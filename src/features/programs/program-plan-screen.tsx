import { useMemo } from "react";
import { ActivityIndicator, Pressable, RefreshControl, SectionList, View } from "react-native";
import { useRouter } from "expo-router";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import { useProgramPlan } from "@/hooks/use-program-plan";
import type { Difficulty, PlanSession, PlanWeek, ProgramPlan } from "@/types/program-plan";
import {
  dayNameFr,
  formatDateRangeFr,
  formatDurationFr,
} from "@/utils/format-date-fr";

import { SessionStateBadge } from "./session-state-badge";

const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  beginner: "Débutant",
  intermediate: "Intermédiaire",
  advanced: "Avancé",
};

/**
 * The athlete's full training plan (cm#23).
 *
 * A SectionList rather than a ScrollView: a 12-week program is 12 sections and
 * up to ~50 rows, and the sticky week header is what keeps the athlete oriented
 * while scrolling. A ScrollView would mount every row up front.
 *
 * All four states are explicit -- loading, error, empty, content -- as required
 * by the project conventions, and every colour pair carries a dark variant.
 */
export function ProgramPlanScreen() {
  const { state, refetch } = useProgramPlan();

  if (state.status === "loading") {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50 dark:bg-gray-900">
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  if (state.status === "error") {
    return <PlanError kind={state.failure.kind} onRetry={refetch} />;
  }

  if (state.plan.kind === "no-active-program") {
    return <NoProgram />;
  }

  return (
    <PlanContent
      plan={state.plan.plan}
      refreshing={state.status === "refreshing"}
      onRefresh={refetch}
    />
  );
}

// ── Error ────────────────────────────────────────────────────────────────────

function PlanError({
  kind,
  onRetry,
}: {
  kind: "unauthenticated" | "network";
  onRetry: () => void;
}) {
  return (
    <View className="flex-1 items-center justify-center gap-4 bg-gray-50 px-8 dark:bg-gray-900">
      <Text variant="heading" className="text-center text-xl">
        {kind === "unauthenticated" ? "Session expirée" : "Chargement impossible"}
      </Text>
      <Text variant="body" className="text-center">
        {kind === "unauthenticated"
          ? "Reconnecte-toi pour voir ton plan."
          : "On n'a pas réussi à charger ton plan. Vérifie ta connexion et réessaie."}
      </Text>
      {kind === "network" ? (
        <Button title="Réessayer" onPress={onRetry} className="w-full" />
      ) : null}
    </View>
  );
}

// ── Empty ────────────────────────────────────────────────────────────────────

function NoProgram() {
  return (
    <View className="flex-1 items-center justify-center gap-4 bg-gray-50 px-8 dark:bg-gray-900">
      <Text variant="heading" className="text-center text-xl">
        Aucun programme en cours
      </Text>
      <Text variant="body" className="text-center">
        Choisis un programme dans la bibliothèque Cadence et il apparaîtra ici, semaine par
        semaine.
      </Text>
      {/*
        The button that starts a template belongs to cm#79, which is not built
        yet. Showing a disabled control would be worse than showing none: it
        promises something that does nothing. The copy above already says what to
        do.
      */}
    </View>
  );
}

// ── Content ──────────────────────────────────────────────────────────────────

function PlanContent({
  plan,
  refreshing,
  onRefresh,
}: {
  plan: ProgramPlan;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const sections = useMemo(
    () => plan.weeks.map((week) => ({ week, data: week.sessions })),
    [plan.weeks],
  );

  // Deliberately NOT auto-scrolling to the current week. SectionList's
  // initialScrollIndex counts headers and rows in one flat sequence, and
  // without getItemLayout VirtualizedList can throw when the target has not
  // been measured yet. Scrolling to the current week is worth doing, but it
  // needs measured row heights -- left out rather than shipped as a crash. The
  // sticky header keeps the athlete oriented in the meantime.
  return (
    <SectionList
      className="flex-1 bg-gray-50 dark:bg-gray-900"
      contentContainerClassName="pb-8"
      sections={sections}
      keyExtractor={(session, index) => `${session.sessionId}-${index}`}
      stickySectionHeadersEnabled
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />
      }
      ListHeaderComponent={<PlanHeader plan={plan} />}
      renderSectionHeader={({ section }) => <WeekHeader week={section.week} />}
      renderItem={({ item }) => <SessionRow session={item} />}
      renderSectionFooter={({ section }) =>
        section.data.length === 0 ? <EmptyWeek /> : null
      }
    />
  );
}

function PlanHeader({ plan }: { plan: ProgramPlan }) {
  const progress =
    plan.totalSessions === 0
      ? 0
      : Math.round((plan.completedSessions / plan.totalSessions) * 100);

  return (
    <View className="gap-3 px-4 pb-2 pt-4">
      <Text variant="heading">{plan.name}</Text>

      {plan.description ? <Text variant="body">{plan.description}</Text> : null}

      <View className="flex-row flex-wrap gap-2">
        {plan.goal ? <Tag label={plan.goal} /> : null}
        {plan.difficulty ? <Tag label={DIFFICULTY_LABEL[plan.difficulty]} /> : null}
        <Tag label={`${plan.weeks.length} semaines`} />
      </View>

      <Card className="gap-2 p-4">
        <View className="flex-row items-baseline justify-between">
          <Text variant="caption" className="font-semibold uppercase">
            Progression
          </Text>
          <Text variant="body" className="font-semibold">
            {plan.completedSessions} / {plan.totalSessions} séances
          </Text>
        </View>
        <View className="h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
          <View className="h-full rounded-full bg-blue-500" style={{ width: `${progress}%` }} />
        </View>
      </Card>
    </View>
  );
}

function Tag({ label }: { label: string }) {
  return (
    <View className="rounded-full bg-gray-200 px-3 py-1 dark:bg-gray-700">
      <Text variant="caption" className="text-xs font-medium">
        {label}
      </Text>
    </View>
  );
}

function WeekHeader({ week }: { week: PlanWeek }) {
  return (
    <View
      className={`flex-row items-center justify-between border-b px-4 py-2 ${
        week.isCurrent
          ? "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950"
          : "border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900"
      }`}
    >
      <View>
        <Text variant="body" className="font-bold">
          Semaine {week.weekNumber}
          {week.isCurrent ? " · en cours" : ""}
        </Text>
        <Text variant="caption">{formatDateRangeFr(week.startDate, week.endDate)}</Text>
      </View>
      {week.sessions.length > 0 ? (
        <Text variant="caption">
          {week.completedCount}/{week.sessions.length}
        </Text>
      ) : null}
    </View>
  );
}

function SessionRow({ session }: { session: PlanSession }) {
  const router = useRouter();
  const details = [
    session.dayOfWeek === null ? null : dayNameFr(session.dayOfWeek),
    `${session.exerciseCount} exercice${session.exerciseCount === 1 ? "" : "s"}`,
    session.estimatedDurationMinutes === null
      ? null
      : formatDurationFr(session.estimatedDurationMinutes),
  ].filter((d): d is string => d !== null);

  // Only today's session is actionable. Making every row tappable would
  // suggest an athlete can log Friday's workout on Monday, which the schema
  // allows but the product should not invite.
  const startable = session.state === "today";

  const card = (
    <Card className="flex-row items-center gap-3 p-4">
      <View className="flex-1 gap-1">
        <Text variant="body" className="font-semibold">
          {session.name}
        </Text>
        <Text variant="caption">{details.join(" · ")}</Text>
        {startable ? (
          <Text variant="caption" className="font-semibold text-blue-600 dark:text-blue-400">
            Toucher pour démarrer
          </Text>
        ) : null}
      </View>
      <SessionStateBadge state={session.state} />
    </Card>
  );

  return (
    <View className="px-4 pt-3">
      {startable ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Démarrer ${session.name}`}
          onPress={() => router.push("/(athlete)/session")}
          className="active:opacity-80"
        >
          {card}
        </Pressable>
      ) : (
        card
      )}
    </View>
  );
}

function EmptyWeek() {
  return (
    <View className="px-4 pt-3">
      <Card className="p-4">
        <Text variant="caption">
          Aucune séance planifiée cette semaine. Le programme la laisse libre — ou elle reste à
          remplir.
        </Text>
      </Card>
    </View>
  );
}
