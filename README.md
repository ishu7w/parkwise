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
- Optional location-based sorting with manual search when permission is denied.
- Transactional exact-bay reservations, overlap protection and independent booking references.
- Driver passes with entrance map, driving directions, floor, assigned bay and arrival instructions.
- Owner check-in/check-out, publication controls, facility details editing, maintenance blocks and activity records.
- Automatic unclaimed-reservation expiry 30 minutes after booked arrival; checked-in vehicles continue to occupy their bay until checkout.
- Price snapshots, in INR, payable at the facility; no online payment collection is claimed.
- Shared database refresh every five seconds while the page is visible and on focus.

## Production database and Vercel

Copy `.env.example` to `.env` for local configuration, or set DATABASE_URL in the Vercel project environment. Use a managed PostgreSQL connection string with the provider's required TLS configuration. Never commit credentials.

The Vercel function serves `/api/*` through `api/index.js`. The API requires DATABASE_URL in production and fails clearly when it is absent; it does not fall back to ephemeral or browser storage. The SQL schema initializes on connection. Use the same database for all production instances. The initial Vercel project remains on the earlier release until this rebuild's database is configured.

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
