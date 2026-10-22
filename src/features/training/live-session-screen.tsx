import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import { useRouter } from "expo-router";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import { useTodaySession } from "@/hooks/use-today-session";
import { useWorkoutSession } from "@/hooks/use-workout-session";
import { useAuth } from "@/providers/auth-provider";
import type { PrescribedExercise } from "@/types/today-screen";
import { formatDurationFr } from "@/utils/format-date-fr";

import {
  currentExercise,
  isExerciseComplete,
  nextSetNumber,
  setsLoggedFor,
  WEIGHT_STEP_KG,
  type WorkoutExercise,
} from "./workout-state";

/**
 * Live workout logging (cm#25).
 *
 * The interaction model comes straight from the wireframe: one set at a time, a
 * large rep counter driven by thumb-sized +/- controls, a weight stepper, and a
 * single validate button. Everything else is secondary. The target is three
 * seconds per set, one-handed.
 *
 * The screen holds no rules. Every decision lives in the reducer
 * (workout-state.ts) and the queue (set-queue.ts), both of which are tested
 * without rendering anything.
 */
export function LiveSessionScreen() {
  const router = useRouter();
  const { state: auth } = useAuth();
  const { state: today } = useTodaySession();

  const athleteId = auth.status === "ready" ? auth.profile.id : "";

  const plan = useMemo(() => {
    if (today.status !== "ready" && today.status !== "refreshing") return null;
    const state = today.data.today;
    if (state.state === "no-active-program" || state.state === "rest-day") return null;
    return state.session;
  }, [today]);

  const exercises = useMemo<WorkoutExercise[]>(
    () => (plan ? plan.exercises.map(toWorkoutExercise) : []),
    [plan],
  );

  if (today.status === "loading") {
    return <Centered><ActivityIndicator size="large" color="#3b82f6" /></Centered>;
  }

  if (today.status === "error") {
    return (
      <Centered>
        <Text variant="heading" className="text-center text-xl">Chargement impossible</Text>
        <Text variant="body" className="text-center">
          {today.failure.kind === "unauthenticated"
            ? "Reconnecte-toi pour démarrer ta séance."
            : "Vérifie ta connexion et réessaie."}
        </Text>
      </Centered>
    );
  }

  if (!plan || exercises.length === 0) {
    return (
      <Centered>
        <Text variant="heading" className="text-center text-xl">Aucune séance à logger</Text>
        <Text variant="body" className="text-center">
          Rien n&apos;est planifié pour aujourd&apos;hui, ou la séance n&apos;a pas d&apos;exercice.
        </Text>
        <Button title="Retour" variant="outline" onPress={() => router.back()} className="w-full" />
      </Centered>
    );
  }

  return (
    <ActiveWorkout
      sessionId={plan.sessionId}
      sessionName={plan.name}
      athleteId={athleteId}
      exercises={exercises}
    />
  );
}

function toWorkoutExercise(e: PrescribedExercise): WorkoutExercise {
  // The heaviest set of the last session is the useful anchor for the weight
  // stepper; the reps of that same set seed the counter when the prescription
  // carries no number.
  const heaviest = e.lastPerformance?.sets.reduce<{ weightKg: number | null; reps: number | null }>(
    (best, s) =>
      (s.weightKg ?? -1) > (best.weightKg ?? -1)
        ? { weightKg: s.weightKg, reps: s.repsCompleted }
        : best,
    { weightKg: null, reps: null },
  );

  return {
    sessionExerciseId: e.sessionExerciseId,
    exerciseId: e.exerciseId,
    name: e.name,
    // A prescription with no set count still means one set, not zero.
    targetSets: e.sets ?? 1,
    targetReps: e.reps,
    restSeconds: e.restSeconds,
    lastWeightKg: heaviest?.weightKg ?? null,
    lastReps: heaviest?.reps ?? null,
  };
}

function ActiveWorkout({
  sessionId,
  sessionName,
  athleteId,
  exercises,
}: {
  sessionId: string;
  sessionName: string;
  athleteId: string;
  exercises: WorkoutExercise[];
}) {
  const router = useRouter();
  const {
    state,
    status,
    pendingCount,
    rejectedCount,
    discardRejected,
    startedAt,
    dispatch,
    validateSet,
    finish,
    retryPending,
  } = useWorkoutSession({ sessionId, athleteId, exercises });

  const elapsed = useElapsedMinutes(startedAt);
  const exercise = currentExercise(state);
  const done = exercise ? setsLoggedFor(state.logged, exercise.exerciseId) : [];

  if (status.status === "starting") {
    return <Centered><ActivityIndicator size="large" color="#3b82f6" /></Centered>;
  }

  if (status.status === "finished") {
    return (
      <Centered>
        <Text variant="heading" className="text-center text-xl">Séance terminée</Text>
        <Text variant="body" className="text-center">
          {state.logged.length} série{state.logged.length === 1 ? "" : "s"} enregistrée
          {state.logged.length === 1 ? "" : "s"}.
        </Text>
        <Button title="Retour à l'accueil" onPress={() => router.replace("/(athlete)")} className="w-full" />
      </Centered>
    );
  }

  if (!exercise) return <Centered><Text variant="body">Aucun exercice.</Text></Centered>;

  return (
    <ScrollView
      className="flex-1 bg-gray-50 dark:bg-gray-900"
      contentContainerClassName="pb-10"
    >
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 pt-4">
        <View>
          <Text variant="caption" className="uppercase">{sessionName}</Text>
          <Text variant="body" className="font-semibold">
            Exercice {state.currentIndex + 1} / {state.exercises.length}
            {elapsed === null ? "" : ` · ${formatDurationFr(elapsed)}`}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Quitter la séance"
          onPress={() => router.back()}
          className="rounded-full bg-gray-200 px-4 py-2 dark:bg-gray-700"
        >
          <Text variant="caption" className="font-semibold">Quitter</Text>
        </Pressable>
      </View>

      {/* Unsent sets. Shown as reassurance, not as an error: the sets are safe
          on disk and will go out on their own. */}
      {pendingCount > 0 ? (
        <Pressable onPress={retryPending} className="mx-4 mt-3 rounded-xl bg-amber-100 p-3 dark:bg-amber-900/40">
          <Text variant="caption" className="text-amber-900 dark:text-amber-100">
            {pendingCount} série{pendingCount === 1 ? "" : "s"} en attente d&apos;envoi. Elles sont
            enregistrées sur ton appareil — touche pour réessayer maintenant.
          </Text>
        </Pressable>
      ) : null}

      {/* Refused sets: never dropped silently. The athlete corrects them (a new
          value for the same set replaces it) or chooses to remove them. */}
      {rejectedCount > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Retirer ${rejectedCount} série(s) refusée(s)`}
          onPress={discardRejected}
          className="mx-4 mt-3 rounded-xl bg-red-100 p-3 dark:bg-red-900/40"
        >
          <Text variant="caption" className="text-red-900 dark:text-red-100">
            {rejectedCount} série{rejectedCount === 1 ? "" : "s"} refusée
            {rejectedCount === 1 ? "" : "s"} par le serveur. Corrige-la ou touche ici pour la retirer.
          </Text>
        </Pressable>
      ) : null}

      {status.status === "error" ? (
        <View className="mx-4 mt-3 rounded-xl bg-red-100 p-3 dark:bg-red-900/40">
          <Text variant="caption" className="text-red-900 dark:text-red-100">{status.message}</Text>
        </View>
      ) : null}

      {/* Exercise */}
      <View className="px-4 pt-4">
        <Card className="gap-1 p-4">
          <Text variant="heading" className="text-xl">{exercise.name}</Text>
          <Text variant="caption">
            Série {nextSetNumber(state)} / {exercise.targetSets}
            {exercise.targetReps ? ` · cible ${exercise.targetReps}` : ""}
          </Text>
          <View className="mt-2 flex-row gap-1.5">
            {Array.from({ length: exercise.targetSets }, (_unused, i) => (
              <View
                key={i}
                className={`h-2 flex-1 rounded-full ${
                  i < done.length ? "bg-blue-500" : "bg-gray-200 dark:bg-gray-700"
                }`}
              />
            ))}
          </View>
        </Card>
      </View>

      {/* Rep counter — the primary control */}
      <View className="items-center gap-3 px-4 pt-8">
        <Text variant="caption" className="uppercase">Répétitions</Text>
        <View className="flex-row items-center gap-7">
          <StepButton label="Une répétition de moins" onPress={() => dispatch({ type: "adjust-reps", delta: -1 })} symbol="−" />
          <Text variant="heading" className="min-w-[90px] text-center text-6xl">{state.draft.reps}</Text>
          <StepButton label="Une répétition de plus" onPress={() => dispatch({ type: "adjust-reps", delta: 1 })} symbol="+" primary />
        </View>

        {/* Weight */}
        <View className="mt-2 flex-row items-center gap-3 rounded-full border border-gray-300 px-3 py-2 dark:border-gray-700">
          <StepButton small label="Moins de poids" onPress={() => dispatch({ type: "adjust-weight", delta: -WEIGHT_STEP_KG })} symbol="−" />
          <Text variant="body" className="min-w-[80px] text-center font-semibold">
            {state.draft.weightKg === null ? "—" : `${state.draft.weightKg} kg`}
          </Text>
          <StepButton small label="Plus de poids" onPress={() => dispatch({ type: "adjust-weight", delta: WEIGHT_STEP_KG })} symbol="+" />
        </View>

        {exercise.lastWeightKg !== null ? (
          <Text variant="caption">
            Dernière perf : {exercise.lastReps ?? "?"} reps à {exercise.lastWeightKg} kg
          </Text>
        ) : null}
      </View>

      {/* Sets already logged for this exercise */}
      {done.length > 0 ? (
        <View className="gap-2 px-4 pt-6">
          {done.map((s) => (
            <View key={s.setNumber} className="flex-row items-center justify-between rounded-xl bg-white px-4 py-2 dark:bg-gray-800">
              <Text variant="caption">Série {s.setNumber}</Text>
              <Text variant="body" className="font-semibold">
                {s.repsCompleted} reps{s.weightKg === null ? "" : ` · ${s.weightKg} kg`}
              </Text>
            </View>
          ))}
          <Pressable accessibilityRole="button" onPress={() => dispatch({ type: "undo-last-set" })} className="self-end py-2">
            <Text variant="caption" className="font-semibold text-blue-600 dark:text-blue-400">
              Annuler la dernière série
            </Text>
          </Pressable>
        </View>
      ) : null}

      {/* Actions */}
      <View className="gap-3 px-4 pt-8">
        <Button title="Série terminée" onPress={validateSet} className="h-14" />

        <View className="flex-row gap-3">
          <View className="flex-1">
            <Button
              title="Exercice précédent"
              variant="outline"
              disabled={state.currentIndex === 0}
              onPress={() => dispatch({ type: "previous-exercise" })}
            />
          </View>
          <View className="flex-1">
            <Button
              title={isExerciseComplete(state, state.currentIndex) ? "Exercice suivant ✓" : "Exercice suivant"}
              variant="outline"
              disabled={state.currentIndex >= state.exercises.length - 1}
              onPress={() => dispatch({ type: "next-exercise" })}
            />
          </View>
        </View>

        <Button
          title="Terminer la séance"
          variant="secondary"
          loading={status.status === "finishing"}
          onPress={() => void finish()}
        />
      </View>
    </ScrollView>
  );
}

/**
 * Elapsed minutes since the session opened, refreshed once a minute.
 *
 * Derived from `started_at` rather than from a counter started on mount: the
 * screen can be reopened mid-session, and a counter would restart from zero
 * while the session did not.
 */
function useElapsedMinutes(startedAt: string | null): number | null {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  if (startedAt === null) return null;
  const started = Date.parse(startedAt);
  if (Number.isNaN(started)) return null;
  return Math.max(0, Math.floor((now - started) / 60_000));
}

function StepButton({
  symbol,
  label,
  onPress,
  primary = false,
  small = false,
}: {
  symbol: string;
  label: string;
  onPress: () => void;
  primary?: boolean;
  small?: boolean;
}) {
  // 52pt for the primary controls: the wireframe's size, and comfortably above
  // the 44pt minimum touch target, because these are pressed with a thumb while
  // holding a barbell.
  const size = small ? "h-8 w-8" : "h-[52px] w-[52px]";
  const background = primary
    ? "bg-blue-600 dark:bg-blue-500"
    : "bg-white border border-gray-300 dark:bg-gray-800 dark:border-gray-700";
  const colour = primary ? "text-white" : "text-gray-900 dark:text-white";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      className={`${size} ${background} items-center justify-center rounded-full active:opacity-70`}
    >
      <Text variant="body" className={`${colour} ${small ? "text-base" : "text-2xl"} font-bold`}>
        {symbol}
      </Text>
    </Pressable>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <View className="flex-1 items-center justify-center gap-4 bg-gray-50 px-8 dark:bg-gray-900">
      {children}
    </View>
  );
}
