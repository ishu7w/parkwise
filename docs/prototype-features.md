# Product research and implemented scope

Reviewed 4 October 2026 using official product pages.

- [Get My Parking](https://www.getmyparking.com/product.php): reservations, capacity controls and parking access workflows informed visitor holds and maintenance blocks.
- [Parkable parking management](https://parkable.com/us/parking-management-system): bookings, occupancy visibility and reporting informed the reservation register, occupancy overview and vehicle CSV reports.

These are independently implemented workflows within Parkwise's existing visual design. No third-party source code or backend service is incorporated.

## Structure

- Overview: daily arrivals, allocation queue and current bay occupancy.
- Vehicles: searchable visit register, checkout, cancellation and export.
- Reservations: immediate visitor holds with check-in and cancellation.
- Activity: timestamped operating history.
- Workspace: usable capacity, sample workspace entry and data backup.

Operational rules reside in `src/domain/parking.js`; page components display and update that state. Legacy educational modules are not linked into the main application.
