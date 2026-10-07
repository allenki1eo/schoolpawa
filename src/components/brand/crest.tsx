import { crestDesign } from "@/lib/client/crest";
import { cn } from "@/lib/client/cn";

/**
 * Generated school crest: shield + initials + region colour + a pattern derived from the
 * registration number. Every school looks proud without using real logos.
 */
export function Crest({
  name,
  regNo,
  color,
  size = 44,
  glow = false,
  className,
}: {
  name: string;
  regNo: string;
  color: string;
  size?: number;
  glow?: boolean;
  className?: string;
}) {
  const { initials, pattern, rotate } = crestDesign(name, regNo);
  const id = `c${regNo.replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <span className={cn("relative inline-grid shrink-0 place-items-center", className)} style={{ width: size, height: size * 1.15 }}>
      {glow ? (
        <span aria-hidden className="absolute inset-[-25%] rounded-full motion-safe:animate-glow" style={{ background: `radial-gradient(circle, ${color}55, transparent 65%)` }} />
      ) : null}
      <svg viewBox="0 0 40 46" width={size} height={size * 1.15} role="img" aria-label={name} className="relative drop-shadow-[0_4px_10px_rgb(0_0_0/0.45)]">
        <defs>
          <linearGradient id={`${id}-g`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={color} />
            <stop offset="1" stopColor={color} stopOpacity="0.55" />
          </linearGradient>
          <clipPath id={`${id}-clip`}>
            <path d="M20 1.5 37 7v14.5c0 10.6-7.2 18.9-17 23-9.8-4.1-17-12.4-17-23V7z" />
          </clipPath>
        </defs>
        <path d="M20 1.5 37 7v14.5c0 10.6-7.2 18.9-17 23-9.8-4.1-17-12.4-17-23V7z" fill="#0b1426" />
        <g clipPath={`url(#${id}-clip)`} opacity="0.95">
          {pattern === "chevron" && <path d={rotate ? "M0 30 20 18l20 12v6L20 24 0 36z" : "M0 14 20 26l20-12v6L20 32 0 20z"} fill={`url(#${id}-g)`} />}
          {pattern === "stripes" && (
            <g fill={`url(#${id}-g)`}>
              {[0, 1, 2, 3, 4].map((i) => (
                <rect key={i} x={-10 + i * 12} y="-5" width="5" height="60" transform="rotate(25 20 23)" />
              ))}
            </g>
          )}
          {pattern === "split" && <rect x={rotate ? 20 : 0} y="0" width="20" height="46" fill={`url(#${id}-g)`} />}
          {pattern === "band" && <rect x="0" y={rotate ? 8 : 26} width="40" height="10" fill={`url(#${id}-g)`} />}
          {pattern === "star" && (
            <path d="M20 5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L20 18.4l-5.2 2.7 1-5.8-4.3-4.1 5.9-.8z" fill={`url(#${id}-g)`} />
          )}
        </g>
        <path d="M20 1.5 37 7v14.5c0 10.6-7.2 18.9-17 23-9.8-4.1-17-12.4-17-23V7z" fill="none" stroke={color} strokeWidth="1.6" />
        <text
          x="20"
          y={pattern === "star" ? 33 : 27}
          textAnchor="middle"
          fontSize={initials.length > 1 ? 13 : 16}
          fontWeight="800"
          fill="#fff"
          style={{ fontFamily: "var(--font-display)", paintOrder: "stroke", stroke: "#0b1426", strokeWidth: 3 }}
        >
          {initials}
        </text>
      </svg>
    </span>
  );
}
