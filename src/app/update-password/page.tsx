import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { UpdatePasswordForm } from "./UpdatePasswordForm";

export default async function UpdatePasswordPage() {
  const t = await getTranslations("updatePassword");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="flex flex-1 items-center justify-center bg-bg p-6">
        <div className="w-full max-w-sm space-y-4 rounded-2xl border border-border bg-surface p-8 text-center shadow-card">
          <p className="text-lg font-extrabold tracking-tight text-primary">
            AiDesk
          </p>
          <p className="text-sm text-danger">{t("expiredLink")}</p>
          <Link
            href="/forgot-password"
            className="inline-block text-sm font-semibold text-primary hover:underline"
          >
            {t("requestNewLink")}
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-1 items-center justify-center bg-bg p-6">
      <UpdatePasswordForm />
    </main>
  );
}
