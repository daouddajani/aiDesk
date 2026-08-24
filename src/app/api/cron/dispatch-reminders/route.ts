import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resend, RESEND_FROM_EMAIL } from "@/lib/resend";

export const maxDuration = 300;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminClient = createAdminClient();
  const { data: dueReminders, error } = await adminClient
    .from("reminders")
    .select("id, ticket_id, agent_id, comment")
    .is("sent_at", null)
    .lte("remind_at", new Date().toISOString());

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!dueReminders || dueReminders.length === 0) {
    return NextResponse.json({ dispatched: 0, results: [] });
  }

  const ticketIds = [...new Set(dueReminders.map((r) => r.ticket_id))];
  const { data: tickets } = await adminClient
    .from("tickets")
    .select("id, subject")
    .in("id", ticketIds);
  const subjectByTicketId = new Map(
    (tickets ?? []).map((t) => [t.id, t.subject]),
  );

  // Same auth.admin.listUsers()-joined-to-agent-ids pattern as
  // loadAgentEmailMap() in poll-mailboxes/route.ts, just keyed
  // agent id -> email instead of email -> agent id.
  const agentIds = new Set(dueReminders.map((r) => r.agent_id));
  const { data: usersData } = await adminClient.auth.admin.listUsers({
    perPage: 1000,
  });
  const emailByAgentId = new Map<string, string>();
  for (const user of usersData?.users ?? []) {
    if (user.email && agentIds.has(user.id)) {
      emailByAgentId.set(user.id, user.email);
    }
  }

  const origin = new URL(request.url).origin;
  const results: { id: string; sent?: true; error?: string }[] = [];
  let dispatched = 0;

  for (const reminder of dueReminders) {
    try {
      const agentEmail = emailByAgentId.get(reminder.agent_id);
      if (!agentEmail) {
        results.push({ id: reminder.id, error: "No email found for agent" });
        continue;
      }

      const subject = subjectByTicketId.get(reminder.ticket_id) ?? "a ticket";
      const ticketUrl = `${origin}/dashboard/tickets/${reminder.ticket_id}`;

      const { error: sendError } = await resend.emails.send({
        from: RESEND_FROM_EMAIL,
        to: agentEmail,
        subject: `Reminder: ${subject}`,
        html: `<p>This is your reminder for ticket <strong>${subject}</strong>.</p><p>${reminder.comment}</p><p><a href="${ticketUrl}">View ticket</a></p>`,
      });

      if (sendError) {
        results.push({ id: reminder.id, error: sendError.message });
        continue;
      }

      await adminClient
        .from("reminders")
        .update({ sent_at: new Date().toISOString() })
        .eq("id", reminder.id);

      dispatched += 1;
      results.push({ id: reminder.id, sent: true });
    } catch (err) {
      results.push({
        id: reminder.id,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return NextResponse.json({ dispatched, results });
}
