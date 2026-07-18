import type { SupabaseClient } from "@supabase/supabase-js";
import type { AIProvider, CompanyAIConfig } from "./types";
import { OpenAIProvider } from "./openai";
import { AnthropicProvider } from "./anthropic";
import { GeminiProvider } from "./gemini";
import { OpenAIEmbeddings } from "./embeddings";

// Strictly BYOK: a company must enable AI and provide their own provider key
// before any AI feature runs. Returns null (not an error) when AI is
// disabled or unconfigured — callers should treat that as "skip AI", the
// same as if this feature didn't exist.
export async function getAIProviderForCompany(
  adminClient: SupabaseClient,
  companyId: string,
): Promise<AIProvider | null> {
  const { data: company } = await adminClient
    .from("companies")
    .select("company_ai_config")
    .eq("id", companyId)
    .single();

  const config = (company?.company_ai_config ?? {}) as CompanyAIConfig;
  if (!config.enabled || !config.provider) return null;

  const { data: apiKey } = await adminClient.rpc("get_company_ai_secret", {
    p_company_id: companyId,
  });
  if (!apiKey) return null;

  const logUsage = async (operation: "classify" | "embed", totalTokens: number) => {
    await adminClient.from("ai_usage_log").insert({
      company_id: companyId,
      provider: config.provider,
      operation,
      total_tokens: totalTokens,
    });
  };

  if (config.provider === "openai") {
    return new OpenAIProvider(apiKey, logUsage);
  }

  const { data: embeddingsKey } = await adminClient.rpc(
    "get_company_ai_embeddings_secret",
    { p_company_id: companyId },
  );
  const embeddings = embeddingsKey
    ? new OpenAIEmbeddings(embeddingsKey, logUsage)
    : null;

  if (config.provider === "anthropic") {
    return new AnthropicProvider(apiKey, embeddings, logUsage);
  }
  if (config.provider === "gemini") {
    return new GeminiProvider(apiKey, embeddings, logUsage);
  }

  return null;
}

export type {
  AIProvider,
  AIProviderName,
  ClassifyResult,
  AgentSkills,
  SuggestedAnswer,
  CompanyAIConfig,
} from "./types";
