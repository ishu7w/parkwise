import { randomUUID } from "node:crypto";
import { database } from "./database.js";
import {
  HttpError,
  fail,
  text,
  passwordValue,
  mutationLimit,
  authenticate,
  requireRole,
  passwordHash,
  passwordMatches,
  startSession,
  sessionCookie,
  hashToken,
  tokenFromRequest,
  throttle,
  checkOrigin,
} from "./security.js";
import * as service from "./services.js";
import * as operations from "./operations.js";
import { updateAccount, changePassword } from "./accounts.js";
async function body(req) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) {
    if (Array.isArray(req.body)) fail(400, "Invalid request.");
    if (Buffer.byteLength(JSON.stringify(req.body)) > 20000)
      fail(413, "Request is too large.");
    return req.body;
  }
  if (!(req.headers["content-type"] || "").includes("application/json"))
    fail(415, "Send application/json.");
  let data = "";
  for await (const chunk of req) {
    data += chunk.toString();
    if (Buffer.byteLength(data) > 20000) fail(413, "Request is too large.");
  }
  try {
    const parsed = JSON.parse(data || "{}");
    if (!parsed || Array.isArray(parsed) || typeof parsed !== "object")
      fail(400, "Invalid request.");
    return parsed;
  } catch (e) {
    if (e instanceof HttpError) throw e;
    fail(400, "Invalid JSON request.");
  }
}
function send(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.end(JSON.stringify(data));
}
export default async function handler(req, res) {
  try {
    const url = new URL(req.url, "http://localhost"),
      path = (
        url.pathname === "/api/index" && url.searchParams.has("route")
          ? "/api/" + url.searchParams.get("route")
          : url.pathname
      ).replace(/\/$/, ""),
      method = req.method;
    if (!["GET", "POST", "PATCH"].includes(method))
      fail(405, "Method not allowed.");
    if (method !== "GET") checkOrigin(req);
    const db = await database(),
      user = await authenticate(db, req),
      input =
        method === "GET"
          ? Object.fromEntries(url.searchParams)
          : await body(req);
    if (method !== "GET") await mutationLimit(db, req, user);
    let data;
    if (path === "/api/health" && method === "GET") {
      await db.query("SELECT 1");
      data = { status: "ok", database: "connected" };
    } else if (path === "/api/account" && method === "PATCH") {
      requireRole(user);
      data = await updateAccount(db, user, input);
    } else if (path === "/api/account/password" && method === "POST") {
      requireRole(user);
      data = await changePassword(db, user, input, req, res);
    } else if (path === "/api/owner/report" && method === "GET") {
      requireRole(user, "owner");
      data = await operations.ownerReport(db, user, input);
    } else if (path === "/api/help" && method === "GET") {
      requireRole(user);
      data = await operations.helpInbox(db, user);
    } else if (
      /^\/api\/bookings\/[^/]+\/messages$/.test(path) &&
      ["GET", "POST"].includes(method)
    ) {
      requireRole(user);
      data =
        method === "GET"
          ? await operations.messages(db, user, path.split("/")[3])
          : await operations.sendMessage(db, user, path.split("/")[3], input);
    } else if (
      /^\/api\/bookings\/[^/]+\/help$/.test(path) &&
      method === "PATCH"
    ) {
      requireRole(user);
      data = await operations.resolveHelp(db, user, path.split("/")[3], input);
    } else if (
      /^\/api\/bookings\/[^/]+\/review$/.test(path) &&
      method === "POST"
    ) {
      requireRole(user, "driver");
      data = await operations.review(db, user, path.split("/")[3], input);
    } else if (
      /^\/api\/owner\/bookings\/[^/]+\/payment$/.test(path) &&
      method === "POST"
    ) {
      requireRole(user, "owner");
      data = await operations.recordPayment(
        db,
        user,
        path.split("/")[4],
        input,
      );
    } else if (path === "/api/session" && method === "GET") data = { user };
    else if (
      ["/api/auth/register", "/api/auth/login"].includes(path) &&
      method === "POST"
    ) {
      const email = text(input.email, "Email", 5, 254).toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        fail(400, "Enter a valid email.");
      const password = passwordValue(input.password);
      await throttle(db, req, email);
      let account;
      if (path.endsWith("register")) {
        const name = text(input.name, "Name", 2, 80),
          role = input.role;
        if (!["driver", "owner"].includes(role))
          fail(400, "Choose driver or owner.");
        const id = randomUUID(),
          encoded = await passwordHash(password);
        try {
          await db.query(
            "INSERT INTO users(id,name,email,password,role) VALUES($1,$2,$3,$4,$5)",
            [id, name, email, encoded, role],
          );
        } catch (e) {
          if (e.code === "23505")
            fail(409, "An account already exists for this email.");
          throw e;
        }
        account = { id, name, email, role };
      } else {
        const result = await db.query("SELECT * FROM users WHERE email=$1", [
          email,
        ]);
        account = result.rows[0];
        // Do a password derivation even when the email is unknown.
        const valid = account
          ? await passwordMatches(password, account.password)
          : (await passwordHash(password), false);
        if (!valid) fail(401, "Email or password is incorrect.");
      }
      await startSession(db, account.id, res);
      data = {
        user: {
          id: account.id,
          name: account.name,
          email: account.email,
          role: account.role,
        },
      };
    } else if (path === "/api/auth/logout" && method === "POST") {
      await db.query("DELETE FROM sessions WHERE token=$1", [
        hashToken(tokenFromRequest(req)),
      ]);
      res.setHeader("Set-Cookie", sessionCookie("", 0));
      data = { signedOut: true };
    } else if (path === "/api/facilities" && method === "GET")
      data = await service.publicFacilities(db, input);
    else if (/^\/api\/facilities\/[^/]+$/.test(path) && method === "GET")
      data = {
        ...(await service.publicFacility(db, path.split("/").at(-1), input)),
        reviews: await operations.publicReviews(db, path.split("/").at(-1)),
      };
    else if (path === "/api/driver/garage" && method === "GET") {
      requireRole(user, "driver");
      data = await service.driverGarage(db, user);
    } else if (path === "/api/driver/vehicles" && method === "POST") {
      requireRole(user, "driver");
      data = await service.saveVehicle(db, user, input);
    } else if (
      /^\/api\/driver\/vehicles\/[^/]+\/remove$/.test(path) &&
      method === "POST"
    ) {
      requireRole(user, "driver");
      data = await service.removeVehicle(db, user, path.split("/")[4]);
    } else if (
      /^\/api\/driver\/favorites\/[^/]+$/.test(path) &&
      method === "PATCH"
    ) {
      requireRole(user, "driver");
      data = await service.saveFavorite(
        db,
        user,
        path.split("/").at(-1),
        input.saved,
      );
    } else if (
      /^\/api\/bookings\/[^/]+\/extend$/.test(path) &&
      method === "POST"
    ) {
      requireRole(user, "driver");
      data = await service.extendBooking(db, user, path.split("/")[3], input);
    } else if (path === "/api/bookings" && method === "GET") {
      requireRole(user);
      data = await operations.bookingExtras(
        db,
        await service.bookings(db, user),
      );
    } else if (path === "/api/bookings" && method === "POST") {
      requireRole(user, "driver");
      data = await service.reserve(db, user, input);
    } else if (
      /^\/api\/bookings\/[^/]+\/cancel$/.test(path) &&
      method === "POST"
    ) {
      requireRole(user, "driver");
      data = await service.changeBooking(
        db,
        user,
        path.split("/")[3],
        "cancel",
      );
    } else if (path === "/api/owner/facilities" && method === "GET") {
      requireRole(user, "owner");
      data = await service.ownerFacilities(db, user);
    } else if (path === "/api/owner/facilities" && method === "POST") {
      requireRole(user, "owner");
      data = await service.createFacility(db, user, input);
    } else if (
      /^\/api\/owner\/facilities\/[^/]+$/.test(path) &&
      method === "PATCH"
    ) {
      requireRole(user, "owner");
      data = await service.updateFacility(
        db,
        user,
        path.split("/").at(-1),
        input,
      );
    } else if (path === "/api/owner/bookings" && method === "GET") {
      requireRole(user, "owner");
      data = await operations.bookingExtras(
        db,
        await service.bookings(db, user),
      );
    } else if (
      /^\/api\/owner\/bookings\/[^/]+\/(check-in|check-out)$/.test(path) &&
      method === "POST"
    ) {
      requireRole(user, "owner");
      data = await service.changeBooking(
        db,
        user,
        path.split("/")[4],
        path.split("/").at(-1),
      );
    } else if (/^\/api\/owner\/bays\/[^/]+$/.test(path) && method === "PATCH") {
      requireRole(user, "owner");
      data = await service.maintenance(
        db,
        user,
        path.split("/").at(-1),
        input.blocked,
      );
    } else if (path === "/api/owner/activity" && method === "GET") {
      requireRole(user, "owner");
      const result = await db.query(
        "SELECT a.*,u.name AS actor_name,f.name AS facility_name FROM activity a JOIN facilities f ON f.id=a.facility_id JOIN users u ON u.id=a.actor_id WHERE f.owner_id=$1 ORDER BY a.created_at DESC LIMIT 100",
        [user.id],
      );
      data = result.rows;
    } else fail(404, "Endpoint not found.");
    send(res, 200, { success: true, data });
  } catch (e) {
    const status = e.status || 503;
    if (!e.status) console.error("Parkwise API:", e.message);
    send(res, status, {
      success: false,
      error: e.status
        ? e.message
        : "Parking service is unavailable. Please try again shortly.",
    });
  }
}
