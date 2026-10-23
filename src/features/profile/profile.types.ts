/**
 * Types du domaine Profil.
 *
 * Miroir de la table `profiles` definie dans
 * supabase/migrations/001_initial_schema.sql. Tant que `src/types/database.ts`
 * n'est pas regenere depuis Supabase (Phase 4), ce fichier fait office de
 * source de verite cote application.
 */

/** Valeurs de l'enum Postgres `user_role`. */
export const USER_ROLES = ["coach", "athlete"] as const;

/** Role d'un utilisateur. Derive de USER_ROLES pour rester synchronise. */
export type UserRole = (typeof USER_ROLES)[number];

/** Horodatage ISO 8601, tel que renvoye par un TIMESTAMPTZ Postgres. */
export type IsoTimestamp = string;

/**
 * Ligne complete de la table `profiles`.
 *
 * Note sur la nullabilite : `timezone`, `preferred_language` et
 * `onboarding_completed` sont declares DEFAULT sans NOT NULL en base, donc
 * Postgres accepterait techniquement NULL. Ils sont types non-nullables ici
 * car l'application n'ecrit jamais NULL et les DEFAULT s'appliquent toujours
 * a l'insertion — ce qui rend leur consommation nettement plus simple.
 */
export type Profile = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  avatar_url: string | null;
  phone: string | null;
  bio: string | null;
  timezone: string;
  preferred_language: string;
  onboarding_completed: boolean;
  last_active_at: IsoTimestamp | null;
  created_at: IsoTimestamp;
  updated_at: IsoTimestamp;
  is_deleted: boolean;
  deleted_at: IsoTimestamp | null;
};

/**
 * Sous-ensemble effectivement charge par AuthProvider.
 * Voir la clause `.select()` de fetchProfile dans providers/auth-provider.tsx.
 */
export type ProfileSummary = Pick<
  Profile,
  "id" | "email" | "first_name" | "last_name" | "role" | "avatar_url" | "onboarding_completed"
>;

/** Profil dont le role est garanti "coach" au niveau du type. */
export type CoachProfile = Profile & { role: "coach" };

/** Profil dont le role est garanti "athlete" au niveau du type. */
export type AthleteProfile = Profile & { role: "athlete" };

/**
 * Champs necessaires a la creation d'un profil.
 * `id` vient de auth.users, `email` est NOT NULL sans DEFAULT ; tout le reste
 * est couvert par les valeurs par defaut du schema.
 */
export type ProfileInsert = Pick<Profile, "id" | "email"> &
  Partial<Omit<Profile, "id" | "email" | "created_at" | "updated_at">>;

/**
 * Champs modifiables par l'utilisateur depuis l'ecran Profil.
 * Exclut volontairement id, email, role et les colonnes gerees par la base
 * (timestamps, suppression logique).
 */
export type ProfileUpdate = Partial<
  Pick<
    Profile,
    | "first_name"
    | "last_name"
    | "avatar_url"
    | "phone"
    | "bio"
    | "timezone"
    | "preferred_language"
    | "onboarding_completed"
  >
>;

/** Valide qu'une valeur inconnue est bien un UserRole. */
export function isUserRole(value: unknown): value is UserRole {
  return typeof value === "string" && (USER_ROLES as readonly string[]).includes(value);
}

/** Predicat de type : le profil appartient-il a un coach ? */
export function isCoach(profile: Profile): profile is CoachProfile {
  return profile.role === "coach";
}

/** Predicat de type : le profil appartient-il a un athlete ? */
export function isAthlete(profile: Profile): profile is AthleteProfile {
  return profile.role === "athlete";
}

/** Profil actif, c'est-a-dire non supprime logiquement. */
export function isActiveProfile(profile: Profile): boolean {
  return !profile.is_deleted;
}

/**
 * Statistiques affichees sur l'ecran Profil, selon le role.
 *
 * Elles ne proviennent pas de la table `profiles` mais d'agregats sur
 * d'autres tables ; l'union discriminee sur `role` empeche d'associer des
 * statistiques de coach a un athlete, et inversement.
 */
export type ProfileStats =
  | {
      role: "coach";
      /** Relations `coach_athletes` au statut "active". */
      activeAthleteCount: number;
      /** Programmes `programs` au statut "active". */
      activeProgramCount: number;
    }
  | {
      role: "athlete";
      /** Seances `session_logs` au statut "completed". */
      completedSessionCount: number;
      /** Nom du programme de l'assignation "active", ou null s'il n'y en a pas. */
      activeProgramName: string | null;
    };

/** Statistiques d'un coach. */
export type CoachStats = Extract<ProfileStats, { role: "coach" }>;

/** Statistiques d'un athlete. */
export type AthleteStats = Extract<ProfileStats, { role: "athlete" }>;
