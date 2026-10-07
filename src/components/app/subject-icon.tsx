import { Calculator, FlaskConical, Leaf, Sigma, BookOpen, type LucideIcon } from "lucide-react";

const ICONS: Record<string, LucideIcon> = { calculator: Calculator, flask: FlaskConical, sigma: Sigma, leaf: Leaf };

export function SubjectIcon({ icon, accent, size = 44 }: { icon: string; accent: string; size?: number }) {
  const Icon = ICONS[icon] ?? BookOpen;
  return (
    <span
      className="inline-grid shrink-0 place-items-center rounded-2xl"
      style={{ width: size, height: size, background: `linear-gradient(145deg, ${accent}38, ${accent}10)`, boxShadow: `inset 0 0 0 1px ${accent}55` }}
    >
      <Icon style={{ color: accent, width: size * 0.5, height: size * 0.5 }} aria-hidden />
    </span>
  );
}
