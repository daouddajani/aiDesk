"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendTicketReply } from "@/lib/sendTicketReply";
import { getAIProviderForCompany } from "@/lib/ai";

async function requireCompanyMember() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, company_id")
    .eq("id", user.id)
    .single();

  if (
    (profile?.role !== "company_admin" && profile?.role !== "company_agent") ||
    !profile.company_id
  ) {
    return null;
  }

  return { supabase, userId: user.id, companyId: profile.company_id };
}

export async function takeOwnership(_prevState: unknown, formData: FormData) {
  const t = await getTranslations("tickets.takeOwnership.errors");
  const ctx = await requireCompanyMember();
  if (!ctx) return { error: t("unauthorized") };

  const ticketId = String(formData.get("ticketId") ?? "");
  if (!ticketId) return { error: t("ticketMissing") };

  const { data: ticket } = await ctx.supabase
    .from("tickets")
    .select("status")
    .eq("id", ticketId)
    .single();

  const { error } = await ctx.supabase
    .from("tickets")
    .update({
      assigned_agent_id: ctx.userId,
      status: ticket?.status === "new" ? "pending" : ticket?.status,
    })
    .eq("id", ticketId);

  if (error) return { error: t("failed") };

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
    .in("role", ["company_admin", "company_agent"])
    .maybeSingle();

  if (!agent) return { error: t("invalidAgent") };

  const { data: ticket } = await ctx.supabase
    .from("tickets")
    .select("status")
    .eq("id", ticketId)
    .single();

  const { error } = await ctx.supabase
    .from("tickets")
    .update({
      assigned_agent_id: agentId,
      status: ticket?.status === "new" ? "pending" : ticket?.status,
    })
    .eq("id", ticketId);

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

  const { data: ticket } = await ctx.supabase
    .from("tickets")
    .select("id, company_id, status, subject, sender_email, source_message_id")
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

    if (!uploadError) {
      await ctx.supabase.from("attachments").insert({
        comment_id: comment.id,
        storage_path: path,
        filename: attachmentMeta.filename,
        mime_type: attachmentMeta.mimeType,
        size: attachmentMeta.size,
      });
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
