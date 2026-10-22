# `supabase/scripts/` — scripts manuels, hors migrations

Ce dossier contient des scripts SQL qu'on exécute **à la main**, volontairement,
et jamais automatiquement.

## Pourquoi ce dossier existe

Tout fichier `.sql` placé dans `supabase/migrations/` est exécuté :

- par `supabase db reset` ;
- par toute exécution séquentielle des migrations ;
- par la CI ou un script de déploiement qui rejoue le dossier.

Un script destructif rangé dans `migrations/` finit donc par tourner tout seul,
un jour où quelqu'un lance une commande de routine. Les scripts de ce dossier-ci
ne sont jamais ramassés par ces mécanismes : il faut les invoquer explicitement,
par leur chemin.

**Règle : rien dans `scripts/` ne doit jamais être déplacé vers `migrations/`.**

## `reset-local-only.sql`

Supprime **toutes** les tables applicatives, les triggers, les fonctions et les
types enum du schéma. Les données sont perdues définitivement, il n'y a pas de
retour en arrière.

### Réservé au développement local

À n'exécuter que sur une base jetable : la base locale du `supabase start`, ou
une branche Supabase de développement. **Jamais** sur un projet qui contient des
données réelles.

Ce que ce script effacerait sur la base de production :

| Table | Contenu perdu |
|---|---|
| `waitlist_subscribers` | la liste d'attente de la page d'accueil, qui alimente le compteur public |
| `profiles` | tous les comptes utilisateurs |
| `session_logs`, `exercise_logs` | l'historique d'entraînement complet des athlètes |
| `readiness_logs` | les check-ins quotidiens |
| `programs`, `sessions`, `session_exercises` | tous les programmes et leur contenu |
| `messages`, `conversations` | toute la messagerie |

`waitlist_subscribers` mérite une mention particulière : elle est alimentée par
la page d'accueil publique, elle est **en production**, et elle n'est reconstruite
par aucune migration. Une fois vidée, elle est irrécupérable sans sauvegarde.

### Deux garde-fous

Le script refuse de s'exécuter dans deux cas.

1. **Opt-in explicite manquant.** Il faut avoir positionné le drapeau dans la
   session courante, sinon le script s'arrête avant le premier `DROP`.
2. **Canari de production.** Si la table `waitlist_subscribers` existe et
   contient au moins une ligne, le script considère que la base porte des
   données réelles et s'arrête.

Ces garde-fous réduisent le risque, ils ne le suppriment pas. Ils ne remplacent
pas la vérification de la base sur laquelle tu es connecté.

### Utilisation

```sql
-- 1. Vérifier d'abord sur quelle base tu es connecté
SELECT current_database(), current_user, inet_server_addr();

-- 2. Autoriser explicitement la destruction, pour cette session uniquement
SET cadence.allow_destructive_reset = 'yes';

-- 3. Lancer le reset
\i supabase/scripts/reset-local-only.sql

-- 4. Reconstruire le schéma
\i supabase/migrations/001_initial_schema.sql
```

Via la CLI Supabase en local :

```bash
supabase start
psql "$(supabase status -o env | grep DB_URL | cut -d= -f2-)" \
  -c "SET cadence.allow_destructive_reset = 'yes';" \
  -f supabase/scripts/reset-local-only.sql
```

### Avant de l'exécuter sur autre chose que ta base locale

Ne le fais pas. Si tu penses vraiment en avoir besoin sur une base partagée :

1. prends une sauvegarde et **vérifie qu'elle se restaure** ;
2. écris le plan de retour arrière avant, pas après ;
3. fais-toi relire par quelqu'un d'autre.
