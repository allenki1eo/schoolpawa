"use client";

import { createContext, useContext } from "react";
import { dictionaries, type Dictionary, type Locale } from "@/lib/i18n";

const I18nContext = createContext<{ locale: Locale; t: Dictionary }>({ locale: "sw", t: dictionaries.sw });

export function I18nProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return <I18nContext.Provider value={{ locale, t: dictionaries[locale] }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
