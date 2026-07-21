import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AIProvider,
  AgentSkills,
  ClassifyResult,
  SuggestedAnswer,
  UsageLogger,
} from "./types";
import { matchAgentByKeyword } from "./keywordMatch";
import type { OpenAIEmbeddings } from "./embeddings";
import {
  CLASSIFY_SYSTEM_PROMPT,
  classifyUserPrompt,
  parseClassifyJson,
} from "./classifyPrompt";

const CHAT_MODEL = "gemini-2.5-flash";

export class GeminiProvider implements AIProvider {
  constructor(
    private apiKey: string,
    // Gemini has its own embedding model, but its output dimension doesn't
    // match the ticket_embeddings column — this is a separate, optional
    // OpenAI key the company provides just for the suggested-answers feature.
    private embeddings: OpenAIEmbeddings | null,
    private logUsage: UsageLogger,
  ) {}

  async classify(subject: string, body: string): Promise<ClassifyResult> {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${CHAT_MODEL}:generateContent?key=${this.apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: CLASSIFY_SYSTEM_PROMPT }],
          },
          contents: [
            {
              role: "user",
              parts: [{ text: classifyUserPrompt(subject, body) }],
            },
          ],
          generationConfig: {
            temperature: 0,
            responseMimeType: "application/json",
          },
        }),
      },
    );

    if (!res.ok) {
      throw new Error(
        `Gemini classify failed: ${res.status} ${await res.text()}`,
      );
    }

    const data = await res.json();
    await this.logUsage(
      "classify",
      data.usageMetadata?.totalTokenCount ?? 0,
    );
    return parseClassifyJson(data.candidates[0].content.parts[0].text, body);
  }

  async suggestAgent(
    category: string,
    agents: AgentSkills[],
  ): Promise<string | null> {
    return matchAgentByKeyword(category, agents);
  }

  embed(text: string): Promise<number[]> {
    if (!this.embeddings) {
      throw new Error(
        "Suggested answers require a separate OpenAI key when the provider is Gemini.",
      );
    }
    return this.embeddings.embed(text);
  }

  suggestAnswer(
    supabase: SupabaseClient,
    companyId: string,
    problemText: string,
    excludeTicketId?: string,
  ): Promise<SuggestedAnswer[]> {
    if (!this.embeddings) {
      throw new Error(
        "Suggested answers require a separate OpenAI key when the provider is Gemini.",
      );
    }
    return this.embeddings.suggestAnswer(
      supabase,
      companyId,
      problemText,
      excludeTicketId,
    );
  }
}
