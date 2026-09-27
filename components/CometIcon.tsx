import { useId } from "react";

/** Comet mark: a glowing head with a tapered tail sweeping to the lower left. */
export function CometIcon({ className, glow = true }: { className?: string; glow?: boolean }) {
  const id = useId();
  return (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden="true" className={className}>
      <defs>
        <linearGradient id={`${id}-tail`} x1="6" y1="58" x2="44" y2="20" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#9333ea" stopOpacity="0" />
          <stop offset="0.6" stopColor="#9333ea" stopOpacity="0.55" />
          <stop offset="1" stopColor="#c084fc" />
        </linearGradient>
        <radialGradient id={`${id}-head`} cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(44 20) scale(12)">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.35" stopColor="#e9d5ff" />
          <stop offset="1" stopColor="#9333ea" />
        </radialGradient>
        {glow && (
          <filter id={`${id}-glow`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.5" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        )}
      </defs>
      <g filter={glow ? `url(#${id}-glow)` : undefined}>
        <path d="M6 58 L37 16 Q44 11 49 17 Q54 23 48 29 Z" fill={`url(#${id}-tail)`} />
        <path d="M14 56 L40 24" stroke="#c084fc" strokeOpacity="0.5" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M22 58 L44 30" stroke="#c084fc" strokeOpacity="0.3" strokeWidth="1" strokeLinecap="round" />
        <circle cx="44" cy="20" r="8.5" fill={`url(#${id}-head)`} />
      </g>
    </svg>
  );
}
