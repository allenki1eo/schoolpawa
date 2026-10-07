import { getDict } from "@/server/locale";
import { terms } from "../content";
import { LegalDocView } from "../legal-doc";

export const metadata = { title: "Masharti · Terms" };

export default async function TermsPage() {
  const { locale, t } = await getDict();
  return <LegalDocView doc={terms[locale]} back={t.common.back} />;
}
