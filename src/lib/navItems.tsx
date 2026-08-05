import type { getTranslations } from "next-intl/server";
import type { ShellNavItem } from "@/components/shell/AppShell";
import {
  DashboardIcon,
  TicketsIcon,
  PerformanceIcon,
  AgentsIcon,
  MailboxIcon,
  SettingsIcon,
  ArchiveIcon,
  ProfileIcon,
  CompaniesIcon,
} from "@/components/shell/icons";

type Translator = Awaited<ReturnType<typeof getTranslations>>;

export function buildNavItems(
  role: "super_admin" | "company_admin" | "company_agent",
  t: Translator,
): ShellNavItem[] {
  if (role === "super_admin") {
    return [
      { href: "/admin", label: t("nav.companies"), icon: <CompaniesIcon /> },
      { href: "/profile", label: t("nav.profile"), icon: <ProfileIcon /> },
    ];
  }

  return [
    { href: "/dashboard", label: t("nav.dashboard"), icon: <DashboardIcon /> },
    { href: "/dashboard/tickets", label: t("nav.tickets"), icon: <TicketsIcon /> },
    {
      href: "/dashboard/performance",
      label: t("nav.performance"),
      icon: <PerformanceIcon />,
    },
    ...(role === "company_admin"
      ? [
          {
            href: "/dashboard/agents",
            label: t("nav.agents"),
            icon: <AgentsIcon />,
          },
          {
            href: "/dashboard/mailbox",
            label: t("nav.mailbox"),
            icon: <MailboxIcon />,
          },
          {
            href: "/dashboard/settings",
            label: t("nav.settings"),
            icon: <SettingsIcon />,
          },
          {
            href: "/dashboard/archived",
            label: t("nav.archived"),
            icon: <ArchiveIcon />,
          },
        ]
      : []),
    { href: "/profile", label: t("nav.profile"), icon: <ProfileIcon /> },
  ];
}

export function roleLabel(
  role: "super_admin" | "company_admin" | "company_agent",
  t: Translator,
): string {
  if (role === "super_admin") return t("nav.roleSuperAdmin");
  if (role === "company_admin") return t("nav.roleCompanyAdmin");
  return t("nav.roleCompanyAgent");
}
