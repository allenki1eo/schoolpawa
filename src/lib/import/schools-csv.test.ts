import { describe, expect, it } from "vitest";
import { parseSchoolsCsv, splitCsvLine } from "./schools-csv";

describe("school CSV import", () => {
  it("splits quoted fields", () => {
    expect(splitCsvLine('a,"b, c","say ""hi""",d')).toEqual(["a", "b, c", 'say "hi"', "d"]);
  });

  it("parses valid rows, maps Swahili stages and size bands", () => {
    const csv = [
      "# exported from the registry",
      "Reg_No,Name,Region,District,Stage,Enrolled",
      'EM.1234,"Mwenge, Shule ya Msingi",Shinyanga,Kahama,msingi,"1,250"',
      "S.4567,Uhuru Sekondari,Shinyanga,Kishapu,sekondari,420",
      "# comment line",
      "",
    ].join("\n");
    const { rows, issues } = parseSchoolsCsv(csv);
    expect(issues).toEqual([]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ regNo: "EM.1234", name: "Mwenge, Shule ya Msingi", stage: "primary", enrolled: 1250, sizeBand: "L" });
    expect(rows[1]).toMatchObject({ stage: "secondary", sizeBand: "M" });
  });

  it("reports problems with line numbers and skips bad rows", () => {
    const csv = [
      "reg_no,name,region,district,stage,enrolled",
      "EM.1,A,Shinyanga,Kahama,primary,100",
      "EM.1,B,Shinyanga,Kahama,primary,100",
      "EM.2,C,Shinyanga,Kahama,college,100",
      "EM.3,,Shinyanga,Kahama,primary,100",
      "EM.4,D,Shinyanga,Kahama,primary,-5",
    ].join("\n");
    const { rows, issues } = parseSchoolsCsv(csv);
    expect(rows.map((r) => r.regNo)).toEqual(["EM.1"]);
    expect(issues.map((i) => i.line)).toEqual([3, 4, 5, 6]);
  });

  it("rejects files without the required header", () => {
    expect(parseSchoolsCsv("name,region\nA,B").issues[0]!.message).toMatch(/Missing columns/);
  });
});
