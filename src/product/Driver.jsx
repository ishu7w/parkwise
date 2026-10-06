import { useState } from "react";
import { Search, Navigation, ArrowRight, MapPin } from "lucide-react";
import {
  api,
  mutate,
  useResource,
  money,
  localTime,
  categoryLabel,
} from "./api";
import {
  Heading,
  Panel,
  Notice,
  Empty,
  SyncStatus,
  EntranceMap,
  ParkingPass,
  BayPlan,
} from "./Common";
function distance(a, b) {
  const rad = (v) => (v * Math.PI) / 180,
    dlat = rad(b.latitude - a.latitude),
    dlon = rad(b.longitude - a.longitude),
    x =
      Math.sin(dlat / 2) ** 2 +
      Math.cos(rad(a.latitude)) *
        Math.cos(rad(b.latitude)) *
        Math.sin(dlon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}
export function Discover({ user, onSignIn }) {
  const [search, setSearch] = useState(""),
    [q, setQ] = useState(""),
    [arrival, setArrival] = useState("now"),
    [startAt, setStartAt] = useState(localTime()),
    [duration, setDuration] = useState(60),
    [category, setCategory] = useState("standard"),
    [selected, setSelected] = useState(null),
    [position, setPosition] = useState(null),
    [locating, setLocating] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [plate, setPlate] = useState("");
  const params = new URLSearchParams({
    duration: String(duration),
    category,
    q,
    ...(arrival === "scheduled"
      ? { startAt: new Date(startAt).toISOString() }
      : {}),
  }).toString();
  const listings = useResource("/facilities?" + params);
  const detail = useResource(
    selected ? "/facilities/" + selected + "?" + params : null,
  );
  let facilities = listings.data || [];
  if (position)
    facilities = [...facilities].sort(
      (a, b) => distance(position, a) - distance(position, b),
    );
  const facility = detail.data;
  async function locate() {
    if (!navigator.geolocation) {
      setError("Location is unavailable. Search by address instead.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setPosition({
          latitude: p.coords.latitude,
          longitude: p.coords.longitude,
        });
        setLocating(false);
        setError("");
      },
      () => {
        setError(
          "Location access was unavailable. You can still search by address.",
        );
        setLocating(false);
      },
      { timeout: 10000, maximumAge: 60000 },
    );
  }
  async function reserve(e) {
    e.preventDefault();
    if (!user) {
      onSignIn();
      return;
    }
    if (user.role !== "driver") {
      setError("Sign in with a driver account to reserve parking.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await mutate("/bookings", {
        facilityId: facility.id,
        plate,
        duration,
        category,
        ...(arrival === "scheduled"
          ? { startAt: new Date(startAt).toISOString() }
          : {}),
      });
      location.hash = "MyParking";
    } catch (e) {
      setError(e.message);
      detail.refresh();
      listings.refresh();
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Heading
        eyebrow="FIND YOUR NEXT SPACE"
        title={
          <>
            Park closer.
            <br />
            <em>Arrive certain.</em>
          </>
        }
      >
        Choose your arrival, reserve an available bay, and get directions to the
        entrance.
      </Heading>
      <form
        className="pw-search-controls"
        onSubmit={(e) => {
          e.preventDefault();
          setQ(search);
        }}
      >
        <label className="pw-search-label">
          Where are you parking?
          <div>
            <Search size={18} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search parking name or address"
              maxLength={100}
            />
          </div>
        </label>
        <label>
          Arrival
          <select value={arrival} onChange={(e) => setArrival(e.target.value)}>
            <option value="now">Arriving now</option>
            <option value="scheduled">Choose date & time</option>
          </select>
        </label>
        {arrival === "scheduled" && (
          <label>
            Arrival time
            <input
              aria-label="Arrival time"
              type="datetime-local"
              required
              value={startAt}
              onChange={(e) => setStartAt(e.target.value || localTime())}
            />
          </label>
        )}
        <label>
          Duration
          <select
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
          >
            {[30, 60, 120, 180, 240, 480].map((m) => (
              <option value={m} key={m}>
                {m < 60
                  ? m + " minutes"
                  : m === 60
                    ? "1 hour"
                    : m / 60 + " hours"}
              </option>
            ))}
          </select>
        </label>
        <label>
          Space type
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {Object.entries(categoryLabel).map(([v, label]) => (
              <option value={v} key={v}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button className="pw-primary">Find parking</button>
      </form>
      <div className="pw-results-meta">
        <span>
          {listings.data
            ? facilities.length +
              " published parking " +
              (facilities.length === 1 ? "facility" : "facilities")
            : "PARKING DIRECTORY"}
          {position ? " · nearest first" : ""}
        </span>
        <button onClick={locate} disabled={locating}>
          <Navigation size={16} />
          {locating ? "Locating…" : "Use my location"}
        </button>
      </div>
      {error && <Notice error>{error}</Notice>}
      {listings.error && <Notice error>{listings.error}</Notice>}
      <div className="pw-discovery-grid">
        <div className="pw-results">
          {listings.loading ? (
            <div className="pw-empty">Loading available parking…</div>
          ) : !facilities.length ? (
            <Empty
              title={q ? "No matching parking" : "No published parking yet"}
              action={
                <a className="pw-button" href="#Owner">
                  List a parking facility →
                </a>
              }
            >
              {q
                ? "Try another address or parking name."
                : "Parking owners can create and publish a facility. Published spaces will appear here."}
            </Empty>
          ) : (
            facilities.map((f) => (
              <button
                className={
                  "pw-facility-card " + (selected === f.id ? "active" : "")
                }
                key={f.id}
                onClick={() => {
                  setSelected(f.id);
                  setError("");
                }}
              >
                <div className="pw-facility-top">
                  <span className="pw-eyebrow">{f.floor}</span>
                  <span className="pw-availability">
                    {f.available} compatible bays
                  </span>
                </div>
                <h2>{f.name}</h2>
                <p>
                  <MapPin size={15} />
                  {f.address}
                </p>
                <footer>
                  <span>
                    <strong>{money(f.hourly_rate)}</strong> / hour
                    {position && (
                      <small>
                        {distance(position, f).toFixed(1)} km straight-line
                        distance
                      </small>
                    )}
                  </span>
                  <span>
                    View parking <ArrowRight size={18} />
                  </span>
                </footer>
              </button>
            ))
          )}
        </div>
        <div className="pw-detail">
          {!selected ? (
            <div className="pw-location-empty">
              <MapPin size={56} strokeWidth={1} />
              <h2>
                A clear route.
                <br />A confirmed bay.
              </h2>
              <p>
                Select a published parking facility to view its entrance,
                arrival instructions and availability.
              </p>
            </div>
          ) : detail.loading ? (
            <Panel title="Parking details">
              <p className="pw-pad">Loading facility…</p>
            </Panel>
          ) : detail.error ? (
            <Notice error>{detail.error}</Notice>
          ) : (
            facility && (
              <>
                <EntranceMap facility={facility} />
                <Panel
                  title="Reserve your bay"
                  aside={<span>{facility.availableBays.length} available</span>}
                >
                  <div className="pw-pad">
                    <h3>{facility.name}</h3>
                    <p className="pw-instructions">{facility.instructions}</p>
                    <div className="pw-quote">
                      <span>
                        {duration} min · {categoryLabel[category]}
                      </span>
                      <strong>
                        {money(Math.ceil(duration / 60) * facility.hourly_rate)}
                      </strong>
                      <small>
                        Pay at facility. No online payment is collected.
                      </small>
                    </div>
                    <form className="pw-book-form" onSubmit={reserve}>
                      <label>
                        Vehicle plate
                        <input
                          value={plate}
                          onChange={(e) => setPlate(e.target.value)}
                          placeholder="MH12 AB1234"
                          required
                          minLength={3}
                          maxLength={15}
                        />
                      </label>
                      <button
                        className="pw-primary"
                        disabled={busy || !facility.availableBays.length}
                      >
                        {busy
                          ? "Reserving…"
                          : !facility.availableBays.length
                            ? "No compatible bays"
                            : !user
                              ? "Sign in to reserve"
                              : "Reserve a bay"}
                      </button>
                    </form>
                    <p className="pw-small">
                      An exact compatible bay is assigned when your reservation
                      is confirmed. Check-in grace: 30 minutes after arrival.
                    </p>
                  </div>
                </Panel>
              </>
            )
          )}
        </div>
      </div>
      <SyncStatus resource={listings} />
    </>
  );
}
export function MyParking() {
  const resource = useResource("/bookings"),
    [filter, setFilter] = useState("active"),
    [confirm, setConfirm] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const records = (resource.data || []).filter(
    (b) => filter === "all" || ["reserved", "parked"].includes(b.status),
  );
  async function cancel(id) {
    if (confirm !== id) {
      setConfirm(id);
      return;
    }
    setBusy(true);
    try {
      await mutate("/bookings/" + id + "/cancel");
      setConfirm(null);
      setError("");
      resource.refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Heading
        eyebrow="YOUR PARKING PASSES"
        title="A space with your name on it."
      >
        Your reservations, assigned bays and arrival details stay together.
      </Heading>
      <div className="pw-tabs">
        <button
          className={filter === "active" ? "active" : ""}
          onClick={() => setFilter("active")}
        >
          Upcoming & active
        </button>
        <button
          className={filter === "all" ? "active" : ""}
          onClick={() => setFilter("all")}
        >
          All parking
        </button>
      </div>
      {error && <Notice error>{error}</Notice>}
      {resource.error && <Notice error>{resource.error}</Notice>}
      {confirm && (
        <Notice>
          Cancel this reservation? Click its Cancel reservation button again to
          confirm, or{" "}
          <button onClick={() => setConfirm(null)}>keep reservation</button>.
        </Notice>
      )}
      {resource.loading ? (
        <p className="pw-pad">Loading your parking passes…</p>
      ) : !records.length ? (
        <Empty
          title="No parking passes here yet"
          action={
            <a href="#Discover" className="pw-button pw-primary">
              Find parking →
            </a>
          }
        >
          Reserve a bay at a published facility to get your arrival pass.
        </Empty>
      ) : (
        <div className="pw-passes">
          {records.map((b) => (
            <ParkingPass key={b.id} booking={b} busy={busy} onCancel={cancel} />
          ))}
        </div>
      )}
      <SyncStatus resource={resource} />
    </>
  );
}
