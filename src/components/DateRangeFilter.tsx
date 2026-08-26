import Link from "next/link";
import type { getTranslations } from "next-intl/server";

type Translator = Awaited<ReturnType<typeof getTranslations>>;

export function buildHref(
  base: string,
  params: {
    status?: string;
    from?: string;
    to?: string;
    page?: string;
    pageSize?: string;
  },
) {
  const query = new URLSearchParams();
  if (params.status) query.set("status", params.status);
  if (params.from) query.set("from", params.from);
  if (params.to) query.set("to", params.to);
  if (params.page) query.set("page", params.page);
  if (params.pageSize) query.set("pageSize", params.pageSize);
  const qs = query.toString();
  return qs ? `${base}?${qs}` : base;
}

// No `action` — submitting a plain GET form defaults to the current page's
// own path, which is exactly right for every caller of this component.
export function DateRangeFilter({
  t,
  basePath,
  status,
  from,
  to,
}: {
  t: Translator;
  basePath: string;
  status?: string;
  from?: string;
  to?: string;
}) {
  return (
    <form className="flex flex-wrap items-end gap-3 text-sm">
      {status && <input type="hidden" name="status" value={status} />}
      <div className="space-y-1">
        <label htmlFor="from" className="text-xs font-semibold text-ink-sub">
          {t("performance.dateFrom")}
        </label>
        <input
          id="from"
          name="from"
          type="date"
          defaultValue={from}
          className="rounded-[10px] border border-border bg-surface px-2.5 py-1.5 text-sm text-ink"
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="to" className="text-xs font-semibold text-ink-sub">
          {t("performance.dateTo")}
        </label>
        <input
          id="to"
          name="to"
          type="date"
          defaultValue={to}
          className="rounded-[10px] border border-border bg-surface px-2.5 py-1.5 text-sm text-ink"
        />
      </div>
      <button
        type="submit"
        className="rounded-[10px] border border-border bg-surface px-4 py-2 text-sm font-bold text-ink hover:bg-surface-alt"
      >
        {t("performance.apply")}
      </button>
      {(from || to) && (
        <Link
          href={buildHref(basePath, { status })}
          className="text-sm font-semibold text-ink-sub hover:underline"
        >
          {t("performance.clearDates")}
        </Link>
      )}
    </form>
  );
}
