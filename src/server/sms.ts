import "server-only";
import { config } from "./config";

/**
 * SMS delivery. `console` prints to the server log (dev only — refused in production by
 * config). `africastalking` uses the REST API directly to avoid a heavy SDK.
 *
 * The raw phone number is passed in memory only; it is never persisted or logged in production.
 */
export async function sendSms(toE164: string, message: string): Promise<void> {
  if (config.SMS_DRIVER === "console") {
    console.info(`\n📱 [sms → ${toE164}] ${message}\n`);
    return;
  }

  const host = config.AT_USERNAME === "sandbox" ? "api.sandbox.africastalking.com" : "api.africastalking.com";
  const params = new URLSearchParams({ username: config.AT_USERNAME, to: toE164, message });
  if (config.AT_SENDER_ID) params.set("from", config.AT_SENDER_ID);

  const res = await fetch(`https://${host}/version1/messaging`, {
    method: "POST",
    headers: {
      apiKey: config.AT_API_KEY,
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`SMS gateway error ${res.status}`);
  const json = (await res.json()) as { SMSMessageData?: { Recipients?: Array<{ status: string }> } };
  const status = json.SMSMessageData?.Recipients?.[0]?.status;
  if (status !== "Success") throw new Error(`SMS not accepted: ${status ?? "unknown"}`);
}
