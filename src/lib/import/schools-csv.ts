import { sizeBandFor, type SizeBand, type Stage } from "../ranking/school-power";

/**
 * School registry CSV import (PRD §9: schools seeded from CSV).
 *
 * Expected header (case-insensitive, any order):
 *   reg_no,name,region,district,stage,enrolled
 * `stage` accepts primary|secondary|msingi|sekondari. `enrolled` is optional (size band then
 * defaults to S until updated).
 */
export interface SchoolCsvRow {
  regNo: string;
  name: string;
  region: string;
  district: string;
  stage: Stage;
  enrolled: number | null;
  sizeBand: SizeBand;
}

export interface CsvIssue {
  line: number;
  message: string;
}

const REQUIRED = ["reg_no", "name", "region", "district", "stage"] as const;

/** RFC 4180-ish line splitter: handles quoted fields, escaped quotes and commas in quotes. */
export function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function parseStage(v: string): Stage | null {
  const s = v.toLowerCase();
  if (s === "primary" || s === "msingi") return "primary";
  if (s === "secondary" || s === "sekondari") return "secondary";
  return null;
}

export function parseSchoolsCsv(text: string): { rows: SchoolCsvRow[]; issues: CsvIssue[] } {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/);
  const issues: CsvIssue[] = [];
  const rows: SchoolCsvRow[] = [];
  // Leading comment / blank lines are allowed before the header.
  const headerIndex = lines.findIndex((l) => l.trim() !== "" && !l.trim().startsWith("#"));
  const header = splitCsvLine(lines[headerIndex] ?? "").map((h) => h.toLowerCase().replace(/\s+/g, "_"));
  const missing = REQUIRED.filter((r) => !header.includes(r));
  if (missing.length) return { rows, issues: [{ line: headerIndex + 1, message: `Missing columns: ${missing.join(", ")}` }] };
  const col = (name: string) => header.indexOf(name);
  const seen = new Set<string>();

  lines.forEach((raw, i) => {
    const line = i + 1;
    if (i <= headerIndex) return;
    if (!raw.trim() || raw.trim().startsWith("#")) return;
    const cells = splitCsvLine(raw);
    const get = (name: string) => (col(name) >= 0 ? (cells[col(name)] ?? "") : "");
    const regNo = get("reg_no").toUpperCase();
    const name = get("name").replace(/\s+/g, " ");
    const region = get("region");
    const district = get("district");
    const stage = parseStage(get("stage"));
    const enrolledRaw = get("enrolled");
    const enrolled = enrolledRaw ? Number(enrolledRaw.replace(/[, ]/g, "")) : null;

    if (!regNo || !name || !region || !district) return issues.push({ line, message: "Missing required value" });
    if (!/^[A-Z0-9./-]{3,30}$/.test(regNo)) return issues.push({ line, message: `Invalid reg_no "${regNo}"` });
    if (!stage) return issues.push({ line, message: `Invalid stage "${get("stage")}"` });
    if (enrolled !== null && (!Number.isInteger(enrolled) || enrolled < 0 || enrolled > 20000)) {
      return issues.push({ line, message: `Invalid enrolled "${enrolledRaw}"` });
    }
    if (seen.has(regNo)) return issues.push({ line, message: `Duplicate reg_no "${regNo}"` });
    seen.add(regNo);
    rows.push({ regNo, name, region, district, stage, enrolled, sizeBand: sizeBandFor(enrolled ?? 0) });
  });
  return { rows, issues };
}
