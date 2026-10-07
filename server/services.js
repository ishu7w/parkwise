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
    `SELECT f.id,f.name,f.address,f.latitude,f.longitude,f.hourly_rate,f.floor,f.instructions,
     (SELECT count(*)::int FROM bays b WHERE b.facility_id=f.id AND b.category=$2 AND NOT b.blocked AND NOT EXISTS(SELECT 1 FROM bookings r WHERE r.bay_id=b.id AND (r.status='parked' OR (r.status='reserved' AND r.start_at<$4 AND r.end_at>$3)))) AS available
     FROM facilities f WHERE f.published AND (f.name ILIKE $1 OR f.address ILIKE $1) ORDER BY f.created_at DESC LIMIT 100`,
    ["%" + q + "%", window.category, window.startAt, window.endAt],
  );
  return rows.map((f) => ({ ...f, window }));
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
    await tx.query("SELECT id FROM users WHERE id=$1 FOR NO KEY UPDATE", [
      user.id,
    ]);
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
      "INSERT INTO bookings(id,reference,facility_id,bay_id,driver_id,plate,start_at,end_at,status,price,booked_hourly_rate) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'reserved',$9,$10)",
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
        facility.hourly_rate,
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

export function vehiclePlate(value) {
  const plate = text(value, "Vehicle plate", 3, 15)
    .toUpperCase()
    .replace(/[ -]/g, "");
  if (!/^[A-Z0-9]{3,15}$/.test(plate))
    fail(400, "Enter a valid vehicle plate.");
  return plate;
}
export async function driverGarage(db, user) {
  const vehicles = await db.query(
    "SELECT id,plate,label FROM vehicles WHERE driver_id=$1 ORDER BY label,plate",
    [user.id],
  );
  const favorites = await db.query(
    "SELECT f.id,f.name,f.address,f.hourly_rate,f.published FROM favorites s JOIN facilities f ON f.id=s.facility_id WHERE s.driver_id=$1 ORDER BY f.name",
    [user.id],
  );
  return { vehicles: vehicles.rows, favorites: favorites.rows };
}
export async function saveVehicle(db, user, input) {
  const plate = vehiclePlate(input.plate),
    label = text(input.label, "Vehicle name", 1, 50);
  const { rows } = await db.query(
    "INSERT INTO vehicles(id,driver_id,plate,label) VALUES($1,$2,$3,$4) ON CONFLICT(driver_id,plate) DO UPDATE SET label=EXCLUDED.label RETURNING id,plate,label",
    [randomUUID(), user.id, plate, label],
  );
  return rows[0];
}
export async function removeVehicle(db, user, id) {
  const result = await db.query(
    "DELETE FROM vehicles WHERE id=$1 AND driver_id=$2 RETURNING id",
    [id, user.id],
  );
  if (!result.rows.length) fail(404, "Vehicle not found.");
  return { id };
}
export async function saveFavorite(db, user, id, saved) {
  if (typeof saved !== "boolean") fail(400, "Choose a saved parking status.");
  if (saved) {
    const facility = await db.query(
      "SELECT id FROM facilities WHERE id=$1 AND published",
      [id],
    );
    if (!facility.rows.length)
      fail(404, "This parking facility is unavailable.");
    await db.query(
      "INSERT INTO favorites(driver_id,facility_id) VALUES($1,$2) ON CONFLICT DO NOTHING",
      [user.id, id],
    );
  } else
    await db.query(
      "DELETE FROM favorites WHERE driver_id=$1 AND facility_id=$2",
      [user.id, id],
    );
  return { id, saved };
}
export async function extendBooking(db, user, id, input) {
  const minutes = integer(input.minutes, "Extra time", 30, 120);
  if (![30, 60, 120].includes(minutes))
    fail(400, "Choose 30, 60 or 120 extra minutes.");
  const existing = await db.query(
    "SELECT facility_id FROM bookings WHERE id=$1 AND driver_id=$2",
    [id, user.id],
  );
  if (!existing.rows.length) fail(404, "Booking not found.");
  return db.transaction(async (tx) => {
    // Use the same driver → facility lock order as reservation creation.
    await tx.query("SELECT id FROM users WHERE id=$1 FOR NO KEY UPDATE", [
      user.id,
    ]);
    await tx.query("SELECT id FROM facilities WHERE id=$1 FOR UPDATE", [
      existing.rows[0].facility_id,
    ]);
    await reconcile(tx);
    const { rows } = await tx.query(
      "SELECT * FROM bookings WHERE id=$1 AND driver_id=$2 FOR UPDATE",
      [id, user.id],
    );
    const b = rows[0],
      end = new Date(Date.parse(b.end_at) + minutes * 60000);
    if (!["reserved", "parked"].includes(b.status))
      fail(409, "Only reserved or checked-in parking can be extended.");
    if (Date.parse(b.end_at) <= Date.now())
      fail(
        409,
        "The booked departure has passed. Please speak to the attendant.",
      );
    const duration = Math.round(
      (end.getTime() - Date.parse(b.start_at)) / 60000,
    );
    if (duration > 480) fail(400, "A booking can cover up to 8 hours.");
    const conflict = await tx.query(
      "SELECT id FROM bookings WHERE id<>$1 AND (bay_id=$2 OR (driver_id=$3 AND plate=$4)) AND (status='parked' OR (status='reserved' AND start_at<$6 AND end_at>$5))",
      [id, b.bay_id, user.id, b.plate, b.end_at, end.toISOString()],
    );
    if (conflict.rows.length)
      fail(
        409,
        "Extra time is unavailable: the bay or vehicle has another booking. Your current booking is unchanged.",
      );
    const price = Math.ceil(duration / 60) * b.booked_hourly_rate;
    await tx.query("UPDATE bookings SET end_at=$1,price=$2 WHERE id=$3", [
      end.toISOString(),
      price,
      id,
    ]);
    await activity(
      tx,
      b.facility_id,
      user.id,
      `${b.reference} extended by ${minutes} min · ${b.plate}`,
    );
    return { id, end_at: end.toISOString(), price };
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
