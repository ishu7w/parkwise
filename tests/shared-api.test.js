import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
process.env.LOCAL_DATABASE_PATH = "memory://";
const { default: handler } = await import("../server/app.js");
const { database } = await import("../server/database.js");
const server = http.createServer(handler);
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = "http://127.0.0.1:" + server.address().port;
async function request(
  path,
  { cookie, body, method = body ? "POST" : "GET", origin } = {},
) {
  const r = await fetch(base + "/api" + path, {
    method,
    headers: {
      ...(cookie ? { cookie } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(origin ? { origin } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return {
    status: r.status,
    cookie: r.headers.get("set-cookie")?.split(";")[0],
    result: await r.json(),
  };
}
async function register(role, index) {
  const r = await request("/auth/register", {
    body: {
      name: "Test " + role + " " + index,
      email: role + index + "@example.test",
      password: "Strong-pass-1234",
      role,
    },
  });
  assert.equal(r.status, 200);
  return r;
}
let owner, driver, otherOwner, facility, bayIds;
test("real accounts have separate server-enforced roles and opaque sessions", async () => {
  owner = await register("owner", 1);
  driver = await register("driver", 1);
  otherOwner = await register("owner", 2);
  assert.equal(
    (await request("/session", { cookie: owner.cookie })).result.data.user.role,
    "owner",
  );
  assert.equal(
    (await request("/index?route=session", { cookie: owner.cookie })).result
      .data.user.role,
    "owner",
  );
  assert.equal(
    (await request("/owner/facilities", { cookie: driver.cookie })).status,
    403,
  );
  assert.equal((await request("/owner/facilities")).status, 401);
  assert.equal(
    (
      await request("/auth/login", {
        body: { email: "driver1@example.test", password: "wrong-password" },
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await request("/auth/register", {
        body: {
          name: "Bad",
          email: "bad@example.test",
          password: "short",
          role: "driver",
        },
      })
    ).status,
    400,
  );
});
test("owner publication exposes actual facility and available categories", async () => {
  const r = await request("/owner/facilities", {
    cookie: owner.cookie,
    body: {
      name: "Real Test Parking",
      address: "Test Road, Pune, Maharashtra",
      latitude: 18.52,
      longitude: 73.85,
      hourlyRate: 40,
      floor: "Ground level",
      instructions: "Enter the east vehicle gate and follow posted bay labels.",
      standard: 1,
      accessible: 1,
      ev: 0,
    },
  });
  assert.equal(r.status, 200);
  facility = r.result.data.id;
  assert.equal((await request("/facilities")).result.data.length, 0);
  assert.equal(
    (
      await request("/owner/facilities/" + facility, {
        cookie: otherOwner.cookie,
        method: "PATCH",
        body: { published: true },
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await request("/owner/facilities/" + facility, {
        cookie: owner.cookie,
        method: "PATCH",
        body: { published: true },
      })
    ).status,
    200,
  );
  const listing = (await request("/facilities")).result.data[0];
  assert.equal(listing.available, 1);
  assert.equal(listing.name, "Real Test Parking");
  bayIds = (await request("/owner/facilities", { cookie: owner.cookie })).result
    .data[0].bays;
});
let booking;
test("driver reservation appears for owner and owner updates return to driver", async () => {
  const r = await request("/bookings", {
    cookie: driver.cookie,
    body: { facilityId: facility, plate: "MH12 AB1234", duration: 60 },
  });
  assert.equal(r.status, 200);
  booking = r.result.data.id;
  const ownerBookings = (
    await request("/owner/bookings", { cookie: owner.cookie })
  ).result.data;
  assert.equal(ownerBookings[0].id, booking);
  assert.equal(ownerBookings[0].bay_label, "A01");
  assert.equal(ownerBookings[0].price, 4000);
  assert.equal(
    (await request("/owner/bookings", { cookie: otherOwner.cookie })).result
      .data.length,
    0,
  );
  assert.equal(
    (
      await request("/owner/bookings/" + booking + "/check-in", {
        cookie: otherOwner.cookie,
        body: {},
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await request("/owner/bookings/" + booking + "/check-in", {
        cookie: owner.cookie,
        body: {},
      })
    ).status,
    200,
  );
  assert.equal(
    (await request("/bookings", { cookie: driver.cookie })).result.data[0]
      .status,
    "parked",
  );
  assert.equal(
    (
      await request("/bookings/" + booking + "/cancel", {
        cookie: driver.cookie,
        body: {},
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await request("/owner/bookings/" + booking + "/check-out", {
        cookie: owner.cookie,
        body: {},
      })
    ).status,
    200,
  );
  assert.equal(
    (await request("/bookings", { cookie: driver.cookie })).result.data[0]
      .status,
    "completed",
  );
});
test("owner details edits propagate and preserve existing booking amounts", async () => {
  const r = await request("/owner/facilities/" + facility, {
    cookie: owner.cookie,
    method: "PATCH",
    body: {
      name: "Updated Real Parking",
      address: "Test Road, Pune, Maharashtra",
      latitude: 18.52,
      longitude: 73.85,
      hourlyRate: 80,
      floor: "Ground level",
      instructions: "Use the east vehicle entrance and posted bay labels.",
    },
  });
  assert.equal(r.status, 200);
  const pass = (
    await request("/bookings", { cookie: driver.cookie })
  ).result.data.find((b) => b.id === booking);
  assert.equal(pass.price, 4000);
  assert.equal(pass.facility_name, "Updated Real Parking");
  assert.ok(pass.floor_plan.length === 2);
});
test("simultaneous last-bay bookings admit one driver, cancellation releases bay", async () => {
  const second = await register("driver", 2);
  const payload = { facilityId: facility, duration: 60 };
  const results = await Promise.all([
    request("/bookings", {
      cookie: driver.cookie,
      body: { ...payload, plate: "RACEONE" },
    }),
    request("/bookings", {
      cookie: second.cookie,
      body: { ...payload, plate: "RACETWO" },
    }),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
  const winner = results.findIndex((r) => r.status === 200),
    id = results[winner].result.data.id,
    cookie = winner === 0 ? driver.cookie : second.cookie;
  assert.equal(
    (
      await request(
        "/owner/bays/" + bayIds.find((b) => b.category === "standard").id,
        { cookie: owner.cookie, method: "PATCH", body: { blocked: true } },
      )
    ).status,
    409,
  );
  assert.equal(
    (await request("/bookings/" + id + "/cancel", { cookie, body: {} })).status,
    200,
  );
  assert.equal((await request("/facilities")).result.data[0].available, 1);
});
test("maintenance excludes bay and CSRF origin is rejected", async () => {
  const id = bayIds.find((b) => b.category === "standard").id;
  assert.equal(
    (
      await request("/owner/bays/" + id, {
        cookie: owner.cookie,
        method: "PATCH",
        body: { blocked: true },
      })
    ).status,
    200,
  );
  assert.equal((await request("/facilities")).result.data[0].available, 0);
  assert.equal(
    (
      await request("/bookings", {
        cookie: driver.cookie,
        body: { facilityId: facility, plate: "BLOCK123", duration: 60 },
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await request("/owner/bays/" + id, {
        cookie: owner.cookie,
        method: "PATCH",
        body: { blocked: false },
        origin: "https://evil.example",
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request("/owner/bays/" + id, {
        cookie: owner.cookie,
        method: "PATCH",
        body: { blocked: false },
      })
    ).status,
    200,
  );
});
test("grace expiry and future check-in protect operational state", async () => {
  const r = await request("/bookings", {
    cookie: driver.cookie,
    body: { facilityId: facility, plate: "EXPIRE12", duration: 60 },
  });
  assert.equal(r.status, 200);
  const db = await database();
  await db.query(
    "UPDATE bookings SET start_at=now()-interval '40 minutes',end_at=now()+interval '20 minutes' WHERE id=$1",
    [r.result.data.id],
  );
  const own = (await request("/bookings", { cookie: driver.cookie })).result
    .data;
  assert.equal(own.find((b) => b.id === r.result.data.id).status, "expired");
  const future = await request("/bookings", {
    cookie: driver.cookie,
    body: {
      facilityId: facility,
      plate: "FUTURE12",
      duration: 60,
      startAt: new Date(Date.now() + 86400000).toISOString(),
    },
  });
  assert.equal(future.status, 200);
  assert.equal(
    (
      await request("/owner/bookings/" + future.result.data.id + "/check-in", {
        cookie: owner.cookie,
        body: {},
      })
    ).status,
    409,
  );
});
test("sign-out invalidates the server session and activity is owner scoped", async () => {
  assert.ok(
    (await request("/owner/activity", { cookie: owner.cookie })).result.data
      .length > 4,
  );
  assert.equal(
    (await request("/owner/activity", { cookie: otherOwner.cookie })).result
      .data.length,
    0,
  );
  await request("/auth/logout", { cookie: driver.cookie, body: {} });
  assert.equal(
    (await request("/bookings", { cookie: driver.cookie })).status,
    401,
  );
});
test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await (await database()).close();
});
