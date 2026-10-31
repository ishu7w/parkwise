import test from "node:test";
import assert from "node:assert/strict";
import { facilityLocation } from "../server/location.js";

test("Google Maps location links preserve short links and extract embedded entrance coordinates", () => {
  const short = facilityLocation({
    locationUrl: "https://maps.app.goo.gl/example",
  });
  assert.equal(short.locationUrl, "https://maps.app.goo.gl/example");
  assert.equal(short.latitude, null);
  const full = facilityLocation({
    locationUrl:
      "https://www.google.com/maps/search/?api=1&query=28.463276%2C77.508196",
  });
  assert.equal(full.latitude, 28.463276);
  assert.equal(full.longitude, 77.508196);
  assert.throws(
    () =>
      facilityLocation({ locationUrl: "https://google.com.evil.test/maps" }),
    /Google Maps/,
  );
  assert.throws(
    () => facilityLocation({ locationUrl: "javascript:alert(1)" }),
    /Google Maps/,
  );
  assert.throws(
    () => facilityLocation({ locationUrl: "https://www.google.com/maps/%zz" }),
    /Google Maps/,
  );
});
