# Parkwise operational rebuild

## Structure
- Overview: availability, arrivals, parking map, queue, checkout and zone occupancy.
- Vehicles: visit register, category/status filters, plate/visit/bay search, timestamps, checkout and CSV export.
- Activity: timestamped arrivals, assignments and departures.

## Removed from the active product
Modules, Architecture, OS Concepts, process inspectors, synchronization demonstrations, deadlock, producer-consumer and CPU service timing. Legacy source is retained but no longer imported by the app.

## Operational rules
Arrival order is stable FIFO among eligible requests. Priority first selects eligible vehicles by category. Reserved vehicles prefer C4; other categories cannot use C4. No assignment occurs when all eligible bays are full. Plate matching ignores spaces and hyphens to prevent duplicate active visits. New visits record actual arrival, parking and exit timestamps.

## Preservation
Restore from parkwise-workspace-v2, falling back to parkwise-state-v1. Keep the original legacy storage key. Do not fabricate timestamps for old visits. Invalid stored data is not overwritten.

## Verification
Test migration, duplicate plates, reserved-space eligibility, full capacity, checkout, timestamps, search, CSV, persistence, route removal and responsive layout.

## Deployment boundary
This implementation is a single-device operational workspace. Shared staff accounts, synchronization, recoverable server backups and authoritative audit records require a backend. Sensor and payment integrations are not present.
