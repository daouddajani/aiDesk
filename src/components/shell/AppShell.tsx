import { getTranslations } from "next-intl/server";
import { signOut } from "@/app/actions";
import { getThemeCookie } from "@/lib/theme";
import { ThemeToggleButton } from "@/components/ThemeToggleButton";
import { LanguageToggleButton } from "@/components/LanguageToggleButton";
import { MobileNav } from "./MobileNav";
import { SidebarNav, type ShellNavItem } from "./SidebarNav";
import { TicketNotifications } from "./TicketNotifications";
import {
  SidebarCollapseProvider,
  CollapsibleSidebar,
  SidebarToggleButton,
} from "./SidebarCollapse";

export type { ShellNavItem };

export async function AppShell({
  navItems,
  user,
  companyId,
  children,
}: {
  navItems: ShellNavItem[];
  user: { name: string; roleLabel: string; initials: string };
  // Only company_admin/company_agent (the /dashboard shell) have one —
  // super_admin (/admin) and the shared /profile page don't pass it, and
  // ticket notifications simply don't render for them.
  companyId?: string;
  children: React.ReactNode;
}) {
  const t = await getTranslations("common");
  const theme = await getThemeCookie();
  const isDark = theme === "dark";

  const brand = (
    <div className="flex items-center gap-3 px-5 py-5">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-gradient-to-br from-primary to-accent text-sm font-extrabold text-white">
        AI
      </div>
      <div className="text-[17px] font-extrabold tracking-tight text-ink">
        AiDesk
      </div>
    </div>
  );

  return (
    <SidebarCollapseProvider>
      <div className="flex min-h-screen flex-col bg-bg md:flex-row">
        {companyId && <TicketNotifications companyId={companyId} />}
        <MobileNav brandLabel="AiDesk">
          {brand}
          <SidebarNav items={navItems} />
        </MobileNav>

        <CollapsibleSidebar>
          {brand}
          <SidebarNav items={navItems} />
        </CollapsibleSidebar>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-10 hidden items-center border-b border-border bg-surface px-7 py-3.5 md:flex">
            <SidebarToggleButton />
            <div className="ms-auto flex items-center gap-2.5">
              <LanguageToggleButton />
              <ThemeToggleButton isDark={isDark} />
              <div className="ms-1 flex items-center gap-2.5 border-s border-border ps-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] bg-primary text-xs font-bold text-white">
                  {user.initials}
                </div>
                <div>
                  <div className="text-[13px] font-bold text-ink">
                    {user.name}
                  </div>
                  <div className="text-[11.5px] text-ink-sub">
                    {user.roleLabel}
                  </div>
                </div>
              </div>
              <form action={signOut}>
                <button
                  type="submit"
                  className="text-xs font-semibold text-ink-sub hover:underline"
                >
                  {t("signOut")}
                </button>
              </form>
            </div>
          </header>

          <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 py-6 md:px-8 md:py-8">
            {children}
          </main>
        </div>
      </div>
    </SidebarCollapseProvider>
  );
}

