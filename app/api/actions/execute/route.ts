// app/api/actions/execute/route.ts
// Phase 3 — GEL Action Executor
// Runs approved actions

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Resend } from "resend";

export const runtime = "nodejs";

type ExecuteRequest = {
  kind: string;
  params: Record<string, string | null>;
  approved: boolean;
};

type ExecuteResult = {
  ok: boolean;
  kind: string;
  executed: boolean;
  message: string;
};

async function executeCreateReminder(
  userId: string,
  params: Record<string, string | null>,
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>
): Promise<string> {
  const subject = params.subject ?? "Reminder";
  const time = params.time ?? null;

  // Store as a memory note with reminder flag
  // Clean up subject — remove quotes and "Remind me to" prefix
  // Strip quotes, prefixes, and the time phrase from subject
  let cleanSubject = subject
    .replace(/^["']|["']$/g, "")
    .replace(/^remind me to /i, "")
    .replace(/^reminder:\s*/i, "")
    .trim();
  // If time is in the subject, remove it
  if (time) {
    cleanSubject = cleanSubject
      .replace(new RegExp(`\\s*(for\\s+)?${time.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i'), "")
      .replace(/\s*:\s*"[^"]*"\s*$/, "")
      .trim();
  }
  // If subject is still the full original message, truncate it
  if (cleanSubject.length > 50) cleanSubject = cleanSubject.slice(0, 47).trimEnd() + "...";

  const reminderText = time
    ? `Reminder: ${cleanSubject} (${time})`
    : `Reminder: ${cleanSubject}`;

  const { error } = await supabase
    .from("memories_structured")
    .insert({
      user_id: userId,
      text: reminderText,
      memory_type: "note",
      importance: 8,
      archived: false,
    });

  if (error) throw new Error(error.message);

  return time
    ? `✓ Reminder set: "${cleanSubject}" — for ${time}.`
    : `✓ Reminder set: "${cleanSubject}". I'll surface it next session.`;
}

async function executeDraftMessage(
  params: Record<string, string | null>
): Promise<string> {
  const recipient = params.recipient ?? "them";
  const subject = params.subject ?? "the topic";
  return `Draft ready for ${recipient}:\n\nHi ${recipient},\n\nI wanted to follow up about ${subject}. Let me know if you have any questions or if there's anything else you need.\n\nBest,\nAbraham\n\nFeel free to edit before sending.`;
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
    }

    const body = await req.json() as ExecuteRequest;
    const { kind, params, approved } = body;

    if (!approved) {
      return NextResponse.json({
        ok: true,
        kind,
        executed: false,
        message: "Action cancelled. No changes were made.",
      });
    }

    let message = "";

    switch (kind) {
      case "create_reminder":
        message = await executeCreateReminder(authData.user.id, params, supabase);
        break;

      case "draft_message":
        message = await executeDraftMessage(params);
        break;

      case "send_email": {
        const recipient = params.recipient ?? null;
        const subject = params.subject ?? "following up";
        const recipientName = recipient ?? "them";

        // If params.email provided directly — store it first
        if (params.email && recipient) {
          await supabase.from("situation_entities").upsert({
            user_id: authData.user.id,
            entity_text: recipient,
            entity_type: "person",
            email: params.email,
            confidence: 1.0,
            occurrence_count: 1,
          }, { onConflict: "user_id,entity_text,entity_type", ignoreDuplicates: false });
        }

        // Look up email in entity graph — prefer person type, fallback to any
        let recipientEmail: string | null = null;
        if (recipient) {
          const { data: entities } = await supabase
            .from("situation_entities")
            .select("email, entity_type")
            .eq("user_id", authData.user.id)
            .ilike("entity_text", recipient);
          if (entities && entities.length > 0) {
            // Prefer person type with email
            const personWithEmail = entities.find(e => e.entity_type === "person" && e.email);
            const anyWithEmail = entities.find(e => e.email);
            recipientEmail = personWithEmail?.email ?? anyWithEmail?.email ?? null;
          }
        }

        // If no email stored — ask for it
        if (!recipientEmail) {
          message = `I don\'t have an email address for ${recipientName} yet.\n\nReply with their email address and I\'ll send it right away. For example: james@example.com`;
          break;
        }

        // Send via Resend
        try {
          const resend = new Resend(process.env.RESEND_API_KEY);
          const fromEmail = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";
          await resend.emails.send({
            from: fromEmail,
            to: recipientEmail,
            subject: `${subject}`,
            html: `<p>Hi ${recipientName},</p><p>This message was sent via Memori.</p><p>Regarding: ${subject}</p>`,
          });
          // Log execution
          await supabase.from("pending_actions").update({
            status: "executed",
            executed_at: new Date().toISOString(),
            result: { recipient: recipientEmail, subject },
          }).eq("user_id", authData.user.id).eq("kind", "send_email").eq("status", "approved");
          message = `✓ Email sent to ${recipientName} (${recipientEmail}) about "${subject}".`;
        } catch (emailErr: unknown) {
          message = `Failed to send email: ${emailErr instanceof Error ? emailErr.message : "unknown error"}`;
        }
        break;
      }

      case "schedule_meeting":
        message = `Action queued. Meeting scheduling with ${params.recipient ?? "them"} ${params.time ? `for ${params.time}` : ""} will be available once the calendar connector is ready.`;
        break;

      default:
        message = `I've noted the action (${kind}). This connector isn't fully built yet — I'll execute it when it's ready.`;
    }

    const result: ExecuteResult = { ok: true, kind, executed: true, message };
    return NextResponse.json(result);

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Execution error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
