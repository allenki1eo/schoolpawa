import { describe, expect, it } from "vitest";
import { checkName, containsBlocked, containsContactInfo, GROUP_NAME_RULES, NICKNAME_RULES, normalizeForMatch } from "./profanity";
import { formatHandle, generateCode, isValidCode, maskPhone, normalizeCode, normalizeTzPhone, parseHandle } from "./codes";

describe("abuse filter", () => {
  it("normalises leetspeak, repeats and separators", () => {
    expect(normalizeForMatch("F.u_u-u-c K")).toBe("fuck");
    expect(normalizeForMatch("M@l4y@")).toBe("malaya");
    expect(normalizeForMatch("Pumbaaavu")).toBe("pumbavu");
  });

  it("blocks Kiswahili and English abuse, including disguised forms", () => {
    for (const bad of ["malaya", "Mpumbavu123", "m s e n g e", "SH1T", "fuuuck", "Kum@ Lako", "b!tch"]) {
      expect(containsBlocked(bad), bad).toBe(true);
    }
  });

  it("does not block innocent names (false-positive guards)", () => {
    for (const ok of ["Dickson", "Nazi Tamu", "Assumpta", "Skillz", "Grapefruit", "Simba", "Neema", "Baraka", "Kumbukumbu"]) {
      expect(containsBlocked(ok), ok).toBe(false);
    }
  });

  it("supports extra moderator terms", () => {
    expect(containsBlocked("badterm", ["badterm"])).toBe(true);
  });

  it("detects contact info", () => {
    expect(containsContactInfo("call 0712 345 678")).toBe(true);
    expect(containsContactInfo("insta @simba")).toBe(true);
    expect(containsContactInfo("www.site.co.tz")).toBe(true);
    expect(containsContactInfo("Simba 2026")).toBe(false);
  });
});

describe("checkName", () => {
  it("accepts good nicknames and tidies whitespace", () => {
    expect(checkName("  Simba   Mkali ", NICKNAME_RULES)).toEqual({ ok: true, value: "Simba Mkali" });
    expect(checkName("Ñyota_7", NICKNAME_RULES).ok).toBe(true);
  });

  it("reports the specific problem", () => {
    expect(checkName("ab", NICKNAME_RULES).problem).toBe("too_short");
    expect(checkName("a".repeat(17), NICKNAME_RULES).problem).toBe("too_long");
    expect(checkName("hi<script>", NICKNAME_RULES).problem).toBe("invalid_chars");
    expect(checkName("Juma 0712345678", NICKNAME_RULES).problem).toBe("contact_info");
    expect(checkName("Malaya", NICKNAME_RULES).problem).toBe("blocked_word");
    expect(checkName("Shule Kuu", NICKNAME_RULES).problem).toBe("identity_hint");
    expect(checkName("Shule Kuu", GROUP_NAME_RULES).ok).toBe(true);
  });
});

describe("codes, handles and phones", () => {
  it("generates codes only from the unambiguous alphabet", () => {
    let i = 0;
    const code = generateCode(6, (n) => i++ % n);
    expect(isValidCode(code, 6)).toBe(true);
    expect(isValidCode("ABC0O1", 6)).toBe(false);
    expect(normalizeCode(" abc-def ")).toBe("ABCDEF");
  });

  it("formats and parses handles", () => {
    expect(formatHandle("Simba", 42)).toBe("Simba#0042");
    expect(parseHandle("Simba Mkali # 0042")).toEqual({ nickname: "Simba Mkali", discriminator: 42 });
    expect(parseHandle("Simba")).toBeNull();
  });

  it("normalises Tanzanian mobile numbers", () => {
    expect(normalizeTzPhone("0712 345 678")).toBe("+255712345678");
    expect(normalizeTzPhone("+255 65-123-4567")).toBe("+255651234567");
    expect(normalizeTzPhone("255712345678")).toBe("+255712345678");
    expect(normalizeTzPhone("712345678")).toBe("+255712345678");
    expect(normalizeTzPhone("0222 123 456")).toBeNull(); // landline
    expect(normalizeTzPhone("12345")).toBeNull();
    expect(maskPhone("+255712345678")).toBe("+255 7•• ••• 678");
  });
});
