import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { RateLimitError } from "./rate-limit";

/** An error that is safe to show the client: a stable `code` the UI translates. */
export class ApiError extends Error {
  override name = "ApiError";
  constructor(
    public status: number,
    public code: string,
    public details?: Record<string, unknown>,
  ) {
    super(code);
  }
}

type Handler<C> = (req: Request, ctx: C) => Promise<unknown>;

/**
 * Wrap a route handler: JSON in/out, typed errors, no stack traces or DB errors leaked.
 * Responses are `no-store` — student data must never land in a shared cache.
 */
export function route<C = unknown>(handler: Handler<C>) {
  return async (req: Request, ctx: C) => {
    try {
      const result = await handler(req, ctx);
      if (result instanceof Response) return result;
      return NextResponse.json(result ?? { ok: true }, { headers: { "Cache-Control": "no-store" } });
    } catch (err) {
      if (err instanceof ApiError) {
        return NextResponse.json({ error: err.code, ...err.details }, { status: err.status });
      }
      if (err instanceof RateLimitError) {
        return NextResponse.json(
          { error: "rate_limited", retryAfter: err.retryAfterSec },
          { status: 429, headers: { "Retry-After": String(err.retryAfterSec) } },
        );
      }
      if (err instanceof z.ZodError) {
        return NextResponse.json({ error: "invalid_input", issues: err.issues.map((i) => i.path.join(".")) }, { status: 400 });
      }
      console.error("[api]", req.method, new URL(req.url).pathname, err);
      return NextResponse.json({ error: "server_error" }, { status: 500 });
    }
  };
}

export async function body<T extends z.ZodType>(req: Request, schema: T): Promise<z.infer<T>> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    throw new ApiError(400, "invalid_json");
  }
  return schema.parse(json);
}
