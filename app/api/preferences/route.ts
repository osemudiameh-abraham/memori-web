import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type UserPreferences = {
  id: string;
  user_id: string;
  timezone: string;
  email_reminders: boolean;
  push_enabled: boolean;
  reminder_time: string;
  created_at: string;
  updated_at: string;
};

type PreferencesResponse =
  | { ok: true; preferences: UserPreferences }
  | { ok: false; error: string };

const DEFAULT_PREFERENCES = {
  timezone: "UTC",
  email_reminders: true,
  push_enabled: false,
  reminder_time: "08:00:00",
};

export async function GET(): Promise<NextResponse<PreferencesResponse>> {
  const supabase = await createSupabaseServerClient();
  const { data: authData, error: authErr } = await supabase.auth.getUser();

  if (authErr || !authData.user) {
    return NextResponse.json(
      { ok: false, error: "Not authenticated" },
      { status: 401 }
    );
  }

  const user = authData.user;

  const { data, error } = await supabase
    .from("user_preferences")
    .select("id, user_id, timezone, email_reminders, push_enabled, reminder_time, created_at, updated_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }

  if (!data) {
    // Return defaults without writing — preferences are created on first POST
    return NextResponse.json({
      ok: true,
      preferences: {
        id: "",
        user_id: user.id,
        ...DEFAULT_PREFERENCES,
        created_at: "",
        updated_at: "",
      } as UserPreferences,
    });
  }

  return NextResponse.json({ ok: true, preferences: data as UserPreferences });
}

type PostBody = {
  timezone?: string;
  email_reminders?: boolean;
  push_enabled?: boolean;
  reminder_time?: string;
};

export async function POST(req: NextRequest): Promise<NextResponse<PreferencesResponse>> {
  const supabase = await createSupabaseServerClient();
  const { data: authData, error: authErr } = await supabase.auth.getUser();

  if (authErr || !authData.user) {
    return NextResponse.json(
      { ok: false, error: "Not authenticated" },
      { status: 401 }
    );
  }

  const user = authData.user;
  const body = (await req.json().catch(() => ({}))) as PostBody;

  // Validate timezone if provided
  if (body.timezone !== undefined) {
    const tz = String(body.timezone ?? "").trim();
    if (!tz) {
      return NextResponse.json(
        { ok: false, error: "timezone cannot be empty" },
        { status: 400 }
      );
    }
  }

  // Validate reminder_time format if provided — must be HH:MM or HH:MM:SS
  if (body.reminder_time !== undefined) {
    const rt = String(body.reminder_time ?? "").trim();
    if (!/^\d{2}:\d{2}(:\d{2})?$/.test(rt)) {
      return NextResponse.json(
        { ok: false, error: "reminder_time must be in HH:MM or HH:MM:SS format" },
        { status: 400 }
      );
    }
  }

  const updates: Record<string, unknown> = {
    user_id: user.id,
    updated_at: new Date().toISOString(),
  };

  if (body.timezone !== undefined) updates.timezone = String(body.timezone).trim();
  if (body.email_reminders !== undefined) updates.email_reminders = Boolean(body.email_reminders);
  if (body.push_enabled !== undefined) updates.push_enabled = Boolean(body.push_enabled);
  if (body.reminder_time !== undefined) updates.reminder_time = String(body.reminder_time).trim();

  const { data, error } = await supabase
    .from("user_preferences")
    .upsert(updates, { onConflict: "user_id" })
    .select("id, user_id, timezone, email_reminders, push_enabled, reminder_time, created_at, updated_at")
    .single();

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, preferences: data as UserPreferences });
}
