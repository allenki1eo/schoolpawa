import type { CanonicalAnswer, QuestionType, SubmittedAnswer } from "@/lib/quiz/types";

export interface PackQuestion {
  index: number;
  type: QuestionType;
  prompt: string;
  options: string[];
  answer: CanonicalAnswer;
  explanation: string;
  unit?: string;
  difficulty: 1 | 2 | 3;
}

export interface StoredPack {
  key: string; // packId, or "starter:<grade>"
  packId: string | null;
  studentId: string | null;
  topicId: string;
  topicName: string;
  accent: string;
  issuedAt: string;
  questions: PackQuestion[];
  played?: { at: string; correct: number; total: number; synced?: number | null };
}

export interface QueuedResult {
  clientResultId: string;
  packId: string;
  studentId: string;
  answers: Array<{ index: number; answer: SubmittedAnswer }>;
  createdAt: string;
}

export interface LocalProfile {
  localId: string;
  nickname: string;
  avatar: string;
  schoolId: string;
  schoolName: string;
  gradeLevelId: string;
  /** PBKDF2(pin) so the PIN itself is never stored, even locally. */
  pinHash: string;
  pinSalt: string;
  createdAt: string;
}
