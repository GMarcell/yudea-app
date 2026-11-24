import { prisma } from "@/lib/prisma";
import { APP_ROLES, normalizeAppRole } from "@/lib/rbac";
import { requireAdmin } from "@/lib/server-auth";
import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { validateBody, handleApiError } from "@/lib/api-validate";
import { updateUserSchema } from "@/schemas/api.schemas";

export const runtime = "nodejs";

/** Counts admin accounts, tolerating legacy mixed-case role values. */
async function countAdmins() {
  return prisma.user.count({
    where: { role: { equals: "ADMIN", mode: "insensitive" } },
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireAdmin();
  if (authResult.error) return authResult.error;

  const { id } = await params;

  try {
    const body = await req.json();

    const parsed = validateBody(updateUserSchema, body, "user PATCH");
    if (parsed.error) return parsed.error;

    const { name, email, password, role, regionId } = parsed.data;

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Keep the emergency way back into the app intact: even an ADMIN session
    // cannot demote it, change its password, or reassign its address here.
    if (existing.isBreakGlass) {
      return NextResponse.json(
        {
          error:
            "The break-glass admin can only be changed with scripts/break-glass.ts",
        },
        { status: 403 },
      );
    }

    if (email && email !== existing.email) {
      const duplicate = await prisma.user.findUnique({ where: { email } });
      if (duplicate) {
        return NextResponse.json(
          { error: "Email is already registered" },
          { status: 409 },
        );
      }
    }

    let normalizedRole: string | undefined;
    if (role !== undefined) {
      normalizedRole = normalizeAppRole(role);
      if (!(APP_ROLES as readonly string[]).includes(normalizedRole)) {
        return NextResponse.json({ error: "Invalid role" }, { status: 400 });
      }
    }

    if (
      normalizedRole === "COORDINATOR" &&
      regionId === undefined &&
      !existing.regionId
    ) {
      return NextResponse.json(
        { error: "Coordinator must be assigned to a region" },
        { status: 400 },
      );
    }

    // Guard against locking the organisation out: the last remaining admin
    // cannot be demoted to another role.
    if (
      normalizeAppRole(existing.role) === "ADMIN" &&
      normalizedRole !== undefined &&
      normalizedRole !== "ADMIN"
    ) {
      const adminCount = await countAdmins();
      if (adminCount <= 1) {
        return NextResponse.json(
          { error: "Cannot demote the last admin" },
          { status: 400 },
        );
      }
    }

    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name || null }),
        ...(email !== undefined && { email }),
        ...(normalizedRole !== undefined && { role: normalizedRole }),
        ...(password && { password: await bcrypt.hash(password, 10) }),
        ...(regionId !== undefined
          ? {
              region: regionId
                ? { connect: { id: regionId } }
                : { disconnect: true },
            }
          : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        regionId: true,
      },
    });

    return NextResponse.json({
      ...user,
      role: normalizeAppRole(user.role),
    });
  } catch (error) {
    return handleApiError(error, "user PATCH", "Failed to update user");
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireAdmin();
  if (authResult.error) return authResult.error;

  const { id } = await params;

  if (authResult.user?.id === id) {
    return NextResponse.json(
      { error: "You cannot delete your own account" },
      { status: 400 },
    );
  }

  try {
    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (target.isBreakGlass) {
      return NextResponse.json(
        {
          error:
            "The break-glass admin can only be removed with scripts/break-glass.ts",
        },
        { status: 403 },
      );
    }

    // Backstop for the self-delete rule above (e.g. a legacy/token session
    // acting on the final admin): never leave the app without an admin.
    if (normalizeAppRole(target.role) === "ADMIN") {
      const adminCount = await countAdmins();
      if (adminCount <= 1) {
        return NextResponse.json(
          { error: "Cannot delete the last admin" },
          { status: 400 },
        );
      }
    }

    await prisma.user.delete({ where: { id } });
    return NextResponse.json({ message: "Deleted successfully" });
  } catch (error) {
    return handleApiError(error, "user DELETE", "Failed to delete user");
  }
}
