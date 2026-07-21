import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { createHash, timingSafeEqual } from 'crypto';
import { db } from '../lib/db';

const router = Router();

const BCRYPT_ROUNDS = 12;

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

// Legacy hashing scheme used by the original Next.js app / seed data.
function legacyHashPassword(password: string): string {
  return createHash('sha256').update(`${password}kabaddi_pro_salt`).digest('hex');
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (hash.startsWith('$2')) return bcrypt.compare(password, hash);
  // Legacy SHA-256 (64 hex chars) accounts created before the bcrypt switch.
  if (/^[a-f0-9]{64}$/i.test(hash)) {
    const computed = Buffer.from(legacyHashPassword(password), 'hex');
    const stored = Buffer.from(hash.toLowerCase(), 'hex');
    return computed.length === stored.length && timingSafeEqual(computed, stored);
  }
  return false;
}

async function generatePlayerCode(): Promise<string> {
  // Find the highest KP number currently in the DB
  const users = await db.user.findMany({
    where: { playerCode: { startsWith: 'KP' } },
    select: { playerCode: true },
  });

  let maxNum = 1000;
  for (const u of users) {
    const match = u.playerCode?.match(/^KP(\d+)$/);
    if (match) {
      const num = parseInt(match[1]);
      if (num > maxNum) maxNum = num;
    }
  }

  // Find the next available number (in case of gaps from deleted users)
  let nextNum = maxNum + 1;
  const existingCodes = new Set(users.map(u => u.playerCode));
  while (existingCodes.has(`KP${nextNum}`)) {
    nextNum++;
  }

  return `KP${nextNum}`;
}

function createDOBVerificationToken(phone: string, dateOfBirth: string): string {
  return createHash('sha256').update(`${phone}:${dateOfBirth}:dob-verify`).digest('hex').slice(0, 24);
}

router.post('/auth', async (req, res) => {
  try {
    const body = req.body;
    const { action, phone, password, name, gender, weight, practiceGround, role, email, dateOfBirth, userId, verificationToken, referralCode } = body;

    if (action === 'register') {
      if (!phone || !password || !name || !dateOfBirth) {
        return res.status(400).json({ error: 'Phone, password, name, and date of birth are required' });
      }
      if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
      const dobRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dobRegex.test(dateOfBirth)) return res.status(400).json({ error: 'Date of birth must be in YYYY-MM-DD format' });
      // Phone format validation — must be +91 followed by 10 digits (matches AuthScreen)
      const phoneRegex = /^\+91\d{10}$/;
      if (!phoneRegex.test(phone)) return res.status(400).json({ error: 'Phone number must be in +91XXXXXXXXXX format (12 digits total).' });

      const existingUser = await db.user.findUnique({ where: { phone } });
      if (existingUser) {
        // ── Provisional user upgrade path ───────────────────────────────
        // If a scorer or coach previously added this phone as a non-registered
        // player, we created a "provisional" placeholder User row (password='',
        // provisional=true). Now that the real player is registering with this
        // phone, we UPGRADE that row in place — set the real password, fill in
        // any missing fields (name/dob/gender/weight), and flip provisional to
        // false. They keep the same id + playerCode, so all match events,
        // academy memberships, attendance, fee records etc. that pointed at the
        // provisional row are automatically theirs.
        if (!existingUser.provisional) {
          return res.status(409).json({ error: 'Phone number already registered. Please login instead.' });
        }

        const upgraded = await db.user.update({
          where: { id: existingUser.id },
          data: {
            password: await hashPassword(password),
            name: name || existingUser.name,
            email: email || null,
            dateOfBirth,
            gender: gender || null,
            weight: weight || null,
            practiceGround: practiceGround || null,
            role: 'player',
            phoneVerified: true,
            provisional: false,
          },
        });

        // Ensure a PlayerProfile exists (it should, since findOrCreateProvisionalUser
        // makes one, but guard against legacy rows).
        await db.playerProfile.upsert({
          where: { userId: upgraded.id },
          update: {},
          create: { userId: upgraded.id },
        });

        // Claim any legacy playerPhone-keyed events (pre-provisional-feature
        // events saved with playerId=null). Same logic as the new-user path below.
        try {
          const pendingEvents = await db.matchEvent.findMany({
            where: { playerPhone: phone },
            include: { match: { select: { isPractice: true } } },
          });

          if (pendingEvents.length > 0) {
            const agg = {
              practice: { matches: new Set<string>(), raids: 0, successfulRaids: 0, tackles: 0, successfulTackles: 0, raidPoints: 0, tacklePoints: 0, bonusPoints: 0, superTackles: 0, totalPoints: 0 },
              tournament: { matches: new Set<string>(), raids: 0, successfulRaids: 0, tackles: 0, successfulTackles: 0, raidPoints: 0, tacklePoints: 0, bonusPoints: 0, superTackles: 0, totalPoints: 0 },
            };

            for (const evt of pendingEvents) {
              const bucket = evt.match.isPractice ? agg.practice : agg.tournament;
              bucket.matches.add(evt.matchId);
              const val = evt.value || 0;
              switch (evt.eventType) {
                case 'raid_point':
                  bucket.raidPoints += val; bucket.raids += 1; bucket.successfulRaids += 1; bucket.totalPoints += val; break;
                case 'bonus_point':
                  bucket.bonusPoints += val; bucket.totalPoints += val; break;
                case 'tackle_point':
                  bucket.tacklePoints += val; bucket.tackles += 1; bucket.successfulTackles += 1; bucket.totalPoints += val; break;
                case 'super_tackle':
                  bucket.tacklePoints += val; bucket.superTackles += 1; bucket.totalPoints += val; break;
                case 'empty_raid':
                  bucket.raids += 1; break;
              }
            }

            const updateData: Record<string, { increment: number }> = {};
            if (agg.practice.matches.size > 0) {
              updateData.practiceMatches = { increment: agg.practice.matches.size };
              if (agg.practice.raids > 0) updateData.practiceTotalRaids = { increment: agg.practice.raids };
              if (agg.practice.successfulRaids > 0) updateData.practiceSuccessfulRaids = { increment: agg.practice.successfulRaids };
              if (agg.practice.tackles > 0) updateData.practiceTotalTackles = { increment: agg.practice.tackles };
              if (agg.practice.successfulTackles > 0) updateData.practiceSuccessfulTackles = { increment: agg.practice.successfulTackles };
              if (agg.practice.raidPoints > 0) updateData.practiceRaidPoints = { increment: agg.practice.raidPoints };
              if (agg.practice.tacklePoints > 0) updateData.practiceTacklePoints = { increment: agg.practice.tacklePoints };
              if (agg.practice.bonusPoints > 0) updateData.practiceBonusPoints = { increment: agg.practice.bonusPoints };
              if (agg.practice.superTackles > 0) updateData.practiceSuperTackles = { increment: agg.practice.superTackles };
              if (agg.practice.totalPoints > 0) updateData.practiceTotalPoints = { increment: agg.practice.totalPoints };
            }
            if (agg.tournament.matches.size > 0) {
              updateData.tournamentMatches = { increment: agg.tournament.matches.size };
              if (agg.tournament.raids > 0) updateData.tournamentTotalRaids = { increment: agg.tournament.raids };
              if (agg.tournament.successfulRaids > 0) updateData.tournamentSuccessfulRaids = { increment: agg.tournament.successfulRaids };
              if (agg.tournament.tackles > 0) updateData.tournamentTotalTackles = { increment: agg.tournament.tackles };
              if (agg.tournament.successfulTackles > 0) updateData.tournamentSuccessfulTackles = { increment: agg.tournament.successfulTackles };
              if (agg.tournament.raidPoints > 0) updateData.tournamentRaidPoints = { increment: agg.tournament.raidPoints };
              if (agg.tournament.tacklePoints > 0) updateData.tournamentTacklePoints = { increment: agg.tournament.tacklePoints };
              if (agg.tournament.bonusPoints > 0) updateData.tournamentBonusPoints = { increment: agg.tournament.bonusPoints };
              if (agg.tournament.superTackles > 0) updateData.tournamentSuperTackles = { increment: agg.tournament.superTackles };
              if (agg.tournament.totalPoints > 0) updateData.tournamentTotalPoints = { increment: agg.tournament.totalPoints };
            }

            if (Object.keys(updateData).length > 0) {
              await db.playerProfile.update({ where: { userId: upgraded.id }, data: updateData });
            }

            await db.matchEvent.updateMany({
              where: { playerPhone: phone },
              data: { playerId: upgraded.id, playerPhone: null },
            });

            console.log(`[claim-pending-stats] Provisional upgrade: claimed ${pendingEvents.length} events for user ${upgraded.id} (${phone})`);
          }
        } catch (claimErr) {
          console.error('Claim pending stats error (provisional upgrade):', claimErr);
        }

        return res.json({
          user: {
            id: upgraded.id,
            phone: upgraded.phone,
            playerCode: upgraded.playerCode,
            name: upgraded.name,
            role: upgraded.role,
            isPremium: upgraded.isPremium,
            premiumExpiry: upgraded.premiumExpiry,
            premiumPlan: upgraded.premiumPlan,
            isAdmin: upgraded.isAdmin,
            avatar: upgraded.avatar,
            gender: upgraded.gender,
            weight: upgraded.weight,
            practiceGround: upgraded.practiceGround,
            dateOfBirth: upgraded.dateOfBirth,
            showCoachBadge: upgraded.showCoachBadge,
            provisional: false,
          },
          message: 'Welcome! Your account has been linked to your existing player profile.',
        });
      }

      const playerCode = await generatePlayerCode();
      // COACH ROLE IS DEPRECATED. Everyone is now a normal player. The Coach
      // Corner feature is available to all users — there's no separate coach
      // account type anymore. We ignore any role sent from the frontend and
      // always set 'player'. This also prevents a malicious caller from
      // creating an admin account by passing role:'admin'.
      const user = await db.user.create({
        data: { phone, playerCode, password: await hashPassword(password), name, email: email || null, dateOfBirth, gender: gender || null, weight: weight || null, practiceGround: practiceGround || null, role: 'player', phoneVerified: true },
      });
      await db.playerProfile.create({ data: { userId: user.id } });

      // ── CLAIM PENDING MATCH STATS ────────────────────────────────
      // Before this user registered, a scorer may have added them to matches by
      // phone number. Those MatchEvents were saved with playerPhone (and
      // playerId=null). Now that the user is registered, we CLAIM those events:
      //   1. Find all MatchEvents where playerPhone = user's phone
      //   2. Aggregate stats (raid points, tackles, etc.) per match's isPractice flag
      //   3. Update the user's PlayerProfile with the aggregated stats
      //   4. Link the events to the new user (set playerId, clear playerPhone)
      // This way, when a non-registered player signs up, they instantly see all
      // their past match stats on their profile.
      try {
        const pendingEvents = await db.matchEvent.findMany({
          where: { playerPhone: phone },
          include: { match: { select: { isPractice: true } } },
        });

        if (pendingEvents.length > 0) {
          // Aggregate stats, separating practice vs tournament
          const agg = {
            practice: { matches: new Set<string>(), raids: 0, successfulRaids: 0, tackles: 0, successfulTackles: 0, raidPoints: 0, tacklePoints: 0, bonusPoints: 0, superTackles: 0, totalPoints: 0 },
            tournament: { matches: new Set<string>(), raids: 0, successfulRaids: 0, tackles: 0, successfulTackles: 0, raidPoints: 0, tacklePoints: 0, bonusPoints: 0, superTackles: 0, totalPoints: 0 },
          };

          for (const evt of pendingEvents) {
            const bucket = evt.match.isPractice ? agg.practice : agg.tournament;
            bucket.matches.add(evt.matchId);
            const val = evt.value || 0;
            switch (evt.eventType) {
              case 'raid_point':
                bucket.raidPoints += val; bucket.raids += 1; bucket.successfulRaids += 1; bucket.totalPoints += val; break;
              case 'bonus_point':
                bucket.bonusPoints += val; bucket.totalPoints += val; break;
              case 'tackle_point':
                bucket.tacklePoints += val; bucket.tackles += 1; bucket.successfulTackles += 1; bucket.totalPoints += val; break;
              case 'super_tackle':
                bucket.tacklePoints += val; bucket.superTackles += 1; bucket.totalPoints += val; break;
              case 'empty_raid':
                bucket.raids += 1; break;
            }
          }

          // Update the user's PlayerProfile with claimed stats
          // Type allows atomic increment objects OR raw numbers.
          const updateData: Record<string, { increment: number } | number> = {};
          if (agg.practice.matches.size > 0) {
            updateData.practiceMatches = { increment: agg.practice.matches.size };
            if (agg.practice.raids > 0) updateData.practiceTotalRaids = { increment: agg.practice.raids };
            if (agg.practice.successfulRaids > 0) updateData.practiceSuccessfulRaids = { increment: agg.practice.successfulRaids };
            if (agg.practice.tackles > 0) updateData.practiceTotalTackles = { increment: agg.practice.tackles };
            if (agg.practice.successfulTackles > 0) updateData.practiceSuccessfulTackles = { increment: agg.practice.successfulTackles };
            if (agg.practice.raidPoints > 0) updateData.practiceRaidPoints = { increment: agg.practice.raidPoints };
            if (agg.practice.tacklePoints > 0) updateData.practiceTacklePoints = { increment: agg.practice.tacklePoints };
            if (agg.practice.bonusPoints > 0) updateData.practiceBonusPoints = { increment: agg.practice.bonusPoints };
            if (agg.practice.superTackles > 0) updateData.practiceSuperTackles = { increment: agg.practice.superTackles };
            if (agg.practice.totalPoints > 0) updateData.practiceTotalPoints = { increment: agg.practice.totalPoints };
          }
          if (agg.tournament.matches.size > 0) {
            updateData.tournamentMatches = { increment: agg.tournament.matches.size };
            if (agg.tournament.raids > 0) updateData.tournamentTotalRaids = { increment: agg.tournament.raids };
            if (agg.tournament.successfulRaids > 0) updateData.tournamentSuccessfulRaids = { increment: agg.tournament.successfulRaids };
            if (agg.tournament.tackles > 0) updateData.tournamentTotalTackles = { increment: agg.tournament.tackles };
            if (agg.tournament.successfulTackles > 0) updateData.tournamentSuccessfulTackles = { increment: agg.tournament.successfulTackles };
            if (agg.tournament.raidPoints > 0) updateData.tournamentRaidPoints = { increment: agg.tournament.raidPoints };
            if (agg.tournament.tacklePoints > 0) updateData.tournamentTacklePoints = { increment: agg.tournament.tacklePoints };
            if (agg.tournament.bonusPoints > 0) updateData.tournamentBonusPoints = { increment: agg.tournament.bonusPoints };
            if (agg.tournament.superTackles > 0) updateData.tournamentSuperTackles = { increment: agg.tournament.superTackles };
            if (agg.tournament.totalPoints > 0) updateData.tournamentTotalPoints = { increment: agg.tournament.totalPoints };
          }

          if (Object.keys(updateData).length > 0) {
            await db.playerProfile.update({ where: { userId: user.id }, data: updateData });
          }

          // Link all pending events to the new user
          await db.matchEvent.updateMany({
            where: { playerPhone: phone },
            data: { playerId: user.id, playerPhone: null },
          });

          console.log(`[claim-pending-stats] Claimed ${pendingEvents.length} events for new user ${user.id} (${phone})`);
        }
      } catch (claimErr) {
        // Non-critical — don't fail registration if stats claim fails
        console.error('Claim pending stats error:', claimErr);
      }

      // ── Process referral code (if provided) ──────────────────────────
      // Look up an UNUSED referral record matching the code (referredId is null).
      // If found, mark it as completed and grant 7 days of Premium to BOTH the
      // referrer and the newly-registered user. This runs inline during signup
      // so the referral is attributed automatically — no second "apply code"
      // step required from the user.
      //
      // Failures here MUST NOT fail the registration itself — the user is
      // already created. We just log and continue.
      let referralApplied = false;
      let referralError: string | null = null;
      if (referralCode && typeof referralCode === 'string' && referralCode.trim().length > 0) {
        try {
          const code = referralCode.trim().toUpperCase();
          const referral = await db.referral.findFirst({
            where: { referralCode: code, referredId: null },
          });
          if (!referral) {
            referralError = 'Invalid or already-used referral code';
          } else if (referral.referrerId === user.id) {
            referralError = 'You cannot use your own referral code';
          } else {
            // Mark the referral as completed
            await db.referral.update({
              where: { id: referral.id },
              data: { referredId: user.id, status: 'signed_up', completedAt: new Date() },
            });

            // Grant premium days to BOTH the referrer and the new user.
            // IMPORTANT: Don't stomp existing premium — if the referrer is a paying
            // subscriber with e.g. 25 days left, EXTEND from their current expiry
            // (not from now), and don't downgrade their premiumPlan.
            const premiumDays = referral.premiumDays || 7;
            const now = new Date();
            const dayMs = 24 * 60 * 60 * 1000;

            // Fetch current premium state for both users
            const [referrer, referredUser] = await Promise.all([
              db.user.findUnique({ where: { id: referral.referrerId }, select: { isPremium: true, premiumExpiry: true, premiumPlan: true } }),
              db.user.findUnique({ where: { id: user.id }, select: { isPremium: true, premiumExpiry: true, premiumPlan: true } }),
            ]);

            // Referrer: extend from the later of (now, existing expiry)
            const referrerExpiry = referrer?.premiumExpiry ? new Date(referrer.premiumExpiry) : null;
            const referrerBase = (referrer?.isPremium && referrerExpiry && referrerExpiry > now) ? referrerExpiry : now;
            const referrerNewExpiry = new Date(referrerBase.getTime() + premiumDays * dayMs);

            // Referred user: extend from the later of (now, existing expiry)
            const referredExpiry = referredUser?.premiumExpiry ? new Date(referredUser.premiumExpiry) : null;
            const referredBase = (referredUser?.isPremium && referredExpiry && referredExpiry > now) ? referredExpiry : now;
            const referredNewExpiry = new Date(referredBase.getTime() + premiumDays * dayMs);

            await Promise.all([
              db.user.update({
                where: { id: referral.referrerId },
                data: {
                  isPremium: true,
                  premiumExpiry: referrerNewExpiry,
                  // Only preserve a non-referral plan label if the referrer is
                  // CURRENTLY a paying subscriber (premium hasn't lapsed).
                  // Otherwise stamp as 'referral' so UI badges are accurate.
                  premiumPlan: (referrer?.isPremium && referrerExpiry && referrerExpiry > now && referrer?.premiumPlan && referrer.premiumPlan !== 'referral') ? referrer.premiumPlan : 'referral',
                },
              }),
              db.user.update({
                where: { id: user.id },
                data: {
                  isPremium: true,
                  premiumExpiry: referredNewExpiry,
                  premiumPlan: (referredUser?.isPremium && referredExpiry && referredExpiry > now && referredUser?.premiumPlan && referredUser.premiumPlan !== 'referral') ? referredUser.premiumPlan : 'referral',
                },
              }),
            ]);

            referralApplied = true;
          }
        } catch (refErr) {
          console.error('Referral apply (during register) error:', refErr);
          referralError = 'Could not apply referral code';
        }
      }

      // Re-fetch the user (with profile) so the response reflects any premium
      // upgrade from the referral AND includes position/jerseyNumber (consistent
      // with the login response shape). The user was just created above, so
      // findUnique is guaranteed to return them.
      const freshUser = (await db.user.findUnique({ where: { id: user.id }, include: { profile: true } }))!;
      const { password: _, profile: __profile, ...userWithoutPassword } = freshUser;
      return res.json({
        user: {
          ...userWithoutPassword,
          position: freshUser.profile?.position || null,
          jerseyNumber: freshUser.profile?.jerseyNumber || null,
        },
        referral: {
          applied: referralApplied,
          error: referralError,
        },
      });
    }

    if (action === 'login') {
      if (!phone || !password) return res.status(400).json({ error: 'Phone and password are required' });
      const user = await db.user.findUnique({ where: { phone }, include: { profile: true } });
      if (!user) return res.status(401).json({ error: 'Invalid phone number or password' });
      const passwordValid = await verifyPassword(password, user.password);
      if (!passwordValid) return res.status(401).json({ error: 'Invalid phone number or password' });
      // Transparently upgrade legacy SHA-256 hashes to bcrypt on successful login.
      if (!user.password.startsWith('$2')) {
        await db.user.update({ where: { id: user.id }, data: { password: await hashPassword(password) } });
      }
      const { password: _, profile: __, ...userWithoutPassword } = user;
      return res.json({ user: { ...userWithoutPassword, position: user.profile?.position || null, jerseyNumber: user.profile?.jerseyNumber || null } });
    }

    if (action === 'forgot-password-verify') {
      if (!phone || !dateOfBirth) return res.status(400).json({ error: 'Phone number and date of birth are required' });
      const user = await db.user.findUnique({ where: { phone } });
      if (!user || user.dateOfBirth !== dateOfBirth) return res.status(401).json({ error: 'Invalid phone number or date of birth' });
      const token = createDOBVerificationToken(phone, dateOfBirth);
      return res.json({ verified: true, message: 'Identity verified successfully', verificationToken: token });
    }

    if (action === 'reset-password') {
      if (!phone || !password || !verificationToken) return res.status(400).json({ error: 'Phone, new password, and verification token are required' });
      if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
      const user = await db.user.findUnique({ where: { phone } });
      if (!user || !user.dateOfBirth) return res.status(400).json({ error: 'Invalid verification. Please start over.' });
      const expectedToken = createDOBVerificationToken(phone, user.dateOfBirth);
      if (verificationToken !== expectedToken) return res.status(400).json({ error: 'Invalid verification token. Please start over.' });
      await db.user.update({ where: { phone }, data: { password: await hashPassword(password) } });
      return res.json({ message: 'Password reset successfully' });
    }

    if (action === 'update-details') {
      if (!userId) return res.status(400).json({ error: 'User ID is required' });
      // SECURITY: Sensitive fields (password, dateOfBirth, phone) are NOT
      // editable through this endpoint. They require dedicated flows:
      //   - password  → POST /auth action='reset-password' (DOB-verified)
      //   - dateOfBirth → NEVER editable (it's the password-reset verifier)
      //   - phone     → not supported via this endpoint to prevent account-takeover
      // 'role' is also NOT editable — the coach role is deprecated and everyone
      // is a player now. Forcing role='player' on register prevents new coaches;
      // blocking role here prevents existing users from making themselves coach.
      // 'showCoachBadge' IS editable — it's a purely cosmetic opt-in badge that
      // any user can toggle on their profile. It does NOT change role or access.
      const allowedFields = ['name', 'email', 'gender', 'weight', 'practiceGround', 'location', 'avatar', 'showCoachBadge'];
      const updateData: Record<string, unknown> = {};
      for (const field of allowedFields) {
        if (body[field] !== undefined) updateData[field] = body[field];
      }
      // Profile-specific fields (stored on PlayerProfile, not User)
      const profileFields = ['position', 'jerseyNumber'];
      const profileData: Record<string, unknown> = {};
      for (const field of profileFields) {
        if (body[field] !== undefined) profileData[field] = body[field];
      }
      // Phone change is NOT supported here for security — phone is the user's
      // unique login identifier and changing it via a generic update endpoint
      // would allow account-takeover. If needed in the future, require an OTP
      // flow on the new number.
      if (Object.keys(updateData).length === 0 && Object.keys(profileData).length === 0) return res.status(400).json({ error: 'No fields to update' });

      // Apply User-table updates
      if (Object.keys(updateData).length > 0) {
        await db.user.update({ where: { id: userId }, data: updateData });
      }
      // Apply PlayerProfile-table updates (upsert ensures profile row exists)
      if (Object.keys(profileData).length > 0) {
        await db.playerProfile.upsert({
          where: { userId },
          create: { userId, ...profileData },
          update: profileData,
        });
      }

      const user = (await db.user.findUnique({ where: { id: userId }, include: { profile: true } }))!;
      const { password: _, profile: __p, ...userWithoutPassword } = user;
      return res.json({
        user: {
          ...userWithoutPassword,
          position: user.profile?.position || null,
          jerseyNumber: user.profile?.jerseyNumber || null,
        },
      });
    }

    if (action === 'check-phone') {
      if (!phone) return res.status(400).json({ error: 'Phone number is required' });
      const existingUser = await db.user.findUnique({ where: { phone } });
      return res.json({ exists: !!existingUser });
    }

    return res.status(400).json({ error: 'Invalid action' });
  } catch (error) {
    console.error('Auth error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/auth/delete-account', async (req, res) => {
  try {
    // SECURITY: Require password re-verification before deleting the account.
    // Previously this endpoint trusted userId from the body, which let anyone
    // who knew a userId delete any account. Now we require the user to type
    // their password to confirm.
    const { userId, password } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId is required' });
    if (!password) return res.status(400).json({ error: 'Password is required to delete your account' });

    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const passwordValid = await verifyPassword(password, user.password);
    if (!passwordValid) return res.status(401).json({ error: 'Incorrect password' });

    await db.user.delete({ where: { id: userId } });
    return res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Delete account error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
