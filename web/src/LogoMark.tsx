import { useId } from "react";

/**
 * Logo vectoriel intégré (aucun fichier externe) — toujours visible.
 */
export function LogoMark({ className, height = 48 }: { className?: string; height?: number }) {
  const id = useId().replace(/:/g, "");
  const gradId = `lm-shield-${id}`;
  const filterId = `lm-glow-${id}`;
  const w = Math.round(height * (280 / 100));

  return (
    <svg
      className={`logo-mark ${className ?? ""}`}
      width={w}
      height={height}
      viewBox="0 0 280 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="TEAM DÉRAPE 718"
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#94a3b8" />
          <stop offset="100%" stopColor="#475569" />
        </linearGradient>
        <filter id={filterId} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <path
        d="M8 18 L140 8 L272 18 L268 82 Q140 96 12 82 Z"
        stroke={`url(#${gradId})`}
        strokeWidth="1.5"
        fill="rgba(148,163,184,0.08)"
        filter={`url(#${filterId})`}
      />
      <text
        x="140"
        y="38"
        textAnchor="middle"
        fill="#e2e8f0"
        style={{ fontFamily: "Syne, system-ui, sans-serif", fontSize: "11px", fontWeight: 700, letterSpacing: "0.28em" }}
      >
        TEAM
      </text>
      <text
        x="140"
        y="66"
        textAnchor="middle"
        fill="#a855f7"
        style={{ fontFamily: "Syne, system-ui, sans-serif", fontSize: "22px", fontWeight: 800 }}
      >
        DÉRAPE
      </text>
      <text
        x="140"
        y="92"
        textAnchor="middle"
        fill="#bef264"
        style={{ fontFamily: "Syne, system-ui, sans-serif", fontSize: "26px", fontWeight: 800 }}
      >
        718
      </text>
    </svg>
  );
}
