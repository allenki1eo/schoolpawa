import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { SubjectIcon } from "@/components/app/subject-icon";
import { fmt, pick } from "@/lib/i18n";
import { getDict } from "@/server/locale";
import { requireStudent } from "@/server/session";
import { subjectsWithTopics } from "@/server/views";

export const metadata = { title: "Jifunze" };

export default async function LearnPage() {
  const student = await requireStudent();
  const { t, locale } = await getDict();
  const subjects = await subjectsWithTopics(student.gradeLevelId);
  return (
    <div className="space-y-8">
      <h1 className="font-display text-3xl font-black">{t.nav.learn}</h1>
      {subjects.map(({ subject, topics }) => (
        <section key={subject.id}>
          <div className="mb-3 flex items-center gap-3">
            <SubjectIcon icon={subject.icon} accent={subject.accent} size={40} />
            <div>
              <h2 className="font-display text-lg font-bold">{pick(subject, "name", locale)}</h2>
              <p className="text-xs text-subtle">{fmt(t.home.topicsCount, { n: topics.length })}</p>
            </div>
          </div>
          <ul className="grid gap-3">
            {topics.map((topic, i) => (
              <li key={topic.id}>
                <Link
                  href={`/learn/${topic.id}`}
                  className="surface group relative flex items-center gap-4 overflow-hidden rounded-2xl p-4 transition-transform active:scale-[0.99]"
                >
                  <span aria-hidden className="absolute inset-y-0 left-0 w-1" style={{ background: subject.accent }} />
                  <span className="num grid size-10 place-items-center rounded-xl bg-white/5 font-display text-lg font-black" style={{ color: subject.accent }}>
                    {i + 1}
                  </span>
                  <span className="flex-1">
                    <span className="block font-bold">{pick(topic, "name", locale)}</span>
                    <span className="text-xs text-subtle">{topic.syllabusRef}</span>
                  </span>
                  <ChevronRight className="size-5 text-subtle transition-transform group-hover:translate-x-0.5" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
