"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendTicketReply } from "@/lib/sendTicketReply";
import { getAIProviderForCompany } from "@/lib/ai";
import { checkRateLimit } from "@/lib/rateLimit";
import { getCompanyTimezone } from "@/lib/companyTimezone";
import { localDateStringToUtcISO } from "@/lib/timezone";

async function requireCompanyMember() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, company_id, disabled")
    .eq("id", user.id)
    .single();

  if (
    (profile?.role !== "company_admin" &&
      profile?.role !== "company_agent" &&
      profile?.role !== "supervisor") ||
    !profile.company_id ||
    profile.disabled
  ) {
    return null;
  }

  return { supabase, userId: user.id, companyId: profile.company_id };
}

async function requireCompanyAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, company_id, disabled")
    .eq("id", user.id)
    .single();

  if (
    profile?.role !== "company_admin" ||
    !profile.company_id ||
    profile.disabled
  ) {
    return null;
  }

  return { supabase, userId: user.id, companyId: profile.company_id };
}

async function assignTicket(
  ctx: NonNullable<Awaited<ReturnType<typeof requireCompanyMember>>>,
  ticketId: string,
  newAgentId: string,
): Promise<"closed" | "failed" | null> {
  const { data: ticket } = await ctx.supabase
    .from("tickets")
    .select("status, assigned_agent_id")
    .eq("id", ticketId)
    .single();

  if (!ticket) return "failed";
  if (ticket.status === "closed") return "closed";

  const { error } = await ctx.supabase
    .from("tickets")
    .update({
      assigned_agent_id: newAgentId,
      status: ticket.status === "new" ? "pending" : ticket.status,
    })
    .eq("id", ticketId);

  if (error) return "failed";

  // Skip logging a no-op reassignment (e.g. taking ownership of a ticket
  // already assigned to you).
  if (ticket.assigned_agent_id !== newAgentId) {
    await ctx.supabase.from("ticket_assignment_log").insert({
      ticket_id: ticketId,
      company_id: ctx.companyId,
      changed_by: ctx.userId,
      previous_agent_id: ticket.assigned_agent_id,
      new_agent_id: newAgentId,
    });
  }

  return null;
}

export async function takeOwnership(_prevState: unknown, formData: FormData) {
  const t = await getTranslations("tickets.takeOwnership.errors");
  const ctx = await requireCompanyMember();
  if (!ctx) return { error: t("unauthorized") };

  const ticketId = String(formData.get("ticketId") ?? "");
  if (!ticketId) return { error: t("ticketMissing") };

  const result = await assignTicket(ctx, ticketId, ctx.userId);
  if (result === "closed") return { error: t("closed") };
  if (result === "failed") return { error: t("failed") };

  revalidatePath(`/dashboard/tickets/${ticketId}`);
  return { success: true };
}

export async function reassignTicket(_prevState: unknown, formData: FormData) {
  const t = await getTranslations("tickets.reassign.errors");
  const ctx = await requireCompanyMember();
  if (!ctx) return { error: t("unauthorized") };

  const ticketId = String(formData.get("ticketId") ?? "");
  const agentId = String(formData.get("agentId") ?? "");
  if (!ticketId || !agentId) return { error: t("agentRequired") };

  // Confirms the target is an agent/admin of the caller's own company —
  // tickets.assigned_agent_id has no FK-level company check, so this is
  // the only thing stopping a cross-company assignment.
  const { data: agent } = await ctx.supabase
    .from("profiles")
    .select("id")
    .eq("id", agentId)
    .eq("company_id", ctx.companyId)
    .in("role", ["company_admin", "company_agent", "supervisor"])
    .eq("disabled", false)
    .maybeSingle();

  if (!agent) return { error: t("invalidAgent") };

  const result = await assignTicket(ctx, ticketId, agentId);
  if (result === "closed") return { error: t("closed") };
  if (result === "failed") return { error: t("failed") };

  revalidatePath(`/dashboard/tickets/${ticketId}`);
  return { success: true };
}

export async function startTimer(_prevState: unknown, formData: FormData) {
  const t = await getTranslations("tickets.timer.errors");
  const ctx = await requireCompanyMember();
  if (!ctx) return { error: t("unauthorized") };

  const ticketId = String(formData.get("ticketId") ?? "");
  if (!ticketId) return { error: t("ticketMissing") };

  const { data: ticket } = await ctx.supabase
    .from("tickets")
    .select("status")
    .eq("id", ticketId)
    .single();

  if (ticket?.status === "closed") return { error: t("closed") };

  // An agent can only work on one ticket at a time — stop any other
  // running timer of theirs before starting this one.
  await ctx.supabase
    .from("ticket_time_entries")
    .update({ ended_at: new Date().toISOString() })
    .eq("agent_id", ctx.userId)
    .is("ended_at", null);

  const { error } = await ctx.supabase.from("ticket_time_entries").insert({
    ticket_id: ticketId,
    company_id: ctx.companyId,
    agent_id: ctx.userId,
  });

  if (error) return { error: t("failed") };

  revalidatePath(`/dashboard/tickets/${ticketId}`);
  return { success: true };
}

export async function stopTimer(_prevState: unknown, formData: FormData) {
  const t = await getTranslations("tickets.timer.errors");
  const ctx = await requireCompanyMember();
  if (!ctx) return { error: t("unauthorized") };

  const ticketId = String(formData.get("ticketId") ?? "");
  if (!ticketId) return { error: t("ticketMissing") };

  const { error } = await ctx.supabase
    .from("ticket_time_entries")
    .update({ ended_at: new Date().toISOString() })
    .eq("ticket_id", ticketId)
    .eq("agent_id", ctx.userId)
    .is("ended_at", null);

  if (error) return { error: t("failed") };

  revalidatePath(`/dashboard/tickets/${ticketId}`);
  return { success: true };
}

export async function addComment(_prevState: unknown, formData: FormData) {
  const t = await getTranslations("tickets.comment.errors");
  const ctx = await requireCompanyMember();
  if (!ctx) return { error: t("unauthorized") };

  const ticketId = String(formData.get("ticketId") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  const isInternal = formData.get("isInternal") === "on";
  const attachmentFile = formData.get("attachment");

  if (!ticketId || !body) {
    return { error: t("bodyRequired") };
  }

  // 20 comments per 5 minutes per agent — generous for real use, blocks
  // scripted spam/abuse of the (email-sending) reply path.
  const allowed = await checkRateLimit(`comment:${ctx.userId}`, 20, 5 * 60);
  if (!allowed) {
    return { error: t("rateLimited") };
  }

  const { data: ticket } = await ctx.supabase
    .from("tickets")
    .select(
      "id, company_id, status, subject, sender_email, source_message_id, watcher_emails",
    )
    .eq("id", ticketId)
    .single();

  if (!ticket) return { error: t("notFound") };

  const { data: comment, error: insertError } = await ctx.supabase
    .from("ticket_comments")
    .insert({
      ticket_id: ticketId,
      author_id: ctx.userId,
      body,
      is_internal: isInternal,
    })
    .select("id")
    .single();

  if (insertError || !comment) {
    return { error: t("saveFailed") };
  }

  let attachmentBuffer: Buffer | null = null;
  let attachmentMeta: { filename: string; mimeType: string; size: number } | null =
    null;
  let attachmentError: string | null = null;

  if (attachmentFile instanceof File && attachmentFile.size > 0) {
    attachmentBuffer = Buffer.from(await attachmentFile.arrayBuffer());
    attachmentMeta = {
      filename: attachmentFile.name,
      mimeType: attachmentFile.type || "application/octet-stream",
      size: attachmentFile.size,
    };

    const path = `${ctx.companyId}/${comment.id}/${attachmentMeta.filename.replace(/[/\\]/g, "_")}`;
    const { error: uploadError } = await ctx.supabase.storage
      .from("attachments")
      .upload(path, attachmentBuffer, { contentType: attachmentMeta.mimeType });

    if (uploadError) {
      attachmentError = uploadError.message;
    } else {
      const { error: attachmentInsertError } = await ctx.supabase
        .from("attachments")
        .insert({
          comment_id: comment.id,
          storage_path: path,
          filename: attachmentMeta.filename,
          mime_type: attachmentMeta.mimeType,
          size: attachmentMeta.size,
        });

      if (attachmentInsertError) {
        attachmentError = attachmentInsertError.message;
      }
    }
  }

  // "On Process" means the agent has responded at least once — only an
  // external reply counts as a response; internal notes don't advance it.
  if (!isInternal && ticket.status === "pending") {
    await ctx.supabase
      .from("tickets")
      .update({ status: "on_process" })
      .eq("id", ticketId);
  }

  if (!isInternal) {
    const adminClient = createAdminClient();
    const { data: company } = await adminClient
      .from("companies")
      .select("id, mailbox_provider, mailbox_imap_config")
      .eq("id", ticket.company_id)
      .single();

    if (company) {
      const { error: sendError } = await sendTicketReply(
        adminClient,
        company,
        {
          source_message_id: ticket.source_message_id,
          sender_email: ticket.sender_email,
          subject: ticket.subject,
        },
        body,
        attachmentBuffer && attachmentMeta
          ? [
              {
                filename: attachmentMeta.filename,
                mimeType: attachmentMeta.mimeType,
                content: attachmentBuffer,
              },
            ]
          : [],
        (ticket.watcher_emails ?? []) as { name: string | null; address: string }[],
      );

      if (sendError) {
        revalidatePath(`/dashboard/tickets/${ticketId}`);
        return {
          error: t("sendFailed", { message: sendError }),
        };
      }
    }
  }

  revalidatePath(`/dashboard/tickets/${ticketId}`);

  if (attachmentError) {
    return { error: t("attachmentFailed", { message: attachmentError }) };
  }

  return { success: true };
}

export async function closeTicket(_prevState: unknown, formData: FormData) {
  const t = await getTranslations("tickets.closeForm.errors");
  const ctx = await requireCompanyMember();
  if (!ctx) return { error: t("unauthorized") };

  const ticketId = String(formData.get("ticketId") ?? "");
  const solutionText = String(formData.get("solutionText") ?? "").trim();

  if (!ticketId) return { error: t("ticketMissing") };
  if (!solutionText) {
    return { error: t("solutionRequired") };
  }

  const { data: ticket } = await ctx.supabase
    .from("tickets")
    .select("company_id, subject, description")
    .eq("id", ticketId)
    .single();

  const { error } = await ctx.supabase
    .from("tickets")
    .update({
      status: "closed",
      solution_text: solutionText,
      closed_at: new Date().toISOString(),
    })
    .eq("id", ticketId);

  if (error) return { error: t("failed") };

  // Closed tickets feed the AI's suggested-answer knowledge base — best
  // effort, a failed embedding (or AI simply being disabled for this
  // company) shouldn't block the close itself.
  if (ticket) {
    try {
      const adminClient = createAdminClient();
      const aiProvider = await getAIProviderForCompany(
        adminClient,
        ticket.company_id,
      );
      if (aiProvider) {
        const content = `${ticket.subject}\n\n${ticket.description}\n\nSolution: ${solutionText}`;
        const embedding = await aiProvider.embed(content);
        await ctx.supabase.from("ticket_embeddings").upsert({
          ticket_id: ticketId,
          company_id: ticket.company_id,
          content,
          embedding,
        });
      }
    } catch {
      // Non-fatal, see comment above.
    }
  }

  revalidatePath(`/dashboard/tickets/${ticketId}`);
  return { success: true };
}

export async function reopenTicket(_prevState: unknown, formData: FormData) {
  const t = await getTranslations("tickets.reopenForm.errors");
  const ctx = await requireCompanyMember();
  if (!ctx) return { error: t("unauthorized") };

  const ticketId = String(formData.get("ticketId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();

  if (!ticketId) return { error: t("ticketMissing") };
  if (!reason) return { error: t("reasonRequired") };

  const { data: ticket } = await ctx.supabase
    .from("tickets")
    .select("status")
    .eq("id", ticketId)
    .single();

  if (ticket?.status !== "closed") return { error: t("notClosed") };

  const { error } = await ctx.supabase
    .from("tickets")
    .update({ status: "pending", closed_at: null })
    .eq("id", ticketId);

  if (error) return { error: t("failed") };

  // The reopen reason is logged as an internal activity comment — not
  // emailed to the requester, same convention as other internal notes.
  const logTranslate = await getTranslations("tickets.reopenForm");
  await ctx.supabase.from("ticket_comments").insert({
    ticket_id: ticketId,
    author_id: ctx.userId,
    body: logTranslate("logEntry", { reason }),
    is_internal: true,
  });

  revalidatePath(`/dashboard/tickets/${ticketId}`);
  return { success: true };
}

export async function addReminder(_prevState: unknown, formData: FormData) {
  const t = await getTranslations("tickets.addReminder.errors");
  const ctx = await requireCompanyMember();
  if (!ctx) return { error: t("unauthorized") };

  const ticketId = String(formData.get("ticketId") ?? "");
  const date = String(formData.get("date") ?? "").trim();
  const time = String(formData.get("time") ?? "").trim();
  const comment = String(formData.get("comment") ?? "").trim();

  if (!ticketId) return { error: t("ticketMissing") };
  if (!date || !time) return { error: t("dateRequired") };
  if (!comment) return { error: t("commentRequired") };

  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(time);
  if (!dateMatch || !timeMatch) return { error: t("invalidDateTime") };

  const { data: ticket } = await ctx.supabase
    .from("tickets")
    .select("id, company_id, status, archived_at")
    .eq("id", ticketId)
    .eq("company_id", ctx.companyId)
    .single();

  if (!ticket) return { error: t("notFound") };
  if (ticket.archived_at || ticket.status === "closed") {
    return { error: t("closed") };
  }

  const timezone = await getCompanyTimezone(ctx.supabase, ctx.companyId);
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  const remindAtIso = localDateStringToUtcISO(date, timezone, hour, minute, 0, 0);

  if (new Date(remindAtIso).getTime() <= Date.now()) {
    return { error: t("mustBeFuture") };
  }

  const { error } = await ctx.supabase.from("reminders").insert({
    company_id: ctx.companyId,
    ticket_id: ticketId,
    agent_id: ctx.userId,
    remind_at: remindAtIso,
    comment,
  });

  if (error) return { error: t("failed") };

  revalidatePath(`/dashboard/tickets/${ticketId}`);
  revalidatePath("/dashboard/reminders");
  return { success: true };
}

export async function archiveTicket(_prevState: unknown, formData: FormData) {
  const t = await getTranslations("tickets.archiveForm.errors");
  const ctx = await requireCompanyAdmin();
  if (!ctx) return { error: t("unauthorized") };

  const ticketId = String(formData.get("ticketId") ?? "");
  if (!ticketId) return { error: t("ticketMissing") };

  const { data: ticket } = await ctx.supabase
    .from("tickets")
    .select("status, archived_at")
    .eq("id", ticketId)
    .single();

  if (!ticket) return { error: t("ticketMissing") };
  if (ticket.archived_at) return { error: t("alreadyArchived") };

  const now = new Date().toISOString();
  const updates: {
    archived_at: string;
    status?: "closed";
    solution_text?: string;
    closed_at?: string;
  } = { archived_at: now };

  // A ticket already closed with its own solution keeps that solution —
  // "Archived" only stands in when archiving is what force-closes it.
  if (ticket.status !== "closed") {
    updates.status = "closed";
    updates.solution_text = "Archived";
    updates.closed_at = now;
  }

  const { error } = await ctx.supabase
    .from("tickets")
    .update(updates)
    .eq("id", ticketId);

  if (error) return { error: t("failed") };

  // Logged the same way reopenTicket logs its reason: an internal activity
  // comment. author_id captures who archived it — the Activity feed already
  // resolves that to a name, so the log text doesn't need to embed one.
  const archiveLogTranslate = await getTranslations("tickets.archiveForm");
  await ctx.supabase.from("ticket_comments").insert({
    ticket_id: ticketId,
    author_id: ctx.userId,
    body: archiveLogTranslate("logEntry"),
    is_internal: true,
  });

  revalidatePath(`/dashboard/tickets/${ticketId}`);
  revalidatePath("/dashboard/tickets");
  revalidatePath("/dashboard/archived");
  return { success: true };
}
