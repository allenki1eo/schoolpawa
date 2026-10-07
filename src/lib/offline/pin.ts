/** Local PIN hashing for pre-consent profiles (Web Crypto PBKDF2; the PIN is never stored). */
const enc = new TextEncoder();

function toHex(buf: ArrayBuffer) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function hashPinLocal(pin: string, saltHex?: string) {
  const salt = saltHex ? Uint8Array.from(saltHex.match(/../g)!.map((h) => parseInt(h, 16))) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", enc.encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: 120_000 }, key, 256);
  return { hash: toHex(bits), salt: toHex(salt.buffer as ArrayBuffer) };
}

export async function verifyPinLocal(pin: string, hash: string, salt: string) {
  const { hash: h } = await hashPinLocal(pin, salt);
  return h === hash;
}
