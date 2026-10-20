import { useId } from "react";
import type { Scene } from "./data";

// Abstract stand-ins for footage, so the mockup never passes off stock photos as real results.

const skies: Record<Scene, [string, string]> = {
  rain: ["#1b2a4a", "#0b1222"],
  city: ["#1a1840", "#07070f"],
  neon: ["#2a0f3d", "#090512"],
  window: ["#15233d", "#070b14"],
  forest: ["#12332b", "#06120f"],
  storm: ["#3a4458", "#10141d"],
  puddle: ["#10313a", "#050e12"],
  umbrella: ["#2a2d36", "#121419"],
  dusk: ["#f08a5d", "#3a1d4f"],
};

export function SceneArt({ scene, className = "" }: { scene: Scene; className?: string }) {
  const id = useId().replace(/:/g, "");
  const [top, bottom] = skies[scene];

  return (
    <svg viewBox="0 0 160 100" preserveAspectRatio="xMidYMid slice" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`s${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={top} />
          <stop offset="1" stopColor={bottom} />
        </linearGradient>
        <filter id={`b${id}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
      </defs>
      <rect width="160" height="100" fill={`url(#s${id})`} />

      {(scene === "window" || scene === "rain") && (
        <g filter={`url(#b${id})`} opacity="0.9">
          <circle cx="30" cy="62" r="10" fill="#ffb15e" opacity="0.55" />
          <circle cx="72" cy="40" r="7" fill="#ff6f91" opacity="0.4" />
          <circle cx="118" cy="66" r="12" fill="#6fb6ff" opacity="0.5" />
          <circle cx="140" cy="30" r="6" fill="#ffd58a" opacity="0.45" />
        </g>
      )}

      {scene === "neon" && (
        <>
          <g filter={`url(#b${id})`}>
            <rect x="18" y="20" width="34" height="8" rx="4" fill="#ff3ea5" opacity="0.8" />
            <rect x="96" y="30" width="44" height="7" rx="3.5" fill="#3ee8ff" opacity="0.75" />
          </g>
          <rect x="0" y="66" width="160" height="34" fill="#0a0612" opacity="0.6" />
          <g filter={`url(#b${id})`} opacity="0.45">
            <rect x="18" y="78" width="34" height="5" rx="2.5" fill="#ff3ea5" />
            <rect x="96" y="74" width="44" height="5" rx="2.5" fill="#3ee8ff" />
          </g>
        </>
      )}

      {(scene === "city" || scene === "storm") && (
        <g fill={scene === "city" ? "#05050b" : "#0c0f16"}>
          <rect x="4" y="52" width="18" height="48" />
          <rect x="24" y="38" width="14" height="62" />
          <rect x="40" y="58" width="20" height="42" />
          <rect x="62" y="30" width="12" height="70" />
          <rect x="76" y="48" width="22" height="52" />
          <rect x="100" y="40" width="16" height="60" />
          <rect x="118" y="56" width="20" height="44" />
          <rect x="140" y="44" width="18" height="56" />
          {scene === "city" &&
            [28, 44, 66, 82, 104, 122, 144].map((x, i) =>
              [0, 1, 2, 3].map((r) => (
                <rect key={`${i}${r}`} x={x + (r % 2) * 4} y={50 + r * 9 + (i % 3) * 3} width="2" height="2" fill="#ffd27a" opacity={0.35 + ((i + r) % 3) * 0.2} />
              )),
            )}
        </g>
      )}

      {scene === "storm" && <path d="M98 6 L90 26 L97 26 L88 46" stroke="#dfe8ff" strokeWidth="1.2" fill="none" opacity="0.5" />}

      {scene === "forest" && (
        <>
          <rect y="30" width="160" height="30" fill="#bfe6d4" opacity="0.06" filter={`url(#b${id})`} />
          <g fill="#04100c">
            {[0, 18, 34, 54, 70, 92, 110, 128, 146].map((x, i) => (
              <path key={x} d={`M${x} 100 L${x + 10} ${36 + (i % 3) * 10} L${x + 20} 100Z`} />
            ))}
          </g>
        </>
      )}

      {scene === "puddle" && (
        <g fill="none" stroke="#9fe3f0" strokeWidth="0.8">
          <ellipse cx="60" cy="56" rx="22" ry="7" opacity="0.5" />
          <ellipse cx="60" cy="56" rx="38" ry="12" opacity="0.25" />
          <ellipse cx="116" cy="74" rx="14" ry="4.5" opacity="0.45" />
          <ellipse cx="116" cy="74" rx="26" ry="8" opacity="0.2" />
        </g>
      )}

      {scene === "umbrella" &&
        [
          [28, 30, "#e5484d"],
          [70, 22, "#f5d90a"],
          [116, 34, "#3e63dd"],
          [46, 70, "#30a46c"],
          [96, 68, "#f76b15"],
          [140, 74, "#e5e7eb"],
        ].map(([x, y, c]) => (
          <g key={`${x}${y}`}>
            <circle cx={x} cy={y} r="13" fill={c as string} opacity="0.85" />
            <circle cx={x} cy={y} r="13" fill="none" stroke="#000" strokeOpacity="0.25" strokeDasharray="2 4" />
          </g>
        ))}

      {scene === "dusk" && (
        <>
          <circle cx="80" cy="54" r="16" fill="#ffd3a1" opacity="0.7" filter={`url(#b${id})`} />
          <path d="M0 64 H160 V100 H0Z" fill="#1d0f2c" opacity="0.85" />
          <path d="M80 64 L40 100 M80 64 L120 100" stroke="#ffb27a" strokeOpacity="0.35" strokeWidth="0.8" />
        </>
      )}

      {(scene === "window" || scene === "rain" || scene === "storm" || scene === "neon") && (
        <g stroke="#cfe2ff" strokeWidth="0.6" strokeLinecap="round" opacity="0.28">
          {Array.from({ length: 18 }, (_, i) => {
            const x = (i * 37) % 160;
            const y = (i * 23) % 80;
            return <line key={i} x1={x} y1={y} x2={x - 2} y2={y + 12} />;
          })}
        </g>
      )}
    </svg>
  );
}

// Waveform for music and sound effect results.
export function Waveform({ seed = 1, bars = 48, className = "" }: { seed?: number; bars?: number; className?: string }) {
  return (
    <div className={`flex h-full items-center gap-[2px] ${className}`} aria-hidden="true">
      {Array.from({ length: bars }, (_, i) => {
        const v = Math.abs(Math.sin(i * 0.55 * seed + seed) * Math.cos(i * 0.21 + seed * 2));
        return <span key={i} className="w-full min-w-px rounded-full bg-current" style={{ height: `${18 + v * 82}%`, opacity: 0.35 + v * 0.65 }} />;
      })}
    </div>
  );
}
