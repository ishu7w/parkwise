import test from "node:test";
import assert from "node:assert/strict";
import { scrypt } from "node:crypto";
import { promisify } from "node:util";
import {
  passwordHash,
  passwordMatches,
  checkOrigin,
} from "../server/security.js";
test("stronger password hashes preserve spaces and support existing legacy hashes", async () => {
  const password = " Spaces-matter-1234 ";
  const encoded = await passwordHash(password);
  assert.ok(encoded.startsWith("s2:"));
  assert.equal(await passwordMatches(password, encoded), true);
  assert.equal(await passwordMatches(password.trim(), encoded), false);
  const salt = "ab".repeat(16);
  const key = await promisify(scrypt)("Legacy-password-1234", salt, 64, {
    N: 32768,
    r: 8,
    p: 2,
    maxmem: 64 * 1024 * 1024,
  });
  assert.equal(
    await passwordMatches(
      "Legacy-password-1234",
      salt + ":" + key.toString("hex"),
    ),
    true,
  );
  assert.equal(await passwordMatches(password, "invalid"), false);
});
test("invalid and cross-site origins are rejected", () => {
  assert.throws(
    () =>
      checkOrigin({ headers: { origin: "not-a-url", host: "example.com" } }),
    (e) => e.status === 403,
  );
  assert.throws(
    () =>
      checkOrigin({
        headers: { "sec-fetch-site": "cross-site", host: "example.com" },
      }),
    (e) => e.status === 403,
  );
  assert.doesNotThrow(() =>
    checkOrigin({
      headers: { origin: "https://example.com", host: "example.com" },
    }),
  );
});
