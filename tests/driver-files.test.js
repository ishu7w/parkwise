import test from "node:test";
import assert from "node:assert/strict";
import { calendarFile, bookingFile } from "../src/product/driverFiles.js";
const booking = {
  id: "booking-1",
  reference: "PW-ABC123",
  facility_name: "Central Parking",
  address: "Main Road, Pune",
  instructions:
    "Follow posted bay labels.\r\nGate; east, side. " +
    "Entry instructions ".repeat(20),
  plate: "MH12AB1234",
  bay_label: "A01",
  floor: "Ground",
  price: 8000,
  start_at: "2026-10-07T08:00:00Z",
  end_at: "2026-10-07T10:00:00Z",
  latitude: 18.52,
  longitude: 73.85,
  status: "reserved",
};
test("calendar export has UTC times, escaped metadata, folded lines and end reminder", () => {
  const file = calendarFile(booking);
  assert.match(file, /DTSTART:20261007T080000Z/);
  assert.match(file, /DTEND:20261007T100000Z/);
  assert.match(file, /TRIGGER;RELATED=END:-PT15M/);
  assert.match(file, /LOCATION:Main Road\\, Pune/);
  assert.ok(file.endsWith("END:VCALENDAR\r\n"));
  for (const line of file.split("\r\n"))
    assert.ok(Buffer.byteLength(line) <= 75);
  const unfolded = file.replace(/\r\n /g, "");
  assert.match(unfolded, /Gate\\; east\\, side/);
  assert.ok(!unfolded.includes("\r\nGate"));
});
test("booking download includes actual bay, amount and explicit payment boundary", () => {
  const file = bookingFile(booking);
  assert.match(file, /PW-ABC123/);
  assert.match(file, /Bay: A01 · Ground/);
  assert.match(file, /MH12AB1234/);
  assert.match(file, /pay at facility/);
  assert.match(file, /not proof of payment/);
});
