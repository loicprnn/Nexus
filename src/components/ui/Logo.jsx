// Nexus brand mark — an angular "|X|" monogram (two pillars + central X),
// rendered as a transparent vector so it sits cleanly on the dark theme with no
// background box. Uses currentColor, so colour follows the surrounding text
// (white via `text-primary`). `size` is the square edge in px.
export default function Logo({ size = 26, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="currentColor"
      className={className}
      role="img"
      aria-label="Nexus"
    >
      {/* Left pillar */}
      <polygon points="16,20 28,14 28,80 16,86" />
      {/* Right pillar */}
      <polygon points="84,20 72,14 72,80 84,86" />
      {/* Diagonal "\" */}
      <polygon points="30,16 44,16 70,84 56,84" />
      {/* Diagonal "/" */}
      <polygon points="56,16 70,16 44,84 30,84" />
    </svg>
  )
}
