import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import authConfig from "@/auth.config";
import { normalizeAppRole } from "@/lib/rbac";
import { prisma } from "./lib/prisma";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        });

        if (!user || !user.password) {
          return null;
        }

        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.password,
        );

        if (!isValid) {
          return null;
        }

        // Emergency access is rare and highly privileged. Leave a server-side
        // trace and record the use so `break-glass.ts status` can show it.
        // A failure here must not block the sign-in an operator is relying on.
        if (user.isBreakGlass) {
          console.warn(
            `[auth] BREAK-GLASS ADMIN SIGN-IN: ${user.email} at ${new Date().toISOString()}`,
          );
          try {
            await prisma.user.update({
              where: { id: user.id },
              data: { breakGlassLastUsedAt: new Date() },
            });
          } catch (error) {
            console.error("[auth] failed to record break-glass sign-in", error);
          }
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: normalizeAppRole(user.role),
          regionId: user.regionId ?? undefined,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = normalizeAppRole(user.role as string);
        token.regionId = (user as { regionId?: string }).regionId ?? undefined;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id as string;
      session.user.role = normalizeAppRole(token.role as string);
      session.user.regionId = token.regionId as string | undefined;
      return session;
    },
  },
});
