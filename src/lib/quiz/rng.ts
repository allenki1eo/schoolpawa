import { createHmac, randomBytes } from "node:crypto";

/**
 * Deterministic, cryptographically strong random stream.
 *
 * Each quiz session gets a fresh 256-bit seed from the OS CSPRNG (`newSeed`). Every draw in the
 * session comes from HMAC-SHA256(seed, label ‖ counter), so:
 *   - clients cannot predict question order or option shuffles (seed never leaves the server);
 *   - a disputed session can be replayed exactly from the seed logged on `quiz_sessions.seed`.
 *
 * Labels namespace independent streams from one seed (e.g. "select", "shuffle:3"), so adding a
 * draw in one place never shifts the values another place receives.
 */
export interface Rng {
  /** Uniform float in [0, 1). 53 bits of entropy. */
  float(): number;
  /** Uniform integer in [min, max] (inclusive), rejection-sampled to avoid modulo bias. */
  int(min: number, max: number): number;
  /** Fisher–Yates shuffle returning a new array. */
  shuffle<T>(items: readonly T[]): T[];
  /** Pick one item uniformly. Throws on empty input. */
  pick<T>(items: readonly T[]): T;
  /** Pick an index with probability proportional to `weights[i]`. */
  weightedIndex(weights: readonly number[]): number;
  /** Derive an independent child stream. */
  fork(label: string): Rng;
}

export function newSeed(): string {
  return randomBytes(32).toString("hex");
}

export function createRng(seedHex: string, label = "root"): Rng {
  if (!/^[0-9a-f]{16,}$/i.test(seedHex)) {
    throw new Error("Seed must be a hex string of at least 64 bits");
  }
  const key = Buffer.from(seedHex, "hex");
  let counter = 0;
  let buffer = Buffer.alloc(0);
  let offset = 0;

  const refill = () => {
    buffer = createHmac("sha256", key).update(`${label}\u0000${counter++}`).digest();
    offset = 0;
  };

  const nextUint32 = (): number => {
    if (offset + 4 > buffer.length) refill();
    const value = buffer.readUInt32BE(offset);
    offset += 4;
    return value;
  };

  const float = (): number => {
    // 27 high bits + 26 low bits → 53-bit mantissa, the standard construction.
    const hi = nextUint32() >>> 5;
    const lo = nextUint32() >>> 6;
    return (hi * 67108864 + lo) / 9007199254740992;
  };

  const int = (min: number, max: number): number => {
    if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
      throw new RangeError(`Invalid int range [${min}, ${max}]`);
    }
    const range = max - min + 1;
    if (range > 0x100000000) throw new RangeError("Range too large");
    const limit = Math.floor(0x100000000 / range) * range;
    let x: number;
    do {
      x = nextUint32();
    } while (x >= limit);
    return min + (x % range);
  };

  const rng: Rng = {
    float,
    int,
    shuffle<T>(items: readonly T[]): T[] {
      const out = items.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = int(0, i);
        [out[i], out[j]] = [out[j]!, out[i]!];
      }
      return out;
    },
    pick<T>(items: readonly T[]): T {
      if (items.length === 0) throw new Error("Cannot pick from an empty list");
      return items[int(0, items.length - 1)]!;
    },
    weightedIndex(weights: readonly number[]): number {
      const total = weights.reduce((sum, w) => sum + Math.max(0, w), 0);
      if (total <= 0) throw new Error("Weights must contain a positive value");
      let target = float() * total;
      for (let i = 0; i < weights.length; i++) {
        target -= Math.max(0, weights[i]!);
        if (target < 0) return i;
      }
      // Floating-point edge: return the last positive weight.
      for (let i = weights.length - 1; i >= 0; i--) if (weights[i]! > 0) return i;
      return 0;
    },
    fork(childLabel: string): Rng {
      return createRng(seedHex, `${label}/${childLabel}`);
    },
  };
  return rng;
}
