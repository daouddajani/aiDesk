import type { SupabaseClient } from "@supabase/supabase-js";
import type { SuggestedAnswer, UsageLogger } from "./types";

const EMBEDDING_MODEL = "text-embedding-3-small";

// Below this cosine similarity, a "past solution" isn't actually related to
// the current ticket — just the least-dissimilar thing in a small corpus.
// Calibrated against real production data: unrelated tickets commonly score
// ~0.37-0.42, genuine topic matches ~0.5-0.67.
const MIN_SIMILARITY = 0.5;

// Embeddings always run on OpenAI regardless of which provider a company
// picks for classification — Anthropic has no embeddings API, and Gemini's
// embedding model doesn't match the dimension the ticket_embeddings column
// is built for. See CLAUDE.md for the decision.
export class OpenAIEmbeddings {
  constructor(
    private apiKey: string,
    private logUsage: UsageLogger,
  ) {}

  async embed(text: string): Promise<number[]> {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: text.slice(0, 8000) || " ",
      }),
    });

    if (!res.ok) {
      throw new Error(`OpenAI embed failed: ${res.status} ${await res.text()}`);
    }

    const data = await res.json();
    await this.logUsage("embed", data.usage?.total_tokens ?? 0);
    return data.data[0].embedding as number[];
  }

  async suggestAnswer(
    supabase: SupabaseClient,
    companyId: string,
    problemText: string,
    excludeTicketId?: string,
  ): Promise<SuggestedAnswer[]> {
    const embedding = await this.embed(problemText);

    const { data, error } = await supabase.rpc("match_ticket_embeddings", {
      p_company_id: companyId,
      p_query_embedding: embedding,
      p_match_count: 10,
      p_exclude_ticket_id: excludeTicketId ?? null,
    });

    if (error || !data || data.length === 0) return [];

    // match_ticket_embeddings only returns the frozen text that was embedded
    // at close time — fetch subject/solution_text fresh from tickets so the
    // card shows just the problem and the solution, not that raw blob, and
    // stays in sync with any later edits.
    const matches = (data as { ticket_id: string; similarity: number }[])
      .filter((m) => m.similarity >= MIN_SIMILARITY)
      .slice(0, 3);
    if (matches.length === 0) return [];

    const { data: tickets } = await supabase
      .from("tickets")
      .select("id, subject, solution_text")
      .in(
        "id",
        matches.map((m) => m.ticket_id),
      );
    const ticketById = new Map((tickets ?? []).map((t) => [t.id, t]));

    return matches.flatMap((match) => {
      const ticket = ticketById.get(match.ticket_id);
      if (!ticket?.solution_text) return [];
      return [
        {
          ticketId: match.ticket_id,
          subject: ticket.subject,
          solutionText: ticket.solution_text,
          similarity: match.similarity,
        },
      ];
    });
  }
}
