/**
 * Fixtures de profils pour les tests.
 *
 * Toutes les valeurs sont deterministes : aucun aleatoire, aucune dependance
 * a l'horloge. Deux executions de la suite produisent exactement les memes
 * objets, ce qui rend les echecs reproductibles.
 *
 * Les identifiants sont derives d'un compteur de module. Appeler
 * resetProfileFixtures() dans un beforeEach pour repartir de zero entre les
 * tests.
 */

import { type AthleteStats, type CoachStats, type Profile } from "./profile.types";
import {
  PROFILE_ERROR_MESSAGE,
  type ProfileErrorState,
  type ProfileLoadingState,
  type ProfileReadyState,
  toProfileViewModel,
} from "./profile.view-model";

/** Horodatage fixe utilise par toutes les fixtures. */
export const PROFILE_FIXTURE_TIMESTAMP = "2026-01-15T10:00:00.000Z";

/** Fuseau par defaut du schema (`DEFAULT 'America/Toronto'`). */
export const PROFILE_FIXTURE_TIMEZONE = "America/Toronto";

/** Langue par defaut du schema (`DEFAULT 'fr'`). */
export const PROFILE_FIXTURE_LANGUAGE = "fr";

/** Valeurs des champs facultatifs, utilisees par makeCompleteProfile. */
export const PROFILE_FIXTURE_AVATAR_URL = "https://cdn.cadence.test/avatars/profile.png";
export const PROFILE_FIXTURE_PHONE = "+15145550100";
export const PROFILE_FIXTURE_BIO = "Passionné de course à pied.";

let sequence = 0;

/** Remet le compteur d'identifiants a zero. A appeler dans un beforeEach. */
export function resetProfileFixtures(): void {
  sequence = 0;
}

/** Numero de sequence courant, utile pour les assertions. */
export function currentProfileFixtureSequence(): number {
  return sequence;
}

function nextSequence(): number {
  sequence += 1;
  return sequence;
}

/**
 * Construit un UUID v4 valide et previsible a partir du numero de sequence.
 * @example buildFixtureId(1) // "00000000-0000-4000-8000-000000000001"
 */
function buildFixtureId(seq: number): string {
  return `00000000-0000-4000-8000-${String(seq).padStart(12, "0")}`;
}

/**
 * Construit un profil complet. Le role vaut "athlete" par defaut.
 *
 * Les overrides sont appliques en dernier et ecrasent donc n'importe quel
 * champ, y compris l'identifiant genere.
 *
 * @example makeProfile()                          // athlete par defaut
 * @example makeProfile({ first_name: "Camille" }) // prenom personnalise
 */
export function makeProfile(overrides: Partial<Profile> = {}): Profile {
  const seq = nextSequence();
  const role = overrides.role ?? "athlete";

  return {
    id: buildFixtureId(seq),
    email: `${role}${seq}@cadence.test`,
    first_name: "Alex",
    last_name: "Tremblay",
    role,
    avatar_url: null,
    phone: null,
    bio: null,
    timezone: PROFILE_FIXTURE_TIMEZONE,
    preferred_language: PROFILE_FIXTURE_LANGUAGE,
    onboarding_completed: true,
    last_active_at: PROFILE_FIXTURE_TIMESTAMP,
    created_at: PROFILE_FIXTURE_TIMESTAMP,
    updated_at: PROFILE_FIXTURE_TIMESTAMP,
    is_deleted: false,
    deleted_at: null,
    ...overrides,
  };
}

/**
 * Profil de coach. Le role est force, meme si les overrides tentent de le
 * changer — c'est le contrat de cette fabrique nommee.
 */
export function makeCoachProfile(overrides: Partial<Profile> = {}): Profile {
  return makeProfile({
    first_name: "Camille",
    last_name: "Roy",
    ...overrides,
    role: "coach",
  });
}

/** Profil d'athlete. Le role est force, comme pour makeCoachProfile. */
export function makeAthleteProfile(overrides: Partial<Profile> = {}): Profile {
  return makeProfile({ ...overrides, role: "athlete" });
}

/**
 * Profil supprime logiquement. Les politiques RLS de `profiles` filtrent sur
 * `NOT is_deleted`, d'ou l'interet d'une fixture dediee.
 */
export function makeDeletedProfile(overrides: Partial<Profile> = {}): Profile {
  return makeProfile({
    ...overrides,
    is_deleted: true,
    deleted_at: PROFILE_FIXTURE_TIMESTAMP,
  });
}

/** Profil n'ayant pas termine l'onboarding. */
export function makePendingOnboardingProfile(overrides: Partial<Profile> = {}): Profile {
  return makeProfile({ ...overrides, onboarding_completed: false });
}

/**
 * Profil dont tous les champs facultatifs sont renseignes : avatar, telephone
 * et bio. Sert a tester l'affichage des informations secondaires.
 */
export function makeCompleteProfile(overrides: Partial<Profile> = {}): Profile {
  return makeProfile({
    avatar_url: PROFILE_FIXTURE_AVATAR_URL,
    phone: PROFILE_FIXTURE_PHONE,
    bio: PROFILE_FIXTURE_BIO,
    ...overrides,
  });
}

/**
 * Construit une liste de profils distincts.
 *
 * Attention : un override sur `id` ou `email` sera applique a tous les
 * elements, ce qui supprime leur unicite. Laisser ces champs de cote pour
 * conserver des identifiants uniques.
 */
export function makeProfiles(count: number, overrides: Partial<Profile> = {}): Profile[] {
  return Array.from({ length: count }, () => makeProfile(overrides));
}

/*
 * Etats de l'ecran Profil.
 *
 * Ce sont des fonctions et non des constantes : une constante appellerait
 * makeProfile() au chargement du module, hors de tout test, et ferait avancer
 * le compteur d'identifiants sans que resetProfileFixtures() puisse l'annuler.
 */

/** Ecran pret, profil d'athlete. Le role est force a "athlete". */
export function athleteReady(overrides: Partial<Profile> = {}): ProfileReadyState {
  return { status: "ready", viewModel: toProfileViewModel(makeAthleteProfile(overrides)) };
}

/** Ecran pret, profil de coach. Le role est force a "coach". */
export function coachReady(overrides: Partial<Profile> = {}): ProfileReadyState {
  return { status: "ready", viewModel: toProfileViewModel(makeCoachProfile(overrides)) };
}

/** Echec du chargement du profil. Independant du role : aucun profil n'a ete lu. */
export function profileError(message: string = PROFILE_ERROR_MESSAGE): ProfileErrorState {
  return { status: "error", message };
}

/** Ecran en cours de chargement. */
export function profileLoading(): ProfileLoadingState {
  return { status: "loading" };
}

/*
 * Statistiques du Profil. Elles ne consomment pas d'identifiant : aucun
 * appel a makeProfile, donc aucun effet sur le compteur de sequence.
 */

/** Statistiques d'un coach. Le role est force a "coach". */
export function makeCoachStats(overrides: Partial<Omit<CoachStats, "role">> = {}): CoachStats {
  return {
    activeAthleteCount: 12,
    activeProgramCount: 3,
    ...overrides,
    role: "coach",
  };
}

/** Statistiques d'un athlete. Le role est force a "athlete". */
export function makeAthleteStats(
  overrides: Partial<Omit<AthleteStats, "role">> = {}
): AthleteStats {
  return {
    completedSessionCount: 24,
    activeProgramName: "Préparation 10 km",
    ...overrides,
    role: "athlete",
  };
}
