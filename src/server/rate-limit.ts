import "server-only";
import { kv } from "./kv";

export const LIMITS = {
  answer: { max: 40, windowSec: 60 },
  quizStart: { max: 30, windowSec: 600 },
  otpPerPhone: { max: 5, windowSec: 3600 },
  otpPerDevice: { max: 8, windowSec: 3600 },
  otpVerify: { max: 10, windowSec: 900 },
  pinAttempt: { max: 6, windowSec: 900 },
  challengeCreate: { max: 20, windowSec: 3600 },
  groupAction: { max: 30, windowSec: 600 },
  reaction: { max: 30, windowSec: 600 },
  report: { max: 10, windowSec: 3600 },
  sync: { max: 20, windowSec: 600 },
  adminLogin: { max: 8, windowSec: 900 },
} as const;

export type LimitName = keyof typeof LIMITS;

export class RateLimitError extends Error {
  override name = "RateLimitError";
  constructor(public retryAfterSec: number) {
    super("rate_limited");
  }
}

/** Fixed-window counter. Throws RateLimitError when exceeded. */
export async function rateLimit(name: LimitName, subject: string): Promise<void> {
  const { max, windowSec } = LIMITS[name];
  const window = Math.floor(Date.now() / 1000 / windowSec);
  const n = await kv.incrWithTtl(`rl:${name}:${subject}:${window}`, windowSec);
  if (n > max) throw new RateLimitError(windowSec - (Math.floor(Date.now() / 1000) % windowSec));
}
