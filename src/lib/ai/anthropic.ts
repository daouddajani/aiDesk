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

const CHAT_MODEL = "claude-haiku-4-5-20251001";

export class AnthropicProvider implements AIProvider {
  constructor(
    private apiKey: string,
    // Anthropic has no embeddings API — this is a separate, optional OpenAI
    // key the company provides just for the suggested-answers feature.
    private embeddings: OpenAIEmbeddings | null,
    private logUsage: UsageLogger,
  ) {}

  async classify(subject: string, body: string): Promise<ClassifyResult> {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: CHAT_MODEL,
        // Large enough for the JSON envelope plus the full (truncated to
        // 4000 chars) body echoed back in cleanBody.
        max_tokens: 2000,
        temperature: 0,
        system: CLASSIFY_SYSTEM_PROMPT,
        messages: [
          { role: "user", content: classifyUserPrompt(subject, body) },
        ],
      }),
    });

    if (!res.ok) {
      throw new Error(
        `Anthropic classify failed: ${res.status} ${await res.text()}`,
      );
    }

    const data = await res.json();
    const totalTokens =
      (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0);
    await this.logUsage("classify", totalTokens);
    return parseClassifyJson(data.content[0].text, body);
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
        "Suggested answers require a separate OpenAI key when the provider is Anthropic.",
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
        "Suggested answers require a separate OpenAI key when the provider is Anthropic.",
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
