"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { FallbackCard } from "@/components/FallbackCard";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("errorBoundary");

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <FallbackCard
      title={t("title")}
      description={t("description")}
      homeLabel={t("home")}
      homeHref="/admin"
      retry={{ label: t("retry"), onRetry: reset }}
    />
  );
}
