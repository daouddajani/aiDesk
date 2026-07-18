import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { DisconnectMailboxButton } from "./DisconnectMailboxButton";
import { ImapMailboxForm } from "./ImapMailboxForm";

export default async function MailboxPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; connected?: string }>;
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

  const { data: company } = await supabase
    .from("companies")
    .select("mailbox_email, mailbox_provider")
    .eq("id", profile.company_id)
    .single();

  const connected = Boolean(company?.mailbox_email);
  const providerKey =
    company?.mailbox_provider === "microsoft"
      ? "mailbox.providerMicrosoft"
      : company?.mailbox_provider === "imap"
        ? "mailbox.providerImap"
        : "mailbox.providerUnknown";

  return (
    <main className="p-6">
      <div className="grid max-w-lg gap-4 rounded-2xl border border-border bg-surface p-6 shadow-card">
        <h1 className="text-lg font-semibold">{t("mailbox.title")}</h1>

        {params.error && (
          <p className="text-sm text-danger">
            {decodeURIComponent(params.error)}
          </p>
        )}
        {params.connected && (
          <p className="text-sm text-success">{t("mailbox.connected")}</p>
        )}

        {connected ? (
          <>
            <p className="text-sm text-ink-sub">
              {t.rich("mailbox.connectedVia", {
                provider: t(providerKey),
                email: company?.mailbox_email,
                strong: (chunks) => <strong>{chunks}</strong>,
              })}
            </p>
            <DisconnectMailboxButton />
          </>
        ) : (
          <>
            <p className="text-sm text-ink-sub">
              {t("mailbox.notConnectedHint")}
            </p>
            <a
              href="/dashboard/mailbox/connect"
              className="w-full rounded-[10px] bg-primary px-4 py-2.5 text-center text-sm font-bold text-white transition-opacity hover:opacity-90"
            >
              {t("mailbox.connectMicrosoft")}
            </a>

            <div className="flex items-center gap-3 text-xs font-semibold text-ink-sub">
              <div className="h-px flex-1 bg-border" />
              {t("mailbox.or")}
              <div className="h-px flex-1 bg-border" />
            </div>

            <ImapMailboxForm />
          </>
        )}
      </div>
    </main>
  );
}
