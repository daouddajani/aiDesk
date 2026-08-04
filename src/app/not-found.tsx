import { getTranslations } from "next-intl/server";
import { FallbackCard } from "@/components/FallbackCard";

export default async function NotFound() {
  const t = await getTranslations("notFound");

  return (
    <FallbackCard
      title={t("title")}
      description={t("description")}
      homeLabel={t("home")}
      homeHref="/"
    />
  );
}
