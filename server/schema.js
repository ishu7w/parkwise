export const schema = `
CREATE TABLE IF NOT EXISTS users (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password TEXT NOT NULL,
 role TEXT NOT NULL CHECK(role IN ('driver','owner')), created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sessions (
 token TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 expires_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE IF NOT EXISTS facilities (
 id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id), name TEXT NOT NULL,
 address TEXT NOT NULL, latitude DOUBLE PRECISION NOT NULL, longitude DOUBLE PRECISION NOT NULL,
 hourly_rate INTEGER NOT NULL CHECK(hourly_rate>=0), floor TEXT NOT NULL, instructions TEXT NOT NULL,
 published BOOLEAN NOT NULL DEFAULT false, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS bays (
 id TEXT PRIMARY KEY, facility_id TEXT NOT NULL REFERENCES facilities(id), label TEXT NOT NULL,
 category TEXT NOT NULL CHECK(category IN ('standard','accessible','ev')), blocked BOOLEAN NOT NULL DEFAULT false,
 UNIQUE(facility_id,label)
);
CREATE TABLE IF NOT EXISTS bookings (
 id TEXT PRIMARY KEY, reference TEXT NOT NULL UNIQUE, facility_id TEXT NOT NULL REFERENCES facilities(id),
 bay_id TEXT NOT NULL REFERENCES bays(id), driver_id TEXT NOT NULL REFERENCES users(id), plate TEXT NOT NULL,
 start_at TIMESTAMPTZ NOT NULL, end_at TIMESTAMPTZ NOT NULL CHECK(end_at>start_at),
 status TEXT NOT NULL CHECK(status IN ('reserved','parked','completed','cancelled','expired')),
 price INTEGER NOT NULL CHECK(price>=0), checked_in_at TIMESTAMPTZ, checked_out_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS activity (
 id TEXT PRIMARY KEY, facility_id TEXT NOT NULL REFERENCES facilities(id), actor_id TEXT NOT NULL REFERENCES users(id),
 message TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS auth_attempts (key TEXT PRIMARY KEY, count INTEGER NOT NULL, reset_at TIMESTAMPTZ NOT NULL);
CREATE TABLE IF NOT EXISTS vehicles (
 id TEXT PRIMARY KEY, driver_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 plate TEXT NOT NULL, label TEXT NOT NULL, UNIQUE(driver_id,plate)
);
CREATE TABLE IF NOT EXISTS favorites (
 driver_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 facility_id TEXT NOT NULL REFERENCES facilities(id), PRIMARY KEY(driver_id,facility_id)
);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS booked_hourly_rate INTEGER;
UPDATE bookings SET booked_hourly_rate=price / GREATEST(1,CEIL(EXTRACT(EPOCH FROM (end_at-start_at))/3600)::integer) WHERE booked_hourly_rate IS NULL;
CREATE INDEX IF NOT EXISTS bookings_facility_time ON bookings(facility_id,start_at,end_at);
CREATE INDEX IF NOT EXISTS bookings_driver ON bookings(driver_id,created_at);
CREATE INDEX IF NOT EXISTS facilities_owner ON facilities(owner_id);
CREATE INDEX IF NOT EXISTS activity_facility ON activity(facility_id,created_at);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
`;
