/**
 * Texts of the account-deletion confirmation (story 2.6).
 *
 * À relire par Ralph (politique de confidentialité, Loi 25): the list of what is
 * erased and the retention sentence must match the published policy.
 */
export const DELETION_TITLE = "Supprimer mon compte";
export const DELETION_INTRO =
  "Cette action est définitive. Ton compte sera supprimé tout de suite et tu ne pourras plus te reconnecter.";
export const DELETION_ERASED = [
  "ton profil",
  "tes programmes",
  "tes séances",
  "tes séries et tes notes",
] as const;
// À relire par Ralph : durée de conservation des sauvegardes (défaut du ticket : cycle normal).
export const DELETION_BACKUPS =
  "Les sauvegardes de la base s'effacent selon leur cycle normal. La durée exacte est écrite dans la politique de confidentialité.";
export const DELETION_FAILED = "La suppression a échoué. Réessaie dans un instant.";
