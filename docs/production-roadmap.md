# Parkwise production roadmap

## Product and launch scope

Parkwise connects drivers to parking operators. Drivers reserve a specific compatible bay, navigate to the vehicle entrance, and manage their stay. Operators publish actual inventory, confirm arrivals/departures, record payments received at the facility and resolve booking issues.

Confirmed launch payment: pay at the facility. Online collection is deferred until merchant integration is approved.

Assumptions: India-first, INR prices, one floor label per facility, short stays up to eight hours, existing React/Vite + Node API + PostgreSQL architecture, existing Paper/Forest visual system. No invented parking locations, reviews, payments or verification badges.

“Production ready” means the complete operating workflow is tested, security controls are enforced, operators are onboarded, recovery procedures are exercised, and service integrations work in production. Deployment alone does not meet that bar.

## Comparable service research

- [SpotHero driver FAQ](https://spothero.com/faq): reservation management, availability-dependent extensions, parking passes, cancellation and payments.
- [SpotHero operator control panel](https://operator-help.spothero.com/en/articles/9319808-control-panel-overview): reservation search/export, revenue/inventory controls and customer reviews.
- [SpotHero reservation management](https://operator-help.spothero.com/en/articles/9346467-review-active-and-upcoming-reservations): operational and historical reservation views.
- [JustPark app](https://www.justpark.com/uk/info/download-the-app): saved vehicle details and managing a stay through the app.
- [JustPark park-and-pay](https://www.justpark.com/uk/solutions/park-and-pay): cashless operator workflows.
- [JustPark booking amendments](https://support-uk.justpark.com/hc/en-gb/articles/32936272389009-I-want-to-change-my-booking-time-and-date): restrictions on amendments after parking starts.

These identify useful workflows; Parkwise's pricing, eligibility and cancellation policies must be chosen for its own operators, rather than copied as legal promises.

## Prioritized feature matrix

| Priority | Capability | Delivery / acceptance condition |
| --- | --- | --- |
| P0 | Separate accounts and exact-bay reservations | Existing. Role/ownership checks; single remaining bay cannot be double booked. |
| P0 | Discovery, entrance directions and assigned-bay pass | Existing. Owner-supplied coordinates; no claim of indoor GPS. |
| P0 | Saved vehicles/facilities, extensions and downloads | Existing. Account-backed; original rate retained; future conflicts rejected. |
| P0 | Support tied to a booking | Implemented and verified in this release. Only booking driver and facility owner can read/reply; resolved threads reject additional replies until reopened. |
| P0 | Pay-at-facility accounting and receipts | Implemented and verified in this release. Owner explicitly records money received; immutable payment entries; remaining balance after extensions; no invented gateway charge. |
| P0 | Owner search and reports | Implemented and verified in this release. Filter reservations by reference/plate/driver; actual recorded payment records separated from quoted booking amounts; downloadable CSV. |
| P0 | Account settings | Implemented and verified in this release. Edit name; verify current password before a password change; invalidate old sessions. |
| P0 | Verified-stay reviews | Implemented and verified in this release. One review per completed booking; public review exposes first name only; driver can edit their review. |
| P0 | Health checks, browser/API security, CI | Implemented and verified in this release. Database-backed health check; defensive HTTP headers; tests/build in CI; request/body limits and server role guards. |
| P0 launch gate | Email verification and recovery | Requires transactional mail service and verified sender domain. Single-use, expiring hashed tokens, generic recovery response, invalidation on use; delivery tested to real inboxes. No “forgot password” button until delivery works. |
| P0 launch gate | Owner verification and business policies | Verify facility operation rights and address manually before public onboarding. Define cancellation, overstay, refund/support, retention and privacy policies with actual business details. |
| P0 launch gate | Backup, restore and monitoring | Document and exercise provider restore on staging; configure uptime/error alert recipients; separate preview DB from production. |
| P1 | Online payments/refunds | Requires approved merchant account. Server-created orders, webhook signatures, event deduplication, captured amount/currency checks, refunds, reconciliation and operator settlement. Never trust a browser “paid” flag. |
| P1 | Booking amendments | Change vehicle/time before arrival under inventory lock; show price difference; forbid unsupported changes after check-in. |
| P1 | Inventory schedules and amenities | Opening hours/blackout days, vehicle height limits, covered/CCTV/EV/accessibility flags, facility photographs, filter support and price transparency. Rules enforced on the server. |
| P1 | Staff permissions | Owner/manager/attendant invitations and facility-scoped permissions; no shared passwords; audit all staff actions. |
| P1 | Owner cancellations and incident recovery | Explain reason, notify driver, release inventory atomically, refund captured funds where applicable; replacement facility only with driver consent. |
| P1 | Notifications | Email/SMS arrival, amendment, cancellation and expiry notices, opt-in preferences, delivery retry/outbox and unsubscribe controls. |
| P1 | Abuse controls | Review moderation, reporting, facility verification queue, registration throttles, per-account quotas and administrative audit trail. |
| P2 | Monthly and recurring parking | Distinct capacity/rate model, recurring availability, renewal/cancellation rules and subscription payment integration. Not a long single short-stay booking. |
| P2 | Waitlists and alternate parking | Opt-in queue, expiring offer, eligibility rules, fair allocation and no promise without a confirmed bay. |
| P2 | Multi-level visual maps | Owner-defined physical bay positions, multiple floors, accessible routes and matching signage; usable fallback pass. |
| P2 | Gate/ANPR/QR integration | Signed admission tokens, replay protection, device credentials, hardware outage/manual override and validated plate events. |
| P2 | Fleet/business accounts | Multiple drivers/vehicles, delegated access, invoicing and spend controls. |
| P2 | Native mobile/PWA and accessibility | Installable app, offline read-only pass, stale-data labels, keyboard and screen-reader checks. Offline booking/payment is not supported. |
| P2 | Dynamic pricing / analytics | Explainable rate schedules and occupancy trends based on real data; honor existing booking snapshots. |

## Flows and screens

Driver: discover → compare actual available inventory → reserve with saved plate → pass/directions → owner arrival confirmation → extend if needed → pay operator → recorded payment record → checkout → verified-stay review. A booking help thread is available throughout.

Owner: facility setup/publication → searchable arrival register → confirm arrival → record payment only after receiving it → checkout → resolve booking help → review recorded collections/report/export. Activity retains actor and timestamp.

UI stays within the existing design system: large readable headers, flat paper panels, forest controls, keyboard focus, clear error/empty states. Navigation adds Account, Help and owner Reports. Payment controls require a deliberate confirmation and display the booking/reference/amount before recording.

## Architecture and data contracts

React screens → same-origin `/api/*` → session/role/ownership checks → services → PostgreSQL. Embedded PostgreSQL remains local-only. Production requires managed `DATABASE_URL`; no browser data substitutes for shared records.

Additive tables: `booking_messages(booking_id, actor_id, message, created_at)`, `booking_reviews(booking_id UNIQUE, rating, comment)`, `booking_payments(booking_id, actor_id, amount, method, created_at)`; booking support resolution timestamp. Foreign keys and time indexes retain relational integrity. Existing bookings are preserved.

APIs: `PATCH /api/account` (name); `POST /api/account/password` (current/new password); `GET /api/help`, `GET/POST /api/bookings/:id/messages`, `PATCH /api/bookings/:id/help`; `POST /api/bookings/:id/review`; `POST /api/owner/bookings/:id/payment`; `GET /api/owner/report` (maximum 31-day arrival window, explicit export limit); `GET /api/health`. Responses keep the existing success/data/error envelope.

Session cookies are opaque, hashed in the DB, HttpOnly/SameSite, Secure in production. Password hashing remains salted scrypt. PostgreSQL transactions and facility/booking locks serialize financial and inventory changes. No password, session or DB secrets appear in exports/logs.

## Release sequence and gates

1. Commit roadmap and additive schema/services/UI. Keep unrelated local files intact.
2. Verify account isolation, unsupported transitions, support ownership, review eligibility, immutable payment totals, payment race protection, extension balance, exports and password session invalidation.
3. Run complete driver/owner browser workflow, 390/768/1440 width checks, build and CI-equivalent tests.
4. Deploy preview; check DB health and schema compatibility before production merge.
5. Verify public release and authenticated workflows in isolated staging; never seed fictitious locations into production.
6. Public launch remains gated on actual operator onboarding, email recovery, business policies, separate staging data, configured monitoring and a tested backup restore.

## Operating runbook

Database failure: health endpoint returns 503; mutations show failure and retain user input. Do not acknowledge booking/payment success without a committed record.

Payment discrepancy: compare the immutable booking payment ledger and operator activity; record payments only actually received. Gateway reconciliation follows after online payment integration.

Deployment rollback: roll back the Vercel deployment; schema additions must remain backward compatible. Never drop production tables as a rollback.

Backup recovery: use managed provider backups, restore to a separate database, verify account/facility/booking/payment counts and relationships, then switch connection only after approval. Retain original database until recovery is validated.

Security incident: revoke affected sessions, preserve audit evidence, rotate exposed secrets, and notify affected parties under the approved business process.
