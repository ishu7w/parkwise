# Parkwise

A single-device parking operations workspace for a facility attendant. The primary app contains Overview, Vehicles, Reservations, Activity and Workspace. Educational simulation modules remain separate from the operational UI.

## Run locally

Requires Node.js 22+ and npm. From this folder:

```sh
npm ci
npm run demo
```

Open http://localhost:5174/. For presentation records, open http://localhost:5174/?workspace=sample#Overview. The sample workspace is saved separately from normal records.

## Working features

- Vehicle arrivals, duplicate-plate protection, arrival-order, priority or balanced allocation. Balanced priority improves queue rank after each 10 minutes of waiting while keeping emergencies first.
- Twelve-bay occupancy map; C4 limited to the Reserved category.
- Timed visitor holds (15–120 minutes), automatic expiry, check-in to the held bay, and cancellation.
- Explained next-assignment recommendations and daily arrivals, departures, queue waits and completed-stay figures.
- Maintenance blocks that prevent allocation until reopened.
- Vehicle search, status filters, queue cancellation, checkout and CSV export.
- Timestamped activity, persistent browser storage and validated JSON backup download and restoration.
- Responsive layouts, GSAP transitions and reduced-motion support.

## Verify

```sh
npm test
npm run typecheck
npm run build
# Keep the local server running first; browser tests use installed Google Chrome.
npm run test:browser
```

See [presentation guide](docs/presentation-guide.md) and [feature research](docs/prototype-features.md).

## Prototype boundaries

This version operates in one browser on one device. It does not include authentication, shared backend synchronization, payment collection, camera/sensor integrations or scheduled future bookings. Holds apply immediately and expire after the chosen duration; older untimed holds require manual check-in or cancellation. JSON backups can be validated and restored after an explicit replacement review. Use one editing tab at a time because simultaneous tabs do not coordinate updates. Clearing browser storage removes saved records.
