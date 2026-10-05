import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveThemeColors, type CompanyThemeConfig } from "@/lib/companyTheme";
import { SurveyForm } from "./SurveyForm";

// Public, no-login page: everything is read through the service-role client
// and scoped by the unguessable token — survey tables have no anon access.
export default async function SurveyPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!/^[0-9a-f]{64}$/.test(token)) notFound();

  const t = await getTranslations("surveyPublic");
  const admin = createAdminClient();

  const { data: response } = await admin
    .from("survey_responses")
    .select("company_id, ticket_id, submitted_at")
    .eq("token", token)
    .maybeSingle();
  if (!response) notFound();

  const [{ data: company }, { data: ticket }, { data: questions }] = await Promise.all([
    admin
      .from("companies")
      .select("name, logo_url, theme_config")
      .eq("id", response.company_id)
      .single(),
    admin.from("tickets").select("subject").eq("id", response.ticket_id).single(),
    admin
      .from("survey_questions")
      .select("id, text")
      .eq("company_id", response.company_id)
      .is("archived_at", null)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true }),
  ]);

  const themeColors = resolveThemeColors(
    company?.theme_config as CompanyThemeConfig | null,
  );
  const themeStyle = themeColors
    ? ({ "--color-primary": themeColors.primaryColor } as React.CSSProperties)
    : undefined;

  return (
    <main className="flex flex-1 justify-center bg-bg p-4 sm:p-6" style={themeStyle}>
      <div className="w-full max-w-xl space-y-5 rounded-2xl border border-border bg-surface p-6 shadow-card sm:p-8">
        <div className="space-y-2 text-center">
          {company?.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={company.logo_url} alt={company.name ?? ""} className="mx-auto h-12 w-auto" />
          ) : (
            <p className="text-lg font-extrabold tracking-tight text-primary">{company?.name}</p>
          )}
          <h1 className="text-lg font-bold text-ink">{t("title")}</h1>
          {ticket?.subject && (
            <p className="text-sm text-ink-sub">{t("ticket", { subject: ticket.subject })}</p>
          )}
        </div>

        {response.submitted_at ? (
          <p className="py-6 text-center text-sm font-semibold text-ink">{t("alreadySubmitted")}</p>
        ) : (
          <SurveyForm token={token} questions={questions ?? []} />
        )}
      </div>
    </main>
  );
}
