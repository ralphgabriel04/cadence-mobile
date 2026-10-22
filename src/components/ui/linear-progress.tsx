import { View, type ViewProps } from "react-native";

type LinearProgressProps = ViewProps & {
  /** 0..100 */
  value: number;
};

export function LinearProgress({ value, className = "", ...props }: LinearProgressProps) {
  const width = Math.max(0, Math.min(100, value));

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: width }}
      className={`h-1.5 overflow-hidden rounded-pill bg-surface2 ${className}`}
      {...props}
    >
      <View className="h-full rounded-pill bg-accent" style={{ width: `${width}%` }} />
    </View>
  );
}
