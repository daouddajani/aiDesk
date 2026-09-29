import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getInitials } from "@/lib/initials";
import { buildNavItems, roleLabel } from "@/lib/navItems";
import { AppShell } from "@/components/shell/AppShell";
import {
  resolveThemeColors,
  type CompanyThemeConfig,
} from "@/lib/companyTheme";
import { ProfileForm } from "./ProfileForm";

export default async function ProfilePage() {
  const t = await getTranslations();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "role, company_id, full_name, locale, auto_refresh_enabled, auto_refresh_interval_minutes",
    )
    .eq("id", user.id)
    .single();

  if (!profile) {
    redirect("/login");
  }

  const displayName = profile.full_name ?? user.email ?? "?";

  // super_admin has no company_id — only company_admin/agent/supervisor get
  // their company's logo and theme applied here, same as the /dashboard shell.
  const { data: company } = profile.company_id
    ? await supabase
        .from("companies")
        .select("logo_url, theme_config")
        .eq("id", profile.company_id)
        .single()
    : { data: null };

  const themeColors = resolveThemeColors(
    company?.theme_config as CompanyThemeConfig | null,
  );

  return (
    <AppShell
      navItems={buildNavItems(profile.role, t)}
      user={{
        id: user.id,
        name: displayName,
        roleLabel: roleLabel(profile.role, t),
        initials: getInitials(displayName),
      }}
      companyId={profile.company_id ?? undefined}
      logoUrl={company?.logo_url ?? null}
      themeColors={themeColors}
    >
      <ProfileForm
        fullName={profile.full_name}
        locale={profile.locale}
        autoRefreshEnabled={profile.auto_refresh_enabled}
        autoRefreshIntervalMinutes={profile.auto_refresh_interval_minutes}
      />
    </AppShell>
  );
}
