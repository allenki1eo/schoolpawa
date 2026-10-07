import { describe, expect, it } from "vitest";
import { addDays, dayNumber, localDate, weekStart } from "./index";

describe("EAT calendar", () => {
  it("rolls the day over at local midnight (21:00 UTC)", () => {
    expect(localDate(new Date("2026-10-07T20:59:00Z"))).toBe("2026-10-07");
    expect(localDate(new Date("2026-10-07T21:00:00Z"))).toBe("2026-10-08");
  });

  it("computes the local Monday", () => {
    expect(weekStart(new Date("2026-10-07T10:00:00Z"))).toBe("2026-10-05"); // Wednesday
    expect(weekStart(new Date("2026-10-04T20:59:00Z"))).toBe("2026-09-28"); // Sunday 23:59 EAT
    expect(weekStart(new Date("2026-10-04T21:00:00Z"))).toBe("2026-10-05"); // Monday 00:00 EAT
  });

  it("adds days and numbers them", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(dayNumber("2026-10-08") - dayNumber("2026-10-07")).toBe(1);
  });
});
