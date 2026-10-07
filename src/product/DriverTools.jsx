import { useState } from "react";
import { calendarFile, bookingFile } from "./driverFiles";
import { mutate, useResource, money, date } from "./api";
import { Heading, Panel, Notice, Empty, SyncStatus } from "./Common";

export function DriverGarage() {
  const resource = useResource("/driver/garage");
  const [plate, setPlate] = useState(""),
    [label, setLabel] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function change(path, body = {}, method = "POST") {
    setBusy(true);
    setError("");
    try {
      await mutate(path, body, method);
      await resource.refresh();
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Heading
        eyebrow="YOUR EVERYDAY PARKING"
        title="Your garage. Your go-to spaces."
      >
        Keep vehicle plates and favourite parking together, ready for your next
        arrival.
      </Heading>
      {error && <Notice error>{error}</Notice>}
      {resource.error && <Notice error>{resource.error}</Notice>}
      <div className="pw-driver-tools-grid">
        <Panel title="My vehicles">
          <div className="pw-pad">
            <form
              className="pw-tool-form"
              onSubmit={async (e) => {
                e.preventDefault();
                if (await change("/driver/vehicles", { plate, label })) {
                  setPlate("");
                  setLabel("");
                }
              }}
            >
              <label>
                Vehicle name
                <input
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  required
                  maxLength={50}
                  placeholder="Daily car"
                />
              </label>
              <label>
                Vehicle plate
                <input
                  value={plate}
                  onChange={(e) => setPlate(e.target.value)}
                  required
                  minLength={3}
                  maxLength={15}
                  placeholder="MH12 AB1234"
                />
              </label>
              <button className="pw-primary" disabled={busy}>
                {busy ? "Saving…" : "Save vehicle"}
              </button>
            </form>
            <p className="pw-small">
              Saving an existing plate updates its name. Removing a vehicle
              keeps its booking history.
            </p>
            {resource.loading ? (
              <p>Loading vehicles…</p>
            ) : !resource.data?.vehicles.length ? (
              <p>No saved vehicles yet.</p>
            ) : (
              resource.data.vehicles.map((v) => (
                <div className="pw-saved-row" key={v.id}>
                  <div>
                    <strong>{v.label}</strong>
                    <p>{v.plate}</p>
                  </div>
                  <button
                    disabled={busy}
                    onClick={() =>
                      change("/driver/vehicles/" + v.id + "/remove")
                    }
                  >
                    Remove vehicle
                  </button>
                </div>
              ))
            )}
          </div>
        </Panel>
        <Panel title="Saved parking">
          <div className="pw-pad">
            {resource.loading ? (
              <p>Loading saved parking…</p>
            ) : !resource.data?.favorites.length ? (
              <Empty
                title="Keep a good space close"
                action={
                  <a href="#Discover" className="pw-button">
                    Find parking →
                  </a>
                }
              >
                Save a facility from its booking details to find it here next
                time.
              </Empty>
            ) : (
              resource.data.favorites.map((f) => (
                <div className="pw-saved-row" key={f.id}>
                  <div>
                    <strong>{f.name}</strong>
                    <p>{f.address}</p>
                    <small>
                      {money(f.hourly_rate)} / hour ·{" "}
                      {f.published
                        ? "Accepting bookings"
                        : "Currently unpublished"}
                    </small>
                    <p>
                      {f.published && (
                        <a
                          className="pw-button"
                          href={
                            "?parking=" + encodeURIComponent(f.id) + "#Discover"
                          }
                        >
                          View availability →
                        </a>
                      )}
                    </p>
                  </div>
                  <button
                    disabled={busy}
                    onClick={() =>
                      change(
                        "/driver/favorites/" + f.id,
                        { saved: false },
                        "PATCH",
                      )
                    }
                  >
                    Unsave
                  </button>
                </div>
              ))
            )}
          </div>
        </Panel>
      </div>
      <SyncStatus resource={resource} />
    </>
  );
}
function download(filename, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function BookingTools({ booking: b, onUpdated }) {
  const [minutes, setMinutes] = useState(
      Math.min(
        60,
        480 -
          Math.round((Date.parse(b.end_at) - Date.parse(b.start_at)) / 60000),
      ),
    ),
    [confirm, setConfirm] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const active = ["reserved", "parked"].includes(b.status),
    totalMinutes = Math.round(
      (Date.parse(b.end_at) - Date.parse(b.start_at)) / 60000,
    );
  const increments = [30, 60, 120].filter((m) => totalMinutes + m <= 480);
  const extraMinutes = increments.includes(minutes) ? minutes : increments[0];
  const extendable =
    active && Date.parse(b.end_at) > Date.now() && increments.length > 0;
  const extra =
    Math.ceil((totalMinutes + (extraMinutes || 0)) / 60) *
      b.booked_hourly_rate -
    b.price;
  async function extend() {
    setBusy(true);
    setError("");
    try {
      await mutate("/bookings/" + b.id + "/extend", { minutes: extraMinutes });
      setConfirm(false);
      await onUpdated();
    } catch (e) {
      setError(e.message);
      setConfirm(false);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="pw-booking-tools">
      {active && (
        <p className="pw-time-note">
          {Date.parse(b.end_at) <= Date.now()
            ? "Booked departure has passed. Speak to the attendant before leaving."
            : `Booked until ${date(b.end_at)}. ${b.status === "reserved" ? "Show your reference to the attendant on arrival." : "Need more time? Extend before departure."}`}
        </p>
      )}
      <div className="pw-tool-actions">
        <button
          onClick={() =>
            download(
              b.reference + ".txt",
              bookingFile(b),
              "text/plain;charset=utf-8",
            )
          }
        >
          Download booking details
        </button>
        {active && (
          <button
            onClick={() =>
              download(
                b.reference + ".ics",
                calendarFile(b),
                "text/calendar;charset=utf-8",
              )
            }
          >
            Add to calendar
          </button>
        )}
        {["completed", "cancelled", "expired"].includes(b.status) && (
          <a
            className="pw-button"
            href={"?parking=" + encodeURIComponent(b.facility_id) + "#Discover"}
          >
            Book this parking again →
          </a>
        )}
      </div>
      {extendable && (
        <div className="pw-extension">
          <label>
            Extra parking time
            <select
              value={extraMinutes}
              onChange={(e) => {
                setMinutes(Number(e.target.value));
                setConfirm(false);
              }}
            >
              {increments.map((m) => (
                <option key={m} value={m}>
                  +{m} minutes
                </option>
              ))}
            </select>
          </label>
          <div>
            <strong>{money(extra)} extra</strong>
            <small>Original rate · rounded up to whole hours</small>
          </div>
          <button
            className="pw-primary"
            disabled={busy}
            onClick={() => (confirm ? extend() : setConfirm(true))}
          >
            {busy
              ? "Checking availability…"
              : confirm
                ? "Confirm extension"
                : "Extend parking"}
          </button>
          {confirm && (
            <p role="status">
              New departure:{" "}
              {date(new Date(Date.parse(b.end_at) + extraMinutes * 60000))}.
              Total {money(b.price + extra)}.{" "}
              <button onClick={() => setConfirm(false)}>
                Keep current time
              </button>
            </p>
          )}
        </div>
      )}
      {error && <Notice error>{error}</Notice>}
      {active && (
        <p className="pw-small">
          Calendar reminders work after importing the file into your calendar
          app. Download again after extending your booking.
        </p>
      )}
    </div>
  );
}
