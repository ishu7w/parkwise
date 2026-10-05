# Single-facility attendant operations

The primary workspace uses actual arrivals entered by an attendant. Example records are optional and stored separately.

## Differentiator: explained, age-aware allocation

- Arrival order assigns the earliest eligible vehicle.
- Priority first uses category ranking and preserves arrival order within a category.
- Balanced priority always ranks emergency vehicles first. For other categories, every completed 10 minutes of waiting improves their effective rank, with oldest arrivals breaking ties.
- The proposed plate, bay and rule are visible before assignment. Occupied bays, active holds and maintenance blocks are excluded. C4 remains restricted to the Reserved category.
- These are deterministic operating rules, not AI predictions or sensor-derived occupancy.

## Timed holds and daily figures

New visitor holds last 15, 30, 60 or 120 minutes. Expired holds cease blocking allocation immediately when checked; the open app refreshes expired statuses every 15 seconds and when focused. On reopening, past expiry is reconciled. No background notification service is claimed.

Daily figures use this browser's calendar day and recorded timestamps. Average stay includes completed parked visits, excludes queue cancellations, and is not a forecast. Older untimed records are not assigned fabricated timestamps.

## Backup recovery

Download a JSON backup regularly. Restore validates the format, capacity conflicts, duplicate active plates, counters and timestamps, then shows a replacement review. It replaces only the current sample or local workspace when confirmed.

## Current operating scope

One attendant, one facility with 12 bays, one browser and one editing tab. Records do not synchronize across devices; there are no staff accounts or physical gate integrations. The owner selected further local-operation improvements on 5 October 2026. Secure shared operations remain a future database and authentication stage.
