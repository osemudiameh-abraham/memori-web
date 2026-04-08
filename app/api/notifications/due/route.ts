import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

// This route is called by Vercel cron — it must be protected by a secret
// Add CRON_SECRET to your .env.local and Vercel environment variables

type DueResult = {
  user_id: string;
  email: string | null;
  due_count: number;
  email_sent: boolean;
  push_sent: boolean;
  error: string | null;
};

type DueResponse =
  | { ok: true; processed: number; results: DueResult[] }
  | { ok: false; error: string };

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("Missing Supabase env vars");
  return createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
}

function validateCronSecret(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const authHeader = req.headers.get("authorization");
  return authHeader === `Bearer ${secret}`;
}

webpush.setVapidDetails(
  `mailto:${process.env.RESEND_FROM_EMAIL ?? "notifications@memori.app"}`,
  process.env.VAPID_PUBLIC_KEY ?? "",
  process.env.VAPID_PRIVATE_KEY ?? ""
);

export async function POST(req: NextRequest): Promise<NextResponse<DueResponse>> {
  if (!validateCronSecret(req)) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const db = getAdminClient();
  const resend = new Resend(process.env.RESEND_API_KEY);
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://memori.app";

  // Find all users who have decisions due today and have email reminders enabled
  // We join user_preferences to get timezone and reminder settings
  const { data: usersWithPrefs, error: prefsError } = await db
    .from("user_preferences")
    .select("user_id, timezone, email_reminders, push_enabled, reminder_time");

  if (prefsError) {
    return NextResponse.json(
      { ok: false, error: prefsError.message },
      { status: 500 }
    );
  }

  if (!usersWithPrefs || usersWithPrefs.length === 0) {
    return NextResponse.json({ ok: true, processed: 0, results: [] });
  }

  const results: DueResult[] = [];

  for (const prefs of usersWithPrefs) {
    const result: DueResult = {
      user_id: prefs.user_id,
      email: null,
      due_count: 0,
      email_sent: false,
      push_sent: false,
      error: null,
    };

    try {
      // Count decisions due for this user
      const { count, error: countError } = await db
        .from("decisions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", prefs.user_id)
        .is("archived_at", null)
        .lte("review_due_at", new Date().toISOString());

      if (countError) {
        result.error = countError.message;
        results.push(result);
        continue;
      }

      const dueCount = count ?? 0;
      result.due_count = dueCount;

      if (dueCount === 0) {
        results.push(result);
        continue;
      }

      // Check if we already sent a notification today to avoid duplicates
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const { count: alreadySent } = await db
        .from("notification_log")
        .select("id", { count: "exact", head: true })
        .eq("user_id", prefs.user_id)
        .eq("type", "due_reminder")
        .gte("send_at", todayStart.toISOString());

      if ((alreadySent ?? 0) > 0) {
        results.push(result);
        continue;
      }

      // Get user email from auth
      const { data: userData, error: userError } = await db.auth.admin.getUserById(
        prefs.user_id
      );

      if (userError || !userData?.user?.email) {
        result.error = "Could not retrieve user email";
        results.push(result);
        continue;
      }

      const userEmail = userData.user.email;
      result.email = userEmail;

      const nowIso = new Date().toISOString();
      const reviewUrl = `${appUrl}/reviews`;
      const subject =
        dueCount === 1
          ? "You have 1 decision ready for review"
          : `You have ${dueCount} decisions ready for review`;

      const htmlBody = `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#f5f0e8;border-radius:12px;">
          <div style="margin-bottom:24px;">
            <span style="font-size:22px;font-weight:600;color:#1a1512;font-family:Georgia,serif;">Seven</span>
          </div>
          <h2 style="font-size:18px;font-weight:600;color:#1a1512;margin:0 0 12px;">
            ${subject}
          </h2>
          <p style="font-size:15px;color:#4e4035;line-height:1.6;margin:0 0 24px;">
            Closing the loop on your decisions builds the pattern intelligence that makes Seven more valuable over time.
          </p>
          <a href="${reviewUrl}" style="display:inline-block;padding:12px 24px;background:#1a1512;color:#f5f0e8;text-decoration:none;border-radius:8px;font-size:15px;font-weight:500;">
            Review now →
          </a>
          <p style="font-size:12px;color:#a09078;margin-top:32px;line-height:1.5;">
            You're receiving this because you have email reminders enabled in Seven.
            You can turn them off in your settings.
          </p>
        </div>
      `;

      // Send email if enabled
      if (prefs.email_reminders) {
        try {
          await resend.emails.send({
            from: fromEmail,
            to: userEmail,
            subject,
            html: htmlBody,
          });
          result.email_sent = true;
        } catch (emailErr) {
          result.error = emailErr instanceof Error ? emailErr.message : "Email send failed";
        }
      }

      // Send push notification if enabled
      if (prefs.push_enabled) {
        const { data: subscriptions } = await db
          .from("notification_subscriptions")
          .select("endpoint, keys")
          .eq("user_id", prefs.user_id);

        if (subscriptions && subscriptions.length > 0) {
          const payload = JSON.stringify({
            title: "Seven",
            body: subject,
            url: reviewUrl,
          });

          for (const sub of subscriptions) {
            try {
              await webpush.sendNotification(
                {
                  endpoint: sub.endpoint,
                  keys: {
                    p256dh: sub.keys.p256dh,
                    auth: sub.keys.auth,
                  },
                },
                payload
              );
              result.push_sent = true;
            } catch {
              // Subscription may be expired — non-blocking
            }
          }
        }
      }

      // Log the notification send
      await db.from("notification_log").insert({
        user_id: prefs.user_id,
        type: "due_reminder",
        channel: result.email_sent && result.push_sent
          ? "email+push"
          : result.email_sent
          ? "email"
          : result.push_sent
          ? "push"
          : "none",
        send_at: nowIso,
        sent_at: result.email_sent || result.push_sent ? nowIso : null,
      });
    } catch (err) {
      result.error = err instanceof Error ? err.message : "Unknown error";
    }

    results.push(result);
  }

  const processed = results.filter((r) => r.due_count > 0).length;
  return NextResponse.json({ ok: true, processed, results });
}
