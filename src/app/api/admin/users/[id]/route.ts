import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, updateAdminUser, deleteAdminUser } from "@/lib/admin";
import { z } from "zod";

export const dynamic = "force-dynamic";

const UpdateUserSchema = z.object({
  creditBalance: z.number().min(0).optional(),
  creditAdjustment: z.number().optional(),
  role: z.enum(["USER", "ADMIN"]).optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(6).optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json(
        { error: "Unauthorized: Admin privileges required" },
        { status: 403 }
      );
    }

    const { id } = params;
    if (!id) {
      return NextResponse.json({ error: "Missing user ID" }, { status: 400 });
    }

    const body = await request.json();
    const parsed = UpdateUserSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Validation failed" },
        { status: 400 }
      );
    }

    // Safety check: Prevents admin from removing their own admin status or deactivating themselves
    if (admin.id === id) {
      if (parsed.data.role === "USER") {
        return NextResponse.json(
          { error: "Cannot revoke your own admin role" },
          { status: 400 }
        );
      }
      if (parsed.data.isActive === false) {
        return NextResponse.json(
          { error: "Cannot deactivate your own account" },
          { status: 400 }
        );
      }
    }

    await updateAdminUser(id, parsed.data);
    return NextResponse.json({ success: true, message: "User updated successfully" });
  } catch (error: any) {
    console.error("Admin user PATCH error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to update user" },
      { status: 400 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json(
        { error: "Unauthorized: Admin privileges required" },
        { status: 403 }
      );
    }

    const { id } = params;
    if (!id) {
      return NextResponse.json({ error: "Missing user ID" }, { status: 400 });
    }

    // Safety check: Cannot delete self
    if (admin.id === id) {
      return NextResponse.json(
        { error: "Cannot delete your own admin account" },
        { status: 400 }
      );
    }

    await deleteAdminUser(id);
    return NextResponse.json({ success: true, message: "User deleted successfully" });
  } catch (error: any) {
    console.error("Admin user DELETE error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to delete user" },
      { status: 400 }
    );
  }
}
