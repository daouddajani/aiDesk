import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { InviteAgentForm } from "./InviteAgentForm";
import { ResendAgentInviteButton } from "./ResendAgentInviteButton";
import { EditAgentForm } from "./EditAgentForm";

export default async function AgentsPage() {
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
    .select("role, company_id")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "company_admin" || !profile.company_id) {
    redirect("/dashboard");
  }

  const { data: teamProfiles } = await supabase
    .from("profiles")
    .select("id, full_name, role, skills, created_at")
    .eq("company_id", profile.company_id)
    .order("created_at", { ascending: true });

  const adminClient = createAdminClient();
  const { data: usersPage } = await adminClient.auth.admin.listUsers();
  const authById = new Map((usersPage?.users ?? []).map((u) => [u.id, u]));

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <section className="space-y-4">
        <h1 className="text-[22px] font-extrabold tracking-tight text-ink md:text-[27px]">
          {t("agents.title")}
        </h1>
        <div className="rounded-2xl border border-border bg-surface shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full text-start text-[13.5px]">
              <thead>
                <tr className="divide-x divide-border border-b border-border">
                  <th className="px-4 py-2.5 text-[11.5px] font-bold tracking-wide text-ink-sub uppercase">
                    {t("agents.table.name")}
                  </th>
                  <th className="px-4 py-2.5 text-[11.5px] font-bold tracking-wide text-ink-sub uppercase">
                    {t("agents.table.email")}
                  </th>
                  <th className="px-4 py-2.5 text-[11.5px] font-bold tracking-wide text-ink-sub uppercase">
                    {t("agents.table.role")}
                  </th>
                  <th className="px-4 py-2.5 text-[11.5px] font-bold tracking-wide text-ink-sub uppercase">
                    {t("agents.table.skills")}
                  </th>
                  <th className="px-4 py-2.5 text-[11.5px] font-bold tracking-wide text-ink-sub uppercase">
                    {t("agents.table.actions")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {(teamProfiles ?? []).map((member) => {
                  const authUser = authById.get(member.id);
                  const verified = Boolean(authUser?.email_confirmed_at);
                  return (
                    <tr
                      key={member.id}
                      className="divide-x divide-border border-b border-border last:border-0 hover:bg-surface-alt"
                    >
                      <td className="px-4 py-3 font-medium text-ink">
                        {member.full_name ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-ink-sub">
                            {authUser?.email ?? "—"}
                          </span>
                          {!verified && authUser?.email && (
                            <>
                              <span className="rounded-full bg-warning-soft px-2 py-0.5 text-xs font-semibold whitespace-nowrap text-warning">
                                {t("common.notVerified")}
                              </span>
                              <ResendAgentInviteButton email={authUser.email} />
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-ink-sub">
                        {member.role === "company_admin"
                          ? t("agents.roleAdmin")
                          : t("agents.roleAgent")}
                      </td>
                      <td className="px-4 py-3 text-ink-sub">
                        {(member.skills ?? []).join(", ") || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <EditAgentForm profile={member} />
                      </td>
                    </tr>
                  );
                })}
                {(teamProfiles ?? []).length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-ink-sub">
                      {t("agents.noAgents")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <InviteAgentForm />
    </div>
  );
}
