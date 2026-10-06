import { useEffect, useRef, useState, useCallback } from "react";
export async function api(path, options = {}) {
  const response = await fetch("/api" + path, {
    credentials: "same-origin",
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  let result;
  try {
    result = await response.json();
  } catch {
    throw Error(
      "The parking service did not return a valid response. Please try again.",
    );
  }
  if (!response.ok || !result.success) {
    const error = Error(result.error || "Request failed.");
    error.status = response.status;
    throw error;
  }
  return result.data;
}
export const mutate = (path, body = {}, method = "POST") =>
  api(path, { method, body: JSON.stringify(body) });
export function useResource(path) {
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [updated, setUpdated] = useState(null);
  const version = useRef(0);
  const refresh = useCallback(async () => {
    if (!path) return;
    const current = ++version.current;
    try {
      const value = await api(path);
      if (version.current === current) {
        setData(value);
        setError("");
        setUpdated(new Date());
      }
    } catch (e) {
      if (version.current === current) setError(e.message);
    } finally {
      if (version.current === current) setLoading(false);
    }
  }, [path]);
  useEffect(() => {
    setLoading(true);
    setData(null);
    setError("");
    refresh();
    const focus = () => refresh(),
      tick = () => {
        if (document.visibilityState === "visible") refresh();
      };
    window.addEventListener("focus", focus);
    const timer = setInterval(tick, 5000);
    return () => {
      version.current++;
      clearInterval(timer);
      window.removeEventListener("focus", focus);
    };
  }, [refresh]);
  return { data, error, loading, updated, refresh };
}
export const money = (cents) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(cents / 100);
export const date = (value) =>
  new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
export function localTime(value = new Date(Date.now() + 5 * 60000)) {
  const d = new Date(value);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
export const categoryLabel = {
  standard: "Standard vehicle",
  accessible: "Accessible bay",
  ev: "EV bay",
};
export const statusLabel = {
  reserved: "Reserved",
  parked: "Checked in",
  completed: "Completed",
  cancelled: "Cancelled",
  expired: "Expired",
};
