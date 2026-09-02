import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ThemingForm } from "./ThemingForm";
import type { CompanyThemeConfig } from "@/lib/companyTheme";

export default async function ThemingPage() {
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

  const { data: company } = await supabase
    .from("companies")
    .select("logo_url, theme_config")
    .eq("id", profile.company_id)
    .single();

  if (!company) {
    redirect("/dashboard");
  }

  return (
    <main className="p-6">
      <ThemingForm
        logoUrl={company.logo_url}
        themeConfig={(company.theme_config ?? {}) as CompanyThemeConfig}
      />
    </main>
  );
}
