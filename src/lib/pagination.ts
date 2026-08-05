export const PAGE_SIZES = [10, 25, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 25;

export function resolvePagination(
  totalItems: number,
  pageParam?: string,
  pageSizeParam?: string,
) {
  const pageSize = PAGE_SIZES.includes(
    Number(pageSizeParam) as (typeof PAGE_SIZES)[number],
  )
    ? Number(pageSizeParam)
    : DEFAULT_PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const page = Math.min(
    Math.max(1, parseInt(pageParam ?? "1", 10) || 1),
    totalPages,
  );
  const start = (page - 1) * pageSize;
  const end = Math.min(start + pageSize, totalItems);
  return { page, pageSize, totalPages, start, end };
}
