import { View, type ViewProps } from "react-native";

type CardProps = ViewProps & {
  /** 4px accent bar on the left edge, for the one card that matters on a screen. */
  stripe?: boolean;
};

export function Card({ stripe = false, className = "", children, ...props }: CardProps) {
  return (
    <View
      className={`overflow-hidden rounded-card border border-border bg-surface p-4 ${stripe ? "pl-5" : ""} ${className}`}
      {...props}
    >
      {stripe ? <View className="absolute bottom-0 left-0 top-0 w-1 bg-accent" /> : null}
      {children}
    </View>
  );
}
