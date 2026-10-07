import { randomUUID } from "node:crypto";
import { fail, text, integer } from "./security.js";
import { activity } from "./services.js";

export async function accessibleBooking(db, user, id, lock = false) {
  if (lock) {
    const existing = await accessibleBooking(db, user, id);
    await db.query("SELECT id FROM facilities WHERE id=$1 FOR UPDATE", [
      existing.facility_id,
    ]);
  }
  const { rows } = await db.query(
    `SELECT b.*,f.owner_id,f.name AS facility_name,u.name AS driver_name FROM bookings b JOIN facilities f ON f.id=b.facility_id JOIN users u ON u.id=b.driver_id WHERE b.id=$1 AND (b.driver_id=$2 OR f.owner_id=$2)${lock ? " FOR UPDATE OF b" : ""}`,
    [id, user.id],
  );
  if (!rows[0]) fail(404, "Booking not found.");
  return rows[0];
}
export async function messages(db, user, id) {
  const booking = await accessibleBooking(db, user, id);
  const { rows } = await db.query(
    "SELECT m.id,m.message,m.created_at,u.name AS actor_name,u.role AS actor_role FROM booking_messages m JOIN users u ON u.id=m.actor_id WHERE m.booking_id=$1 ORDER BY m.created_at LIMIT 200",
    [id],
  );
  return { booking, messages: rows };
}
export async function sendMessage(db, user, id, input) {
  const message = text(input.message, "Message", 2, 1000);
  return db.transaction(async (tx) => {
    const b = await accessibleBooking(tx, user, id, true);
    if (b.help_resolved_at)
      fail(
        409,
        "This conversation is resolved. Reopen it to send another message.",
      );
    const count = await tx.query(
      "SELECT count(*)::int AS count FROM booking_messages WHERE booking_id=$1",
      [id],
    );
    if (count.rows[0].count >= 200)
      fail(
        409,
        "This conversation reached its message limit. Please contact the attendant directly.",
      );
    const messageId = randomUUID();
    await tx.query(
      "INSERT INTO booking_messages(id,booking_id,actor_id,message) VALUES($1,$2,$3,$4)",
      [messageId, id, user.id, message],
    );
    await activity(
      tx,
      b.facility_id,
      user.id,
      `${b.reference} · booking help message`,
    );
    return { id: messageId };
  });
}
export async function resolveHelp(db, user, id, input) {
  if (typeof input.resolved !== "boolean")
    fail(400, "Choose a valid conversation status.");
  return db.transaction(async (tx) => {
    const b = await accessibleBooking(tx, user, id, true);
    await tx.query("UPDATE bookings SET help_resolved_at=$1 WHERE id=$2", [
      input.resolved ? new Date().toISOString() : null,
      id,
    ]);
    await activity(
      tx,
      b.facility_id,
      user.id,
      `${b.reference} · help ${input.resolved ? "resolved" : "reopened"}`,
    );
    return { id };
  });
}
export async function helpInbox(db, user) {
  const { rows } = await db.query(
    `SELECT b.id,b.reference,b.plate,b.help_resolved_at,f.name AS facility_name,u.name AS driver_name, max(m.created_at) AS last_message_at,count(m.id)::int AS message_count FROM bookings b JOIN facilities f ON f.id=b.facility_id JOIN users u ON u.id=b.driver_id JOIN booking_messages m ON m.booking_id=b.id WHERE ${user.role === "owner" ? "f.owner_id" : "b.driver_id"}=$1 GROUP BY b.id,f.name,u.name ORDER BY max(m.created_at) DESC LIMIT 100`,
    [user.id],
  );
  return rows;
}
export async function review(db, user, id, input) {
  const rating = integer(input.rating, "Rating", 1, 5),
    comment = text(input.comment, "Review", 5, 500);
  return db.transaction(async (tx) => {
    const b = await accessibleBooking(tx, user, id, true);
    if (b.driver_id !== user.id) fail(404, "Booking not found.");
    if (b.status !== "completed")
      fail(409, "Reviews are available after a completed parking stay.");
    await tx.query(
      "INSERT INTO booking_reviews(booking_id,rating,comment) VALUES($1,$2,$3) ON CONFLICT(booking_id) DO UPDATE SET rating=EXCLUDED.rating,comment=EXCLUDED.comment",
      [id, rating, comment],
    );
    return { id };
  });
}
export async function recordPayment(db, user, id, input) {
  if (!["cash", "upi", "card"].includes(input.method))
    fail(400, "Choose cash, UPI or card.");
  if (input.confirmReceived !== true)
    fail(400, "Confirm that this payment has actually been received.");
  const expected = integer(input.amount, "Amount", 1, 8000000);
  return db.transaction(async (tx) => {
    const b = await accessibleBooking(tx, user, id, true);
    if (b.owner_id !== user.id) fail(404, "Booking not found.");
    if (!["parked", "completed"].includes(b.status))
      fail(409, "Record payment after confirming arrival.");
    const { rows } = await tx.query(
      "SELECT COALESCE(sum(amount),0)::int AS paid FROM booking_payments WHERE booking_id=$1",
      [id],
    );
    const due = b.price - rows[0].paid;
    if (due <= 0) fail(409, "The booking balance is already paid.");
    if (expected !== due)
      fail(
        409,
        "The balance changed. Refresh the booking and confirm the current amount.",
      );
    const paymentId = randomUUID();
    await tx.query(
      "INSERT INTO booking_payments(id,booking_id,actor_id,amount,method) VALUES($1,$2,$3,$4,$5)",
      [paymentId, id, user.id, due, input.method],
    );
    await activity(
      tx,
      b.facility_id,
      user.id,
      `${b.reference} · payment received INR ${(due / 100).toFixed(2)} · ${input.method}`,
    );
    return { id: paymentId, amount: due };
  });
}
export async function bookingExtras(db, records) {
  const ids = records.map((b) => b.id);
  if (!ids.length) return records;
  const payments = await db.query(
    "SELECT id,booking_id,amount,method,created_at FROM booking_payments WHERE booking_id=ANY($1::text[]) ORDER BY created_at",
    [ids],
  );
  const reviews = await db.query(
    "SELECT * FROM booking_reviews WHERE booking_id=ANY($1::text[])",
    [ids],
  );
  return records.map((b) => ({
    ...b,
    payments: payments.rows.filter((p) => p.booking_id === b.id),
    paid_total: payments.rows
      .filter((p) => p.booking_id === b.id)
      .reduce((n, p) => n + p.amount, 0),
    review: reviews.rows.find((r) => r.booking_id === b.id) || null,
  }));
}
export async function publicReviews(db, facilityId) {
  const { rows } = await db.query(
    "SELECT r.rating,r.comment,r.created_at,split_part(regexp_replace(u.name,'[[:space:]]+',' ','g'),' ',1) AS driver_name FROM booking_reviews r JOIN bookings b ON b.id=r.booking_id JOIN users u ON u.id=b.driver_id WHERE b.facility_id=$1 AND b.status='completed' ORDER BY r.created_at DESC LIMIT 20",
    [facilityId],
  );
  return rows;
}
export async function ownerReport(db, user, input) {
  const from = new Date(input.from),
    to = new Date(input.to);
  if (
    !Number.isFinite(from.getTime()) ||
    !Number.isFinite(to.getTime()) ||
    to <= from ||
    to - from > 31 * 86400000
  )
    fail(400, "Choose a report range of up to 31 days.");
  const { rows } = await db.query(
    "SELECT b.*,f.name AS facility_name,u.name AS driver_name FROM bookings b JOIN facilities f ON f.id=b.facility_id JOIN users u ON u.id=b.driver_id WHERE f.owner_id=$1 AND b.start_at>=$2 AND b.start_at<$3 ORDER BY b.start_at DESC LIMIT 10001",
    [user.id, from.toISOString(), to.toISOString()],
  );
  if (rows.length > 10000)
    fail(
      400,
      "This report exceeds 10,000 bookings. Choose a shorter date range.",
    );
  return bookingExtras(db, rows);
}
