import type { Rng } from "./rng";
import type { CanonicalAnswer, ConcreteQuestion, SubmittedAnswer } from "./types";

/**
 * `order[displayIndex] = canonicalIndex`. Stored on the answer row so the server can map the
 * displayed choice back to the canonical key without ever sending the key to the client.
 */
export type OptionOrder = number[];

export function shuffleOptions(question: ConcreteQuestion, rng: Rng): OptionOrder {
  const identity = question.options.map((_, i) => i);
  if (question.type !== "mcq" && question.type !== "ordering") return identity;
  if (identity.length < 2) return identity;
  // For ordering questions never present the options already in the correct order.
  for (let attempt = 0; attempt < 8; attempt++) {
    const order = rng.shuffle(identity);
    if (question.type === "mcq") return order;
    if (question.answer.type === "ordering" && !sameArray(order, question.answer.order)) return order;
  }
  return identity.slice().reverse();
}

export function displayedOptions(options: readonly string[], order: OptionOrder): string[] {
  return order.map((canonical) => options[canonical]!);
}

/** Display index of the correct option (for feedback after submission). */
export function correctDisplay(answer: CanonicalAnswer, order: OptionOrder): number | number[] | boolean {
  switch (answer.type) {
    case "mcq":
      return order.indexOf(answer.correctIndex);
    case "ordering":
      return answer.order.map((canonical) => order.indexOf(canonical));
    case "true_false":
      return answer.value;
    case "number":
      return answer.value;
  }
}

export function isCorrect(answer: CanonicalAnswer, submitted: SubmittedAnswer, order: OptionOrder): boolean {
  if (submitted.type === "timeout") return false;
  switch (answer.type) {
    case "mcq":
      return submitted.type === "mcq" && order[submitted.displayIndex] === answer.correctIndex;
    case "true_false":
      return submitted.type === "true_false" && submitted.value === answer.value;
    case "number": {
      if (submitted.type !== "number" || !Number.isFinite(submitted.value)) return false;
      const tolerance = answer.tolerance ?? 1e-9;
      return Math.abs(submitted.value - answer.value) <= tolerance;
    }
    case "ordering": {
      if (submitted.type !== "ordering") return false;
      if (submitted.displayOrder.length !== answer.order.length) return false;
      const canonical = submitted.displayOrder.map((d) => order[d]);
      return sameArray(canonical as number[], answer.order);
    }
  }
}

function sameArray(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}
