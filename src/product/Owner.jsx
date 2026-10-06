import { useState } from "react";
import { Plus, MapPin } from "lucide-react";
import {
  mutate,
  useResource,
  money,
  date,
  statusLabel,
  categoryLabel,
} from "./api";
import { Heading, Panel, Notice, Empty, SyncStatus, BayPlan } from "./Common";
export function OwnerFacilities() {
  const resource = useResource("/owner/facilities"),
    [creating, setCreating] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [selected, setSelected] = useState(null),
    [editing, setEditing] = useState(null);
  async function act(path, body, method = "POST", success = "Saved.") {
    setBusy(true);
    setError("");
    try {
      await mutate(path, body, method);
      setMessage(success);
      await resource.refresh();
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function create(e) {
    e.preventDefault();
    const values = Object.fromEntries(new FormData(e.currentTarget));
    if (
      await act(
        "/owner/facilities",
        values,
        "POST",
        "Facility created. Review it, then publish to accept bookings.",
      )
    )
      setCreating(false);
  }
  return (
    <>
      <Heading
        eyebrow="OWNER / YOUR FACILITIES"
        title="Make every bay count."
        action={
          <button className="pw-primary" onClick={() => setCreating(!creating)}>
            <Plus size={17} />
            {creating ? "Close form" : "Add facility"}
          </button>
        }
      >
        Publish your location and usable bays. Drivers book from the same
        availability.
      </Heading>
      {error && <Notice error>{error}</Notice>}
      {message && <Notice>{message}</Notice>}
      {resource.error && <Notice error>{resource.error}</Notice>}
      {creating && (
        <Panel title="Add a parking facility">
          <form className="pw-facility-form" onSubmit={create}>
            <label>
              Facility name
              <input name="name" required minLength={3} maxLength={80} />
            </label>
            <label className="pw-wide">
              Street address
              <input
                name="address"
                required
                minLength={8}
                maxLength={240}
                placeholder="Building, road, locality and city"
              />
            </label>
            <label>
              Entrance latitude
              <input
                name="latitude"
                required
                type="number"
                step="any"
                min="-90"
                max="90"
              />
            </label>
            <label>
              Entrance longitude
              <input
                name="longitude"
                required
                type="number"
                step="any"
                min="-180"
                max="180"
              />
            </label>
            <label>
              Floor / level
              <input
                name="floor"
                required
                maxLength={40}
                placeholder="Ground level"
              />
            </label>
            <label>
              Hourly rate (₹)
              <input
                name="hourlyRate"
                required
                type="number"
                min="0"
                max="10000"
                defaultValue="40"
              />
            </label>
            <label>
              Standard bays
              <input
                name="standard"
                type="number"
                min="0"
                max="100"
                defaultValue="10"
                required
              />
            </label>
            <label>
              Accessible bays
              <input
                name="accessible"
                type="number"
                min="0"
                max="100"
                defaultValue="1"
                required
              />
            </label>
            <label>
              EV bays
              <input
                name="ev"
                type="number"
                min="0"
                max="100"
                defaultValue="1"
                required
              />
            </label>
            <label className="pw-wide">
              Arrival instructions
              <textarea
                aria-label="Arrival instructions"
                name="instructions"
                required
                minLength={5}
                maxLength={1000}
                placeholder="Which gate to enter, landmarks, level and how to find the bay labels."
              />
            </label>
            <p className="pw-form-note pw-wide">
              Pin the vehicle entrance rather than the building centre.
              Coordinates can be copied from your map app. Bays receive A, D
              (accessible) and E (EV) labels; post matching labels on site. This
              creates an unpublished facility.
            </p>
            <div className="pw-wide">
              <button className="pw-primary" disabled={busy}>
                {busy ? "Creating…" : "Create facility"}
              </button>
            </div>
          </form>
        </Panel>
      )}
      {resource.loading ? (
        <p className="pw-pad">Loading your facilities…</p>
      ) : !resource.data?.length ? (
        <Empty
          title="Your first facility starts here"
          action={
            <button className="pw-primary" onClick={() => setCreating(true)}>
              Add facility
            </button>
          }
        >
          Enter your actual entrance location, arrival instructions and bay
          inventory to start accepting driver reservations.
        </Empty>
      ) : (
        resource.data.map((f) => (
          <Panel
            key={f.id}
            title={f.name}
            aside={
              <span
                className={
                  "pw-status " + (f.published ? "parked" : "cancelled")
                }
              >
                {f.published ? "Published" : "Unpublished"}
              </span>
            }
          >
            <div className="pw-owner-facility-info">
              <div>
                <p>
                  <MapPin size={16} />
                  {f.address}
                </p>
                <small>
                  {f.floor} · {money(f.hourly_rate)} / hour · {f.bays.length}{" "}
                  bays
                </small>
                <p className="pw-instructions">{f.instructions}</p>
              </div>
              <div className="pw-facility-actions">
                <button
                  onClick={() => setEditing(editing === f.id ? null : f.id)}
                >
                  Edit details
                </button>
                <button
                  disabled={busy}
                  onClick={() =>
                    act(
                      "/owner/facilities/" + f.id,
                      { published: !f.published },
                      "PATCH",
                      f.published
                        ? "Facility hidden from new driver searches. Existing bookings remain available."
                        : "Facility is published and accepting reservations.",
                    )
                  }
                >
                  {f.published ? "Stop new bookings" : "Publish facility"}
                </button>
              </div>
            </div>
            {editing === f.id && (
              <form
                className="pw-facility-form"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (
                    await act(
                      "/owner/facilities/" + f.id,
                      Object.fromEntries(new FormData(e.currentTarget)),
                      "PATCH",
                      "Facility details updated. Existing booked amounts stay the same.",
                    )
                  )
                    setEditing(null);
                }}
              >
                <label>
                  Facility name
                  <input
                    name="name"
                    defaultValue={f.name}
                    required
                    minLength={3}
                    maxLength={80}
                  />
                </label>
                <label className="pw-wide">
                  Street address
                  <input
                    name="address"
                    defaultValue={f.address}
                    required
                    minLength={8}
                    maxLength={240}
                  />
                </label>
                <label>
                  Entrance latitude
                  <input
                    name="latitude"
                    defaultValue={f.latitude}
                    required
                    type="number"
                    step="any"
                    min="-90"
                    max="90"
                  />
                </label>
                <label>
                  Entrance longitude
                  <input
                    name="longitude"
                    defaultValue={f.longitude}
                    required
                    type="number"
                    step="any"
                    min="-180"
                    max="180"
                  />
                </label>
                <label>
                  Floor / level
                  <input
                    name="floor"
                    defaultValue={f.floor}
                    required
                    maxLength={40}
                  />
                </label>
                <label>
                  Hourly rate (₹)
                  <input
                    name="hourlyRate"
                    defaultValue={f.hourly_rate / 100}
                    required
                    type="number"
                    min="0"
                    max="10000"
                  />
                </label>
                <label className="pw-wide">
                  Arrival instructions
                  <textarea
                    aria-label="Arrival instructions"
                    name="instructions"
                    defaultValue={f.instructions}
                    required
                    minLength={5}
                    maxLength={1000}
                  />
                </label>
                <div className="pw-wide">
                  <button className="pw-primary" disabled={busy}>
                    Save facility details
                  </button>
                </div>
              </form>
            )}
            <BayPlan bays={f.bays} interactive onSelect={setSelected} />
            {selected && selected.facility_id === f.id && (
              <div className="pw-bay-control">
                <span>
                  <strong>{selected.label}</strong> ·{" "}
                  {categoryLabel[selected.category]} ·{" "}
                  {selected.booking_status || "No current booking"}
                </span>
                <button
                  disabled={busy}
                  onClick={async () => {
                    if (
                      await act(
                        "/owner/bays/" + selected.id,
                        { blocked: !selected.blocked },
                        "PATCH",
                        selected.blocked
                          ? "Bay reopened."
                          : "Bay blocked for maintenance.",
                      )
                    )
                      setSelected(null);
                  }}
                >
                  {selected.blocked ? "Reopen bay" : "Block for maintenance"}
                </button>
                <button onClick={() => setSelected(null)}>Close</button>
              </div>
            )}
          </Panel>
        ))
      )}
      <SyncStatus resource={resource} />
    </>
  );
}
export function OwnerBookings() {
  const resource = useResource("/owner/bookings"),
    [filter, setFilter] = useState("active"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(null),
    [message, setMessage] = useState("");
  const records = (resource.data || []).filter(
    (b) =>
      filter === "all" ||
      (filter === "active" && ["reserved", "parked"].includes(b.status)) ||
      b.status === filter,
  );
  const all = resource.data || [];
  async function change(b, action) {
    setBusy(b.id);
    setError("");
    try {
      await mutate("/owner/bookings/" + b.id + "/" + action);
      setMessage(
        `${b.plate} ${action === "check-in" ? "checked in" : "checked out"}. The driver’s parking pass will update.`,
      );
      await resource.refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  }
  return (
    <>
      <Heading eyebrow="OWNER / DAILY OPERATIONS" title="Arrivals, in order.">
        Driver reservations arrive here with their assigned bay. Confirm arrival
        and departure as vehicles enter and leave.
      </Heading>
      <div className="pw-owner-metrics">
        {[
          ["Reserved", all.filter((b) => b.status === "reserved").length],
          ["Currently parked", all.filter((b) => b.status === "parked").length],
          ["Completed", all.filter((b) => b.status === "completed").length],
          [
            "Overstaying",
            all.filter(
              (b) => b.status === "parked" && Date.parse(b.end_at) < Date.now(),
            ).length,
          ],
        ].map(([label, value]) => (
          <div key={label}>
            <span className="pw-eyebrow">{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <div className="pw-tabs">
        {[
          ["active", "Upcoming & active"],
          ["reserved", "Reserved"],
          ["parked", "Checked in"],
          ["all", "All bookings"],
        ].map(([value, label]) => (
          <button
            key={value}
            className={filter === value ? "active" : ""}
            onClick={() => setFilter(value)}
          >
            {label}
          </button>
        ))}
      </div>
      {error && <Notice error>{error}</Notice>}
      {message && <Notice>{message}</Notice>}
      {resource.error && <Notice error>{resource.error}</Notice>}
      {resource.loading ? (
        <p className="pw-pad">Loading driver reservations…</p>
      ) : !records.length ? (
        <Empty title="No bookings in this view">
          Once your facility is published, driver reservations appear here. You
          can manage your bays from Facilities.
        </Empty>
      ) : (
        <Panel title="Reservation register">
          <div className="pw-table-scroll">
            <table>
              <thead>
                <tr>
                  {[
                    "Driver / reference",
                    "Vehicle",
                    "Facility / bay",
                    "Arrival / departure",
                    "Status",
                    "Action",
                  ].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {records.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <strong>{b.driver_name}</strong>
                      <small>{b.reference}</small>
                    </td>
                    <td>
                      {b.plate}
                      <small>{categoryLabel[b.category]}</small>
                    </td>
                    <td>
                      {b.facility_name}
                      <small>
                        {b.floor} · {b.bay_label}
                      </small>
                    </td>
                    <td>
                      {date(b.start_at)}
                      <small>{date(b.end_at)}</small>
                    </td>
                    <td>
                      <span className={"pw-status " + b.status}>
                        {statusLabel[b.status]}
                      </span>
                      {b.status === "parked" &&
                        Date.parse(b.end_at) < Date.now() && (
                          <small className="pw-overstay">
                            Past booked departure
                          </small>
                        )}
                    </td>
                    <td>
                      {b.status === "reserved" ? (
                        <button
                          className="pw-primary"
                          disabled={busy === b.id}
                          onClick={() => change(b, "check-in")}
                        >
                          Confirm arrival
                        </button>
                      ) : b.status === "parked" ? (
                        <button
                          disabled={busy === b.id}
                          onClick={() => change(b, "check-out")}
                        >
                          Check out
                        </button>
                      ) : (
                        <span>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
      <SyncStatus resource={resource} />
    </>
  );
}
export function OwnerActivity() {
  const resource = useResource("/owner/activity");
  return (
    <>
      <Heading eyebrow="OWNER / ACTIVITY" title="Every change, recorded.">
        Reservations and parking changes with the account that performed them.
      </Heading>
      {resource.error && <Notice error>{resource.error}</Notice>}
      <Panel title="Latest facility activity">
        {resource.loading ? (
          <p className="pw-pad">Loading activity…</p>
        ) : !resource.data?.length ? (
          <Empty title="No activity yet">
            Create a facility to start its operating history.
          </Empty>
        ) : (
          <div className="pw-activity">
            {resource.data.map((a) => (
              <article key={a.id}>
                <time>{date(a.created_at)}</time>
                <div>
                  <strong>{a.message}</strong>
                  <p>
                    {a.facility_name} · {a.actor_name}
                  </p>
                </div>
              </article>
            ))}
          </div>
        )}
      </Panel>
      <SyncStatus resource={resource} />
    </>
  );
}
