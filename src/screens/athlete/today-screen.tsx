import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LinearProgress } from "@/components/ui/linear-progress";
import { Pill } from "@/components/ui/pill";
import { SectionLabel } from "@/components/ui/section-label";
import { Text } from "@/components/ui/text";
import { useTodaySession, type OfflineInfo } from "@/hooks/use-today-session";
import { usePalette } from "@/theme/tokens";
import type {
  LastSessionSummary,
  PlannedSession,
  ScheduleOutlook,
  TodayScreenData,
  TodayState,
  WeekDay,
  WeekSession,
  WeekSummary,
} from "@/types/today-screen";
import {
  dayInitialFr,
  dayNameFr,
  formatDayAndMonthFr,
  formatDurationFr,
} from "@/utils/format-date-fr";
import { isoDayOfWeek } from "@/utils/program-schedule";
import { dayAccessibilityLabel, stripState, type StripState } from "@/utils/week-strip";

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
  finishedTitle: "Programme terminé",
  finishedBody: "Tu as fait toutes les séances prévues. Choisis un programme pour continuer.",
  noProgramTitle: "Aucun programme en cours",
  noProgramBody: "Choisis un programme et ta séance du jour apparaîtra ici.",
  noProgramCta: "Voir le programme",
  offline: "Hors ligne",
  dayRest: "Rien de prévu ce jour-là.",
  backToToday: "Revenir à aujourd'hui",
} as const;

// ── Screen ───────────────────────────────────────────────────────────────────

export function AthleteTodayScreen() {
  const { state, refetch } = useTodaySession();
  const palette = usePalette();
  // Day touched in the week strip (story 4.3); null shows today's card.
  const [selectedDow, setSelectedDow] = useState<number | null>(null);

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
        <Header data={state.data} offline={state.offline} />
        {selectedDow === null || selectedDow === isoDayOfWeek(state.data.date) ? (
          <TodayCard today={state.data.today} outlook={state.data.outlook ?? null} />
        ) : (
          <DayCard
            dayOfWeek={selectedDow}
            session={findWeekSession(state.data.outlook ?? null, selectedDow)}
            onBack={() => setSelectedDow(null)}
          />
        )}
        <WeekSection
          week={state.data.week}
          todayDow={isoDayOfWeek(state.data.date)}
          selectedDow={selectedDow}
          onSelect={(dow) => setSelectedDow(dow === isoDayOfWeek(state.data.date) ? null : dow)}
        />
        {state.data.lastSession ? <LastSessionCard last={state.data.lastSession} /> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Blocks ───────────────────────────────────────────────────────────────────

function Header({ data, offline }: { data: TodayScreenData; offline?: OfflineInfo }) {
  return (
    <View className="flex-row items-start justify-between gap-3">
      <View className="flex-1">
        <Text variant="heading">Bonjour, {data.athleteFirstName}</Text>
        <Text variant="caption" weight="medium" className="mt-0.5 text-[13px] capitalize">
          {formatDayAndMonthFr(data.date)}
        </Text>
      </View>
      {offline ? (
        <Pill
          label={COPY.offline}
          accessibilityLabel={`${COPY.offline}. Dernière séance connue, mise à jour ${formatSavedAt(offline.savedAt)}.`}
        />
      ) : null}
    </View>
  );
}

function formatSavedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "plus tôt";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `le ${formatDayAndMonthFr(localIso(d))} à ${hh} h ${mm}`;
}

function localIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function findWeekSession(outlook: ScheduleOutlook | null, dow: number): WeekSession | null {
  return outlook?.weekSessions.find((w) => w.dayOfWeek === dow) ?? null;
}

function TodayCard({ today, outlook }: { today: TodayState; outlook: ScheduleOutlook | null }) {
  const palette = usePalette();
  const goToSession = () => router.push(SESSION_ROUTE);

  switch (today.state) {
    case "scheduled":
    case "in-progress": {
      const inProgress = today.state === "in-progress";
      return (
        <Card
          stripe
          className="gap-3"
          accessible={false}
        >
          <View
            className="flex-row items-center justify-between"
            accessible
            accessibilityLabel={sessionSpokenSummary(today.session)}
          >
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

    case "rest-day": {
      // The outlook (migration 012) looks past the end of the week; without it,
      // fall back to get_today_screen()'s "later this week".
      const finished = outlook?.programFinished === true;
      const next = outlook
        ? outlook.nextSession
          ? { name: outlook.nextSession.name, when: nextSessionWhen(outlook.nextSession) }
          : null
        : today.nextSession
          ? { name: today.nextSession.name, when: dayNameFr(today.nextSession.dayOfWeek) }
          : null;

      if (finished) {
        return (
          <Card className="gap-3" accessible accessibilityLabel={`${COPY.finishedTitle}. ${COPY.finishedBody}`}>
            <SectionLabel>{COPY.today}</SectionLabel>
            <Text weight="bold" className="text-lg tracking-[-0.3px]">
              {COPY.finishedTitle}
            </Text>
            <Text variant="caption" className="text-[13px]">
              {COPY.finishedBody}
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

      const nextLine = next ? `Prochaine séance : ${next.when}` : COPY.restNone;
      return (
        <Card
          className="gap-2"
          accessible
          accessibilityLabel={`${COPY.restTitle}. ${nextLine}${next ? `, ${next.name}` : ""}.`}
        >
          <SectionLabel>{COPY.today}</SectionLabel>
          <Text weight="bold" className="text-lg tracking-[-0.3px]">
            {COPY.restTitle}
          </Text>
          <Text variant="caption" weight="semibold" className="text-[13px]">
            {nextLine}
          </Text>
          {next ? (
            <Text variant="caption" className="text-[13px]">
              {next.name}
            </Text>
          ) : null}
        </Card>
      );
    }

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

/** « jeudi » this week, « mardi 25 août » further away. */
function nextSessionWhen(next: { date: string; dayOfWeek: number }): string {
  const daysAway = Math.round(
    (Date.parse(`${next.date}T00:00:00`) - Date.parse(`${localIso(new Date())}T00:00:00`)) / 86_400_000,
  );
  return daysAway > 0 && daysAway < 7 ? dayNameFr(next.dayOfWeek) : formatDayAndMonthFr(next.date);
}

function sessionSpokenSummary(session: PlannedSession): string {
  const duration =
    session.estimatedDurationMinutes !== null
      ? `, environ ${formatDurationFr(session.estimatedDurationMinutes)}`
      : "";
  return `Aujourd'hui : ${session.name}, ${session.exercises.length} exercices${duration}`;
}

/** A day touched in the week strip (story 4.3): what is planned that day. */
function DayCard({
  dayOfWeek,
  session,
  onBack,
}: {
  dayOfWeek: number;
  session: WeekSession | null;
  onBack: () => void;
}) {
  return (
    <Card className="gap-3">
      <SectionLabel>{dayNameFr(dayOfWeek)}</SectionLabel>
      {session ? (
        <>
          <Text weight="bold" className="text-lg tracking-[-0.3px]">
            {session.name}
          </Text>
          <View className="flex-row flex-wrap gap-2">
            <Pill label={`${session.exerciseCount} exercices`} />
            {session.estimatedDurationMinutes !== null ? (
              <Pill label={`~${formatDurationFr(session.estimatedDurationMinutes)}`} />
            ) : null}
          </View>
        </>
      ) : (
        <Text variant="caption" className="text-[13px]">
          {COPY.dayRest}
        </Text>
      )}
      <Button title={COPY.backToToday} variant="outline" onPress={onBack} className="mt-1" />
    </Card>
  );
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

function WeekSection({
  week,
  todayDow,
  selectedDow,
  onSelect,
}: {
  week: WeekSummary;
  todayDow: number;
  selectedDow: number | null;
  onSelect: (dow: number) => void;
}) {
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
          <DayDot
            key={day.dayOfWeek}
            day={day}
            todayDow={todayDow}
            selected={selectedDow === day.dayOfWeek}
            onPress={() => onSelect(day.dayOfWeek)}
          />
        ))}
      </View>
      <LinearProgress value={ratio} />
    </View>
  );
}

// Same shapes as design/final/athlete/accueil (done: filled + check, today:
// 2px accent ring, rest: dashed, future: thin ring). Missed, skipped and started
// carry their own symbol so every state reads without colour (story 4.3).
const DOT_FILL: Record<StripState, string> = {
  completed: "bg-accent",
  started: "bg-accent-dim",
  skipped: "bg-surface2",
  missed: "bg-surface2",
  upcoming: "",
  rest: "",
};

const DOT_ICON: Partial<Record<StripState, keyof typeof Ionicons.glyphMap>> = {
  completed: "checkmark",
  started: "play",
  skipped: "remove",
  missed: "close",
};

function DayDot({
  day,
  todayDow,
  selected,
  onPress,
}: {
  day: WeekDay;
  todayDow: number;
  selected: boolean;
  onPress: () => void;
}) {
  const palette = usePalette();
  const state = stripState(day, todayDow);
  const done = state === "completed";
  const ringed = day.isToday || selected;

  const width = ringed ? "border-2" : done ? "" : "border";
  const colour = ringed || state === "started" ? "border-accent" : "border-border";
  const dashed = state === "rest" && !ringed ? "border-dashed" : "";
  // eslint-disable-next-line security/detect-object-injection -- state is a typed union
  const fill = DOT_FILL[state];
  // eslint-disable-next-line security/detect-object-injection -- state is a typed union
  const icon = DOT_ICON[state];
  const label = done ? "text-btn-primary-text" : ringed ? "text-accent" : "text-text-muted";
  const iconColour = done ? palette.btnPrimaryText : state === "started" ? palette.accent : palette.textMuted;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={dayAccessibilityLabel(day, todayDow)}
      accessibilityState={{ selected }}
      onPress={onPress}
      // 38 pt drawn as in the design, 44 pt touchable (story 4.3 quality bar).
      hitSlop={3}
      className="h-11 w-11 items-center justify-center"
    >
      <View
        className={`h-[38px] w-[38px] items-center justify-center rounded-full ${fill} ${width} ${colour} ${dashed}`}
      >
        {icon ? (
          <Ionicons name={icon} size={16} color={iconColour} />
        ) : (
          <Text weight="bold" className={`text-[13px] ${label}`}>
            {dayInitialFr(day.dayOfWeek)}
          </Text>
        )}
      </View>
    </Pressable>
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
