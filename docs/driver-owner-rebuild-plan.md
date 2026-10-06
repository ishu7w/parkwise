# Parkwise: driver and owner rebuild

Plan dated 6 October 2026. Build a usable parking service with two authenticated workspaces and a shared source of truth. The existing visual direction stays Paper/Forest with structural grids, large readable type and purposeful motion.

## 1. Product and differentiation

The distinctive workflow is an entrance-to-bay pass. Booking assigns an actual bay, not just a parking-area name. Drivers see the facility entrance on a map, directions, floor, zone, bay label and owner-provided arrival instructions. Owners see the same booking and bay assignment and update its operational status.

No seeded public facilities, fabricated availability, fake payments or educational panels are part of the main app. An owner publishes their actual address, entrance coordinates, bay inventory and instructions. Driver discovery starts with those listings.

## 2. Driver experience

- Public discovery: search published facilities by name/address, choose arrival and duration, filter vehicle/bay category, optionally rank by device location. Permission refusal keeps manual search available.
- Facility page: verified entered address, hourly rate, available bays for the selected time window, entrance map, walking/arrival instructions and a clear booking action.
- Account: register as a driver, sign in, sign out. Only authenticated drivers create bookings.
- Booking: server allocates a compatible bay atomically. Store a price snapshot and an independent short booking reference. Refuse overlapping reservations and duplicate overlapping visits for the same driver/plate.
- My parking: upcoming/active/history records, cancellation before check-in, owner-confirmed arrival/departure status, entrance directions and assigned-bay plan.
- Map: external directions to actual entrance coordinates; SVG floor plan highlights the assigned bay. Do not describe it as live indoor GPS or turn-by-turn positioning.

## 3. Owner experience

- Register as an owner; role is enforced by the server and cannot be switched by changing a URL.
- Create a facility: name, address, entrance latitude/longitude, hourly rate, floor label, entry instructions, regular/accessible/EV bay counts.
- Publish/unpublish facility to control discovery without deleting bookings.
- Owner dashboard: real reservations, checked-in vehicles, completed/cancelled records, bay map and status filters.
- Check-in/check-out: validate timing and state, reject invalid transitions, update the driver's pass.
- Bay maintenance: prevent new reservations for blocked bays; refuse blocking a bay with an active/future booking.
- Activity: server-generated events tied to the actor; owner can view only their facilities.

## 4. Architecture

React UI → same-origin /api endpoints → authenticated services → PostgreSQL.

Local development runs the same SQL on persistent embedded PostgreSQL (PGlite) through a Node HTTP server. Production uses a managed PostgreSQL DATABASE_URL and the same SQL services through a Vercel function. Production must fail clearly when the database is unconfigured; never fall back to temporary memory or browser-only records.

Tables: users, sessions, facilities, bays, bookings, activity, authentication throttles. Primary keys use UUIDs. Sessions use random opaque tokens hashed in the database; passwords use salted scrypt. Cookie flags: HttpOnly, SameSite=Lax, Secure in production. Origin checks protect state-changing requests. Input validation, payload limits, parameterized SQL, role checks, owner/driver resource checks and generic server errors apply throughout.

## 5. API

- GET /api/session; POST /api/auth/register, /api/auth/login, /api/auth/logout
- GET /api/facilities?startAt=&duration=&category=&q=
- GET /api/facilities/:id?startAt=&duration=&category=
- GET /api/bookings; POST /api/bookings; POST /api/bookings/:id/cancel
- GET /api/owner/facilities; POST /api/owner/facilities
- PATCH /api/owner/facilities/:id (publication)
- GET /api/owner/bookings; POST /api/owner/bookings/:id/check-in or /check-out
- PATCH /api/owner/bays/:id (maintenance)
- GET /api/owner/activity

## 6. Synchronization and consistency

Both workspaces fetch the same database. Refresh every five seconds while visible, refresh on focus and immediately after changes, and show last refresh/error status. This is polling with bounded delay, not an instant push claim.

All allocation and maintenance transactions lock the facility row. Check for overlapping time ranges inside the lock before assigning. An already checked-in vehicle continues to occupy its bay after the planned departure until checkout, preventing overstay conflicts. Check-in refuses an occupied bay even if the booking was made earlier. Reservations expire when the arrival grace period passes; expiry is reconciled on reads/actions.

## 7. Verification

Use independent owner and driver browser sessions against the real local API. Verify owner publication → driver discovery → booking → owner visibility → check-in → driver update → check-out → history. Also test cancellation propagation, maintenance exclusion, simultaneous last-bay bookings, authorization, expiry, location links, password/session handling, empty states, reload persistence and mobile layout.

## 8. Release

Keep existing browser records intact; they are not automatically treated as authenticated shared bookings. The new app starts with real accounts and owner-entered facilities. Provide run/setup instructions and an .env.example with variable names only. Production release requires managed PostgreSQL and deployment configuration. Do not replace the working live deployment with an unusable database error if those credentials are still missing.

## Initial boundaries

Booking prices are estimates/pay-at-site amounts; no payment collection is claimed. Address and coordinates are owner-entered, not verified by a mapping provider. No physical gate, license-plate camera, email verification or indoor positioning is claimed. Password reset requires a mail-provider stage; keep those absent rather than adding fake controls.
