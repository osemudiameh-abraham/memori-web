import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type PushSubscriptionKeys = {
  p256dh: string;
  auth: string;
};

type PushSubscriptionBody = {
  endpoint: string;
  keys: PushSubscriptionKeys;
};

type SubscribeResponse =
  | { ok: true; message: string }
  | { ok: false; error: string };

export async function POST(
  req: NextRequest
): Promise<NextResponse<SubscribeResponse>> {
  const supabase = await createSupabaseServerClient();
  const { data: authData, error: authErr } = await supabase.auth.getUser();

  if (authErr || !authData.user) {
    return NextResponse.json(
      { ok: false, error: "Not authenticated" },
      { status: 401 }
    );
  }

  const user = authData.user;
  const body = (await req.json().catch(() => ({}))) as PushSubscriptionBody;

  const endpoint = String(body?.endpoint ?? "").trim();
  const p256dh = String(body?.keys?.p256dh ?? "").trim();
  const auth = String(body?.keys?.auth ?? "").trim();

  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json(
      { ok: false, error: "Missing endpoint or keys" },
      { status: 400 }
    );
  }

  if (!endpoint.startsWith("https://")) {
    return NextResponse.json(
      { ok: false, error: "Invalid endpoint" },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from("notification_subscriptions")
    .upsert(
      {
        user_id: user.id,
        endpoint,
        keys: { p256dh, auth },
      },
      { onConflict: "endpoint" }
    );

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }

  // Enable push in user_preferences
  await supabase
    .from("user_preferences")
    .upsert(
      {
        user_id: user.id,
        push_enabled: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

  return NextResponse.json({ ok: true, message: "Subscription saved" });
}

export async function DELETE(
  req: NextRequest
): Promise<NextResponse<SubscribeResponse>> {
  const supabase = await createSupabaseServerClient();
  const { data: authData, error: authErr } = await supabase.auth.getUser();

  if (authErr || !authData.user) {
    return NextResponse.json(
      { ok: false, error: "Not authenticated" },
      { status: 401 }
    );
  }

  const user = authData.user;
  const body = (await req.json().catch(() => ({}))) as { endpoint?: string };
  const endpoint = String(body?.endpoint ?? "").trim();

  if (!endpoint) {
    return NextResponse.json(
      { ok: false, error: "Missing endpoint" },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from("notification_subscriptions")
    .delete()
    .eq("user_id", user.id)
    .eq("endpoint", endpoint);

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }

  // Check if user has any remaining subscriptions
  const { data: remaining } = await supabase
    .from("notification_subscriptions")
    .select("id")
    .eq("user_id", user.id)
    .limit(1);

  // If no subscriptions left, disable push in preferences
  if (!remaining || remaining.length === 0) {
    await supabase
      .from("user_preferences")
      .update({
        push_enabled: false,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);
  }

  return NextResponse.json({ ok: true, message: "Subscription removed" });
}
