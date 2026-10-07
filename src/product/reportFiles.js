const safeCell = (v) => {
  let s = String(v ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
};
export function reportCsv(records) {
  return [
    [
      "Reference",
      "Facility",
      "Vehicle",
      "Driver",
      "Arrival",
      "Departure",
      "Status",
      "Booked amount INR",
      "Recorded payments INR",
      "Balance INR",
    ],
    ...records.map((b) => [
      b.reference,
      b.facility_name,
      b.plate,
      b.driver_name,
      b.start_at,
      b.end_at,
      b.status,
      (b.price / 100).toFixed(2),
      (b.paid_total / 100).toFixed(2),
      ((b.price - b.paid_total) / 100).toFixed(2),
    ]),
  ]
    .map((row) => row.map(safeCell).join(","))
    .join("\r\n");
}
