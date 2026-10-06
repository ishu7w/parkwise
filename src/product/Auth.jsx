import { useState } from "react";
import { mutate } from "./api";
import { Heading, Notice } from "./Common";
export default function Auth({ role, onAuthenticated }) {
  const [mode, setMode] = useState("login"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const values = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const result = await mutate("/auth/" + mode, { ...values, role });
      onAuthenticated(result.user);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="pw-auth-grid">
      <div className="pw-auth-intro">
        <Heading
          eyebrow={role === "owner" ? "FOR PARKING OWNERS" : "FOR DRIVERS"}
          title={
            role === "owner"
              ? "Your parking.\nUnder control."
              : "Your space.\nBefore you arrive."
          }
        >
          {role === "owner"
            ? "Publish your facility, manage arrivals and keep every bay accounted for."
            : "Book an available bay and get the entrance location and arrival instructions in one pass."}
        </Heading>
        <div className="pw-auth-route">
          <span>
            01 ·{" "}
            {role === "owner" ? "Publish your facility" : "Choose a facility"}
          </span>
          <span>
            02 · {role === "owner" ? "Receive bookings" : "Reserve a bay"}
          </span>
          <span>
            03 · {role === "owner" ? "Confirm arrival" : "Navigate & park"}
          </span>
        </div>
      </div>
      <section className="pw-auth-card">
        <span className="pw-eyebrow">
          {mode === "login" ? "WELCOME BACK" : "CREATE YOUR ACCOUNT"}
        </span>
        <h2>{mode === "login" ? "Sign in" : "Get started"}</h2>
        <p>
          {role === "owner"
            ? "Parking owner workspace"
            : "Driver parking account"}
        </p>
        {error && <Notice error>{error}</Notice>}
        <form onSubmit={submit}>
          {mode === "register" && (
            <label>
              Full name
              <input
                name="name"
                required
                minLength={2}
                maxLength={80}
                autoComplete="name"
              />
            </label>
          )}
          <label>
            Email address
            <input
              type="email"
              name="email"
              required
              maxLength={254}
              autoComplete="email"
            />
          </label>
          <label>
            Password
            <input
              type="password"
              aria-label="Password"
              name="password"
              required
              minLength={10}
              maxLength={128}
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
            />
            <small>At least 10 characters.</small>
          </label>
          <button className="pw-primary" disabled={busy}>
            {busy
              ? "Please wait…"
              : mode === "login"
                ? "Sign in"
                : "Create " +
                  (role === "owner" ? "owner" : "driver") +
                  " account"}
          </button>
        </form>
        <button
          className="pw-text-button"
          onClick={() => {
            setMode(mode === "login" ? "register" : "login");
            setError("");
          }}
        >
          {mode === "login"
            ? "New here? Create an account"
            : "Already registered? Sign in"}
        </button>
      </section>
    </div>
  );
}
