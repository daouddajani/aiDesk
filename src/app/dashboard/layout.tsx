import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getInitials } from "@/lib/initials";
import { buildNavItems, roleLabel } from "@/lib/navItems";
import { AppShell } from "@/components/shell/AppShell";
import type { CompanyThemeConfig } from "@/lib/companyTheme";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
    .select("role, company_id, full_name, disabled")
    .eq("id", user.id)
    .single();

  if (
    !profile?.company_id ||
    (profile.role !== "company_admin" &&
      profile.role !== "company_agent" &&
      profile.role !== "supervisor") ||
    profile.disabled
  ) {
    // Catches an agent disabled mid-session: their cookie is still valid,
    // so it must be revoked here rather than just redirecting past them.
    await supabase.auth.signOut();
    redirect("/login");
  }

  const displayName = profile.full_name ?? user.email ?? "?";

  const [{ count: unreadNotifications }, { data: company }] = await Promise.all([
    supabase
      .from("ticket_notifications")
      .select("id", { count: "exact", head: true })
      .eq("agent_id", user.id)
      .eq("company_id", profile.company_id)
      .is("read_at", null),
    supabase
      .from("companies")
      .select("logo_url, theme_config")
      .eq("id", profile.company_id)
      .single(),
  ]);

  const themeConfig = (company?.theme_config ?? {}) as CompanyThemeConfig;
  const themeColors =
    themeConfig.primaryColor && themeConfig.accentColor
      ? {
          primaryColor: themeConfig.primaryColor,
          accentColor: themeConfig.accentColor,
        }
      : null;

  return (
    <AppShell
      navItems={buildNavItems(profile.role, t, {
        unreadNotifications: unreadNotifications ?? 0,
      })}
      user={{
        id: user.id,
        name: displayName,
        roleLabel: roleLabel(profile.role, t),
        initials: getInitials(displayName),
      }}
      companyId={profile.company_id}
      logoUrl={company?.logo_url ?? null}
      themeColors={themeColors}
    >
      {children}
    </AppShell>
  );
}
