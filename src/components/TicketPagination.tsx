import Link from "next/link";
import type { getTranslations } from "next-intl/server";
import { PageSizeSelect } from "./PageSizeSelect";

type Translator = Awaited<ReturnType<typeof getTranslations>>;

const PAGE_WINDOW = 5;

export function TicketPagination({
  t,
  page,
  totalPages,
  pageSize,
  from,
  to,
  total,
  buildPageHref,
  buildPageSizeHref,
}: {
  t: Translator;
  page: number;
  totalPages: number;
  pageSize: number;
  from: number;
  to: number;
  total: number;
  buildPageHref: (page: number) => string;
  buildPageSizeHref: (size: number) => string;
}) {
  if (total === 0) return null;

  let windowStart = Math.max(1, page - Math.floor(PAGE_WINDOW / 2));
  const windowEnd = Math.min(totalPages, windowStart + PAGE_WINDOW - 1);
  windowStart = Math.max(1, windowEnd - PAGE_WINDOW + 1);
  const pageNumbers: number[] = [];
  for (let p = windowStart; p <= windowEnd; p++) pageNumbers.push(p);

  const navButtonClasses =
    "rounded-[8px] border border-border bg-surface px-2.5 py-1 text-xs font-semibold text-ink hover:bg-surface-alt";
  const navButtonDisabledClasses =
    "rounded-[8px] border border-border bg-surface px-2.5 py-1 text-xs font-semibold text-ink-sub opacity-50";

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-[13px]">
      <span className="text-ink-sub">
        {t("pagination.showing", { from, to, total })}
      </span>
      <div className="flex flex-wrap items-center gap-3">
        <PageSizeSelect
          pageSize={pageSize}
          label={t("pagination.perPage")}
          buildHref={buildPageSizeHref}
        />
        {totalPages > 1 && (
          <nav className="flex items-center gap-1">
            {page > 1 ? (
              <Link href={buildPageHref(page - 1)} className={navButtonClasses}>
                {t("pagination.prev")}
              </Link>
            ) : (
              <span className={navButtonDisabledClasses}>
                {t("pagination.prev")}
              </span>
            )}
            {windowStart > 1 && <span className="px-1 text-ink-sub">…</span>}
            {pageNumbers.map((p) => (
              <Link
                key={p}
                href={buildPageHref(p)}
                className={`rounded-[8px] border px-2.5 py-1 text-xs font-semibold ${
                  p === page
                    ? "border-primary bg-primary text-white"
                    : "border-border bg-surface text-ink hover:bg-surface-alt"
                }`}
              >
                {p}
              </Link>
            ))}
            {windowEnd < totalPages && (
              <span className="px-1 text-ink-sub">…</span>
            )}
            {page < totalPages ? (
              <Link href={buildPageHref(page + 1)} className={navButtonClasses}>
                {t("pagination.next")}
              </Link>
            ) : (
              <span className={navButtonDisabledClasses}>
                {t("pagination.next")}
              </span>
            )}
          </nav>
        )}
      </div>
    </div>
  );
}
