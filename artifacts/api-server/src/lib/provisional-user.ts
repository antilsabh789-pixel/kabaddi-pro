import { db } from './db';

/**
 * Find or create a "provisional" user for a non-registered player added by
 * phone number during match scoring or academy roster management.
 *
 * Provisional users are real rows in the User table — they have a real `id`,
 * `phone`, `name`, and `playerCode` — but their `password` is the empty string
 * (so they cannot log in) and `provisional = true`. Because they're real User
 * rows, every existing relation (MatchScorer, MatchEvent.playerId, AcademyPlayer,
 * Attendance, FeeRecord, …) can point at them with no schema changes, and the
 * admin "total players" counter already includes them (it counts
 * `isAdmin = false`, which provisional users satisfy).
 *
 * When the player later registers via /api/auth (action=register), the auth
 * flow detects the existing provisional row for that phone and UPGRADES it in
 * place (sets the real password, name, dob, etc., flips `provisional = false`)
 * instead of returning a 409 conflict. The player thereby inherits:
 *   - their playerCode (kept stable so refs/contacts already know it)
 *   - all past match events that were saved against this userId
 *   - all academy memberships the coach added them to
 *   - all attendance / fee records
 *
 * Legacy claim flow (events saved with `playerPhone` and `playerId = null`
 * before this feature shipped) still runs in auth.ts and re-links those events
 * to the upgraded userId — so both old and new data paths converge.
 *
 * @param phone   Normalized phone in +91XXXXXXXXXX format.
 * @param name    Display name (falls back to phone if empty).
 * @param createdByUserId  The user (scorer or coach) who triggered creation.
 *                         Stored in `practiceGround` is NOT done — we only
 *                         pass it for potential audit later. Currently unused
 *                         beyond logging.
 * @returns The User row (provisional or, if one already exists and has been
 *          upgraded, the real one).
 */
export async function findOrCreateProvisionalUser(opts: {
  phone: string;
  name?: string;
  jerseyNumber?: number;
  createdByUserId?: string;
}): Promise<{ id: string; playerCode: string | null; name: string | null; phone: string; provisional: boolean }> {
  const { phone, name, createdByUserId } = opts;
  if (!phone) throw new Error('phone is required to find-or-create provisional user');

  // 1. Exact match on phone — return whatever's there (provisional OR real).
  //    If they later register, the auth flow upgrades the row in place.
  const existing = await db.user.findUnique({
    where: { phone },
    select: { id: true, playerCode: true, name: true, phone: true, provisional: true, password: true },
  });
  if (existing) {
    return existing;
  }

  // 2. Generate the next player code (mirrors auth.ts generatePlayerCode but
  //    inlined here to avoid a circular import). Format: KP<number>.
  const users = await db.user.findMany({
    where: { playerCode: { startsWith: 'KP' } },
    select: { playerCode: true },
  });
  let maxNum = 1000;
  const existingCodes = new Set<string>();
  for (const u of users) {
    if (!u.playerCode) continue;
    existingCodes.add(u.playerCode);
    const m = u.playerCode.match(/^KP(\d+)$/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > maxNum) maxNum = n;
    }
  }
  let nextNum = maxNum + 1;
  while (existingCodes.has(`KP${nextNum}`)) nextNum++;
  const playerCode = `KP${nextNum}`;

  // 3. Create the provisional user. password = '' (empty) — bcrypt compare
  //    against '' will never match a real hash, and our verifyPassword helper
  //    returns false for any non-$2 hash anyway, so login is impossible until
  //    the row is upgraded on real signup.
  const created = await db.user.create({
    data: {
      phone,
      playerCode,
      password: '', // unusable until upgrade
      name: name?.trim() || null,
      role: 'player',
      phoneVerified: true,
      provisional: true,
    },
    select: { id: true, playerCode: true, name: true, phone: true, provisional: true },
  });

  // 4. Make sure they have a PlayerProfile row so stats endpoints don't 500.
  await db.playerProfile.create({ data: { userId: created.id } }).catch((err: unknown) => {
    // If a profile somehow already exists (race), ignore — the unique
    // constraint on userId will catch it.
    console.warn('[provisional-user] PlayerProfile create failed (likely race):', String(err).slice(0, 120));
  });

  console.log(
    `[provisional-user] Created provisional user ${created.id} (code ${created.playerCode}) for phone ${phone}` +
      (createdByUserId ? ` — added by ${createdByUserId}` : '')
  );

  return created;
}
