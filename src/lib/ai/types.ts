import type { SupabaseClient } from "@supabase/supabase-js";

export type ClassifyResult = {
  // Short free-text label for the type of problem, matched against agent
  // skills by suggestAgent() — not a fixed enum.
  category: string;
  isJunk: boolean;
};

export type AgentSkills = {
  id: string;
  skills: string[];
};

export type SuggestedAnswer = {
  ticketId: string;
  content: string;
  similarity: number;
};

export type AIProviderName = "openai" | "anthropic" | "gemini";

export type CompanyAIConfig = {
  enabled?: boolean;
  provider?: AIProviderName;
};

// Called after every billable API call so usage can be shown back to the
// company admin in Settings.
export type UsageLogger = (
  operation: "classify" | "embed",
  totalTokens: number,
) => Promise<void>;

export interface AIProvider {
  classify(subject: string, body: string): Promise<ClassifyResult>;
  suggestAgent(category: string, agents: AgentSkills[]): Promise<string | null>;
  embed(text: string): Promise<number[]>;
  suggestAnswer(
    supabase: SupabaseClient,
    companyId: string,
    problemText: string,
    excludeTicketId?: string,
  ): Promise<SuggestedAnswer[]>;
}
