import { Pressable, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Pill } from "@/components/ui/pill";
import { SectionLabel } from "@/components/ui/section-label";
import { Text } from "@/components/ui/text";
import { usePalette } from "@/theme/tokens";

import { formatKg, formatWeight, type ExerciseRecap } from "./session-recap";
import type { LoggedSet } from "./workout-state";

// ============================================================================
// Pieces of the live session, drawn after design/wireframe/athlete/session-live/
// musculation (screens 1 to 4) with the app's own tokens and components.
// No new visual language: where the wireframe has no element for a story
// requirement (effort, offline, confirmations), the existing Card, Pill and
// Button are used.
// ============================================================================

/** Top bar: stop (Quitter), session clock, and the « En cours » / « Hors ligne » label. */
export function SessionTopBar({
  elapsed,
  offline,
  onQuit,
}: {
  elapsed: string;
  offline: boolean;
  onQuit: () => void;
}) {
  const palette = usePalette();
  return (
    <View className="flex-row items-center justify-between px-5 pt-2">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Quitter la séance"
        onPress={onQuit}
        hitSlop={5}
        className="h-[38px] w-[38px] items-center justify-center rounded-xl border border-border bg-surface"
      >
        <View className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: palette.textMuted }} />
      </Pressable>
      <View
        className="items-center"
        accessible
        accessibilityLabel={`Durée de la séance ${elapsed}`}
      >
        <Text mono weight="medium" className="text-xl text-text">
          {elapsed}
        </Text>
        <Text weight="bold" className="text-[10px] uppercase tracking-[0.8px] text-text-muted">
          {offline ? "Hors ligne" : "En cours"}
        </Text>
      </View>
      {/* Keeps the clock centred, like the wireframe's right-hand button. */}
      <View className="h-[38px] w-[38px]" />
    </View>
  );
}

/** « Progression séance · 2/3 exercices » with its thin bar. */
export function WorkoutProgress({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <View
      className="px-5 pt-2.5"
      accessible
      accessibilityLabel={`${done} exercices sur ${total} terminés`}
    >
      <View className="mb-1.5 flex-row justify-between">
        <Text weight="bold" className="text-[11px] uppercase tracking-[0.6px] text-text-muted">
          Progression séance
        </Text>
        <Text mono className="text-[11px] text-text-muted">
          {done}/{total} exercices
        </Text>
      </View>
      <View className="h-[3px] overflow-hidden rounded-sm bg-border">
        <View className="h-full rounded-sm bg-accent" style={{ width: `${pct}%` }} />
      </View>
    </View>
  );
}

/** Exercise card with the accent stripe, muscles and current weight. */
export function ExerciseCard({
  name,
  muscles,
  weightKg,
  position,
  total,
}: {
  name: string;
  muscles: string[];
  weightKg: number | null;
  position: number;
  total: number;
}) {
  return (
    <View className="px-5 pt-3.5">
      <Card
        stripe
        accessible
        accessibilityLabel={`${name}, exercice ${position} sur ${total}`}
        accessibilityRole="header"
      >
        <Text weight="bold" className="mb-2 text-[17px] tracking-[-0.3px] text-text">
          {name}
        </Text>
        <View className="flex-row flex-wrap gap-1.5">
          {muscles.length > 0 ? <Pill label={muscles.join(" · ")} /> : null}
          {weightKg !== null ? (
            <Pill variant="accent" label={`${formatWeight(weightKg)} kg`} />
          ) : null}
        </View>
      </Card>
    </View>
  );
}

/** « Série 3 / 4 » and the dots: done (wide, filled), current (wide, ringed), to come (small). */
export function SetDots({
  current,
  total,
  done,
}: {
  current: number;
  total: number;
  done: number;
}) {
  return (
    <View className="flex-row items-center justify-between px-5 pt-4">
      <Text weight="bold" className="text-[11px] uppercase tracking-[0.6px] text-text-muted">
        Série {Math.min(current, total)} / {total}
      </Text>
      <View
        className="flex-row gap-[7px]"
        accessible
        accessibilityLabel={`${done} séries sur ${total} notées`}
      >
        {Array.from({ length: total }, (_u, i) => {
          const isDone = i < done;
          const isCurrent = i === done;
          return (
            <View
              key={i}
              className={`h-2 rounded ${isDone || isCurrent ? "w-[26px] bg-accent" : "w-2.5 bg-border opacity-40"}`}
            />
          );
        })}
      </View>
    </View>
  );
}

/** Round +/- button of the rep counter and of the weight pill. */
export function StepButton({
  symbol,
  label,
  onPress,
  primary = false,
  small = false,
}: {
  symbol: "+" | "−";
  label: string;
  onPress: () => void;
  primary?: boolean;
  small?: boolean;
}) {
  const palette = usePalette();
  // Small buttons are drawn at 28 pt as in the wireframe, but touch at 48 pt.
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={small ? 10 : 0}
      className={`${small ? "h-7 w-7 border border-border bg-surface2" : primary ? "h-[52px] w-[52px] bg-accent" : "h-[52px] w-[52px] border border-border bg-surface"} items-center justify-center rounded-full active:opacity-70`}
    >
      <Ionicons
        name={symbol === "+" ? "add" : "remove"}
        size={small ? 14 : 22}
        color={primary ? palette.btnPrimaryText : palette.textSub}
      />
    </Pressable>
  );
}

/** Circular countdown of the rest screen. */
export function RestRing({ remaining, fraction }: { remaining: number; fraction: number }) {
  const palette = usePalette();
  const size = 200;
  const stroke = 10;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const left = Math.max(0, Math.min(1, 1 - fraction));
  return (
    <View
      style={{ width: size, height: size }}
      accessible
      accessibilityRole="timer"
      accessibilityLabel={`Repos : ${remaining} secondes restantes`}
    >
      <Svg
        width={size}
        height={size}
        style={{ position: "absolute", transform: [{ rotate: "-90deg" }] }}
      >
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={palette.border}
          strokeWidth={stroke}
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={palette.accent}
          strokeWidth={stroke}
          strokeDasharray={`${circ}`}
          strokeDashoffset={circ * (1 - left)}
          strokeLinecap="round"
        />
      </Svg>
      <View className="absolute inset-0 items-center justify-center">
        <Text mono weight="medium" className="text-[62px] leading-[64px] text-text">
          {remaining}
        </Text>
        <Text mono className="mt-1 text-base text-text-muted">
          secondes
        </Text>
      </View>
    </View>
  );
}

/** Card with the neutral stripe announcing what comes next (rest and summary screens). */
export function NextUpCard({
  label,
  title,
  detail,
}: {
  label: string;
  title: string;
  detail: string;
}) {
  return (
    <View className="mx-5 mb-3.5 flex-row overflow-hidden rounded-2xl border border-border bg-surface">
      <View className="w-1 bg-border" />
      <View className="flex-1 px-4 py-3">
        <Text weight="bold" className="mb-1 text-[10px] uppercase tracking-[0.8px] text-text-muted">
          {label}
        </Text>
        <Text weight="bold" className="mb-0.5 text-sm text-text">
          {title}
        </Text>
        <Text mono className="text-xs text-text-muted">
          {detail}
        </Text>
      </View>
    </View>
  );
}

const RPE_VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

/**
 * Optional effort of a set, 1 to 10 (story 5.6). Touching the chosen value
 * again clears it. Never required: validating a set stays one touch.
 */
export function RpePicker({
  value,
  onChange,
  showHelp,
}: {
  value: number | null;
  onChange: (rpe: number | null) => void;
  showHelp: boolean;
}) {
  return (
    <View className="gap-2 px-5">
      <Text weight="bold" className="text-[11px] uppercase tracking-[0.6px] text-text-muted">
        Effort ressenti (facultatif)
      </Text>
      {showHelp ? (
        <Text variant="caption">
          1 = très facile, 10 = impossible de faire une répétition de plus.
        </Text>
      ) : null}
      <View className="flex-row flex-wrap gap-1.5">
        {RPE_VALUES.map((n) => {
          const selected = value === n;
          return (
            <Pressable
              key={n}
              accessibilityRole="button"
              accessibilityLabel={`Effort ${n} sur 10`}
              accessibilityState={{ selected }}
              onPress={() => onChange(selected ? null : n)}
              className={`h-11 w-11 items-center justify-center rounded-full border ${selected ? "border-accent bg-accent-dim" : "border-border bg-surface"}`}
            >
              <Text
                mono
                weight="medium"
                className={`text-sm ${selected ? "text-accent" : "text-text-sub"}`}
              >
                {n}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** One row of « Détail des séries »: check when the target is met. */
export function SetSummaryRow({ set, targetReps }: { set: LoggedSet; targetReps: number | null }) {
  const palette = usePalette();
  const met = targetReps === null || set.repsCompleted >= targetReps;
  const weight = set.weightKg === null ? "" : ` · ${formatWeight(set.weightKg)} kg`;
  const effort = set.rpe === null ? "" : ` · effort ${set.rpe}/10`;
  return (
    <View
      className="mb-2 flex-row items-center gap-3 rounded-xl border border-border bg-surface px-3.5 py-2.5"
      accessible
      accessibilityLabel={`Série ${set.setNumber} : ${set.repsCompleted} répétitions${set.weightKg === null ? "" : ` à ${formatWeight(set.weightKg)} kilos`}${set.rpe === null ? "" : `, effort ${set.rpe} sur 10`}`}
    >
      <View
        className={`h-7 w-7 items-center justify-center rounded-full border ${met ? "border-accent bg-accent-dim" : "border-border bg-surface2"}`}
      >
        {met ? (
          <Ionicons name="checkmark" size={14} color={palette.accent} />
        ) : (
          <Text mono className="text-[11px] text-text-muted">
            {set.setNumber}
          </Text>
        )}
      </View>
      <View className="flex-1 flex-row items-baseline">
        <Text weight="semibold" className={`text-[13px] ${met ? "text-text" : "text-text-sub"}`}>
          Série {set.setNumber}
        </Text>
        <Text mono className="ml-2 text-xs text-text-muted">
          {set.repsCompleted} reps{weight}
          {effort}
        </Text>
      </View>
    </View>
  );
}

/** Two figures side by side (summary between exercises). */
export function StatTile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <View className="flex-1 rounded-[14px] border border-border bg-surface px-3.5 py-3">
      <Text weight="bold" className="mb-1 text-[10px] uppercase tracking-[0.6px] text-text-muted">
        {label}
      </Text>
      <Text mono weight="medium" className="mb-0.5 text-lg text-text">
        {value}
      </Text>
      <Text className="text-[10px] text-text-muted">{sub}</Text>
    </View>
  );
}

/** One column of the recap strip. */
export function RecapStat({
  label,
  value,
  sub,
  spoken,
}: {
  label: string;
  value: string;
  sub: string;
  spoken: string;
}) {
  return (
    <View className="flex-1 items-center" accessible accessibilityLabel={spoken}>
      <Text mono weight="medium" className="mb-1 text-[26px] leading-7 text-text">
        {value}
      </Text>
      <Text weight="bold" className="text-[11px] uppercase tracking-[0.4px] text-text-muted">
        {label}
      </Text>
      {sub ? <Text className="mt-0.5 text-[10px] text-text-muted">{sub}</Text> : null}
    </View>
  );
}

/** One exercise in « Résumé par exercice ». */
export function ExerciseRecapRow({ recap }: { recap: ExerciseRecap }) {
  return (
    <View className="mb-2 flex-row overflow-hidden rounded-[14px] border border-border bg-surface">
      <View className="w-1 bg-accent" />
      <View className="flex-1 px-3.5 py-3">
        <Text weight="bold" className="mb-1.5 text-sm text-text">
          {recap.name}
        </Text>
        <View className="flex-row flex-wrap items-center gap-2">
          <Pill label={`${recap.sets.length} séries`} />
          <Text mono className="text-[10px] text-text-muted">
            {formatKg(recap.volumeKg)} kg
          </Text>
          {recap.averageRpe !== null ? (
            <Text className="text-[10px] text-text-muted">Effort {recap.averageRpe}/10</Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

/**
 * Confirmation drawn over the screen (« Quitter », « Terminer quand même »).
 * A plain overlay rather than Alert: Alert has no buttons on the web build.
 */
export function ConfirmOverlay({
  title,
  body,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <View className="absolute inset-0 justify-end bg-black/60 px-5 pb-8" accessibilityViewIsModal>
      <Card className="gap-3 p-5">
        <SectionLabel>Confirmation</SectionLabel>
        <Text
          weight="bold"
          className="text-lg tracking-[-0.3px] text-text"
          accessibilityRole="header"
        >
          {title}
        </Text>
        <Text variant="caption" className="text-[13px]">
          {body}
        </Text>
        <Button title={confirmLabel} onPress={onConfirm} className="mt-1" />
        <Button title={cancelLabel} variant="outline" onPress={onCancel} />
      </Card>
    </View>
  );
}
