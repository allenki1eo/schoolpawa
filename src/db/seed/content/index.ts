import { form4Topics } from "./form4";
import { std7Topics } from "./std7";

export const GRADE_LEVELS = [
  ...[1, 2, 3, 4, 5, 6, 7].map((n) => ({ id: `std${n}`, stage: "primary" as const, ordinal: n, labelSw: `Darasa la ${n}`, labelEn: `Standard ${n}` })),
  ...[1, 2, 3, 4, 5, 6].map((n) => ({ id: `form${n}`, stage: "secondary" as const, ordinal: 7 + n, labelSw: `Kidato cha ${n}`, labelEn: `Form ${n}` })),
];

export const SUBJECTS = [
  { code: "HIS-P", nameSw: "Hisabati", nameEn: "Mathematics", stage: "primary" as const, medium: "sw" as const, accent: "#38BDF8", icon: "calculator" },
  { code: "SAY-P", nameSw: "Sayansi na Teknolojia", nameEn: "Science and Technology", stage: "primary" as const, medium: "sw" as const, accent: "#34D399", icon: "flask" },
  { code: "BMATH-S", nameSw: "Hisabati ya Msingi", nameEn: "Basic Mathematics", stage: "secondary" as const, medium: "en" as const, accent: "#A78BFA", icon: "sigma" },
  { code: "BIO-S", nameSw: "Biolojia", nameEn: "Biology", stage: "secondary" as const, medium: "en" as const, accent: "#FB7185", icon: "leaf" },
];

export const TOPICS = [...std7Topics, ...form4Topics];
