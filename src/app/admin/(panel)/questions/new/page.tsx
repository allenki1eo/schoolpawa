import { asc } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db, schema } from "@/db/client";
import { PageTitle, field } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import type { CanonicalAnswer } from "@/lib/quiz/types";
import { requireAdmin } from "@/server/admin/auth";
import { createQuestion, PipelineError, type QuestionInput } from "@/server/admin/questions";

async function create(formData: FormData) {
  "use server";
  const admin = await requireAdmin("reviewer");
  const type = String(formData.get("type")) as QuestionInput["type"];
  const options = String(formData.get("options") ?? "").split("\n").map((s) => s.trim()).filter(Boolean);
  const correct = String(formData.get("correct") ?? "").trim();
  let answer: CanonicalAnswer;
  if (type === "mcq") answer = { type, correctIndex: Number(correct) - 1 };
  else if (type === "true_false") answer = { type, value: correct.toLowerCase() === "true" };
  else if (type === "number") answer = { type, value: Number(correct) };
  else answer = { type, order: correct.split(",").map((n) => Number(n.trim()) - 1) };
  try {
    await createQuestion(admin, {
      topicId: String(formData.get("topicId")),
      subTopic: String(formData.get("subTopic") ?? "general"),
      syllabusRef: String(formData.get("syllabusRef") ?? ""),
      difficulty: Number(formData.get("difficulty")) as 1 | 2 | 3,
      language: formData.get("language") === "en" ? "en" : "sw",
      sourceType: String(formData.get("sourceType")) as QuestionInput["sourceType"],
      licenseId: String(formData.get("licenseId") ?? "") || null,
      type,
      prompt: String(formData.get("prompt") ?? ""),
      options: type === "mcq" || type === "ordering" ? options : [],
      answer,
      explanation: String(formData.get("explanation") ?? ""),
    });
  } catch (e) {
    if (e instanceof PipelineError) redirect(`/admin/questions/new?error=${encodeURIComponent(e.message)}`);
    throw e;
  }
  redirect("/admin/questions?status=draft");
}

export default async function NewQuestion({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireAdmin("reviewer");
  const { error } = await searchParams;
  const [topics, licenses] = await Promise.all([
    db.select().from(schema.topics).orderBy(asc(schema.topics.code)),
    db.select().from(schema.contentLicenses),
  ]);
  return (
    <div className="max-w-2xl">
      <PageTitle sub="New questions start as drafts. Never paste NECTA past papers or textbook text unless a licence is recorded (Compliance → Licences).">New question</PageTitle>
      {error ? <p className="mb-4 rounded-xl bg-danger/10 px-4 py-3 text-sm text-red-200 ring-1 ring-danger/30">{error}</p> : null}
      <form action={create} className="surface grid gap-4 rounded-2xl p-5 text-sm">
        <label className="grid gap-1">Topic
          <select name="topicId" className={field} required>{topics.map((t) => <option key={t.id} value={t.id}>{t.code} — {t.nameEn}</option>)}</select>
        </label>
        <div className="grid grid-cols-3 gap-3">
          <label className="grid gap-1">Type
            <select name="type" className={field}><option value="mcq">Multiple choice</option><option value="true_false">True / false</option><option value="number">Number</option><option value="ordering">Ordering</option></select>
          </label>
          <label className="grid gap-1">Difficulty
            <select name="difficulty" className={field}><option value="1">1 · easy</option><option value="2">2 · medium</option><option value="3">3 · hard</option></select>
          </label>
          <label className="grid gap-1">Language
            <select name="language" className={field}><option value="sw">Kiswahili</option><option value="en">English</option></select>
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="grid gap-1">Sub-topic<input name="subTopic" className={field} required /></label>
          <label className="grid gap-1">Syllabus reference<input name="syllabusRef" className={field} required /></label>
        </div>
        <label className="grid gap-1">Prompt<textarea name="prompt" rows={3} className={`${field} h-auto py-2`} required /></label>
        <label className="grid gap-1">Options (one per line, MCQ/ordering)<textarea name="options" rows={4} className={`${field} h-auto py-2`} /></label>
        <label className="grid gap-1">
          Correct answer
          <input name="correct" className={field} placeholder="MCQ: option number (1-based) · T/F: true|false · Number: 4500 · Ordering: 2,1,3" required />
        </label>
        <label className="grid gap-1">Explanation<textarea name="explanation" rows={2} className={`${field} h-auto py-2`} required /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="grid gap-1">Source type
            <select name="sourceType" className={field}><option value="original">Original (our team)</option><option value="ai_draft">AI draft (teacher approval required)</option><option value="teacher_submitted">Teacher submitted (licence required)</option><option value="licensed">Licensed third party (licence required)</option></select>
          </label>
          <label className="grid gap-1">Licence
            <select name="licenseId" className={field}><option value="">— none —</option>{licenses.map((l) => <option key={l.id} value={l.id}>{l.licensor} · {l.documentRef}</option>)}</select>
          </label>
        </div>
        <Button type="submit" variant="gold">Save draft</Button>
      </form>
    </div>
  );
}
