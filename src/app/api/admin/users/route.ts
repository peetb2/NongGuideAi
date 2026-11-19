import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, getAdminUsersList, createAdminUser } from "@/lib/admin";
import { z } from "zod";

export const dynamic = "force-dynamic";

const CreateUserSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  creditBalance: z.number().min(0).optional(),
  plan: z.enum(["STANDARD", "PRO_MAX"]).optional().default("STANDARD"),
  role: z.enum(["USER", "ADMIN"]).optional().default("USER"),
});

export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json(
        { error: "Unauthorized: Admin privileges required" },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const q = searchParams.get("q") || undefined;
    const role = searchParams.get("role") || undefined;

    const users = await getAdminUsersList(q, role);
    return NextResponse.json({ success: true, users });
  } catch (error: any) {
    console.error("Admin users GET error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to load users" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json(
        { error: "Unauthorized: Admin privileges required" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = CreateUserSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Validation failed" },
        { status: 400 }
      );
    }

    const newUser = await createAdminUser(parsed.data);
    return NextResponse.json({ success: true, user: newUser }, { status: 201 });
  } catch (error: any) {
    console.error("Admin users POST error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to create user" },
      { status: 400 }
    );
  }
}
