import { Crown, Flame, Mountain, Rocket, Shield, Star, Sun, Zap, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/client/cn";

export const EMBLEM_ART: Record<string, { Icon: LucideIcon; color: string }> = {
  ngao: { Icon: Shield, color: "#60a5fa" },
  nyota: { Icon: Star, color: "#f7c948" },
  mwenge: { Icon: Flame, color: "#fb923c" },
  radi: { Icon: Zap, color: "#facc15" },
  taji: { Icon: Crown, color: "#e879f9" },
  mlima: { Icon: Mountain, color: "#34d399" },
  jua: { Icon: Sun, color: "#fbbf24" },
  roketi: { Icon: Rocket, color: "#f472b6" },
};

export function Emblem({ emblem, size = 48, className }: { emblem: string; size?: number; className?: string }) {
  const { Icon, color } = EMBLEM_ART[emblem] ?? EMBLEM_ART.ngao!;
  return (
    <span
      className={cn("inline-grid shrink-0 place-items-center rounded-2xl ring-1", className)}
      style={{ width: size, height: size, background: `linear-gradient(145deg, ${color}33, ${color}0d)`, borderColor: `${color}55`, boxShadow: `inset 0 0 0 1px ${color}40` }}
    >
      <Icon style={{ color, width: size * 0.5, height: size * 0.5 }} aria-hidden />
    </span>
  );
}
