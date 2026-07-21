import { getTranslations } from "next-intl/server";
import { confirmAuthToken } from "./actions";
import { SubmitButton } from "@/components/SubmitButton";

export default async function AuthConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{
    token_hash?: string;
    type?: string;
    next?: string;
  }>;
}) {
  const t = await getTranslations("authConfirm");
  const { token_hash, type, next } = await searchParams;

  if (!token_hash || !type) {
    return (
      <main className="flex flex-1 items-center justify-center bg-bg p-6">
        <div className="w-full max-w-sm space-y-3 rounded-2xl border border-border bg-surface p-8 text-center shadow-card">
          <p className="text-lg font-extrabold tracking-tight text-primary">
            AiDesk
          </p>
          <p className="text-sm text-danger">{t("invalid")}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-1 items-center justify-center bg-bg p-6">
      <form
        action={confirmAuthToken}
        className="w-full max-w-sm space-y-5 rounded-2xl border border-border bg-surface p-8 text-center shadow-card"
      >
        <div className="space-y-1">
          <p className="text-lg font-extrabold tracking-tight text-primary">
            AiDesk
          </p>
          <h1 className="text-base font-semibold text-ink">{t("title")}</h1>
          <p className="text-sm text-ink-sub">{t("description")}</p>
        </div>

        <input type="hidden" name="token_hash" value={token_hash} />
        <input type="hidden" name="type" value={type} />
        <input type="hidden" name="next" value={next ?? "/"} />

        <SubmitButton>{t("submit")}</SubmitButton>
      </form>
    </main>
  );
}
