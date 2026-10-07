import test from "node:test";
import assert from "node:assert/strict";
import { reportCsv } from "../src/product/reportFiles.js";
test("CSV escapes quotes, protects spreadsheet formulas and distinguishes receipts from booked price", () => {
  const csv = reportCsv([
    {
      reference: "PW-X",
      facility_name: '=HYPERLINK("bad")',
      plate: "MH12AB1234",
      driver_name: "Driver",
      start_at: "2026-10-07T10:00:00Z",
      end_at: "2026-10-07T11:00:00Z",
      status: "completed",
      price: 8000,
      paid_total: 4000,
    },
  ]);
  assert.match(csv, /Booked amount INR/);
  assert.match(csv, /Recorded payments INR/);
  assert.match(csv, /"'=HYPERLINK\(""bad""\)"/);
  assert.ok(csv.endsWith('"80.00","40.00","40.00"'));
});
