interface FallbackCardProps {
  title: string;
  description: string;
  homeLabel: string;
  homeHref: string;
  retry?: { label: string; onRetry: () => void };
}

// Shared shell for error.tsx / not-found.tsx / global-error.tsx boundaries —
// kept prop-driven (no next-intl/next-navigation calls inside) so it also
// works from global-error.tsx, which renders outside the app's providers.
export function FallbackCard({
  title,
  description,
  homeLabel,
  homeHref,
  retry,
}: FallbackCardProps) {
  return (
    <div className="flex flex-1 items-center justify-center bg-bg p-6">
      <div className="w-full max-w-sm space-y-4 rounded-2xl border border-border bg-surface p-8 text-center shadow-card">
        <p className="text-lg font-extrabold tracking-tight text-primary">
          AiDesk
        </p>
        <h1 className="text-base font-semibold text-ink">{title}</h1>
        <p className="text-sm text-ink-sub">{description}</p>
        <div className="flex justify-center gap-3 pt-2">
          {retry && (
            <button
              type="button"
              onClick={retry.onRetry}
              className="rounded-[10px] bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              {retry.label}
            </button>
          )}
          <a
            href={homeHref}
            className="rounded-[10px] border border-border px-4 py-2 text-sm font-semibold text-ink hover:bg-surface-alt"
          >
            {homeLabel}
          </a>
        </div>
      </div>
    </div>
  );
}
