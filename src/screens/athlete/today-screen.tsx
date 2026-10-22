import { useCallback, useRef } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LinearProgress } from "@/components/ui/linear-progress";
import { Pill } from "@/components/ui/pill";
import { SectionLabel } from "@/components/ui/section-label";
import { Text } from "@/components/ui/text";
import { useTodaySession } from "@/hooks/use-today-session";
import { usePalette } from "@/theme/tokens";
import type {
  LastSessionSummary,
  PlannedSession,
  TodayScreenData,
  TodayState,
  WeekDay,
  WeekDayState,
  WeekSummary,
} from "@/types/today-screen";
import { dayInitialFr, dayNameFr, formatDayAndMonthFr, formatDurationFr } from "@/utils/format-date-fr";

const SESSION_ROUTE = "/(athlete)/session";
const PLAN_ROUTE = "/(athlete)/plan";

// TODO(Ralph): copy québécois final des six états de la carte du jour. Les
// textes ci-dessous sont des valeurs de travail, pas la voix du produit.
const COPY = {
  today: "Aujourd'hui",
  startCta: "Commencer la séance",
  resumeCta: "Reprendre la séance",
  inProgress: "En cours",
  completed: "Complétée",
  skipped: "Passée",
  skippedBody: "Séance passée pour aujourd'hui. On se reprend à la prochaine.",
  restTitle: "Jour de repos",
  restNone: "Plus rien de prévu cette semaine. Récupère bien.",
  noProgramTitle: "Aucun programme en cours",
  noProgramBody: "Choisis un programme et ta séance du jour apparaîtra ici.",
  noProgramCta: "Voir le programme",
} as const;

// ── Screen ───────────────────────────────────────────────────────────────────

export function AthleteTodayScreen() {
  const { state, refetch } = useTodaySession();
  const palette = usePalette();

  // Refetch when the screen regains focus (back from the live session), but
  // not on the first focus: the hook already loads on mount.
  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      refetch();
    }, [refetch]),
  );

  if (state.status === "loading") {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-bg">
        <ActivityIndicator size="large" color={palette.accent} />
      </SafeAreaView>
    );
  }

  if (state.status === "error") {
    const kind = state.failure.kind === "unauthenticated" ? "unauthenticated" : "network";
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-bg px-8">
        <Text variant="heading" className="text-center">
          {kind === "unauthenticated" ? "Session expirée" : "Chargement impossible"}
        </Text>
        <Text className="text-center">
          {kind === "unauthenticated"
            ? "Reconnecte-toi pour voir ta séance du jour."
            : "On n'a pas réussi à charger ta journée. Vérifie ta connexion et réessaie."}
        </Text>
        {kind === "network" ? (
          <Button title="Réessayer" onPress={refetch} className="w-full" />
        ) : null}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
      <ScrollView
        contentContainerClassName="gap-6 px-5 pb-10 pt-2"
        refreshControl={
          <RefreshControl
            refreshing={state.status === "refreshing"}
            onRefresh={refetch}
            tintColor={palette.accent}
            colors={[palette.accent]}
          />
        }
      >
        <Header data={state.data} />
        <TodayCard today={state.data.today} />
        <WeekSection week={state.data.week} />
        {state.data.lastSession ? <LastSessionCard last={state.data.lastSession} /> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Blocks ───────────────────────────────────────────────────────────────────

function Header({ data }: { data: TodayScreenData }) {
  return (
    <View>
      <Text variant="heading">Bonjour, {data.athleteFirstName}</Text>
      <Text variant="caption" weight="medium" className="mt-0.5 text-[13px] capitalize">
        {formatDayAndMonthFr(data.date)}
      </Text>
    </View>
  );
}

function TodayCard({ today }: { today: TodayState }) {
  const palette = usePalette();
  const goToSession = () => router.push(SESSION_ROUTE);

  switch (today.state) {
    case "scheduled":
    case "in-progress": {
      const inProgress = today.state === "in-progress";
      return (
        <Card stripe className="gap-3">
          <View className="flex-row items-center justify-between">
            <SectionLabel className="text-accent">{COPY.today}</SectionLabel>
            {inProgress ? <Pill variant="active" label={COPY.inProgress} /> : null}
          </View>
          <SessionTitle session={today.session} />
          <SessionPills session={today.session} />
          <Button
            title={inProgress ? COPY.resumeCta : COPY.startCta}
            icon={<Ionicons name="arrow-forward" size={18} color={palette.btnPrimaryText} />}
            onPress={goToSession}
            className="mt-1"
          />
        </Card>
      );
    }

    case "completed":
      return (
        <Card className="gap-3">
          <View className="flex-row items-center justify-between">
            <SectionLabel>{COPY.today}</SectionLabel>
            <Pill variant="accent" label={COPY.completed} />
          </View>
          <SessionTitle session={today.session} />
          <View className="flex-row flex-wrap gap-2">
            {today.log.durationMinutes !== null ? (
              <Pill label={formatDurationFr(today.log.durationMinutes)} />
            ) : null}
            <Pill label={`${today.log.loggedSetCount} séries`} />
          </View>
        </Card>
      );

    case "skipped":
      return (
        <Card className="gap-3">
          <View className="flex-row items-center justify-between">
            <SectionLabel>{COPY.today}</SectionLabel>
            <Pill label={COPY.skipped} />
          </View>
          <SessionTitle session={today.session} />
          <Text variant="caption" className="text-[13px]">
            {COPY.skippedBody}
          </Text>
        </Card>
      );

    case "rest-day":
      return (
        <Card className="gap-2">
          <SectionLabel>{COPY.today}</SectionLabel>
          <Text weight="bold" className="text-lg tracking-[-0.3px]">
            {COPY.restTitle}
          </Text>
          <Text variant="caption" className="text-[13px]">
            {today.nextSession
              ? `Prochaine séance : ${today.nextSession.name}, ${dayNameFr(today.nextSession.dayOfWeek)}`
              : COPY.restNone}
          </Text>
        </Card>
      );

    case "no-active-program":
      return (
        <Card className="gap-3">
          <SectionLabel>{COPY.today}</SectionLabel>
          <Text weight="bold" className="text-lg tracking-[-0.3px]">
            {COPY.noProgramTitle}
          </Text>
          <Text variant="caption" className="text-[13px]">
            {COPY.noProgramBody}
          </Text>
          <Button
            title={COPY.noProgramCta}
            variant="secondary"
            onPress={() => router.push(PLAN_ROUTE)}
            className="mt-1"
          />
        </Card>
      );
  }
}

function SessionTitle({ session }: { session: PlannedSession }) {
  return (
    <Text weight="bold" className="text-lg tracking-[-0.3px]">
      {session.name}
    </Text>
  );
}

function SessionPills({ session }: { session: PlannedSession }) {
  return (
    <View className="flex-row flex-wrap gap-2">
      <Pill label={`${session.exercises.length} exercices`} />
      {session.estimatedDurationMinutes !== null ? (
        <Pill label={`~${formatDurationFr(session.estimatedDurationMinutes)}`} />
      ) : null}
      {session.coachFirstName ? <Pill label={`Coach ${session.coachFirstName}`} /> : null}
    </View>
  );
}

function WeekSection({ week }: { week: WeekSummary }) {
  const ratio = week.scheduledCount > 0 ? (week.completedCount / week.scheduledCount) * 100 : 0;

  return (
    <View className="gap-3.5">
      <View className="flex-row items-baseline justify-between">
        <SectionLabel>Ta semaine</SectionLabel>
        <Text variant="caption" weight="semibold">
          <Text mono weight="medium" className="text-xs text-text">
            {week.completedCount}/{week.scheduledCount}
          </Text>{" "}
          séances complétées
        </Text>
      </View>
      <View className="flex-row justify-between">
        {week.days.map((day) => (
          <DayDot key={day.dayOfWeek} day={day} />
        ))}
      </View>
      <LinearProgress value={ratio} />
    </View>
  );
}

const DOT_FILL: Record<WeekDayState, string> = {
  completed: "bg-accent",
  started: "bg-accent-dim",
  skipped: "bg-surface2",
  upcoming: "",
  rest: "",
};

function DayDot({ day }: { day: WeekDay }) {
  const palette = usePalette();
  const done = day.state === "completed";

  const width = day.isToday ? "border-2" : done ? "" : "border";
  const colour = day.isToday || day.state === "started" ? "border-accent" : "border-border";
  const dashed = day.state === "rest" && !day.isToday ? "border-dashed" : "";
  const fill = DOT_FILL[day.state];
  const label = done ? "text-btn-primary-text" : day.isToday ? "text-accent" : "text-text-muted";

  return (
    <View
      accessibilityLabel={`${dayNameFr(day.dayOfWeek)} : ${day.state}`}
      className={`h-[38px] w-[38px] items-center justify-center rounded-full ${fill} ${width} ${colour} ${dashed}`}
    >
      {done ? (
        <Ionicons name="checkmark" size={16} color={palette.btnPrimaryText} />
      ) : (
        <Text weight="bold" className={`text-[13px] ${label}`}>
          {dayInitialFr(day.dayOfWeek)}
        </Text>
      )}
    </View>
  );
}

function LastSessionCard({ last }: { last: LastSessionSummary }) {
  const day = dayNameFr(new Date(last.completedAt).getDay() || 7);

  return (
    <View className="gap-2.5">
      <SectionLabel>Dernière séance</SectionLabel>
      <Card className="gap-3">
        <Text weight="bold" className="text-[15px] capitalize">
          {day} — {last.name}
        </Text>
        <View className="flex-row gap-4">
          <Stat value={last.exerciseCount} label="exercices" />
          {last.durationMinutes !== null ? <Stat value={last.durationMinutes} label="min" /> : null}
          <Stat value={last.prCount} label="PRs" accent />
        </View>
      </Card>
    </View>
  );
}

function Stat({ value, label, accent = false }: { value: number; label: string; accent?: boolean }) {
  return (
    <Text
      variant="caption"
      weight={accent ? "bold" : "medium"}
      className={`text-[13px] ${accent ? "text-accent" : ""}`}
    >
      <Text mono weight="medium" className={`text-[13px] ${accent ? "text-accent" : "text-text"}`}>
        {value}
      </Text>{" "}
      {label}
    </Text>
  );
}
