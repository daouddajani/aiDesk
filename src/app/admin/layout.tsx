import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getInitials } from "@/lib/initials";
import { buildNavItems, roleLabel } from "@/lib/navItems";
import { AppShell } from "@/components/shell/AppShell";

export default async function AdminLayout({
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
    .select("role, full_name")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "super_admin") {
    redirect("/dashboard");
  }

  const displayName = profile.full_name ?? user.email ?? "?";

  return (
    <AppShell
      navItems={buildNavItems("super_admin", t)}
      user={{
        id: user.id,
        name: displayName,
        roleLabel: roleLabel("super_admin", t),
        initials: getInitials(displayName),
      }}
    >
      {children}
    </AppShell>
  );
}
