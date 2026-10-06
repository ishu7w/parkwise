import { randomUUID, randomBytes } from "node:crypto";
import { fail, text, integer, coordinate } from "./security.js";
export const categories = ["standard", "accessible", "ev"];
export function bookingWindow(input) {
  const now = Date.now(),
    start = new Date(input.startAt || now),
    duration = integer(input.duration ?? 60, "Duration", 30, 480);
  if (
    !Number.isFinite(start.getTime()) ||
    start.getTime() < now - 120000 ||
    start.getTime() > now + 30 * 86400000
  )
    fail(400, "Choose an arrival between now and 30 days ahead.");
  const category = input.category || "standard";
  if (!categories.includes(category))
    fail(400, "Choose a valid vehicle category.");
  return {
    startAt: start.toISOString(),
    endAt: new Date(start.getTime() + duration * 60000).toISOString(),
    duration,
    category,
  };
}
export async function reconcile(db) {
  await db.query(
    "UPDATE bookings SET status='expired' WHERE status='reserved' AND start_at+interval '30 minutes'<now()",
  );
}
export async function activity(db, facilityId, userId, message) {
  await db.query(
    "INSERT INTO activity(id,facility_id,actor_id,message) VALUES($1,$2,$3,$4)",
    [randomUUID(), facilityId, userId, message],
  );
}
export async function availableBays(db, facilityId, window) {
  const { rows } = await db.query(
    `SELECT b.* FROM bays b WHERE b.facility_id=$1 AND b.category=$2 AND NOT b.blocked AND NOT EXISTS(
 SELECT 1 FROM bookings r WHERE r.bay_id=b.id AND (r.status='parked' OR (r.status='reserved' AND r.start_at<$4 AND r.end_at>$3))) ORDER BY b.label`,
    [facilityId, window.category, window.startAt, window.endAt],
  );
  return rows;
}
export async function publicFacilities(db, input) {
  const window = bookingWindow(input);
  await reconcile(db);
  const q = String(input.q || "").slice(0, 100);
  const { rows } = await db.query(
    "SELECT id,name,address,latitude,longitude,hourly_rate,floor,instructions FROM facilities WHERE published AND (name ILIKE $1 OR address ILIKE $1) ORDER BY created_at DESC LIMIT 100",
    ["%" + q + "%"],
  );
  return Promise.all(
    rows.map(async (f) => ({
      ...f,
      available: (await availableBays(db, f.id, window)).length,
      window,
    })),
  );
}
export async function publicFacility(db, id, input) {
  const { rows } = await db.query(
    "SELECT id,name,address,latitude,longitude,hourly_rate,floor,instructions FROM facilities WHERE id=$1 AND published",
    [id],
  );
  if (!rows[0]) fail(404, "This parking facility is unavailable.");
  const window = bookingWindow(input);
  await reconcile(db);
  return {
    ...rows[0],
    availableBays: await availableBays(db, id, window),
    window,
  };
}
export async function ownerFacility(db, id, user) {
  const { rows } = await db.query(
    "SELECT * FROM facilities WHERE id=$1 AND owner_id=$2 FOR UPDATE",
    [id, user.id],
  );
  if (!rows[0]) fail(404, "Facility not found.");
  return rows[0];
}
export async function createFacility(db, user, input) {
  const name = text(input.name, "Facility name", 3, 80),
    address = text(input.address, "Address", 8, 240),
    floor = text(input.floor, "Floor", 1, 40),
    instructions = text(input.instructions, "Arrival instructions", 5, 1000);
  const latitude = coordinate(input.latitude, "latitude", -90, 90),
    longitude = coordinate(input.longitude, "longitude", -180, 180),
    rate = integer(input.hourlyRate, "Hourly rate", 0, 10000) * 100;
  const counts = categories.map((c) =>
    integer(input[c] ?? 0, `${c} bays`, 0, 100),
  );
  if (
    counts.reduce((a, b) => a + b, 0) < 1 ||
    counts.reduce((a, b) => a + b, 0) > 150
  )
    fail(400, "Create between 1 and 150 bays.");
  return db.transaction(async (tx) => {
    const id = randomUUID();
    await tx.query(
      "INSERT INTO facilities(id,owner_id,name,address,latitude,longitude,hourly_rate,floor,instructions) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)",
      [
        id,
        user.id,
        name,
        address,
        latitude,
        longitude,
        rate,
        floor,
        instructions,
      ],
    );
    for (let c = 0; c < categories.length; c++)
      for (let i = 1; i <= counts[c]; i++)
        await tx.query(
          "INSERT INTO bays(id,facility_id,label,category) VALUES($1,$2,$3,$4)",
          [
            randomUUID(),
            id,
            `${["A", "D", "E"][c]}${String(i).padStart(2, "0")}`,
            categories[c],
          ],
        );
    await activity(tx, id, user.id, "Facility created · unpublished");
    return { id };
  });
}
export async function reserve(db, user, input) {
  const window = bookingWindow(input),
    facilityId = text(input.facilityId, "Facility ID", 1, 60),
    plate = text(input.plate, "Vehicle plate", 3, 15)
      .toUpperCase()
      .replace(/[ -]/g, "");
  if (!/^[A-Z0-9]{3,15}$/.test(plate))
    fail(400, "Enter a valid vehicle plate.");
  await reconcile(db);
  return db.transaction(async (tx) => {
    // The driver lock prevents concurrent overlapping reservations across different facilities.
    await tx.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [user.id]);
    const { rows } = await tx.query(
      "SELECT * FROM facilities WHERE id=$1 AND published FOR UPDATE",
      [facilityId],
    );
    const facility = rows[0];
    if (!facility) fail(404, "Facility is no longer accepting bookings.");
    const overlap = await tx.query(
      "SELECT id FROM bookings WHERE driver_id=$1 AND plate=$2 AND (status='parked' OR (status='reserved' AND start_at<$4 AND end_at>$3))",
      [user.id, plate, window.startAt, window.endAt],
    );
    if (overlap.rows.length)
      fail(409, "This vehicle already has an overlapping booking.");
    const bays = await availableBays(tx, facilityId, window);
    if (!bays.length)
      fail(
        409,
        "The last compatible bay was just booked. Choose another time or facility.",
      );
    const id = randomUUID(),
      reference = "PW-" + randomBytes(5).toString("hex").toUpperCase(),
      price = Math.ceil(window.duration / 60) * facility.hourly_rate;
    await tx.query(
      "INSERT INTO bookings(id,reference,facility_id,bay_id,driver_id,plate,start_at,end_at,status,price) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'reserved',$9)",
      [
        id,
        reference,
        facilityId,
        bays[0].id,
        user.id,
        plate,
        window.startAt,
        window.endAt,
        price,
      ],
    );
    await activity(
      tx,
      facilityId,
      user.id,
      `${reference} booked · ${plate} → ${bays[0].label}`,
    );
    return { id, reference };
  });
}
const bookingSelect = `SELECT r.*,f.name AS facility_name,f.address,f.latitude,f.longitude,f.floor,f.instructions,b.label AS bay_label,b.category,u.name AS driver_name FROM bookings r JOIN facilities f ON f.id=r.facility_id JOIN bays b ON b.id=r.bay_id JOIN users u ON u.id=r.driver_id`;
export async function bookings(db, user) {
  await reconcile(db);
  const { rows } = await db.query(
    bookingSelect +
      (user.role === "owner"
        ? " WHERE f.owner_id=$1"
        : " WHERE r.driver_id=$1") +
      " ORDER BY r.created_at DESC LIMIT 500",
    [user.id],
  );
  const facilities = [...new Set(rows.map((r) => r.facility_id))];
  if (!facilities.length) return rows;
  const plan = await db.query(
    "SELECT id,facility_id,label,category FROM bays WHERE facility_id=ANY($1::text[]) ORDER BY label",
    [facilities],
  );
  return rows.map((r) => ({
    ...r,
    floor_plan: plan.rows.filter((b) => b.facility_id === r.facility_id),
  }));
}
export async function changeBooking(db, user, id, action) {
  const existing = await db.query(
    "SELECT facility_id FROM bookings WHERE id=$1",
    [id],
  );
  if (!existing.rows[0]) fail(404, "Booking not found.");
  return db.transaction(async (tx) => {
    const f = await tx.query(
      "SELECT * FROM facilities WHERE id=$1 FOR UPDATE",
      [existing.rows[0].facility_id],
    );
    const facility = f.rows[0];
    await reconcile(tx);
    const { rows } = await tx.query(
      "SELECT r.*,b.label FROM bookings r JOIN bays b ON b.id=r.bay_id WHERE r.id=$1 FOR UPDATE",
      [id],
    );
    const r = rows[0];
    if (action === "cancel") {
      if (r.driver_id !== user.id) fail(404, "Booking not found.");
      if (r.status !== "reserved")
        fail(409, "Only an upcoming reservation can be cancelled.");
      await tx.query("UPDATE bookings SET status='cancelled' WHERE id=$1", [
        id,
      ]);
    } else {
      if (facility.owner_id !== user.id) fail(404, "Booking not found.");
      if (action === "check-in") {
        if (r.status !== "reserved")
          fail(409, "This reservation is not available for check-in.");
        if (Date.parse(r.start_at) > Date.now() + 15 * 60000)
          fail(409, "Check-in opens 15 minutes before the booked arrival.");
        const conflict = await tx.query(
          "SELECT id FROM bookings WHERE bay_id=$1 AND id<>$2 AND status='parked'",
          [r.bay_id, id],
        );
        if (conflict.rows.length)
          fail(
            409,
            "The assigned bay is still occupied. Check out the previous vehicle first.",
          );
        await tx.query(
          "UPDATE bookings SET status='parked',checked_in_at=now() WHERE id=$1",
          [id],
        );
      } else if (action === "check-out") {
        if (r.status !== "parked")
          fail(409, "Only a checked-in vehicle can be checked out.");
        await tx.query(
          "UPDATE bookings SET status='completed',checked_out_at=now() WHERE id=$1",
          [id],
        );
      } else fail(400, "Unknown action.");
    }
    await activity(
      tx,
      facility.id,
      user.id,
      `${r.reference} ${action} · ${r.plate} · bay ${r.label}`,
    );
    return { id };
  });
}
export async function ownerFacilities(db, user) {
  await reconcile(db);
  const { rows } = await db.query(
    "SELECT * FROM facilities WHERE owner_id=$1 ORDER BY created_at DESC",
    [user.id],
  );
  return Promise.all(
    rows.map(async (f) => {
      const bays = await db.query(
        `SELECT b.*,r.id AS booking_id,r.plate,r.status AS booking_status FROM bays b LEFT JOIN bookings r ON r.bay_id=b.id AND (r.status='parked' OR (r.status='reserved' AND r.start_at<=now() AND r.end_at>now())) WHERE b.facility_id=$1 ORDER BY b.label`,
        [f.id],
      );
      return { ...f, bays: bays.rows };
    }),
  );
}
export async function maintenance(db, user, id, blocked) {
  if (typeof blocked !== "boolean") fail(400, "Choose a valid bay status.");
  const result = await db.query("SELECT facility_id FROM bays WHERE id=$1", [
    id,
  ]);
  if (!result.rows[0]) fail(404, "Bay not found.");
  return db.transaction(async (tx) => {
    const f = await ownerFacility(tx, result.rows[0].facility_id, user);
    const conflict = await tx.query(
      "SELECT id FROM bookings WHERE bay_id=$1 AND (status='parked' OR (status='reserved' AND end_at>now()))",
      [id],
    );
    if (blocked && conflict.rows.length)
      fail(
        409,
        "This bay has an active or upcoming booking. Release the booking before blocking it.",
      );
    await tx.query("UPDATE bays SET blocked=$1 WHERE id=$2", [blocked, id]);
    await activity(
      tx,
      f.id,
      user.id,
      `Bay ${blocked ? "blocked for maintenance" : "reopened"}`,
    );
    return { id };
  });
}

export async function updateFacility(db, user, id, input) {
  return db.transaction(async (tx) => {
    const f = await ownerFacility(tx, id, user);
    if (Object.hasOwn(input, "published")) {
      if (typeof input.published !== "boolean")
        fail(400, "Choose a publication status.");
      await tx.query("UPDATE facilities SET published=$1 WHERE id=$2", [
        input.published,
        id,
      ]);
      await activity(
        tx,
        id,
        user.id,
        input.published ? "Facility published" : "Facility unpublished",
      );
    } else {
      const name = text(input.name, "Facility name", 3, 80),
        address = text(input.address, "Address", 8, 240),
        floor = text(input.floor, "Floor", 1, 40),
        instructions = text(
          input.instructions,
          "Arrival instructions",
          5,
          1000,
        ),
        latitude = coordinate(input.latitude, "latitude", -90, 90),
        longitude = coordinate(input.longitude, "longitude", -180, 180),
        rate = integer(input.hourlyRate, "Hourly rate", 0, 10000) * 100;
      await tx.query(
        "UPDATE facilities SET name=$1,address=$2,floor=$3,instructions=$4,latitude=$5,longitude=$6,hourly_rate=$7 WHERE id=$8",
        [name, address, floor, instructions, latitude, longitude, rate, id],
      );
      await activity(
        tx,
        f.id,
        user.id,
        "Facility details updated · existing booking amounts preserved",
      );
    }
    return { id };
  });
}
