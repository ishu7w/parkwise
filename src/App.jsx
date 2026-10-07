import { useEffect, useRef, useState } from "react";
import { Command, ArrowUpRight, LogOut } from "lucide-react";
import gsap from "gsap";
import { api, mutate } from "./product/api";
import { Discover, MyParking } from "./product/Driver";
import { OwnerFacilities, OwnerBookings, OwnerActivity } from "./product/Owner";
import Auth from "./product/Auth";
import { DriverGarage } from "./product/DriverTools";
import { Account, HelpInbox, OwnerReports } from "./product/Operations";
import { Notice } from "./product/Common";
import "./product/product.css";
function route() {
  const value = location.hash.slice(1);
  return [
    "Discover",
    "MyParking",
    "Garage",
    "Account",
    "Help",
    "OwnerHelp",
    "Reports",
    "Owner",
    "Facilities",
    "OwnerActivity",
    "SignIn",
  ].includes(value)
    ? value
    : "Discover";
}
export default function App() {
  const [page, setPage] = useState(route),
    [user, setUser] = useState(null),
    [bookingIntent, setBookingIntent] = useState(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const main = useRef(null);
  const ownerPage =
      ["Owner", "Facilities", "OwnerActivity", "OwnerHelp", "Reports"].includes(
        page,
      ) ||
      (page === "Account" && user?.role === "owner"),
    mode = ownerPage ? "owner" : "driver";
  useEffect(() => {
    const update = () => setPage(route());
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  useEffect(() => {
    let active = true;
    api("/session")
      .then((s) => {
        if (active) setUser(s.user);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    document.title = `${ownerPage ? "Owner" : "Driver"} · Parkwise`;
    window.scrollTo(0, 0);
    if (loading || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = gsap.context(
      () =>
        gsap.from(".pw-heading,.pw-auth-card", {
          opacity: 0,
          y: 12,
          duration: 0.35,
          ease: "power2.out",
          stagger: 0.05,
        }),
      main,
    );
    return () => ctx.revert();
  }, [page, loading, user, ownerPage]);
  function signedIn(account) {
    setUser(account);
    setError("");
    location.hash =
      account.role === "owner"
        ? "Owner"
        : bookingIntent
          ? "Discover"
          : "MyParking";
  }
  async function signOut() {
    try {
      await mutate("/auth/logout");
      setUser(null);
      setBookingIntent(null);
      location.hash = "Discover";
    } catch (e) {
      setError(e.message);
    }
  }
  const links = ownerPage
    ? [
        ["Owner", "Arrivals"],
        ["Facilities", "Facilities"],
        ["OwnerActivity", "Activity"],
        ["Reports", "Reports"],
        ["OwnerHelp", "Help"],
      ]
    : [
        ["Discover", "Find parking"],
        ["MyParking", "My parking"],
        ["Garage", "My garage"],
        ["Help", "Help"],
      ];
  let content;
  if (loading)
    content = (
      <div className="pw-loading">Connecting to your parking workspace…</div>
    );
  else if (
    (ownerPage ||
      ["MyParking", "Garage", "SignIn", "Account", "Help"].includes(page)) &&
    !user
  )
    content = <Auth role={mode} onAuthenticated={signedIn} />;
  else if (ownerPage && user.role !== "owner")
    content = (
      <div className="pw-empty">
        <h1>Parking owner account required</h1>
        <p>You are signed in as a driver. Sign out to use an owner account.</p>
        <button onClick={signOut}>Sign out</button>
      </div>
    );
  else if (["MyParking", "Garage"].includes(page) && user.role !== "driver")
    content = (
      <div className="pw-empty">
        <h1>Driver account required</h1>
        <p>
          You are signed in as a parking owner. Your reservations are managed in
          the owner workspace.
        </p>
        <a className="pw-button pw-primary" href="#Owner">
          Open owner workspace
        </a>
      </div>
    );
  else if (page === "Owner") content = <OwnerBookings />;
  else if (page === "Facilities") content = <OwnerFacilities />;
  else if (page === "OwnerActivity") content = <OwnerActivity />;
  else if (page === "MyParking") content = <MyParking />;
  else if (page === "Garage") content = <DriverGarage />;
  else if (page === "Account")
    content = <Account user={user} onUpdated={setUser} />;
  else if (["Help", "OwnerHelp"].includes(page))
    content = <HelpInbox owner={ownerPage} />;
  else if (page === "Reports") content = <OwnerReports />;
  else if (page === "SignIn")
    content = (
      <div className="pw-empty">
        <h1>You’re signed in.</h1>
        <a
          href={user.role === "owner" ? "#Owner" : "#MyParking"}
          className="pw-button pw-primary"
        >
          Open your workspace
        </a>
      </div>
    );
  else
    content = (
      <Discover
        user={user}
        intent={bookingIntent}
        onBooked={() => setBookingIntent(null)}
        onSignIn={(intent) => {
          setBookingIntent(intent);
          location.hash = "SignIn";
        }}
      />
    );
  return (
    <div className="parkwise">
      <a
        className="pw-skip"
        href="#content"
        onClick={(e) => {
          e.preventDefault();
          main.current.focus();
        }}
      >
        Skip to content
      </a>
      <header className="pw-header">
        <a className="pw-brand" href="#Discover">
          <span>
            <Command size={21} />
          </span>
          parkwise<small>SPACE, IN ORDER.</small>
        </a>
        <nav aria-label="Main navigation">
          {links.map(([id, label], i) => (
            <a
              href={"#" + id}
              key={id}
              aria-current={page === id ? "page" : undefined}
            >
              <small>0{i + 1}</small>
              {label}
            </a>
          ))}
        </nav>
        <div className="pw-account">
          <a className="pw-mode-link" href={ownerPage ? "#Discover" : "#Owner"}>
            {ownerPage ? "Driver view" : "Parking owner"}
            <ArrowUpRight size={15} />
          </a>
          {user ? (
            <>
              <a
                href="#Account"
                className="pw-account-name"
                aria-label="Account settings"
              >
                {user.name}
              </a>
              <button aria-label="Sign out" onClick={signOut}>
                <LogOut size={16} />
              </button>
            </>
          ) : (
            <a
              href={ownerPage ? "#Owner" : "#SignIn"}
              className="pw-button pw-primary"
            >
              Sign in
            </a>
          )}
        </div>
      </header>
      <main id="content" tabIndex={-1} ref={main}>
        {error && (
          <Notice error>
            {error}{" "}
            <button onClick={() => location.reload()}>Retry connection</button>
          </Notice>
        )}
        {content}
      </main>
      <footer className="pw-footer">
        <a href="#Discover">parkwise</a>
        <span>FIND A SPACE. ARRIVE WITH A PLAN.</span>
        <a href="#Owner">For parking owners →</a>
      </footer>
    </div>
  );
}
