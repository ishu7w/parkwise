import { fail, coordinate } from "./security.js";

export function facilityLocation(input, existing = {}) {
  if (input.locationUrl === undefined) {
    return {
      latitude: coordinate(input.latitude, "latitude", -90, 90),
      longitude: coordinate(input.longitude, "longitude", -180, 180),
      locationUrl: existing.location_url || null,
    };
  }
  const value = String(input.locationUrl || "").trim();
  let url;
  try {
    url = new URL(value);
  } catch {
    fail(400, "Paste a valid Google Maps location link.");
  }
  const host = url.hostname.toLowerCase();
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    value.length > 2048 ||
    !(
      ((host === "www.google.com" ||
        host === "google.com" ||
        host === "maps.google.com") &&
        url.pathname.startsWith("/maps")) ||
      host === "maps.app.goo.gl" ||
      (host === "goo.gl" && url.pathname.startsWith("/maps/"))
    )
  )
    fail(400, "Paste a valid Google Maps location link.");
  let decoded;
  try {
    decoded = decodeURIComponent(url.href);
  } catch {
    fail(400, "Paste a valid Google Maps location link.");
  }
  const pair =
    decoded.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/) ||
    decoded.match(
      /(?:[?&](?:query|destination|q)=|@)(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
    );
  let latitude = null,
    longitude = null;
  if (pair) {
    latitude = coordinate(pair[1], "latitude", -90, 90);
    longitude = coordinate(pair[2], "longitude", -180, 180);
  }
  return { latitude, longitude, locationUrl: url.href };
}
