import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { passcode } = await req.json();
    const expectedPasscode = process.env.APP_PASSCODE || "history123";

    if (passcode !== expectedPasscode) {
      return NextResponse.json({ error: "Invalid passcode" }, { status: 401 });
    }

    const res = NextResponse.json({ ok: true });
    res.cookies.set("quiz_auth", "authenticated", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: "/",
    });

    return res;
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
}
