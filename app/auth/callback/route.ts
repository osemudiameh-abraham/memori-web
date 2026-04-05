import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const requestUrl = new URL(req.url);
  const code = requestUrl.searchParams.get("code");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? requestUrl.origin;

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { data: sessionData } = await supabase.auth.exchangeCodeForSession(code);

    if (sessionData?.user) {
      // Check if this is a new user — no identity profile means first time
      const { data: profile } = await supabase
        .from("identity_profiles")
        .select("id")
        .eq("user_id", sessionData.user.id)
        .maybeSingle();

      if (!profile) {
        // New user — send to onboarding
        return NextResponse.redirect(new URL("/onboarding", appUrl));
      }
    }
  }

  // Existing user — send home
  return NextResponse.redirect(new URL("/", appUrl));
}
