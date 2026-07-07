/**
 * CoverageRing
 * Circular progress gauge for visualizing coverage percentage.
 * Used in both the Coverage Spotlight banner and the Coverage Hub panel header.
 */
const TONES = {
  indigo: { track: "#E0E7FF", progress: "#4F46E5", text: "text-indigo-700" },
  white: {
    track: "rgba(255,255,255,0.28)",
    progress: "#FFFFFF",
    text: "text-white",
  },
  emerald: { track: "#D1FAE5", progress: "#059669", text: "text-emerald-700" },
};

const CoverageRing = ({
  percentage = 0,
  size = 72,
  strokeWidth = 7,
  tone = "indigo",
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, Number(percentage) || 0));
  const offset = circumference * (1 - clamped / 100);
  const colors = TONES[tone] || TONES.indigo;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={colors.track}
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={colors.progress}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 700ms ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          className={`font-bold tabular-nums leading-none ${colors.text}`}
          style={{ fontSize: size * 0.26 }}
        >
          {clamped.toFixed(0)}%
        </span>
      </div>
    </div>
  );
};

export default CoverageRing;
