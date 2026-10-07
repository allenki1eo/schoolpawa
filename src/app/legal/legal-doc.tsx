import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { LanguageToggle } from "@/components/app/language-toggle";
import type { LegalDoc } from "./content";

export function LegalDocView({ doc, back }: { doc: LegalDoc; back: string }) {
  return (
    <article className="mx-auto max-w-2xl px-5 pt-5 pb-16">
      <div className="flex items-center justify-between">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted">
          <ArrowLeft className="size-4" aria-hidden /> {back}
        </Link>
        <LanguageToggle />
      </div>
      <h1 className="font-display mt-6 text-3xl font-black">{doc.title}</h1>
      <p className="mt-3 leading-relaxed text-muted">{doc.intro}</p>
      {doc.sections.map((s) => (
        <section key={s.heading} className="mt-8">
          <h2 className="font-display text-lg font-bold text-gold-200">{s.heading}</h2>
          {s.body.map((p) => (
            <p key={p} className="mt-2 leading-relaxed text-fg/90">{p}</p>
          ))}
        </section>
      ))}
    </article>
  );
}
