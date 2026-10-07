# Parkwise

A driver and parking-owner application with server-backed accounts, shared booking records and exact-bay arrival passes. The primary app contains no preloaded parking facilities or educational concept pages.

## Start locally

Requires Node.js 22+ and npm.

```sh
npm ci
npm run dev
```

Open http://localhost:5174/. This starts both the API and website. With no DATABASE_URL configured, a persistent embedded PostgreSQL database is created in `.data/parkwise`. Local server data is excluded from Git. Accounts and bookings survive refreshes and server restarts.

1. Open Parking owner and create an owner account.
2. Add a facility using its actual entrance coordinates, address, rate, bay counts and entry instructions.
3. Publish the facility to make it discoverable.
4. In another browser or private window, create a driver account and reserve a bay.
5. The reservation appears in the owner's Arrivals view. Confirm arrival and checkout; the driver's pass reflects those changes.

Use separate browser sessions for the two accounts. Both must reach the same server/database.

## Features

- Separate driver and owner experiences with server-enforced roles and resource ownership.
- Discovery by address/name, arrival window, duration and standard/accessible/EV category.
- Price, availability, saved-parking and optional location-based sorting; manual search works when location permission is denied.
- Account-backed vehicle garage and saved facilities, with saved plate selection at checkout.
- Extend reserved/checked-in parking by 30, 60 or 120 minutes, subject to bay/vehicle conflicts and an eight-hour total limit. Extensions preserve the booked hourly rate and appear for the owner.
- Download booking details, import a calendar event with a departure reminder, and rebook a previous facility.
- Guest booking selections remain available after signing in during the same page session.
- Transactional exact-bay reservations, overlap protection and independent booking references.
- Driver passes with entrance map, driving directions, floor, assigned bay and arrival instructions.
- Owner check-in/check-out, publication controls, facility details editing, maintenance blocks and activity records.
- Automatic unclaimed-reservation expiry 30 minutes after booked arrival; checked-in vehicles continue to occupy their bay until checkout.
- Price snapshots, in INR, payable at the facility; no online payment collection is claimed.
- Booking-linked driver/owner help conversations with resolution and reopening.
- Cash, UPI and card payment records entered by the operator after receiving money; outstanding balance and downloadable payment records.
- Owner reservation search and date-range CSV reports separating booking amounts from recorded collections.
- Completed-stay reviews, name editing and password changes that revoke previous sessions.
- Database health checks, security headers, mutation limits and automated CI verification.
- Shared database refresh every five seconds while the page is visible and on focus.

## Production database and Vercel

Copy `.env.example` to `.env` for local configuration, or set DATABASE_URL in the Vercel project environment. Use a managed PostgreSQL connection string with the provider's required TLS configuration. Never commit credentials.

The Vercel function serves `/api/*` through `api/index.js`. The API requires DATABASE_URL in production and fails clearly when it is absent; it does not fall back to ephemeral or browser storage. The SQL schema initializes on connection. Use the same database for all production instances. The live Vercel project is connected to a free Neon PostgreSQL database through its marketplace integration. Schema updates are additive and initialize under a database lock.

## Verify

```sh
npm test
npm run typecheck
npm run build
npm run test:browser
```

Browser tests start an isolated API/database and website on port 5175 and use installed Google Chrome. Test accounts and facilities are temporary fixtures and are removed after verification. They are not product seed data. `test:legacy-browser` contains historical checks for the previous attendant UI and is not the new product's verification command.

See [detailed rebuild plan](docs/driver-owner-rebuild-plan.md) and [shared-platform verification](docs/shared-platform-verification.md).

## Operating boundaries

The facility owner supplies the entrance coordinates and physical bay labels. The internal plan is a schematic, not indoor GPS. The product currently supports one floor label per facility and up to 150 bays. Registration has no email verification/reset service yet; map directions open an external provider. Publication should use actual locations and posted matching bay labels. Parking payments, gate sensors and license-plate cameras are not integrated.

The previous attendant implementation is preserved separately in `src/AttendantApp.jsx`; prior browser-local records are left intact and are not imported into shared accounts automatically.

## Production launch roadmap

See [production roadmap](docs/production-roadmap.md) for researched competitor workflows, priorities, acceptance criteria and the operating runbook. Pay-at-facility is confirmed for the first launch. This release supports a tested operational pilot; unrestricted public launch remains gated on verified facilities, email recovery, business policies, separate preview data, monitoring and an exercised backup restore. Payment records are operator acknowledgements, not tax invoices or bank settlement records.
