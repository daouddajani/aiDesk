"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { addComment } from "../actions";
import { SubmitButton } from "@/components/SubmitButton";

type AgentOption = {
  id: string;
  name: string;
};

type MentionQuery = {
  start: number;
  query: string;
};

const MENTION_MATCH_LIMIT = 5;

function findMentionQuery(text: string, cursor: number): MentionQuery | null {
  const upToCursor = text.slice(0, cursor);
  const atIndex = upToCursor.lastIndexOf("@");
  if (atIndex === -1) return null;

  const before = atIndex === 0 ? "" : upToCursor[atIndex - 1];
  if (before && !/\s/.test(before)) return null;

  const query = upToCursor.slice(atIndex + 1);
  if (/\s/.test(query)) return null;

  return { start: atIndex, query };
}

export function CommentForm({
  ticketId,
  agentOptions,
}: {
  ticketId: string;
  agentOptions: AgentOption[];
}) {
  const t = useTranslations("tickets.comment");
  const [state, formAction] = useActionState(addComment, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [body, setBody] = useState("");
  const [mentionQuery, setMentionQuery] = useState<MentionQuery | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  // Reset the controlled body on a successful submit. Done during render
  // (React's documented pattern for adjusting state in response to a prop/
  // state change) rather than in the effect below, since setState calls
  // belong there, not in an effect — the effect stays for the imperative
  // form-DOM reset only.
  const [lastHandledState, setLastHandledState] = useState(state);
  if (state !== lastHandledState) {
    setLastHandledState(state);
    if (state?.success) {
      setBody("");
      setMentionQuery(null);
    }
  }

  useEffect(() => {
    if (state?.success) {
      formRef.current?.reset();
    }
  }, [state]);

  const matches = mentionQuery
    ? agentOptions
        .filter((a) =>
          a.name.toLowerCase().includes(mentionQuery.query.toLowerCase()),
        )
        .slice(0, MENTION_MATCH_LIMIT)
    : [];

  function updateMentionQuery(el: HTMLTextAreaElement) {
    const next = findMentionQuery(el.value, el.selectionStart ?? 0);
    setMentionQuery(next);
    setActiveIndex(0);
  }

  function selectAgent(agent: AgentOption) {
    if (!mentionQuery) return;
    const before = body.slice(0, mentionQuery.start);
    const after = body.slice(mentionQuery.start + 1 + mentionQuery.query.length);
    const token = `@[${agent.name}](${agent.id}) `;
    const newBody = `${before}${token}${after}`;
    setBody(newBody);
    setMentionQuery(null);

    const cursor = before.length + token.length;
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(cursor, cursor);
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (!mentionQuery || matches.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % matches.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + matches.length) % matches.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      selectAgent(matches[activeIndex]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setMentionQuery(null);
    }
  }

  return (
    <form
      ref={formRef}
      action={formAction}
      className="grid gap-3 rounded-xl border border-border bg-surface-alt p-4"
    >
      <input type="hidden" name="ticketId" value={ticketId} />
      <label htmlFor="comment-body" className="sr-only">
        {t("label")}
      </label>
      <div className="relative">
        <textarea
          ref={textareaRef}
          id="comment-body"
          name="body"
          required
          rows={4}
          value={body}
          placeholder={t("placeholder")}
          onChange={(e) => {
            setBody(e.target.value);
            updateMentionQuery(e.target);
          }}
          onKeyUp={(e) => updateMentionQuery(e.currentTarget)}
          onClick={(e) => updateMentionQuery(e.currentTarget)}
          onKeyDown={handleKeyDown}
          className="w-full resize-y rounded-[10px] border border-border bg-surface px-3.5 py-2.5 text-[13.5px] text-ink placeholder:text-ink-sub"
        />
        {mentionQuery && (
          <div className="absolute start-0 top-full z-10 mt-1 w-64 rounded-[10px] border border-border bg-surface py-1 text-[13px] shadow-card">
            {matches.length === 0 && (
              <div className="px-3 py-1.5 text-ink-sub">{t("mentionEmpty")}</div>
            )}
            {matches.map((agent, index) => (
              <button
                key={agent.id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  selectAgent(agent);
                }}
                className={`block w-full px-3 py-1.5 text-start ${
                  index === activeIndex
                    ? "bg-surface-alt text-ink"
                    : "text-ink-sub hover:bg-surface-alt"
                }`}
              >
                {agent.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-[13px] font-medium text-ink-sub">
          <input type="checkbox" name="isInternal" />
          {t("internalLabel")}
        </label>

        <input
          type="file"
          name="attachment"
          className="text-[13px] text-ink-sub"
        />
      </div>

      {state?.error && <p className="text-sm text-danger">{state.error}</p>}

      <div className="w-32">
        <SubmitButton>{t("submit")}</SubmitButton>
      </div>
    </form>
  );
}
