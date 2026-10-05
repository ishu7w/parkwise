# Parkwise presentation walkthrough

Run `npm run demo` from the project folder. Open http://localhost:5174/?workspace=sample#Overview.

The sample is separate from normal records, persists after refresh, and initially includes four parked vehicles, two queued arrivals, one visitor hold and one maintenance block. To start again without changing saved records, use a fresh private browser window with the sample URL.

## Five-minute walkthrough

1. **Overview:** Explain the available/occupied counts and select a parked bay. The map shows the actual current workspace records.
2. **Arrival:** Click Add vehicle, enter a new plate such as MH12 XY1234, and add it to the queue. Choose Balanced priority, review the next-assignment explanation, then click Park next vehicle. The emergency vehicle receives priority; held, occupied and blocked bays are skipped.
3. **Reservations:** Enter a visitor name and unique plate, select an available bay, and click Hold bay. Check in the visitor to demonstrate assignment to that exact bay. Choose a hold duration; expiration or cancellation releases unused holds.
4. **Workspace:** Block an empty bay for maintenance. Return to Overview to show the unavailable bay. Reopen it when ready.
5. **Vehicles:** Search for a plate, export the filtered CSV, then check out a parked vehicle. Queued visits can be cancelled without deleting their history.
6. **Activity:** Show the timestamped record of actions. Refresh the page to demonstrate persistence.
7. **Workspace:** Download the JSON backup. The restore control validates a backup and shows record counts before you confirm replacement. Return to the real workspace using the link; its records remain separate.

## What to explain honestly

- This is a working frontend prototype for a parking operator, with real state changes and browser persistence.
- It supports a fixed 12-bay facility and immediate visitor holds.
- Multi-user accounts, a server database, online payments and physical gate/sensor integration would be subsequent implementation stages.
- Run one editing tab at a time. Download a backup before clearing browser data.
