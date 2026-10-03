import { redirect } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { resolvePagination } from "@/lib/pagination";
import { TicketPagination } from "@/components/TicketPagination";
import { EditCategoryForm } from "../tickets/[id]/EditCategoryForm";

// Sentinel filter value for tickets with no category at all.
const UNCATEGORIZED = "__none";

// Same case/whitespace normalization the Reports page groups categories by,
// so "Billing" and "billing " are one tag here too.
function tagKey(category: string | null) {
  return category?.trim().toLowerCase() || UNCATEGORIZED;
}

function buildHref(params: { tag?: string; page?: string; pageSize?: string }) {
  const query = new URLSearchParams();
  if (params.tag) query.set("tag", params.tag);
  if (params.page) query.set("page", params.page);
  if (params.pageSize) query.set("pageSize", params.pageSize);
  const qs = query.toString();
  return qs ? `/dashboard/tags?${qs}` : "/dashboard/tags";
}

export default async function TagsPage({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string; page?: string; pageSize?: string }>;
}) {
  const params = await searchParams;
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

  const { data: allTickets } = await supabase
    .from("tickets")
    .select("id, subject, category")
    .eq("company_id", profile.company_id)
    .is("archived_at", null)
    .order("received_at", { ascending: false });

  // One dropdown option per normalized tag, labelled with the first spelling
  // seen, alphabetized.
  const tagOptions = new Map<string, string>();
  for (const ticket of allTickets ?? []) {
    const key = tagKey(ticket.category);
    if (key !== UNCATEGORIZED && !tagOptions.has(key)) {
      tagOptions.set(key, ticket.category!.trim());
    }
  }
  const sortedTagOptions = [...tagOptions.entries()].sort((a, b) =>
    a[1].localeCompare(b[1]),
  );

  const tickets = params.tag
    ? (allTickets ?? []).filter((tk) => tagKey(tk.category) === params.tag)
    : (allTickets ?? []);

  const { page, pageSize, totalPages, start, end } = resolvePagination(
    tickets.length,
    params.page,
    params.pageSize,
  );
  const pageTickets = tickets.slice(start, end);

  return (
    <div className="space-y-5">
      <h1 className="text-[22px] font-extrabold tracking-tight text-ink md:text-[27px]">
        {t("tagsPage.title")}
      </h1>

      <form className="flex flex-wrap items-end gap-3 text-sm">
        {params.pageSize && (
          <input type="hidden" name="pageSize" value={params.pageSize} />
        )}
        <div className="space-y-1">
          <label htmlFor="tag" className="text-xs font-semibold text-ink-sub">
            {t("tagsPage.filterLabel")}
          </label>
          <select
            id="tag"
            name="tag"
            defaultValue={params.tag ?? ""}
            className="rounded-[10px] border border-border bg-surface px-2.5 py-1.5 text-sm text-ink"
          >
            <option value="">{t("tagsPage.allTags")}</option>
            <option value={UNCATEGORIZED}>
              {t("tickets.category.uncategorized")}
            </option>
            {sortedTagOptions.map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="rounded-[10px] border border-border bg-surface px-4 py-2 text-sm font-bold text-ink hover:bg-surface-alt"
        >
          {t("tagsPage.apply")}
        </button>
      </form>

      <div className="rounded-2xl border border-border bg-surface p-0 shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-start text-[13.5px]">
            <thead>
              <tr className="divide-x divide-border border-b border-border">
                <th className="px-4 py-2.5 text-[11.5px] font-bold tracking-wide text-ink-sub uppercase">
                  {t("tagsPage.table.subject")}
                </th>
                <th className="w-[40%] px-4 py-2.5 text-[11.5px] font-bold tracking-wide text-ink-sub uppercase">
                  {t("tagsPage.table.tag")}
                </th>
              </tr>
            </thead>
            <tbody>
              {pageTickets.map((ticket) => (
                <tr
                  key={ticket.id}
                  className="divide-x divide-border border-b border-border last:border-0"
                >
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/dashboard/tickets/${ticket.id}`}
                      className="font-medium text-ink hover:text-link-hover"
                    >
                      {ticket.subject}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5">
                    {/* key resets the uncontrolled input when the saved value changes */}
                    <EditCategoryForm
                      key={ticket.category ?? ""}
                      ticketId={ticket.id}
                      category={ticket.category}
                    />
                  </td>
                </tr>
              ))}
              {pageTickets.length === 0 && (
                <tr>
                  <td colSpan={2} className="px-4 py-8 text-center text-ink-sub">
                    {t("tagsPage.noTickets")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <TicketPagination
          t={t}
          page={page}
          totalPages={totalPages}
          pageSize={pageSize}
          from={start + 1}
          to={end}
          total={tickets.length}
          buildPageHref={(p) =>
            buildHref({ tag: params.tag, pageSize: params.pageSize, page: String(p) })
          }
          buildPageSizeHref={(s) =>
            buildHref({ tag: params.tag, pageSize: String(s), page: "1" })
          }
        />
      </div>
    </div>
  );
}
