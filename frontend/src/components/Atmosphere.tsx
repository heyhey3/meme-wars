import type { CSSProperties } from "react";

const EMBERS = [
  { left: "6%", size: 3, color: "#ff9f43", duration: 18, delay: -4, drift: 28 },
  { left: "14%", size: 2, color: "#ff5a3c", duration: 23, delay: -15, drift: -22 },
  { left: "23%", size: 4, color: "#ffd166", duration: 20, delay: -9, drift: 34 },
  { left: "31%", size: 2, color: "#2dd4ff", duration: 26, delay: -2, drift: -18 },
  { left: "40%", size: 3, color: "#ff9f43", duration: 16, delay: -12, drift: 20 },
  { left: "48%", size: 2, color: "#ffd166", duration: 22, delay: -19, drift: -28 },
  { left: "57%", size: 4, color: "#5b8cff", duration: 24, delay: -6, drift: 26 },
  { left: "64%", size: 2, color: "#2dd4ff", duration: 17, delay: -14, drift: -16 },
  { left: "72%", size: 3, color: "#ff5a3c", duration: 21, delay: -3, drift: 30 },
  { left: "80%", size: 2, color: "#ffd166", duration: 27, delay: -10, drift: -24 },
  { left: "88%", size: 4, color: "#5b8cff", duration: 19, delay: -17, drift: 18 },
  { left: "95%", size: 2, color: "#ff9f43", duration: 25, delay: -7, drift: -30 },
];

/**
 * Slow, non-interactive embers behind the app.
 * The CSS respects `prefers-reduced-motion` and hides them when requested.
 */
export function Atmosphere() {
  return (
    <div className="atmosphere" aria-hidden>
      {EMBERS.map((ember, index) => {
        const style = {
          left: ember.left,
          width: ember.size,
          height: ember.size,
          backgroundColor: ember.color,
          boxShadow: `0 0 ${ember.size * 3}px ${ember.color}`,
          animationDuration: `${ember.duration}s`,
          animationDelay: `${ember.delay}s`,
          "--drift": `${ember.drift}px`,
        } as CSSProperties;

        return <span key={index} className="ember" style={style} />;
      })}
    </div>
  );
}
