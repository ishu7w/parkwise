import { useState } from "react";
import { reportCsv } from "./reportFiles";
import { mutate, useResource, money, date } from "./api";
import { Heading, Panel, Notice, Empty, SyncStatus } from "./Common";

export function Account({ user, onUpdated }) {
  const [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function save(e, password = false) {
    e.preventDefault();
    const form = e.currentTarget,
      values = Object.fromEntries(new FormData(form));
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await mutate(
        password ? "/account/password" : "/account",
        values,
        password ? "POST" : "PATCH",
      );
      if (result.user) onUpdated(result.user);
      if (password) form.reset();
      setMessage(
        password
          ? "Password changed. Other sessions have been signed out."
          : "Account name updated.",
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Heading eyebrow="YOUR ACCOUNT" title="Your details. Under your control.">
        Manage your display name and keep your account secure.
      </Heading>
      {error && <Notice error>{error}</Notice>}
      {message && <Notice>{message}</Notice>}
      <div className="pw-driver-tools-grid">
        <Panel title="Profile">
          <form className="pw-tool-form pw-pad" onSubmit={save}>
            <p>
              {user.email} · {user.role} account
            </p>
            <label>
              Full name
              <input
                name="name"
                defaultValue={user.name}
                minLength={2}
                maxLength={80}
                required
                autoComplete="name"
              />
            </label>
            <button disabled={busy} className="pw-primary">
              Save profile
            </button>
          </form>
        </Panel>
        <Panel title="Change password">
          <form className="pw-tool-form pw-pad" onSubmit={(e) => save(e, true)}>
            <label>
              Current password
              <input
                type="password"
                name="currentPassword"
                required
                minLength={10}
                maxLength={128}
                autoComplete="current-password"
              />
            </label>
            <label>
              New password
              <input
                type="password"
                name="newPassword"
                required
                minLength={10}
                maxLength={128}
                autoComplete="new-password"
              />
            </label>
            <p className="pw-small">
              Changing your password signs out all other sessions. Keep this
              password safe; email recovery is not connected yet.
            </p>
            <button disabled={busy} className="pw-primary">
              Change password
            </button>
          </form>
        </Panel>
      </div>
    </>
  );
}
export function HelpInbox({ owner = false }) {
  const resource = useResource("/help");
  const params = new URLSearchParams(location.search),
    initial = params.get("booking");
  const [selected, setSelected] = useState(initial);
  return (
    <>
      <Heading
        eyebrow={owner ? "OWNER / BOOKING HELP" : "YOUR BOOKING HELP"}
        title="A direct line to your parking."
      >
        Questions about an arrival or stay stay attached to the booking. Replies
        appear here; this is not an emergency service.
      </Heading>
      {resource.error && <Notice error>{resource.error}</Notice>}
      <div className="pw-driver-tools-grid">
        <Panel title="Conversations">
          <div className="pw-pad">
            {resource.loading ? (
              <p>Loading conversations…</p>
            ) : !resource.data?.length ? (
              <Empty title="No conversations yet">
                Open a parking pass and choose Get help for a booking question.
              </Empty>
            ) : (
              resource.data.map((b) => (
                <button
                  className="pw-help-row"
                  key={b.id}
                  onClick={() => setSelected(b.id)}
                  aria-pressed={b.id === selected}
                >
                  <strong>{b.facility_name}</strong>
                  <span>
                    {b.reference} · {b.plate}
                  </span>
                  <small>
                    {b.help_resolved_at ? "Resolved" : "Open"} ·{" "}
                    {date(b.last_message_at)}
                  </small>
                </button>
              ))
            )}
          </div>
        </Panel>
        {selected ? (
          <BookingConversation
            key={selected}
            id={selected}
            onUpdated={resource.refresh}
          />
        ) : (
          <Empty title="Choose a booking conversation">
            Messages are visible only to the driver and facility owner.
          </Empty>
        )}
      </div>
      <SyncStatus resource={resource} />
    </>
  );
}
function BookingConversation({ id, onUpdated }) {
  const resource = useResource("/bookings/" + id + "/messages"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function act(path, body, method = "POST") {
    setBusy(true);
    setError("");
    try {
      await mutate(path, body, method);
      setMessage("");
      await resource.refresh();
      await onUpdated();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const b = resource.data?.booking;
  return (
    <Panel title={b ? b.reference : "Booking conversation"}>
      <div className="pw-pad">
        {(resource.error || error) && (
          <Notice error>{error || resource.error}</Notice>
        )}
        {b && (
          <>
            <h3>{b.facility_name}</h3>
            <p>
              {b.plate} · {b.driver_name}
            </p>
            <div className="pw-messages">
              {resource.data.messages.map((m) => (
                <article key={m.id}>
                  <strong>
                    {m.actor_name} · {m.actor_role}
                  </strong>
                  <small>{date(m.created_at)}</small>
                  <p>{m.message}</p>
                </article>
              ))}
            </div>
            {b.help_resolved_at ? (
              <Notice>This conversation is resolved.</Notice>
            ) : (
              <form
                className="pw-tool-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  act("/bookings/" + id + "/messages", { message });
                }}
              >
                <label>
                  Message
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    required
                    minLength={2}
                    maxLength={1000}
                    rows={4}
                  />
                </label>
                <button className="pw-primary" disabled={busy}>
                  Send message
                </button>
              </form>
            )}
            <button
              disabled={busy}
              onClick={() =>
                act(
                  "/bookings/" + id + "/help",
                  { resolved: !b.help_resolved_at },
                  "PATCH",
                )
              }
            >
              {b.help_resolved_at ? "Reopen conversation" : "Mark resolved"}
            </button>
          </>
        )}
      </div>
      <SyncStatus resource={resource} />
    </Panel>
  );
}
export function ReviewForm({ booking: b, onUpdated }) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    const values = Object.fromEntries(new FormData(e.currentTarget));
    setBusy(true);
    setError("");
    try {
      await mutate("/bookings/" + b.id + "/review", values);
      await onUpdated();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="pw-review-form">
      <summary>
        {b.review ? "Edit your review" : "Review your completed stay"}
      </summary>
      {error && <Notice error>{error}</Notice>}
      <form className="pw-tool-form" onSubmit={submit}>
        <label>
          Rating
          <select
            name="rating"
            aria-label="Rating"
            defaultValue={b.review?.rating || 5}
          >
            {[5, 4, 3, 2, 1].map((n) => (
              <option key={n} value={n}>
                {n} / 5
              </option>
            ))}
          </select>
        </label>
        <label>
          Your review
          <textarea
            name="comment"
            defaultValue={b.review?.comment || ""}
            required
            minLength={5}
            maxLength={500}
            rows={3}
          />
        </label>
        <p className="pw-small">
          Only completed stays can be reviewed. Your first name and review are
          visible on the facility page. Do not include private contact details.
        </p>
        <button className="pw-primary" disabled={busy}>
          Save review
        </button>
      </form>
    </details>
  );
}
export function PaymentControl({ booking: b, onUpdated }) {
  const [confirm, setConfirm] = useState(false),
    [method, setMethod] = useState("cash"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const due = b.price - b.paid_total;
  async function record() {
    setBusy(true);
    setError("");
    try {
      await mutate("/owner/bookings/" + b.id + "/payment", {
        method,
        amount: due,
        confirmReceived: true,
      });
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
    <div className="pw-payment-control">
      <strong>{money(b.paid_total)} recorded</strong>
      <small>{money(due)} remaining</small>
      {["parked", "completed"].includes(b.status) && due > 0 && (
        <>
          <select
            aria-label={"Payment method for " + b.reference}
            value={method}
            onChange={(e) => setMethod(e.target.value)}
          >
            <option value="cash">Cash</option>
            <option value="upi">UPI received</option>
            <option value="card">Card at facility</option>
          </select>
          <button
            disabled={busy}
            onClick={() => (confirm ? record() : setConfirm(true))}
          >
            {confirm ? "Confirm money received" : "Record payment"}
          </button>
          {confirm && (
            <p>
              Record {money(due)} actually received for {b.reference}? This does
              not charge the driver.{" "}
              <button onClick={() => setConfirm(false)}>Cancel</button>
            </p>
          )}
        </>
      )}
      {error && <Notice error>{error}</Notice>}
    </div>
  );
}
export function OwnerReports() {
  const day = (value) =>
    new Date(value.getTime() - value.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 10);
  const [from, setFrom] = useState(day(new Date(Date.now() - 29 * 86400000))),
    [to, setTo] = useState(day(new Date()));
  const fromDate = new Date(from + "T00:00:00"),
    toDate = new Date(to + "T00:00:00");
  toDate.setDate(toDate.getDate() + 1);
  const valid =
    Number.isFinite(fromDate.getTime()) && Number.isFinite(toDate.getTime());
  const params = new URLSearchParams({
    from: valid ? fromDate.toISOString() : "",
    to: valid ? toDate.toISOString() : "",
  });
  const resource = useResource("/owner/report?" + params);
  const records = resource.data || [];
  const collections = records.reduce((n, b) => n + b.paid_total, 0);
  function download() {
    const url = URL.createObjectURL(
      new Blob([reportCsv(records)], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "parkwise-bookings.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <>
      <Heading
        eyebrow="OWNER / REPORTS"
        title="Your bookings. The actual numbers."
      >
        Choose up to 31 days, filtered by booked arrival date. Payment totals
        below are recorded receipts for those bookings, not bank settlement or
        payment-date revenue.
      </Heading>
      <div className="pw-discovery-filters">
        <label>
          From date
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label>
          To date
          <input
            type="date"
            min={from}
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        <button
          onClick={download}
          disabled={!records.length || !!resource.error || resource.loading}
        >
          Export bookings CSV
        </button>
      </div>
      {resource.error && <Notice error>{resource.error}</Notice>}
      <div className="pw-owner-metrics">
        {[
          ["Bookings", records.length],
          [
            "Completed stays",
            records.filter((b) => b.status === "completed").length,
          ],
          ["Payments recorded", money(collections)],
          [
            "Cancelled / expired",
            records.filter((b) => ["cancelled", "expired"].includes(b.status))
              .length,
          ],
        ].map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <Panel title="Payment ledger">
        <div className="pw-pad">
          {!records.some((b) => b.payments.length) ? (
            <p>No payments recorded for this selection.</p>
          ) : (
            records.flatMap((b) =>
              b.payments.map((p) => (
                <div key={p.id} className="pw-saved-row">
                  <div>
                    <strong>
                      {b.reference} · {b.facility_name}
                    </strong>
                    <p>
                      {date(p.created_at)} · {p.method}
                    </p>
                  </div>
                  <strong>{money(p.amount)}</strong>
                </div>
              )),
            )
          )}
        </div>
      </Panel>
      <SyncStatus resource={resource} />
    </>
  );
}
