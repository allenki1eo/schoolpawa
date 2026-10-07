import { config } from "@/server/config";
import { getDict } from "@/server/locale";
import { privacy } from "../content";
import { LegalDocView } from "../legal-doc";

export const metadata = { title: "Faragha · Privacy" };

export default async function PrivacyPage() {
  const { locale, t } = await getDict();
  const residency = config.DATA_RESIDENCY.toLowerCase() === "tz" ? "Tanzania" : `${config.DB_REGION}`;
  return <LegalDocView doc={privacy[locale]({ version: config.POLICY_VERSION, dpo: config.DPO_CONTACT, residency })} back={t.common.back} />;
}
