/**
 * ViewModel de l'ecran Profil.
 *
 * Transforme un profil du domaine en donnees pretes a afficher. Ce module est
 * volontairement du TypeScript pur : aucune dependance a React, React Native
 * ou Supabase, ce qui le rend testable sans mock ni rendu de composant.
 */

import { type ProfileSummary, type UserRole } from "./profile.types";

/** Libelle affiche pour chaque role. */
export const ROLE_LABELS: Record<UserRole, string> = {
  coach: "Coach",
  athlete: "Athlète",
};

/** Initiales utilisees quand ni le nom ni l'email ne fournissent de lettre. */
export const FALLBACK_INITIALS = "?";

/**
 * Donnees affichees par l'ecran Profil.
 *
 * `roleTone` reste une valeur semantique : le choix des couleurs appartient a
 * la couche de rendu, pas au ViewModel.
 */
export type ProfileViewModel = {
  id: string;
  /** "Prenom Nom", ou null si les deux champs sont vides. */
  displayName: string | null;
  /** Une ou deux lettres majuscules, pour un avatar de substitution. */
  initials: string;
  email: string;
  roleLabel: string;
  roleTone: UserRole;
  avatarUrl: string | null;
  onboardingPending: boolean;
};

/** Message affiche quand le profil n'a pas pu etre charge. */
export const PROFILE_ERROR_MESSAGE = "Impossible de charger le profil.";

/**
 * Etat de l'ecran Profil. Le role n'intervient pas ici : un seul etat
 * "ready" couvre coach et athlete, la difference vit dans le ViewModel.
 */
export type ProfileState =
  | { status: "loading" }
  | { status: "ready"; viewModel: ProfileViewModel }
  | { status: "error"; message: string };

/** Etat "loading". */
export type ProfileLoadingState = Extract<ProfileState, { status: "loading" }>;

/** Etat "ready", dont le ViewModel est accessible sans verification prealable. */
export type ProfileReadyState = Extract<ProfileState, { status: "ready" }>;

/** Etat "error", dont le message est accessible sans verification prealable. */
export type ProfileErrorState = Extract<ProfileState, { status: "error" }>;

/** Premier caractere d'une chaine, en tenant compte des paires de substitution. */
function firstCharacter(value: string): string {
  return Array.from(value.trim())[0] ?? "";
}

/** Joint prenom et nom en ignorant les parties vides. */
export function formatDisplayName(firstName: string, lastName: string): string | null {
  const fullName = [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");
  return fullName === "" ? null : fullName;
}

/**
 * Initiales du profil : prenom + nom, sinon premiere lettre de l'email,
 * sinon FALLBACK_INITIALS.
 */
export function formatInitials(firstName: string, lastName: string, email: string): string {
  const fromName = firstCharacter(firstName) + firstCharacter(lastName);
  const initials = fromName || firstCharacter(email);
  return initials === "" ? FALLBACK_INITIALS : initials.toUpperCase();
}

/**
 * Construit le ViewModel a partir du profil charge par AuthProvider.
 * Un profil absent (chargement en cours, deconnexion) donne null.
 */
export function toProfileViewModel(profile: ProfileSummary): ProfileViewModel;
export function toProfileViewModel(profile: ProfileSummary | null): ProfileViewModel | null;
export function toProfileViewModel(profile: ProfileSummary | null): ProfileViewModel | null {
  if (profile === null) return null;

  return {
    id: profile.id,
    displayName: formatDisplayName(profile.first_name, profile.last_name),
    initials: formatInitials(profile.first_name, profile.last_name, profile.email),
    email: profile.email,
    roleLabel: ROLE_LABELS[profile.role],
    roleTone: profile.role,
    avatarUrl: profile.avatar_url,
    onboardingPending: !profile.onboarding_completed,
  };
}
