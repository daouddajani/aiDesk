import { getTranslations } from "next-intl/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDate } from "@/lib/formatDate";
import { CreateCompanyForm } from "./CreateCompanyForm";
import { InviteAdminForm } from "./InviteAdminForm";
import { ResendInviteButton } from "./ResendInviteButton";
import { EditCompanyForm } from "./EditCompanyForm";

export default async function AdminPage() {
  const t = await getTranslations();
  const adminClient = createAdminClient();

  const [{ data: companies }, { data: usersPage }] = await Promise.all([
    adminClient
      .from("companies")
      .select("id, name, timezone, helpdesk_email, created_at")
      .order("created_at", { ascending: false }),
    adminClient.auth.admin.listUsers(),
  ]);

  const adminByCompanyId = new Map<
    string,
    { email: string; verified: boolean }
  >();
  for (const u of usersPage?.users ?? []) {
    const companyId = u.user_metadata?.company_id;
    if (u.user_metadata?.role === "company_admin" && companyId) {
      adminByCompanyId.set(companyId, {
        email: u.email ?? "",
        verified: Boolean(u.email_confirmed_at),
      });
    }
  }

  return (
    <main className="space-y-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[22px] font-extrabold tracking-tight text-ink md:text-[27px]">
          {t("admin.companies")}
        </h1>
        <CreateCompanyForm />
      </div>
      <section className="space-y-4">
        <div className="rounded-2xl border border-border bg-surface shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full text-start text-[13.5px]">
              <thead>
                <tr className="divide-x divide-border border-b border-border">
                  <th className="px-4 py-2.5 text-[11.5px] font-bold tracking-wide text-ink-sub uppercase">
                    {t("admin.table.name")}
                  </th>
                  <th className="px-4 py-2.5 text-[11.5px] font-bold tracking-wide text-ink-sub uppercase">
                    {t("admin.table.timezone")}
                  </th>
                  <th className="px-4 py-2.5 text-[11.5px] font-bold tracking-wide text-ink-sub uppercase">
                    {t("admin.table.helpdeskEmail")}
                  </th>
                  <th className="px-4 py-2.5 text-[11.5px] font-bold tracking-wide text-ink-sub uppercase">
                    {t("admin.table.companyAdmin")}
                  </th>
                  <th className="px-4 py-2.5 text-[11.5px] font-bold tracking-wide text-ink-sub uppercase">
                    {t("admin.table.created")}
                  </th>
                  <th className="px-4 py-2.5 text-[11.5px] font-bold tracking-wide text-ink-sub uppercase">
                    {t("admin.table.actions")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {(companies ?? []).map((company) => {
                  const admin = adminByCompanyId.get(company.id);
                  return (
                    <tr
                      key={company.id}
                      className="divide-x divide-border border-b border-border last:border-0 hover:bg-surface-alt"
                    >
                      <td className="px-4 py-3 font-medium text-ink">
                        {company.name}
                      </td>
                      <td className="px-4 py-3 text-ink-sub">
                        {company.timezone}
                      </td>
                      <td className="px-4 py-3 text-ink-sub">
                        {company.helpdesk_email ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        {!admin && <InviteAdminForm companyId={company.id} />}
                        {admin?.verified && (
                          <span className="text-ink-sub">{admin.email}</span>
                        )}
                        {admin && !admin.verified && (
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-ink-sub">{admin.email}</span>
                            <span className="rounded-full bg-warning-soft px-2 py-0.5 text-xs font-semibold whitespace-nowrap text-warning">
                              {t("common.notVerified")}
                            </span>
                            <ResendInviteButton
                              companyId={company.id}
                              adminEmail={admin.email}
                            />
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-ink-sub">
                        {formatDate(company.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <EditCompanyForm company={company} />
                      </td>
                    </tr>
                  );
                })}
                {(companies ?? []).length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-8 text-center text-ink-sub"
                    >
                      {t("admin.noCompanies")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  );
}
