import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type TokenResponse =
  | { ok: true; key: string }
  | { ok: false; error: string };

export async function GET(): Promise<NextResponse<TokenResponse>> {
  const supabase = await createSupabaseServerClient();
  const { data: authData, error: authErr } = await supabase.auth.getUser();

  if (authErr || !authData.user) {
    return NextResponse.json(
      { ok: false, error: "Not authenticated" },
      { status: 401 }
    );
  }

  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, error: "Deepgram not configured" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, key: apiKey });
}
