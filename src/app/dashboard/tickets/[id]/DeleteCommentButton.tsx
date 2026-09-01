"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { deleteComment } from "../actions";
import { SubmitButton } from "@/components/SubmitButton";

export function DeleteCommentButton({
  ticketId,
  commentId,
}: {
  ticketId: string;
  commentId: string;
}) {
  const t = useTranslations("tickets.comment.delete");
  const [state, formAction] = useActionState(deleteComment, undefined);

  return (
    <form action={formAction} className="inline-flex items-center gap-2">
      <input type="hidden" name="ticketId" value={ticketId} />
      <input type="hidden" name="commentId" value={commentId} />
      <SubmitButton className="text-xs font-semibold text-danger hover:underline">
        {t("submit")}
      </SubmitButton>
      {state?.error && <span className="text-xs text-danger">{state.error}</span>}
    </form>
  );
}
