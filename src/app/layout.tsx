import type { Metadata, Viewport } from "next";
import { I18nProvider } from "@/components/providers/i18n";
import { ToastProvider } from "@/components/providers/toast";
import { ConnectivityBanner } from "@/components/pwa/connectivity";
import { ServiceWorker } from "@/components/pwa/service-worker";
import { getDict } from "@/server/locale";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDict();
  return {
    title: { default: `${t.meta.title} — ${t.meta.tagline}`, template: `%s · ${t.meta.title}` },
    description: t.meta.description,
    applicationName: "School Pawa",
    appleWebApp: { capable: true, title: "School Pawa", statusBarStyle: "black-translucent" },
    formatDetection: { telephone: false },
    robots: { index: false, follow: false },
  };
}

export const viewport: Viewport = {
  themeColor: "#050a16",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { locale } = await getDict();
  return (
    <html lang={locale} className="h-full">
      <body className="h-full">
        <I18nProvider locale={locale}>
          <ToastProvider>
            <ConnectivityBanner />
            {children}
            <ServiceWorker />
          </ToastProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
