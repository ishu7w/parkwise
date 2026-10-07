import {
  text,
  passwordValue,
  passwordMatches,
  passwordHash,
  fail,
  throttle,
  startSession,
} from "./security.js";
export async function updateAccount(db, user, input) {
  const name = text(input.name, "Name", 2, 80);
  await db.query("UPDATE users SET name=$1 WHERE id=$2", [name, user.id]);
  return { user: { ...user, name } };
}
export async function changePassword(db, user, input, req, res) {
  const current = passwordValue(input.currentPassword),
    next = passwordValue(input.newPassword);
  if (current === next) fail(400, "Choose a different new password.");
  await throttle(db, req, user.email);
  return db.transaction(async (tx) => {
    const { rows } = await tx.query(
      "SELECT password FROM users WHERE id=$1 FOR NO KEY UPDATE",
      [user.id],
    );
    if (!(await passwordMatches(current, rows[0].password)))
      fail(401, "Current password is incorrect.");
    await tx.query("UPDATE users SET password=$1 WHERE id=$2", [
      await passwordHash(next),
      user.id,
    ]);
    await tx.query("DELETE FROM sessions WHERE user_id=$1", [user.id]);
    await startSession(tx, user.id, res);
    return { changed: true };
  });
}
