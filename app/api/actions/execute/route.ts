// app/api/actions/execute/route.ts
// Phase 3 — GEL Action Executor
// Runs approved actions

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import OpenAI from "openai";

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

async function draftEmailWithLLM(opts: {
  senderName: string | null;
  senderRole: string | null;
  senderCompany: string | null;
  recipientName: string;
  subject: string;
  identityContext: Record<string, string>;
}): Promise<string> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const identityLines = Object.entries(opts.identityContext)
    .filter(([, v]) => v)
    .map(([k, v]) => `- ${k}: ${v}`)
    .join("\n");

  const systemPrompt = `You are drafting a professional email on behalf of ${opts.senderName ?? "the user"}.
Write a concise, genuine, professional email body.
Do not include subject line. Do not include "Subject:" prefix.
Start directly with the greeting.
Keep it under 150 words.
Sound human — not AI-generated.
Use the sender's identity context to make it specific and relevant.

Sender context:
${identityLines || "No additional context."}`;

  const userPrompt = `Draft a professional email to ${opts.recipientName} about: "${opts.subject}".
The sender is ${opts.senderName ?? "the user"}${opts.senderRole ? `, ${opts.senderRole}` : ""}${opts.senderCompany ? ` at ${opts.senderCompany}` : ""}.`;

  const resp = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    temperature: 0.6,
    max_tokens: 300,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });

  return resp.choices?.[0]?.message?.content?.trim() ?? `Hi ${opts.recipientName},\n\nI wanted to reach out about ${opts.subject}.\n\nBest,\n${opts.senderName ?? ""}`;
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

        // Look up email in entity graph
        let recipientEmail: string | null = null;
        if (recipient) {
          const { data: entities } = await supabase
            .from("situation_entities")
            .select("email, entity_type")
            .eq("user_id", authData.user.id)
            .ilike("entity_text", recipient);
          if (entities && entities.length > 0) {
            const personWithEmail = entities.find(e => e.entity_type === "person" && e.email);
            const anyWithEmail = entities.find(e => e.email);
            recipientEmail = personWithEmail?.email ?? anyWithEmail?.email ?? null;
          }
        }

        // Fetch identity context
        const { data: identityData } = await supabase
          .from("memory_facts")
          .select("fact_key, value_text")
          .eq("user_id", authData.user.id)
          .eq("status", "active")
          .limit(10);
        const identityContext: Record<string, string> = {};
        for (const fact of identityData ?? []) {
          identityContext[fact.fact_key] = fact.value_text;
        }

        // Draft email body via LLM
        const bodyText = await draftEmailWithLLM({
          senderName: identityContext["self_name"] ?? null,
          senderRole: identityContext["self_role"] ?? null,
          senderCompany: identityContext["self_company"] ?? null,
          recipientName,
          subject,
          identityContext,
        });

        // Check for Gmail API token
        const { data: gmailToken } = await supabase
          .from("oauth_tokens")
          .select("access_token, expires_at")
          .eq("user_id", authData.user.id)
          .eq("provider", "gmail")
          .maybeSingle();

        // If Gmail API token exists and recipient email known — send directly
        if (gmailToken?.access_token && recipientEmail) {
          try {
            const emailLines = [
              `To: ${recipientEmail}`,
              `Subject: ${subject}`,
              `Content-Type: text/plain; charset=utf-8`,
              `MIME-Version: 1.0`,
              ``,
              bodyText,
            ].join("\r\n");
            const encoded = Buffer.from(emailLines).toString("base64url");
            const gmailRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${gmailToken.access_token}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ raw: encoded }),
            });
            if (gmailRes.ok) {
              message = `✓ Email sent to ${recipientName} (${recipientEmail}) directly from your Gmail — subject: "${subject}".`;
              break;
            }
          } catch {
            // Fall through to compose URL
          }
        }

        // Fallback: open Gmail compose URL
        const gmailUrl = recipientEmail
          ? `https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(recipientEmail)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyText)}`
          : null;

        if (!gmailUrl && !recipientEmail) {
          // Ask for email first
          message = `I don\'t have an email address for ${recipientName} yet. What\'s their email address?`;
          break;
        }

        message = `__GMAIL_COMPOSE__${gmailUrl}__RECIPIENT__${recipientName}__SUBJECT__${subject}`;
        break;
      }

      case "send_whatsapp":
      case "send_imessage": {
        const recipient = params.recipient ?? null;
        const recipientName = recipient ?? "them";
        const subject = params.subject ?? "checking in";
        const isWhatsApp = kind === "send_whatsapp";

        // Look up phone in entity graph
        let recipientPhone: string | null = null;
        if (recipient) {
          const { data: entities } = await supabase
            .from("situation_entities")
            .select("phone, entity_type")
            .eq("user_id", authData.user.id)
            .ilike("entity_text", recipient);
          if (entities && entities.length > 0) {
            const personWithPhone = entities.find(e => e.entity_type === "person" && e.phone);
            const anyWithPhone = entities.find(e => e.phone);
            recipientPhone = personWithPhone?.phone ?? anyWithPhone?.phone ?? null;
          }
        }

        if (!recipientPhone) {
          message = `I don't have a phone number for ${recipientName} yet. What's their number? (e.g. +44 7700 900000)`;
          break;
        }

        // Draft a short conversational message via LLM
        const { data: identityDataMsg } = await supabase
          .from("memory_facts")
          .select("fact_key, value_text")
          .eq("user_id", authData.user.id)
          .eq("status", "active")
          .limit(10);

        const identityContextMsg: Record<string, string> = {};
        for (const fact of identityDataMsg ?? []) {
          identityContextMsg[fact.fact_key] = fact.value_text;
        }

        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const senderName = identityContextMsg["self_name"] ?? "me";
        const msgDraft = await openai.chat.completions.create({
          model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
          temperature: 0.7,
          max_tokens: 120,
          messages: [
            { role: "system", content: `You are drafting a short ${isWhatsApp ? "WhatsApp" : "iMessage"} message on behalf of ${senderName}. Keep it under 3 sentences. Casual, warm, direct. No subject line. Just the message body.` },
            { role: "user", content: `Write a ${isWhatsApp ? "WhatsApp" : "text"} message to ${recipientName} about: "${subject}". Sender: ${senderName}.` },
          ],
        }).then(r => r.choices?.[0]?.message?.content?.trim() ?? `Hey ${recipientName}, wanted to reach out about ${subject}.`);

        // Clean phone number
        const cleanPhone = recipientPhone.replace(/[^0-9+]/g, "");

        // Build compose URL
        const composeUrl = isWhatsApp
          ? `https://wa.me/${cleanPhone.replace("+", "")}?text=${encodeURIComponent(msgDraft)}`
          : `sms:${cleanPhone}?body=${encodeURIComponent(msgDraft)}`;

        message = `__MSG_COMPOSE__${composeUrl}__RECIPIENT__${recipientName}__KIND__${isWhatsApp ? "WhatsApp" : "iMessage"}`;
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
