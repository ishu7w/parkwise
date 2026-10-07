import { money, date } from "./api.js";
const escapeCalendar = (value) =>
  String(value)
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
const stamp = (value) =>
  new Date(value)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
function foldCalendarLine(line) {
  let result = "",
    part = "",
    size = 0;
  for (const char of line) {
    const bytes = new TextEncoder().encode(char).length;
    if (size + bytes > 75) {
      result += part + "\r\n";
      part = " ";
      size = 1;
    }
    part += char;
    size += bytes;
  }
  return result + part;
}
export function calendarFile(b) {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Parkwise//Parking//EN",
    "BEGIN:VEVENT",
    "UID:" + b.id + "@parkwise",
    "DTSTAMP:" + stamp(new Date()),
    "DTSTART:" + stamp(b.start_at),
    "DTEND:" + stamp(b.end_at),
    "SUMMARY:" + escapeCalendar("Parking · " + b.facility_name),
    "LOCATION:" + escapeCalendar(b.address),
    "DESCRIPTION:" +
      escapeCalendar(
        `Reference ${b.reference}\nVehicle ${b.plate}\nBay ${b.bay_label} · ${b.floor}\n${b.instructions}\nPay at facility. ${money(b.price)}`,
      ),
    "BEGIN:VALARM",
    "TRIGGER;RELATED=END:-PT15M",
    "ACTION:DISPLAY",
    "DESCRIPTION:Your booked parking ends in 15 minutes",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ]
    .map(foldCalendarLine)
    .join("\r\n");
}
export function bookingFile(b) {
  return `PARKWISE — BOOKING DETAILS\n${b.reference}\nStatus: ${b.status}\n\n${b.facility_name}\n${b.address}\nEntrance: ${b.latitude}, ${b.longitude}\nBay: ${b.bay_label} · ${b.floor}\nVehicle: ${b.plate}\nArrival: ${date(b.start_at)}\nDeparture: ${date(b.end_at)}\nAmount: ${money(b.price)} — pay at facility\n\n${b.instructions}\n\nThis document is a booking record, not proof of payment. Check-in is confirmed by the parking owner.\n`;
}
