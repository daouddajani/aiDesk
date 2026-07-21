import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AIProvider,
  AgentSkills,
  ClassifyResult,
  SuggestedAnswer,
  UsageLogger,
} from "./types";
import { matchAgentByKeyword } from "./keywordMatch";
import { OpenAIEmbeddings } from "./embeddings";
import {
  CLASSIFY_SYSTEM_PROMPT,
  classifyUserPrompt,
  parseClassifyJson,
} from "./classifyPrompt";

const CHAT_MODEL = "gpt-4o-mini";

export class OpenAIProvider implements AIProvider {
  private embeddings: OpenAIEmbeddings;

  constructor(
    private apiKey: string,
    private logUsage: UsageLogger,
  ) {
    // Same key doubles as the embeddings key when OpenAI is the chosen
    // provider — no separate embeddings key needed in that case.
    this.embeddings = new OpenAIEmbeddings(apiKey, logUsage);
  }

  async classify(subject: string, body: string): Promise<ClassifyResult> {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: CHAT_MODEL,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: CLASSIFY_SYSTEM_PROMPT },
          { role: "user", content: classifyUserPrompt(subject, body) },
        ],
      }),
    });

    if (!res.ok) {
      throw new Error(`OpenAI classify failed: ${res.status} ${await res.text()}`);
    }

    const data = await res.json();
    await this.logUsage("classify", data.usage?.total_tokens ?? 0);
    return parseClassifyJson(data.choices[0].message.content, body);
  }

  async suggestAgent(
    category: string,
    agents: AgentSkills[],
  ): Promise<string | null> {
    return matchAgentByKeyword(category, agents);
  }

  embed(text: string): Promise<number[]> {
    return this.embeddings.embed(text);
  }

  suggestAnswer(
    supabase: SupabaseClient,
    companyId: string,
    problemText: string,
    excludeTicketId?: string,
  ): Promise<SuggestedAnswer[]> {
    return this.embeddings.suggestAnswer(
      supabase,
      companyId,
      problemText,
      excludeTicketId,
    );
  }
}
