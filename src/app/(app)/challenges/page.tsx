import { ChallengesView } from "@/components/challenges/challenges-view";
import { pick } from "@/lib/i18n";
import { myChallenges } from "@/server/challenges";
import { config } from "@/server/config";
import { getDict } from "@/server/locale";
import { requireStudent } from "@/server/session";
import { subjectsWithTopics } from "@/server/views";

export const metadata = { title: "Changamoto" };

export default async function ChallengesPage({ searchParams }: { searchParams: Promise<{ new?: string; topic?: string; opponent?: string; group?: string }> }) {
  const sp = await searchParams;
  const student = await requireStudent();
  const { locale } = await getDict();
  const [challenges, subjects] = await Promise.all([myChallenges(student), subjectsWithTopics(student.gradeLevelId)]);
  const topics = subjects.flatMap(({ subject, topics }) =>
    topics.map((t) => ({ id: t.id, name: pick(t, "name", locale), subject: pick(subject, "name", locale), accent: subject.accent })),
  );
  return (
    <ChallengesView
      me={student.id}
      challenges={challenges}
      topics={topics}
      appUrl={config.APP_URL}
      openNew={sp.new === "1"}
      initialTopic={sp.topic}
      initialOpponent={sp.opponent}
      groupId={sp.group}
    />
  );
}
