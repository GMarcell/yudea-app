-- Emergency ("break-glass") admin account.
-- The flag keeps the account out of normal user management; its credential is
-- only ever written by scripts/break-glass.ts.
ALTER TABLE "User" ADD COLUMN "isBreakGlass" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "breakGlassLastUsedAt" TIMESTAMP(3);
