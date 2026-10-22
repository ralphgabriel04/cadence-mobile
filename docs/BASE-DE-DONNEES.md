# Base de données (Supabase)

Mis à jour le 2026-10-22 (récit 0.1, #139).

| Élément | Valeur |
|---|---|
| Fournisseur | Supabase (plan Free) |
| Projet | « The Project » |
| Région | `us-west-2`, West US (Oregon), **hors du Canada** |
| Remise en ligne | 2026-10-22 (le projet était en pause) |
| Vérification | l'adresse du projet répond ; une inscription test sur la landing a été acceptée (201) puis refusée en double (409), puis supprimée |

## Règles
- Aucune clé, aucun mot de passe et aucune adresse de connexion dans ce dépôt public. Les clés vivent dans les variables d'environnement (Vercel, EAS, GitHub Secrets).
- Le plan Free met un projet en **pause après 7 jours de faible activité**. Si l'app ou la landing ne répond plus, vérifier d'abord l'état du projet dans le tableau de bord Supabase.
- Les migrations sont dans `supabase/migrations` et se testent avec `./supabase/tests/run.sh` (Postgres jetable, jamais la vraie base).

## Point ouvert : Loi 25
La région `us-west-2` veut dire que les renseignements personnels des utilisateurs sont hébergés hors du Québec. Avant d'inviter des testeurs externes, il faut soit faire l'évaluation des facteurs relatifs à la vie privée (EFVP), soit déplacer la base vers `ca-central-1`. Voir le récit 9.2 (ralphgabriel04/the-project#167).