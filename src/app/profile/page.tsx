import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getInitials } from "@/lib/initials";
import { buildNavItems, roleLabel } from "@/lib/navItems";
import { AppShell } from "@/components/shell/AppShell";
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
    .select("role, full_name, locale")
    .eq("id", user.id)
    .single();

  if (!profile) {
    redirect("/login");
  }

  const displayName = profile.full_name ?? user.email ?? "?";

  return (
    <AppShell
      navItems={buildNavItems(profile.role, t)}
      user={{
        name: displayName,
        roleLabel: roleLabel(profile.role, t),
        initials: getInitials(displayName),
      }}
    >
      <ProfileForm fullName={profile.full_name} locale={profile.locale} />
    </AppShell>
  );
}
