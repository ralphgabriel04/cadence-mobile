import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, PanResponder, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { useRestTimer } from "@/hooks/use-rest-timer";
import { useTodaySession } from "@/hooks/use-today-session";
import { useWorkoutSession } from "@/hooks/use-workout-session";
import { useAuth } from "@/providers/auth-provider";
import { createLocalStore } from "@/services/local-store";
import { usePalette } from "@/theme/tokens";
import type { PrescribedExercise } from "@/types/today-screen";

import {
  ConfirmOverlay,
  ExerciseCard,
  ExerciseRecapRow,
  NextUpCard,
  RecapStat,
  RestRing,
  RpePicker,
  SessionTopBar,
  SetDots,
  SetSummaryRow,
  StatTile,
  StepButton,
  WorkoutProgress,
} from "./live-session-parts";
import { DEFAULT_REST_SECONDS, REST_ADJUST_SECONDS } from "./rest-timer";
import {
  exerciseRecap,
  formatElapsed,
  formatKg,
  formatWeight,
  sessionRecap,
} from "./session-recap";
import {
  completedExerciseCount,
  currentExercise,
  draftProblem,
  isExerciseComplete,
  nextSetNumber,
  parsePrescribedWeight,
  parseTargetReps,
  remainingSets,
  setsLoggedFor,
  WEIGHT_STEP_KG,
  type LoggedSet,
  type WorkoutExercise,
} from "./workout-state";

/**
 * Live session (epic 5), after design/wireframe/athlete/session-live/musculation:
 *   1. série en cours  2. repos  3. résumé d'exercice  4. séance terminée.
 *
 * The screen holds no rules: the reducer (workout-state.ts), the queue
 * (set-queue.ts) and the session hook decide; this file only renders and
 * routes between the four views.
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
    [plan]
  );

  if (today.status === "loading") {
    return (
      <Centered>
        <Spinner />
      </Centered>
    );
  }

  if (today.status === "error") {
    return (
      <Centered>
        <Text variant="heading" className="text-center text-xl">
          Chargement impossible
        </Text>
        <Text variant="body" className="text-center">
          {today.failure.kind === "unauthenticated"
            ? "Reconnecte-toi pour démarrer ta séance."
            : "Vérifie ta connexion et réessaie."}
        </Text>
        <Button title="Retour" variant="outline" onPress={() => router.back()} className="w-full" />
      </Centered>
    );
  }

  if (!plan || exercises.length === 0 || !athleteId) {
    return (
      <Centered>
        <Text variant="heading" className="text-center text-xl">
          Aucune séance à noter
        </Text>
        <Text variant="body" className="text-center">
          Rien n&apos;est prévu aujourd&apos;hui, ou la séance n&apos;a pas d&apos;exercice.
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

export function toWorkoutExercise(e: PrescribedExercise): WorkoutExercise {
  // The heaviest set of the last session anchors the weight; its reps seed the
  // counter when the prescription carries no number.
  const heaviest = e.lastPerformance?.sets.reduce<{ weightKg: number | null; reps: number | null }>(
    (best, s) =>
      (s.weightKg ?? -1) > (best.weightKg ?? -1)
        ? { weightKg: s.weightKg, reps: s.repsCompleted }
        : best,
    { weightKg: null, reps: null }
  );

  return {
    sessionExerciseId: e.sessionExerciseId,
    exerciseId: e.exerciseId,
    name: e.name,
    // A prescription with no set count still means one set, not zero.
    targetSets: e.sets ?? 1,
    targetReps: e.reps,
    restSeconds: e.restSeconds,
    muscleGroups: e.muscleGroups,
    lastSetCount: e.lastPerformance?.sets.length ?? null,
    lastWeightKg: heaviest?.weightKg ?? null,
    lastReps: heaviest?.reps ?? null,
    prescribedWeightKg: parsePrescribedWeight(e.weightSuggestion),
  };
}

type Confirm =
  | { kind: "quit" }
  | { kind: "finish"; remaining: number }
  | { kind: "discard"; count: number }
  | null;

const rpeHelpStore = createLocalStore("rpe-help-seen.json");

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
  const session = useWorkoutSession({ sessionId, athleteId, exercises });
  const { state, status, dispatch } = session;
  const rest = useRestTimer();
  const now = useNow(1000);
  const palette = usePalette();

  const [restOpen, setRestOpen] = useState(false);
  const [summaryIndex, setSummaryIndex] = useState<number | null>(null);
  const [recapOpen, setRecapOpen] = useState(false);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [lastSet, setLastSet] = useState<{ exerciseId: string; setNumber: number } | null>(null);
  const [rpeHelp, setRpeHelp] = useState(false);

  useEffect(() => {
    void rpeHelpStore.read().then((seen) => setRpeHelp(seen === null));
  }, []);

  const exercise = currentExercise(state);
  const done = exercise ? setsLoggedFor(state.logged, exercise.exerciseId) : [];
  const isLast = state.currentIndex >= state.exercises.length - 1;
  const elapsed = formatElapsed(
    session.startedAt ? (now - Date.parse(session.startedAt)) / 1000 : 0
  );
  const lastLogged = lastSet
    ? state.logged.find(
        (l) => l.exerciseId === lastSet.exerciseId && l.setNumber === lastSet.setNumber
      )
    : undefined;

  const goNext = () => {
    if (isLast) return askFinish();
    dispatch({ type: "next-exercise" });
    setProblem(null);
  };
  const goPrevious = () => {
    dispatch({ type: "previous-exercise" });
    setProblem(null);
  };

  // Story 5.1: swipe left for the next exercise, right for the previous one.
  const swipe = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 24 && Math.abs(g.dy) < 20,
      onPanResponderRelease: (_e, g) => {
        if (g.dx < -60) swipeRef.current.next();
        else if (g.dx > 60) swipeRef.current.previous();
      },
    })
  ).current;
  const swipeRef = useRef({ next: goNext, previous: goPrevious });
  swipeRef.current = { next: goNext, previous: goPrevious };

  const askFinish = () => {
    const remaining = remainingSets(state);
    if (remaining > 0) setConfirm({ kind: "finish", remaining });
    else openRecap();
  };

  const openRecap = () => {
    setConfirm(null);
    setRestOpen(false);
    setSummaryIndex(null);
    void rest.cancel();
    setRecapOpen(true);
  };

  /** Story 5.2: one touch, refused with a reason when the value is not plausible. */
  const validate = () => {
    const result = session.validateSet();
    if (!result.ok) {
      setProblem(result.message);
      return;
    }
    setProblem(null);
    setLastSet({ exerciseId: result.set.exerciseId, setNumber: result.set.setNumber });
    // Story 5.4: the rest starts on its own, with the programme's rest.
    void rest.start(exercise?.restSeconds ?? DEFAULT_REST_SECONDS);
    const logged = setsLoggedFor([...state.logged, result.set], result.set.exerciseId).length;
    if (exercise && logged >= exercise.targetSets) {
      setSummaryIndex(state.currentIndex);
    } else {
      setRestOpen(true);
    }
  };

  const changeRpe = (rpe: number | null) => {
    if (!lastLogged) return;
    session.setRpe(lastLogged.exerciseId, lastLogged.setNumber, rpe);
    if (rpeHelp) {
      setRpeHelp(false);
      rpeHelpStore.write("1");
    }
  };

  if (status.status === "starting") {
    return (
      <Centered>
        <Spinner />
      </Centered>
    );
  }

  // ── 4. Séance terminée ──
  if (recapOpen) {
    return (
      <RecapView
        sessionName={sessionName}
        recap={sessionRecap(state, session.startedAt, now)}
        saving={status.status === "finishing"}
        saved={status.status === "finished" ? status : null}
        onSave={() => void session.finish()}
        onHome={() => router.replace("/(athlete)")}
        onBack={() => setRecapOpen(false)}
      />
    );
  }

  if (!exercise) {
    return (
      <Centered>
        <Text variant="body">Aucun exercice.</Text>
      </Centered>
    );
  }

  const banners = (
    <Banners
      pending={session.pendingCount}
      rejected={session.rejectedCount}
      onRetry={session.retryPending}
      // Refused sets are only dropped after a confirmation (story 5.3).
      onDiscard={() => setConfirm({ kind: "discard", count: session.rejectedCount })}
    />
  );

  let body: React.ReactNode;

  if (summaryIndex !== null) {
    // ── 3. Résumé d'exercice ──
    const recap = exerciseRecap(state, summaryIndex);
    const ex = state.exercises.at(summaryIndex);
    const next = state.exercises.at(summaryIndex + 1);
    const target = ex ? parseTargetReps(ex.targetReps) : null;
    body = (
      <>
        <View className="flex-row items-center gap-3 px-5 pt-5">
          <View className="h-10 w-10 items-center justify-center rounded-xl border border-accent bg-accent-dim">
            <Ionicons name="checkmark" size={18} color={palette.accent} />
          </View>
          <View>
            <Text weight="bold" className="text-[17px] text-text" accessibilityRole="header">
              {recap?.name}
            </Text>
            <Text className="mt-0.5 text-xs text-text-muted">
              {recap?.sets.length} séries terminées
            </Text>
          </View>
        </View>
        <View className="flex-row gap-2.5 px-5 pt-4">
          <StatTile
            label="Volume total"
            value={`${formatKg(recap?.volumeKg ?? 0)} kg`}
            sub="sur cet exercice"
          />
          <StatTile
            label="Rép. moyen"
            value={
              recap?.averageReps === null || recap?.averageReps === undefined
                ? "—"
                : `${String(recap.averageReps).replace(".", ",")} reps`
            }
            sub={ex?.targetReps ? `cible : ${ex.targetReps}` : "sans cible"}
          />
        </View>
        <View className="pt-4">
          <RpePicker value={lastLogged?.rpe ?? null} onChange={changeRpe} showHelp={rpeHelp} />
        </View>
        <View className="px-5 pt-4">
          <Text
            weight="bold"
            className="mb-3 text-[11px] uppercase tracking-[0.6px] text-text-muted"
          >
            Détail des séries
          </Text>
          {recap?.sets.map((s) => (
            <SetSummaryRow key={s.setNumber} set={s} targetReps={target} />
          ))}
        </View>
        {next ? (
          <View className="pt-1">
            <NextUpCard label="Prochain exercice" title={next.name} detail={prescription(next)} />
          </View>
        ) : null}
        <View className="px-5 pb-8 pt-1">
          {next ? (
            <Button
              title="Exercice suivant →"
              className="h-14"
              onPress={() => {
                setSummaryIndex(null);
                dispatch({ type: "go-to-exercise", index: summaryIndex + 1 });
                // The summary was the rest: the next exercise starts now.
                void rest.cancel();
                setRestOpen(false);
              }}
            />
          ) : (
            <Button title="Terminer la séance" className="h-14" onPress={askFinish} />
          )}
          <Button
            title="Revenir à l'exercice"
            variant="ghost"
            onPress={() => setSummaryIndex(null)}
            className="mt-1"
          />
        </View>
      </>
    );
  } else if (restOpen) {
    // ── 2. Repos ──
    const setsLeft = Math.max(0, exercise.targetSets - done.length);
    body = (
      <>
        <View className="items-center px-5 pt-6">
          <Text weight="bold" className="mb-1 text-[11px] uppercase tracking-[1px] text-text-muted">
            {rest.isFinished ? "Repos terminé" : "Repos"}
          </Text>
          <Text weight="semibold" className="text-base text-text-sub">
            Série {done.length} terminée · {setsLeft} restante{setsLeft > 1 ? "s" : ""}
          </Text>
        </View>
        <View className="items-center py-6">
          <RestRing remaining={rest.remaining} fraction={rest.progress} />
        </View>
        {rest.notificationsReady === false ? (
          <Text variant="caption" className="px-5 pb-3 text-center">
            Notifications désactivées : le téléphone ne vibrera pas si l&apos;écran est éteint.
          </Text>
        ) : null}
        <View className="pb-4">
          <RpePicker value={lastLogged?.rpe ?? null} onChange={changeRpe} showHelp={rpeHelp} />
        </View>
        <NextUpCard
          label="Prochaine série"
          title={`${exercise.name} · Série ${nextSetNumber(state)} / ${exercise.targetSets}`}
          detail={`${exercise.targetReps ? `${exercise.targetReps} rép` : `${state.draft.reps} rép`}${state.draft.weightKg === null ? "" : ` · ${formatWeight(state.draft.weightKg)} kg`}`}
        />
        <View className="gap-2.5 px-5 pb-8">
          <Button
            title="Reprendre maintenant"
            accessibilityLabel="Passer le repos et reprendre maintenant"
            className="h-14"
            icon={<Ionicons name="arrow-forward" size={16} color={palette.btnPrimaryText} />}
            onPress={() => {
              void rest.cancel();
              setRestOpen(false);
            }}
          />
          <Button
            title={`+${REST_ADJUST_SECONDS} s`}
            accessibilityLabel={`Ajouter ${REST_ADJUST_SECONDS} secondes de repos`}
            variant="secondary"
            onPress={() => void rest.adjust(REST_ADJUST_SECONDS)}
          />
        </View>
      </>
    );
  } else {
    // ── 1. Série en cours ──
    body = (
      <>
        <View {...swipe.panHandlers}>
          <ExerciseCard
            name={exercise.name}
            muscles={exercise.muscleGroups ?? []}
            weightKg={state.draft.weightKg}
            position={state.currentIndex + 1}
            total={state.exercises.length}
          />
          <SetDots current={nextSetNumber(state)} total={exercise.targetSets} done={done.length} />
        </View>

        <View className="items-center px-5 pt-8">
          <Text
            weight="bold"
            className="mb-3.5 text-[11px] uppercase tracking-[1px] text-text-muted"
          >
            Répétitions
          </Text>
          <View className="mb-4 flex-row items-center gap-7">
            <StepButton
              symbol="−"
              label="Une répétition de moins"
              onPress={() => dispatch({ type: "adjust-reps", delta: -1 })}
            />
            <View
              className="min-w-[90px] items-center"
              accessible
              accessibilityLabel={`${state.draft.reps} répétitions`}
            >
              <Text
                mono
                weight="medium"
                className="text-text"
                style={{ fontSize: 88, lineHeight: 92 }}
              >
                {state.draft.reps}
              </Text>
              {exercise.targetReps ? (
                <Text mono className="mt-1.5 text-[13px] text-text-muted">
                  / {exercise.targetReps} cible
                </Text>
              ) : null}
            </View>
            <StepButton
              symbol="+"
              primary
              label="Une répétition de plus"
              onPress={() => dispatch({ type: "adjust-reps", delta: 1 })}
            />
          </View>

          <View className="flex-row items-center gap-2 rounded-[40px] border border-border bg-surface px-3 py-2">
            <StepButton
              small
              symbol="−"
              label={`${String(WEIGHT_STEP_KG).replace(".", ",")} kilo de moins`}
              onPress={() => dispatch({ type: "adjust-weight", delta: -WEIGHT_STEP_KG })}
            />
            <View
              className="min-w-[80px] flex-row items-baseline justify-center"
              accessible
              accessibilityLabel={
                state.draft.weightKg === null
                  ? "Sans poids"
                  : `${formatWeight(state.draft.weightKg)} kilos`
              }
            >
              <Text mono weight="medium" className="text-xl text-text">
                {state.draft.weightKg === null ? "—" : `${formatWeight(state.draft.weightKg)} `}
              </Text>
              <Text mono className="text-[13px] text-text-muted">
                kg
              </Text>
            </View>
            <StepButton
              small
              symbol="+"
              label={`${String(WEIGHT_STEP_KG).replace(".", ",")} kilo de plus`}
              onPress={() => dispatch({ type: "adjust-weight", delta: WEIGHT_STEP_KG })}
            />
          </View>
          {(problem ?? draftProblem(state.draft)) ? (
            <Text
              variant="error"
              className="mt-3 text-center text-[13px]"
              accessibilityLiveRegion="polite"
            >
              {problem ?? draftProblem(state.draft)}
            </Text>
          ) : null}
        </View>

        {exercise.lastWeightKg !== null ? (
          <View className="mx-5 mt-6 flex-row items-center gap-2 rounded-xl border border-border bg-surface px-3.5 py-2.5">
            <Ionicons name="time-outline" size={14} color={palette.textMuted} />
            <Text className="text-xs text-text-muted">
              Dernière perf :{" "}
              <Text mono className="text-xs text-text-sub">
                {exercise.lastSetCount ? `${exercise.lastSetCount}×` : ""}
                {exercise.lastReps ?? "?"} à {formatWeight(exercise.lastWeightKg)} kg
              </Text>
            </Text>
          </View>
        ) : null}

        {state.exercises.at(state.currentIndex + 1) ? (
          <View className="pt-4">
            <NextUpCard
              label="Exercice suivant"
              title={state.exercises.at(state.currentIndex + 1)?.name ?? ""}
              detail={prescription(state.exercises.at(state.currentIndex + 1) as WorkoutExercise)}
            />
          </View>
        ) : null}

        <View className="gap-2 px-5 pb-8 pt-1">
          <Button
            title="Série terminée"
            className="h-14"
            accessibilityLabel={`Série terminée : ${state.draft.reps} répétitions${state.draft.weightKg === null ? "" : ` à ${formatWeight(state.draft.weightKg)} kilos`}`}
            icon={<Ionicons name="checkmark" size={18} color={palette.btnPrimaryText} />}
            onPress={validate}
          />
          <View className="flex-row gap-2">
            <View className="flex-1">
              <Button
                title="‹ Précédent"
                variant="ghost"
                disabled={state.currentIndex === 0}
                onPress={goPrevious}
              />
            </View>
            <View className="flex-1">
              {isLast ? (
                <Button title="Terminer" variant="ghost" onPress={askFinish} />
              ) : (
                <Button
                  title={
                    isExerciseComplete(state, state.currentIndex) ? "Suivant ✓ ›" : "Suivant ›"
                  }
                  variant="ghost"
                  onPress={goNext}
                />
              )}
            </View>
          </View>
          {!isLast ? (
            <Pressable
              accessibilityRole="button"
              onPress={askFinish}
              className="min-h-[48px] items-center justify-center"
            >
              <Text variant="caption" weight="semibold">
                Terminer la séance
              </Text>
            </Pressable>
          ) : null}
        </View>
      </>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <SessionTopBar
        elapsed={elapsed}
        offline={session.offline}
        onQuit={() => setConfirm({ kind: "quit" })}
      />
      <WorkoutProgress done={completedExerciseCount(state)} total={state.exercises.length} />
      <ScrollView className="flex-1" contentContainerClassName="pb-6">
        {banners}
        {body}
      </ScrollView>

      {confirm?.kind === "quit" ? (
        <ConfirmOverlay
          title="Quitter la séance ?"
          body={`${state.logged.length === 0 ? "Rien n'est encore noté." : `Tes ${state.logged.length} série${state.logged.length > 1 ? "s" : ""} notée${state.logged.length > 1 ? "s sont gardées" : " est gardée"}.`} Tu pourras reprendre depuis Aujourd'hui.`}
          confirmLabel="Quitter"
          cancelLabel="Continuer la séance"
          onConfirm={() => {
            setConfirm(null);
            void rest.cancel();
            router.back();
          }}
          onCancel={() => setConfirm(null)}
        />
      ) : null}
      {confirm?.kind === "discard" ? (
        <ConfirmOverlay
          title={`Retirer ${confirm.count} série${confirm.count > 1 ? "s" : ""} refusée${confirm.count > 1 ? "s" : ""} ?`}
          body="Le serveur les a refusées. Une fois retirées, elles ne seront plus envoyées."
          confirmLabel="Retirer"
          cancelLabel="Garder"
          onConfirm={() => {
            setConfirm(null);
            session.discardRejected();
          }}
          onCancel={() => setConfirm(null)}
        />
      ) : null}
      {confirm?.kind === "finish" ? (
        <ConfirmOverlay
          title={`Il reste ${confirm.remaining} série${confirm.remaining > 1 ? "s" : ""}. Terminer quand même ?`}
          body="Ce qui est déjà noté est gardé."
          confirmLabel="Terminer quand même"
          cancelLabel="Continuer la séance"
          onConfirm={openRecap}
          onCancel={() => setConfirm(null)}
        />
      ) : null}
    </SafeAreaView>
  );
}

function RecapView({
  sessionName,
  recap,
  saving,
  saved,
  onSave,
  onHome,
  onBack,
}: {
  sessionName: string;
  recap: ReturnType<typeof sessionRecap>;
  saving: boolean;
  saved: { queued: boolean } | null;
  onSave: () => void;
  onHome: () => void;
  onBack: () => void;
}) {
  const accent = usePalette().accent;
  return (
    <SafeAreaView className="flex-1 bg-bg">
      <ScrollView contentContainerClassName="pb-8">
        <View className="items-center px-5 pt-5">
          <Ionicons name="checkmark" size={32} color={accent} />
          <Text
            weight="bold"
            className="mb-1 mt-2 tracking-[-0.7px] text-text"
            style={{ fontSize: 24, lineHeight: 30 }}
            accessibilityRole="header"
          >
            Séance terminée
          </Text>
          <Text className="text-[13px] text-text-muted">
            {sessionName} · {recap.exercises.length} exercice{recap.exercises.length > 1 ? "s" : ""}
          </Text>
        </View>

        <View className="mx-5 mt-5 flex-row rounded-[18px] border border-border bg-surface py-4">
          <RecapStat
            label="Durée"
            value={formatElapsed(recap.durationSeconds)}
            sub=""
            spoken={`Durée ${formatElapsed(recap.durationSeconds)}`}
          />
          <View className="mx-1 w-px bg-border" />
          <RecapStat
            label="Séries"
            value={String(recap.setsDone)}
            sub={`sur ${recap.setsPlanned}`}
            spoken={`${recap.setsDone} séries sur ${recap.setsPlanned}`}
          />
          <View className="mx-1 w-px bg-border" />
          <RecapStat
            label="Volume"
            value={formatKg(recap.volumeKg)}
            sub="kg total"
            spoken={`${formatKg(recap.volumeKg)} kilos au total`}
          />
        </View>

        <View className="px-5 pt-5">
          <Text
            weight="bold"
            className="mb-3 text-[11px] uppercase tracking-[0.6px] text-text-muted"
          >
            Résumé par exercice
          </Text>
          {recap.exercises.map((ex) => (
            <ExerciseRecapRow key={ex.exerciseId} recap={ex} />
          ))}
        </View>

        <View className="gap-2 px-5 pt-3">
          {saved ? (
            <>
              <Text
                variant="caption"
                className="text-center text-[13px]"
                accessibilityLiveRegion="polite"
              >
                {saved.queued
                  ? "Séance gardée sur ton téléphone. Elle sera envoyée dès que le réseau revient."
                  : "Séance enregistrée."}
              </Text>
              <Button title="Retour à l'accueil" className="h-14" onPress={onHome} />
            </>
          ) : (
            <>
              <Button
                title="Enregistrer la séance"
                className="h-14"
                loading={saving}
                onPress={onSave}
              />
              <Button
                title="Revenir à la séance"
                variant="ghost"
                onPress={onBack}
                disabled={saving}
              />
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Banners({
  pending,
  rejected,
  onRetry,
  onDiscard,
}: {
  pending: number;
  rejected: number;
  onRetry: () => void;
  onDiscard: () => void;
}) {
  return (
    <>
      {/* Reassurance, not an error: the sets are safe on the phone. */}
      {pending > 0 ? (
        <Pressable
          accessibilityRole="button"
          onPress={onRetry}
          className="mx-5 mt-3 min-h-[44px] justify-center rounded-xl border border-border bg-surface px-3.5 py-2.5"
        >
          <Text variant="caption">
            {pending} série{pending > 1 ? "s" : ""} en attente d&apos;envoi, gardée
            {pending > 1 ? "s" : ""} sur ton téléphone. Touche pour réessayer.
          </Text>
        </Pressable>
      ) : null}
      {rejected > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Retirer ${rejected} série(s) refusée(s)`}
          onPress={onDiscard}
          className="mx-5 mt-3 min-h-[44px] justify-center rounded-xl border border-error bg-surface px-3.5 py-2.5"
        >
          <Text variant="error">
            {rejected} série{rejected > 1 ? "s" : ""} refusée{rejected > 1 ? "s" : ""} par le
            serveur. Touche pour choisir.
          </Text>
        </Pressable>
      ) : null}
    </>
  );
}

function prescription(e: WorkoutExercise): string {
  const parts = [`${e.targetSets} série${e.targetSets > 1 ? "s" : ""}`];
  if (e.targetReps) parts.push(`${e.targetReps} rép`);
  if (e.lastWeightKg !== null) parts.push(`${formatWeight(e.lastWeightKg)} kg`);
  return parts.join(" · ");
}

/** Wall clock, refreshed every `ms`, for the session clock and the recap. */
function useNow(ms: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

function Spinner() {
  const palette = usePalette();
  return <ActivityIndicator size="large" color={palette.accent} />;
}

function Centered({ children }: { children: React.ReactNode }) {
  return <View className="flex-1 items-center justify-center gap-4 bg-bg px-8">{children}</View>;
}

export type { LoggedSet };
