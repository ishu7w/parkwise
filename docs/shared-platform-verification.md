# Driver / owner platform verification

The rebuild uses a real API and shared PostgreSQL records. Automated browser tests create independent owner and driver sessions and temporary facility fixtures; no fixtures are loaded in the product workspace.

## Verified scenarios

- Account creation, login checks, server sessions, logout invalidation, role enforcement and owner resource isolation.
- Facility creation, editing and publication; unpublished facilities do not appear in driver discovery.
- Driver booking → owner arrivals → owner check-in → driver pass update → checkout → driver history.
- Simultaneous attempts to reserve a single remaining bay confirm one request and reject the other.
- Cancellation releases capacity; maintenance cannot block bays with active/future reservations.
- Arrival grace expiry; future bookings cannot check in early; parked overstays continue blocking allocation.
- Facility entrance directions use the owner-provided coordinates; bay passes highlight the assigned label in the schematic.
- Persistent SQL data survives database reopening. Existing booking amounts stay unchanged after a rate edit.
- Six product pages at 390, 768 and 1440 pixel widths, with no document overflow or browser runtime errors.

## Release dependency

Production cross-device operation requires a managed PostgreSQL DATABASE_URL in Vercel. A production deployment without that connection is not a working release. Local operation uses persistent embedded PostgreSQL and can exercise the complete multi-account workflow against one server.

## Driver tools update

- Saved vehicles normalize plates, update an existing plate, survive reload and remain isolated between accounts. Removing a saved vehicle does not delete booking history.
- Saved facilities persist in the account; unpublishing keeps the saved entry while preventing new bookings.
- Extensions preserve the original hourly rate after owner rate edits, propagate the new departure/price to owners and add an activity entry. Future bay/vehicle conflicts, foreign accounts, completed bookings and the eight-hour limit are enforced on the server.
- Browser checks cover saved parking, saved vehicle selection, extension confirmation, calendar downloads, reload persistence and the garage at mobile/tablet/desktop widths.
- Calendar exports use UTC, escape metadata, fold long lines and include a reminder 15 minutes before departure. Booking downloads explicitly describe pay-at-facility and are not payment receipts.
