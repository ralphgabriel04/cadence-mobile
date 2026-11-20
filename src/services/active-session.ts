import type { LoggedSet } from "@/features/training/workout-state";

import { createLocalStore, type LocalStore } from "./local-store";

// ============================================================================
// The session in progress, kept on the phone (story 5.3: « Ne jamais perdre
// une série »).
//
// The queue carries sets that have not reached the server. This record carries
// what the SCREEN needs to come back exactly where the athlete was after the
// app was killed, a call, or a locked screen -- with or without network:
//   * the session log id, chosen on the phone so a session can start offline;
//   * every set logged so far (sent or not), with its effort;
//   * a completion that could not be sent yet (story 5.5, criterion 5).
//
// Written synchronously after every change, like the queue.
// ============================================================================

export type PendingCompletion = {
  completedAt: string;
  durationMinutes: number | null;
  overallRpe: number | null;
  notes: string | null;
};

export type ActiveSession = {
  athleteId: string;
  sessionId: string;
  sessionLogId: string;
  startedAt: string;
  programAssignmentId: string | null;
  logged: LoggedSet[];
  /** Set once the athlete finished; cleared when the server has it. */
  completion: PendingCompletion | null;
};

const FILE_NAME = "active-session.json";

function isLoggedSet(v: unknown): v is LoggedSet {
  if (typeof v !== "object" || v === null) return false;
  const s = v as Record<string, unknown>;
  return (
    typeof s.exerciseId === "string" &&
    typeof s.setNumber === "number" &&
    typeof s.repsCompleted === "number" &&
    typeof s.loggedAt === "string"
  );
}

export function parseActiveSession(raw: string | null): ActiveSession | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Record<string, unknown>;
    if (
      typeof v.athleteId !== "string" ||
      typeof v.sessionId !== "string" ||
      typeof v.sessionLogId !== "string" ||
      typeof v.startedAt !== "string" ||
      !Array.isArray(v.logged)
    ) {
      return null;
    }
    const completion = v.completion as PendingCompletion | null | undefined;
    return {
      athleteId: v.athleteId,
      sessionId: v.sessionId,
      sessionLogId: v.sessionLogId,
      startedAt: v.startedAt,
      programAssignmentId: typeof v.programAssignmentId === "string" ? v.programAssignmentId : null,
      logged: v.logged.filter(isLoggedSet).map((s) => ({
        ...s,
        sessionExerciseId: s.sessionExerciseId ?? null,
        weightKg: typeof s.weightKg === "number" ? s.weightKg : null,
        rpe: typeof s.rpe === "number" ? s.rpe : null,
      })),
      completion: completion && typeof completion.completedAt === "string" ? completion : null,
    };
  } catch {
    return null;
  }
}

export function createActiveSessionStore(store: LocalStore = createLocalStore(FILE_NAME)) {
  return {
    /** The record of this account, or null (another account's record is ignored). */
    async read(athleteId: string): Promise<ActiveSession | null> {
      if (!athleteId) return null;
      const record = parseActiveSession(await store.read());
      return record && record.athleteId === athleteId ? record : null;
    },
    write(record: ActiveSession): void {
      store.write(JSON.stringify(record));
    },
    erase(): void {
      store.erase();
    },
  };
}

export type ActiveSessionStore = ReturnType<typeof createActiveSessionStore>;

let shared: ActiveSessionStore | null = null;

export function activeSessionStore(): ActiveSessionStore {
  shared ??= createActiveSessionStore();
  return shared;
}

/**
 * Sets of the server and of the phone, merged slot by slot (exercise + set
 * number). The phone wins on a conflict: it holds the athlete's latest edit
 * (an effort added after the set was sent, for example).
 */
export function mergeLogged(
  server: readonly LoggedSet[],
  local: readonly LoggedSet[]
): LoggedSet[] {
  const key = (s: LoggedSet) => `${s.exerciseId}#${s.setNumber}`;
  const merged = new Map<string, LoggedSet>();
  for (const s of server) merged.set(key(s), s);
  for (const s of local) merged.set(key(s), s);
  return [...merged.values()].sort((a, b) => a.loggedAt.localeCompare(b.loggedAt));
}

/** RFC 4122 v4 id, for a session log created on the phone. */
export function newUuid(): string {
  const bytes = new Uint8Array(16);
  const cryptoLike = (
    globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } }
  ).crypto;
  if (cryptoLike?.getRandomValues) {
    cryptoLike.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) bytes.set([Math.floor(Math.random() * 256)], i);
  }
  bytes.set([((bytes.at(6) ?? 0) & 0x0f) | 0x40], 6);
  bytes.set([((bytes.at(8) ?? 0) & 0x3f) | 0x80], 8);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
