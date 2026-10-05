import crypto from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendCompanyMail } from "./sendTicketReply";


function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Emails the ticket's requester a one-time survey link after close. Silently
// does nothing when the company hasn't enabled the survey, has no questions
// or helpdesk URL, or this ticket already got an invitation (a reopen +
// re-close doesn't send a second one — ticket_id is unique).
export async function sendSurveyInvitation(adminClient: SupabaseClient, ticketId: string) {
  const { data: ticket } = await adminClient
    .from("tickets")
    .select("id, company_id, subject, sender_email, assigned_agent_id")
    .eq("id", ticketId)
    .single();
  if (!ticket?.sender_email) return;

  const [{ data: company }, { count: questionCount }, { data: existing }] =
    await Promise.all([
      adminClient
        .from("companies")
        .select("id, name, survey_enabled, helpdesk_url, mailbox_provider, mailbox_imap_config")
        .eq("id", ticket.company_id)
        .single(),
      adminClient
        .from("survey_questions")
        .select("id", { count: "exact", head: true })
        .eq("company_id", ticket.company_id)
        .is("archived_at", null),
      adminClient
        .from("survey_responses")
        .select("id")
        .eq("ticket_id", ticket.id)
        .maybeSingle(),
    ]);

  if (!company?.survey_enabled || !company.helpdesk_url || !questionCount || existing) {
    return;
  }

  const token = crypto.randomBytes(32).toString("hex");
  const { data: response, error: insertError } = await adminClient
    .from("survey_responses")
    .insert({
      company_id: ticket.company_id,
      ticket_id: ticket.id,
      agent_id: ticket.assigned_agent_id,
      token,
    })
    .select("id")
    .single();
  if (insertError || !response) return;

  const surveyUrl = `${company.helpdesk_url}/survey/${token}`;
  const subject = escapeHtml(ticket.subject || "");
  const { error } = await sendCompanyMail(
    adminClient,
    company,
    ticket.sender_email,
    `How did we do? ${ticket.subject || ""}`.trim(),
    `<p>Your request <strong>${subject}</strong> has been resolved.</p><p>We'd appreciate a minute of your time to tell us how we did.</p><p><a href="${surveyUrl}">Take the survey</a></p><p>${escapeHtml(company.name ?? "")}</p>`,
  );

  if (error) {
    console.error(`survey invitation failed for ${ticket.id}: ${error}`);
    return;
  }

  await adminClient
    .from("survey_responses")
    .update({ sent_at: new Date().toISOString() })
    .eq("id", response.id);
}
