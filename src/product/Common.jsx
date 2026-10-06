import { MapPin, ArrowUpRight, LocateFixed } from "lucide-react";
import { date, money, statusLabel, categoryLabel } from "./api";
export function Heading({ eyebrow, title, children, action }) {
  return (
    <div className="pw-heading">
      <div>
        <span className="pw-eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        {children && <p>{children}</p>}
      </div>
      {action}
    </div>
  );
}
export function Panel({ title, aside, children, className = "" }) {
  return (
    <section className={"pw-panel " + className}>
      <div className="pw-panel-top">
        <h2>{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}
export function Notice({ error, children }) {
  return (
    <p
      className={"pw-notice " + (error ? "pw-error" : "")}
      role={error ? "alert" : "status"}
    >
      {children}
    </p>
  );
}
export function Empty({ title, children, action }) {
  return (
    <div className="pw-empty">
      <MapPin size={32} />
      <h2>{title}</h2>
      <p>{children}</p>
      {action}
    </div>
  );
}
export function SyncStatus({ resource }) {
  return (
    <div className="pw-sync">
      <span className={resource.error ? "pw-offline" : ""} />
      {resource.error
        ? "Refresh failed — previous records may be stale"
        : resource.loading
          ? "Loading parking records…"
          : resource.updated
            ? "Updated " +
              resource.updated.toLocaleTimeString() +
              " · refreshes every 5 sec"
            : "Connecting"}
      <button onClick={resource.refresh}>Refresh</button>
    </div>
  );
}
export function EntranceMap({ facility }) {
  const lat = Number(facility.latitude),
    lon = Number(facility.longitude),
    delta = 0.004,
    bbox = [lon - delta, lat - delta, lon + delta, lat + delta].join(",");
  const directions = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(lat + "," + lon)}&travelmode=driving`;
  return (
    <div className="pw-entrance">
      <iframe
        title={"Entrance map for " + (facility.name || facility.facility_name)}
        loading="eager"
        referrerPolicy="no-referrer"
        src={`https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lon}`}
      />
      <div>
        <span className="pw-eyebrow">PARKING ENTRANCE</span>
        <p>
          <MapPin size={16} />
          {facility.address}
        </p>
        <a
          className="pw-button pw-primary"
          href={directions}
          target="_blank"
          rel="noreferrer"
        >
          Directions to entrance
          <ArrowUpRight size={16} />
        </a>
        <small>
          {lat.toFixed(5)}, {lon.toFixed(5)} ·{" "}
          <a
            href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=18/${lat}/${lon}`}
            target="_blank"
            rel="noreferrer"
          >
            Open entrance map ↗
          </a>
        </small>
        <small>
          Entrance coordinates supplied by the parking owner. Directions open in
          Google Maps.
        </small>
      </div>
    </div>
  );
}
export function BayPlan({ bays, selected, interactive, onSelect }) {
  return (
    <div className="pw-floorplan">
      <div className="pw-plan-label">
        ENTRANCE <span>→</span> INTERNAL DRIVE AISLE
      </div>
      <div className="pw-bays">
        {bays.map((b) => {
          const kind = b.blocked
            ? "blocked"
            : b.booking_status === "parked"
              ? "parked"
              : b.booking_status === "reserved"
                ? "reserved"
                : selected === b.id
                  ? "selected"
                  : "free";
          return interactive ? (
            <button
              key={b.id}
              className={"pw-bay " + kind}
              onClick={() => onSelect(b)}
              aria-label={`Bay ${b.label}, ${b.blocked ? "blocked" : b.booking_status || "available"}`}
            >
              <strong>{b.label}</strong>
              <small>
                {b.category === "standard" ? "BAY" : b.category.toUpperCase()}
              </small>
              <span>
                {b.plate ||
                  {
                    blocked: "Blocked",
                    parked: "Occupied",
                    reserved: "Reserved",
                    selected: "Your bay",
                    free: "Available",
                  }[kind]}
              </span>
            </button>
          ) : (
            <div key={b.id} className={"pw-bay " + kind}>
              <strong>{b.label}</strong>
              <small>{b.category.toUpperCase()}</small>
              <span>{selected === b.id ? "Your bay" : "Bay"}</span>
            </div>
          );
        })}
      </div>
      <p className="pw-plan-note">
        Schematic bay layout. Follow the posted labels and the owner’s entrance
        instructions on arrival.
      </p>
    </div>
  );
}
export function ParkingPass({ booking, onCancel, busy }) {
  const b = booking;
  return (
    <article className="pw-pass">
      <header>
        <span className="pw-eyebrow">{b.reference}</span>
        <span className={"pw-status " + b.status}>{statusLabel[b.status]}</span>
      </header>
      <div className="pw-pass-main">
        <div>
          <h2>{b.facility_name}</h2>
          <p>{b.address}</p>
          <div className="pw-pass-times">
            <span>
              ARRIVAL<strong>{date(b.start_at)}</strong>
            </span>
            <span>
              DEPARTURE<strong>{date(b.end_at)}</strong>
            </span>
          </div>
          <p>
            <strong>{b.plate}</strong> · {categoryLabel[b.category]}
          </p>
        </div>
        <div className="pw-assignment">
          <span>ASSIGNED BAY</span>
          <strong>{b.bay_label}</strong>
          <p>{b.floor}</p>
        </div>
      </div>
      <div className="pw-pass-footer">
        <span>
          {money(b.price)} · Pay at facility ·{" "}
          {b.status === "parked"
            ? "Arrival confirmed by owner"
            : "Reservation amount"}
        </span>
        {b.status === "reserved" && onCancel && (
          <button disabled={busy} onClick={() => onCancel(b.id)}>
            Cancel reservation
          </button>
        )}
      </div>
      <details>
        <summary>
          <LocateFixed size={17} />
          Entrance & assigned bay
        </summary>
        <div className="pw-pass-location">
          <EntranceMap facility={b} />
          <div className="pw-arrival-card">
            <span className="pw-eyebrow">
              ENTRANCE → {b.floor} → {b.bay_label}
            </span>
            <h3>Go straight to your space.</h3>
            <p>{b.instructions}</p>
            <div className="pw-bay-marker">
              {b.bay_label}
              <span>Your assigned bay · {b.floor}</span>
            </div>
            <BayPlan
              bays={
                b.floor_plan || [
                  { id: b.bay_id, label: b.bay_label, category: b.category },
                ]
              }
              selected={b.bay_id}
            />
            <p>
              Ask the attendant to confirm arrival using{" "}
              <strong>{b.reference}</strong>. Check-in is available 15 minutes
              before arrival; unclaimed bookings expire 30 minutes after the
              booked arrival.
            </p>
          </div>
        </div>
      </details>
    </article>
  );
}
