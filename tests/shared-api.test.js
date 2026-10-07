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
test("saved vehicles and facilities persist per driver with role and ownership checks", async () => {
  const second = await register("driver", 3);
  assert.equal((await request("/driver/garage")).status, 401);
  assert.equal(
    (await request("/driver/garage", { cookie: owner.cookie })).status,
    403,
  );
  const saved = await request("/driver/vehicles", {
    cookie: driver.cookie,
    body: { plate: "MH12 AB1234", label: "Daily car" },
  });
  assert.equal(saved.status, 200);
  assert.equal(saved.result.data.plate, "MH12AB1234");
  await request("/driver/vehicles", {
    cookie: driver.cookie,
    body: { plate: "MH12AB1234", label: "Updated car" },
  });
  const garage = await request("/driver/garage", { cookie: driver.cookie });
  assert.equal(garage.result.data.vehicles.length, 1);
  assert.equal(garage.result.data.vehicles[0].label, "Updated car");
  assert.equal(
    (await request("/driver/garage", { cookie: second.cookie })).result.data
      .vehicles.length,
    0,
  );
  assert.equal(
    (
      await request("/driver/vehicles/" + saved.result.data.id + "/remove", {
        cookie: second.cookie,
        body: {},
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await request("/driver/vehicles", {
        cookie: driver.cookie,
        body: { plate: "BAD!", label: "Car" },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request("/driver/favorites/" + facility, {
        cookie: driver.cookie,
        method: "PATCH",
        body: { saved: true },
      })
    ).status,
    200,
  );
  assert.equal(
    (await request("/driver/garage", { cookie: driver.cookie })).result.data
      .favorites[0].id,
    facility,
  );
  assert.equal(
    (await request("/driver/garage", { cookie: second.cookie })).result.data
      .favorites.length,
    0,
  );
  await request("/driver/favorites/" + facility, {
    cookie: driver.cookie,
    method: "PATCH",
    body: { saved: false },
  });
  assert.equal(
    (await request("/driver/garage", { cookie: driver.cookie })).result.data
      .favorites.length,
    0,
  );
  await request("/driver/vehicles/" + saved.result.data.id + "/remove", {
    cookie: driver.cookie,
    body: {},
  });
  assert.equal(
    (await request("/driver/garage", { cookie: driver.cookie })).result.data
      .vehicles.length,
    0,
  );
});
test("extensions preserve booked rates, reach owners, reject conflicts and enforce limits", async () => {
  const d = await register("driver", 4),
    other = await register("driver", 5);
  const details = {
    name: "Extension Parking",
    address: "Extension Road, Pune",
    floor: "Ground",
    instructions: "Enter through the main gate.",
    latitude: 18.52,
    longitude: 73.85,
    hourlyRate: 40,
    standard: 1,
  };
  const f = (
    await request("/owner/facilities", { cookie: owner.cookie, body: details })
  ).result.data.id;
  await request("/owner/facilities/" + f, {
    cookie: owner.cookie,
    method: "PATCH",
    body: { published: true },
  });
  const start = new Date(
    Math.floor(Date.now() / 1000) * 1000 + 5 * 60000,
  ).toISOString();
  const b = (
    await request("/bookings", {
      cookie: d.cookie,
      body: { facilityId: f, plate: "MH12EXT1", startAt: start, duration: 60 },
    })
  ).result.data.id;
  await request("/owner/facilities/" + f, {
    cookie: owner.cookie,
    method: "PATCH",
    body: { ...details, hourlyRate: 90 },
  });
  const extension = await request("/bookings/" + b + "/extend", {
    cookie: d.cookie,
    body: { minutes: 30 },
  });
  assert.equal(extension.status, 200);
  assert.equal(extension.result.data.price, 8000);
  assert.equal(
    Date.parse(extension.result.data.end_at),
    Date.parse(start) + 90 * 60000,
  );
  const ownerRecord = (
    await request("/owner/bookings", { cookie: owner.cookie })
  ).result.data.find((x) => x.id === b);
  assert.equal(ownerRecord.price, 8000);
  assert.equal(ownerRecord.booked_hourly_rate, 4000);
  assert.equal(Date.parse(ownerRecord.end_at), Date.parse(start) + 90 * 60000);
  assert.equal(
    (
      await request("/bookings/" + b + "/extend", {
        cookie: other.cookie,
        body: { minutes: 30 },
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await request("/bookings/" + b + "/extend", {
        cookie: owner.cookie,
        body: { minutes: 30 },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request("/bookings/" + b + "/extend", {
        cookie: d.cookie,
        body: { minutes: 45 },
      })
    ).status,
    400,
  );
  const future = await request("/bookings", {
    cookie: other.cookie,
    body: {
      facilityId: f,
      plate: "MH12EXT2",
      startAt: new Date(Date.parse(start) + 95 * 60000).toISOString(),
      duration: 60,
    },
  });
  assert.equal(future.status, 200);
  assert.equal(
    (
      await request("/bookings/" + b + "/extend", {
        cookie: d.cookie,
        body: { minutes: 30 },
      })
    ).status,
    409,
  );
  assert.equal(
    (await request("/bookings", { cookie: d.cookie })).result.data[0].price,
    8000,
  );
  await request("/bookings/" + future.result.data.id + "/cancel", {
    cookie: other.cookie,
    body: {},
  });
  await request("/owner/bookings/" + b + "/check-in", {
    cookie: owner.cookie,
    body: {},
  });
  assert.equal(
    (
      await request("/bookings/" + b + "/extend", {
        cookie: d.cookie,
        body: { minutes: 30 },
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await request("/owner/activity", { cookie: owner.cookie })
    ).result.data.some((a) => a.message.includes("extended by 30 min")),
    true,
  );
  await request("/owner/bookings/" + b + "/check-out", {
    cookie: owner.cookie,
    body: {},
  });
  assert.equal(
    (
      await request("/bookings/" + b + "/extend", {
        cookie: d.cookie,
        body: { minutes: 30 },
      })
    ).status,
    409,
  );
  const long = (
    await request("/bookings", {
      cookie: d.cookie,
      body: { facilityId: f, plate: "MH12EXT1", duration: 480 },
    })
  ).result.data.id;
  assert.equal(
    (
      await request("/bookings/" + long + "/extend", {
        cookie: d.cookie,
        body: { minutes: 30 },
      })
    ).status,
    400,
  );
});
test("booking help, reviews, payment ledger, reports and account security work together", async () => {
  const d = await register("driver", 6);
  const f = (
    await request("/owner/facilities", {
      cookie: owner.cookie,
      body: {
        name: "Operational Parking",
        address: "Main operational road, Pune",
        floor: "Ground",
        instructions: "Use the east gate.",
        latitude: 18.52,
        longitude: 73.85,
        hourlyRate: 40,
        standard: 1,
      },
    })
  ).result.data.id;
  await request("/owner/facilities/" + f, {
    cookie: owner.cookie,
    method: "PATCH",
    body: { published: true },
  });
  const b = (
    await request("/bookings", {
      cookie: d.cookie,
      body: { facilityId: f, plate: "MH12OPS1", duration: 60 },
    })
  ).result.data.id;
  assert.equal((await request("/health")).result.data.database, "connected");
  assert.equal(
    (
      await request("/bookings/" + b + "/review", {
        cookie: d.cookie,
        body: { rating: 5, comment: "Good parking." },
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await request("/bookings/" + b + "/messages", {
        cookie: d.cookie,
        body: { message: "Which entrance should I use?" },
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await request("/bookings/" + b + "/messages", {
        cookie: otherOwner.cookie,
      })
    ).status,
    404,
  );
  const thread = await request("/bookings/" + b + "/messages", {
    cookie: owner.cookie,
  });
  assert.equal(thread.result.data.messages[0].actor_role, "driver");
  await request("/bookings/" + b + "/help", {
    cookie: owner.cookie,
    method: "PATCH",
    body: { resolved: true },
  });
  assert.equal(
    (
      await request("/bookings/" + b + "/messages", {
        cookie: d.cookie,
        body: { message: "Another question" },
      })
    ).status,
    409,
  );
  await request("/bookings/" + b + "/help", {
    cookie: d.cookie,
    method: "PATCH",
    body: { resolved: false },
  });
  await request("/bookings/" + b + "/messages", {
    cookie: owner.cookie,
    body: { message: "Please use the east entrance." },
  });
  assert.equal(
    (await request("/help", { cookie: d.cookie })).result.data.length,
    1,
  );
  assert.equal(
    (await request("/help", { cookie: otherOwner.cookie })).result.data.length,
    0,
  );
  const payment = { method: "cash", amount: 4000, confirmReceived: true };
  assert.equal(
    (
      await request("/owner/bookings/" + b + "/payment", {
        cookie: owner.cookie,
        body: payment,
      })
    ).status,
    409,
  );
  await request("/owner/bookings/" + b + "/check-in", {
    cookie: owner.cookie,
    body: {},
  });
  assert.equal(
    (
      await request("/owner/bookings/" + b + "/payment", {
        cookie: d.cookie,
        body: payment,
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request("/owner/bookings/" + b + "/payment", {
        cookie: otherOwner.cookie,
        body: payment,
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await request("/owner/bookings/" + b + "/payment", {
        cookie: owner.cookie,
        body: { ...payment, confirmReceived: false },
      })
    ).status,
    400,
  );
  const race = await Promise.all([
    request("/owner/bookings/" + b + "/payment", {
      cookie: owner.cookie,
      body: payment,
    }),
    request("/owner/bookings/" + b + "/payment", {
      cookie: owner.cookie,
      body: payment,
    }),
  ]);
  assert.deepEqual(race.map((x) => x.status).sort(), [200, 409]);
  assert.equal(
    (await request("/bookings", { cookie: d.cookie })).result.data[0]
      .paid_total,
    4000,
  );
  await request("/bookings/" + b + "/extend", {
    cookie: d.cookie,
    body: { minutes: 60 },
  });
  assert.equal(
    (
      await request("/owner/bookings/" + b + "/payment", {
        cookie: owner.cookie,
        body: { ...payment, amount: 8000 },
      })
    ).status,
    409,
  );
  await request("/owner/bookings/" + b + "/payment", {
    cookie: owner.cookie,
    body: { ...payment, method: "upi" },
  });
  const pass = (await request("/bookings", { cookie: d.cookie })).result
    .data[0];
  assert.equal(pass.paid_total, 8000);
  assert.equal(pass.payments.length, 2);
  await request("/owner/bookings/" + b + "/check-out", {
    cookie: owner.cookie,
    body: {},
  });
  assert.equal(
    (
      await request("/bookings/" + b + "/review", {
        cookie: d.cookie,
        body: { rating: 4, comment: "Clear directions and a marked bay." },
      })
    ).status,
    200,
  );
  await request("/bookings/" + b + "/review", {
    cookie: d.cookie,
    body: { rating: 5, comment: "Updated review for my completed stay." },
  });
  const details = (await request("/facilities/" + f)).result.data;
  assert.equal(details.reviews.length, 1);
  assert.equal(details.reviews[0].rating, 5);
  assert.equal(details.reviews[0].driver_name, "Test");
  assert.equal(
    (
      await request("/bookings/" + b + "/review", {
        cookie: owner.cookie,
        body: { rating: 5, comment: "Fake review" },
      })
    ).status,
    403,
  );
  const range = new URLSearchParams({
    from: new Date(Date.now() - 86400000).toISOString(),
    to: new Date(Date.now() + 86400000).toISOString(),
  });
  const report = await request("/owner/report?" + range, {
    cookie: owner.cookie,
  });
  assert.equal(report.status, 200);
  assert.equal(report.result.data.find((x) => x.id === b).paid_total, 8000);
  assert.equal(
    (await request("/owner/report?" + range, { cookie: otherOwner.cookie }))
      .result.data.length,
    0,
  );
  assert.equal(
    (await request("/owner/report?" + range, { cookie: d.cookie })).status,
    403,
  );
  assert.equal(
    (
      await request("/owner/report?from=2020-01-01&to=2026-01-01", {
        cookie: owner.cookie,
      })
    ).status,
    400,
  );
  const profile = await request("/account", {
    cookie: d.cookie,
    method: "PATCH",
    body: { name: "Updated Driver" },
  });
  assert.equal(profile.result.data.user.name, "Updated Driver");
  assert.equal(
    (
      await request("/account/password", {
        cookie: d.cookie,
        body: {
          currentPassword: "Wrong-pass-1234",
          newPassword: "New-strong-pass-1234",
        },
      })
    ).status,
    401,
  );
  const password = await request("/account/password", {
    cookie: d.cookie,
    body: {
      currentPassword: "Strong-pass-1234",
      newPassword: "New-strong-pass-1234",
    },
  });
  assert.equal(password.status, 200);
  assert.equal((await request("/bookings", { cookie: d.cookie })).status, 401);
  assert.equal(
    (await request("/session", { cookie: password.cookie })).result.data.user
      .name,
    "Updated Driver",
  );
  assert.equal(
    (
      await request("/auth/login", {
        body: { email: "driver6@example.test", password: "Strong-pass-1234" },
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await request("/auth/login", {
        body: {
          email: "driver6@example.test",
          password: "New-strong-pass-1234",
        },
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await request("/account", {
        cookie: password.cookie,
        method: "PATCH",
        body: { name: "Hacker" },
        origin: "not-a-url",
      })
    ).status,
    403,
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
