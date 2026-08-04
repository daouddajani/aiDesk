import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { buildAgentNameMap } from "@/lib/agentNames";
import { CompanySettingsForm } from "./CompanySettingsForm";
import { AISettingsForm } from "./AISettingsForm";
import type { AIProviderName, CompanyAIConfig } from "@/lib/ai";

export default async function CompanySettingsPage() {
  const t = await getTranslations("common");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, company_id")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "company_admin" || !profile.company_id) {
    redirect("/dashboard");
  }

  const startOfMonth = new Date();
  startOfMonth.setUTCDate(1);
  startOfMonth.setUTCHours(0, 0, 0, 0);

  const [{ data: company }, { data: agentOptions }, { data: usageRows }] =
    await Promise.all([
      supabase
        .from("companies")
        .select(
          "name, logo_url, timezone, default_agent_id, blocked_sender_emails, company_ai_config, ai_secret_id, ai_embeddings_secret_id",
        )
        .eq("id", profile.company_id)
        .single(),
      supabase
        .from("profiles")
        .select("id, full_name")
        .eq("company_id", profile.company_id)
        .order("created_at", { ascending: true }),
      supabase
        .from("ai_usage_log")
        .select("total_tokens")
        .eq("company_id", profile.company_id)
        .gte("created_at", startOfMonth.toISOString()),
    ]);

  if (!company) {
    redirect("/dashboard");
  }

  const agentNameById = await buildAgentNameMap(agentOptions ?? []);
  const monthTokens = (usageRows ?? []).reduce(
    (sum, row) => sum + row.total_tokens,
    0,
  );
  const aiConfig = (company.company_ai_config ?? {}) as CompanyAIConfig;

  return (
    <main className="grid gap-6 p-6 md:grid-cols-2">
      <CompanySettingsForm
        company={company}
        agentOptions={(agentOptions ?? []).map((a) => ({
          id: a.id,
          name: agentNameById.get(a.id) ?? t("unnamed"),
        }))}
      />
      <AISettingsForm
        config={{
          enabled: aiConfig.enabled ?? false,
          provider: (aiConfig.provider ?? "openai") as AIProviderName,
        }}
        hasProviderKey={Boolean(company.ai_secret_id)}
        hasEmbeddingsKey={Boolean(company.ai_embeddings_secret_id)}
        monthTokens={monthTokens}
      />
    </main>
  );
}
