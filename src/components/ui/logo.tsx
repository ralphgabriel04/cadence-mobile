import Svg, { Path } from "react-native-svg";

import { usePalette } from "@/theme/tokens";

/**
 * "The Resonance": two groups of three concentric arcs that intersect,
 * coach and athlete resonating. Same geometry as design/wireframe/cadence-kit.jsx.
 */
export function Logo({ size = 64 }: { size?: number }) {
  const palette = usePalette();
  const cy = 32;
  const lx = 24;
  const rx = 40;
  const radii = [8, 15, 22];

  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      {radii.map((r, i) => (
        <Path
          key={`l${r}`}
          d={`M${lx},${cy - r} A${r},${r} 0 0 1 ${lx},${cy + r}`}
          stroke={palette.accent}
          strokeWidth={i === 0 ? 2.4 : 2}
          strokeLinecap="round"
          opacity={1 - i * 0.18}
        />
      ))}
      {radii.map((r, i) => (
        <Path
          key={`r${r}`}
          d={`M${rx},${cy + r} A${r},${r} 0 0 1 ${rx},${cy - r}`}
          stroke={palette.accent}
          strokeWidth={i === 0 ? 2.4 : 2}
          strokeLinecap="round"
          opacity={1 - i * 0.18}
        />
      ))}
    </Svg>
  );
}
