/**
 * Break-glass admin: one emergency ADMIN account for the case where every
 * normal admin has lost access. It is deliberately not a hidden bypass — it is
 * a normal credentials account with a generated password, protected from
 * accidental or malicious changes through the app.
 *
 * Usage (run on the server, where DATABASE_URL is available):
 *
 *   npx tsx scripts/break-glass.ts create [--email <address>]
 *   npx tsx scripts/break-glass.ts rotate [--email <address>]
 *   npx tsx scripts/break-glass.ts status
 *
 * Only one break-glass account can exist. The password is printed once and is
 * stored bcrypt-hashed like every other password; it cannot be recovered, only
 * rotated.
 */
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";

const DEFAULT_EMAIL = "break-glass@yudea.local";
// 256 bits of entropy, encoded as 43 URL-safe characters.
const PASSWORD_BYTES = 32;
const BCRYPT_COST = 10;

const USAGE = `Break-glass admin management

  npx tsx scripts/break-glass.ts create [--email <address>]
      Create the emergency admin account and print its password once.
  npx tsx scripts/break-glass.ts rotate [--email <address>]
      Replace the password with a new random one.
  npx tsx scripts/break-glass.ts status
      Show the account address and when it was last used.

Run it on the server/CI job that holds DATABASE_URL, never from the app.`;

// Match the app's runtime: `next dev`/`next start` load .env, a bare tsx
// script does not. Loading it here keeps the command above the whole story.
try {
  process.loadEnvFile(".env");
} catch {
  // No .env file: rely on the environment the command was started with.
}

function readFlag(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;

  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${name} needs a value`);
  }
  return value;
}

function generatePassword() {
  return randomBytes(PASSWORD_BYTES).toString("base64url");
}

function printCredential(email: string, password: string, verb: string) {
  console.log(`
Break-glass admin ${verb}.

  email:    ${email}
  password: ${password}

The password is not stored in readable form and is not shown again. Put it in
the church password manager now, then sign in at /public/login.

If you rotated because the old password may have leaked, also rotate
NEXTAUTH_SECRET afterwards: existing sessions stay valid until it changes.
`);
}

async function createOrRotate(mode: "create" | "rotate") {
  const current = await prisma.user.findFirst({ where: { isBreakGlass: true } });

  if (mode === "create" && current) {
    throw new Error(
      `A break-glass account already exists (${current.email}). ` +
        "Use `rotate` to replace its password, or delete it manually first.",
    );
  }

  if (mode === "rotate" && !current) {
    throw new Error("No break-glass account exists yet. Use `create` first.");
  }

  const email = (readFlag("--email") ?? current?.email ?? DEFAULT_EMAIL).trim();
  if (!email.includes("@")) {
    throw new Error(`"${email}" does not look like an email address`);
  }

  // The email column is unique and login is an exact, case-sensitive lookup;
  // refuse rather than silently reusing or shadowing a real account.
  const occupant = await prisma.user.findUnique({ where: { email } });
  if (occupant && occupant.id !== current?.id) {
    throw new Error(
      `${email} already belongs to a normal account. Pick another address with --email.`,
    );
  }

  const password = generatePassword();
  const data = {
    name: "Break-glass Admin",
    email,
    password: await bcrypt.hash(password, BCRYPT_COST),
    role: "ADMIN",
    regionId: null,
    isBreakGlass: true,
    breakGlassLastUsedAt: null,
  };

  if (current) {
    await prisma.user.update({ where: { id: current.id }, data });
    printCredential(email, password, "password rotated");
  } else {
    await prisma.user.create({ data });
    printCredential(email, password, "created");
  }
}

async function showStatus() {
  const current = await prisma.user.findFirst({ where: { isBreakGlass: true } });

  if (!current) {
    console.log("No break-glass account is configured.");
    return;
  }

  console.log(`
Break-glass admin

  email:     ${current.email}
  last used: ${current.breakGlassLastUsedAt?.toISOString() ?? "never"}
`);
}

async function main() {
  const command = process.argv[2] ?? "status";

  switch (command) {
    case "create":
      await createOrRotate("create");
      break;
    case "rotate":
      await createOrRotate("rotate");
      break;
    case "status":
      await showStatus();
      break;
    case "help":
    case "--help":
    case "-h":
      console.log(USAGE);
      break;
    default:
      throw new Error(`Unknown command "${command}".\n\n${USAGE}`);
  }
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
