# Database Schema

## Vue d'ensemble

Cadence utilise **PostgreSQL via Supabase** avec **Row Level Security (RLS)** active sur toutes les tables. Le schema est partage entre le web et le mobile.

**14 tables**, toutes avec : `id UUID PK`, `created_at`, `updated_at`, `is_deleted`, `deleted_at` (soft delete).

Source de verite : [`supabase/migrations/001_initial_schema.sql`](../../supabase/migrations/001_initial_schema.sql)

## Enums PostgreSQL

| Enum                  | Valeurs                                                      |
|-----------------------|--------------------------------------------------------------|
| `user_role`           | coach, athlete                                               |
| `relationship_status` | pending, active, inactive                                    |
| `program_status`      | draft, active, archived                                      |
| `assignment_status`   | active, completed, paused                                    |
| `session_log_status`  | in_progress, completed, skipped                              |
| `exercise_category`   | strength, cardio, flexibility, mobility, plyometrics, other  |
| `difficulty_level`    | beginner, intermediate, advanced                             |
| `message_type`        | text, image, session_log                                     |

## Tables

### 1. `profiles`

Extension de `auth.users`. Auto-cree par trigger `handle_new_user()`.

| Colonne | Type | Description |
|---------|------|-------------|
| id | uuid (PK, FK -> auth.users) | ID utilisateur |
| email | text | Courriel |
| first_name | text | Prenom |
| last_name | text | Nom de famille |
| role | user_role | Coach ou athlete |
| avatar_url | text | URL avatar |
| phone | text | Telephone |
| bio | text | Biographie |
| timezone | text | Fuseau horaire (defaut: America/Toronto) |
| preferred_language | text | Langue (defaut: fr) |
| onboarding_completed | boolean | Onboarding termine |
| last_active_at | timestamptz | Derniere activite |

**RLS** : SELECT pour tout authentifie, UPDATE par le proprietaire uniquement.

### 2. `coach_athletes`

Relation many-to-many entre coachs et athletes.

| Colonne | Type | Description |
|---------|------|-------------|
| coach_id | uuid (FK -> profiles) | Coach |
| athlete_id | uuid (FK -> profiles) | Athlete |
| status | relationship_status | Statut de la relation |
| invited_at | timestamptz | Date d'invitation |
| accepted_at | timestamptz | Date d'acceptation |
| notes | text | Notes du coach |

**Contrainte** : UNIQUE (coach_id, athlete_id)

**RLS** : Coach CRUD sur ses relations, athlete SELECT ses propres.

### 3. `exercises`

Bibliotheque d'exercices reutilisables du coach.

| Colonne | Type | Description |
|---------|------|-------------|
| coach_id | uuid (FK -> profiles) | Coach proprietaire |
| name | text | Nom de l'exercice |
| description | text | Description |
| category | exercise_category | Type d'exercice |
| equipment | text | Equipement necessaire |
| muscle_groups | text[] | Groupes musculaires cibles |
| video_url | text | URL video demonstrative |
| instructions | text | Instructions detaillees |

**RLS** : Coach CRUD ses exercices.

### 4. `programs`

Programmes d'entrainement crees par les coachs.

| Colonne | Type | Description |
|---------|------|-------------|
| coach_id | uuid (FK -> profiles) | Createur |
| name | text | Nom du programme |
| description | text | Description |
| duration_weeks | integer | Duree en semaines |
| goal | text | Objectif |
| difficulty | difficulty_level | Niveau de difficulte |
| status | program_status | draft, active, archived |
| is_template | boolean | Programme template reutilisable |

**RLS** : Coach CRUD ses programmes, athletes SELECT via program_assignments.

### 5. `sessions`

Seances d'entrainement dans un programme.

| Colonne | Type | Description |
|---------|------|-------------|
| program_id | uuid (FK -> programs) | Programme parent |
| name | text | Nom de la seance |
| description | text | Description |
| day_of_week | integer (1-7) | Jour de la semaine |
| week_number | integer (>= 1) | Semaine dans le programme |
| order_index | integer | Ordre d'affichage |
| estimated_duration_minutes | integer | Duree estimee |

**RLS** : Herite du programme parent (JOIN).

### 6. `session_exercises`

Table de jonction : lie les exercices de la bibliotheque aux seances avec parametres specifiques.

| Colonne | Type | Description |
|---------|------|-------------|
| session_id | uuid (FK -> sessions) | Seance |
| exercise_id | uuid (FK -> exercises) | Exercice de la bibliotheque |
| order_index | integer | Ordre dans la seance |
| sets | integer | Nombre de series |
| reps | text | Repetitions (ex: "8-12") |
| weight_suggestion | text | Poids suggere |
| rest_seconds | integer | Repos entre series |
| tempo | text | Tempo (ex: "3-1-2-0") |
| notes | text | Instructions specifiques |
| superset_group | integer | Groupe de superset |

**RLS** : Herite du programme parent (JOIN sessions -> programs).

### 7. `program_assignments`

Assignation d'un programme a un athlete.

| Colonne | Type | Description |
|---------|------|-------------|
| program_id | uuid (FK -> programs) | Programme |
| athlete_id | uuid (FK -> profiles) | Athlete |
| coach_id | uuid (FK -> profiles) | Coach |
| start_date | date | Date de debut |
| end_date | date | Date de fin |
| status | assignment_status | active, completed, paused |

**RLS** : Coach CRUD ses assignations, athlete SELECT ses propres.

### 8. `session_logs`

Logs de completion d'une seance par un athlete.

| Colonne | Type | Description |
|---------|------|-------------|
| session_id | uuid (FK -> sessions) | Seance |
| athlete_id | uuid (FK -> profiles) | Athlete |
| program_assignment_id | uuid (FK -> program_assignments) | Assignation |
| started_at | timestamptz | Debut |
| completed_at | timestamptz | Fin |
| duration_minutes | integer | Duree reelle |
| overall_rpe | integer (1-10) | Effort percu global |
| notes | text | Notes de l'athlete |
| status | session_log_status | in_progress, completed, skipped |

**RLS** : Athlete CRUD ses logs, coach SELECT pour ses athletes.

### 9. `exercise_logs`

Logs detailles par exercice et par serie.

| Colonne | Type | Description |
|---------|------|-------------|
| session_log_id | uuid (FK -> session_logs) | Log de seance |
| exercise_id | uuid (FK -> exercises) | Exercice |
| session_exercise_id | uuid (FK -> session_exercises) | Ref session_exercise |
| set_number | integer | Numero de serie |
| reps_completed | integer | Reps completees |
| weight_kg | numeric | Poids utilise (kg) |
| rpe | integer (1-10) | Effort percu |
| duration_seconds | integer | Duree (cardio) |
| distance_meters | numeric | Distance (cardio) |
| is_pr | boolean | Record personnel |
| notes | text | Notes |

**RLS** : Herite du session_log parent (JOIN).

### 10. `readiness_logs`

Formulaire de readiness quotidien de l'athlete.

| Colonne | Type | Description |
|---------|------|-------------|
| athlete_id | uuid (FK -> profiles) | Athlete |
| log_date | date | Date |
| sleep_quality | integer (1-5) | Qualite du sommeil |
| energy_level | integer (1-5) | Niveau d'energie |
| muscle_soreness | integer (1-5) | Douleurs musculaires |
| stress_level | integer (1-5) | Niveau de stress |
| motivation | integer (1-5) | Motivation |
| overall_readiness | numeric (GENERATED) | Score calcule automatiquement |
| notes | text | Notes libres |

**Contrainte** : UNIQUE (athlete_id, log_date)

**RLS** : Athlete CRUD ses logs, coach SELECT pour ses athletes.

### 11. `conversations`

Conversations de messagerie coach-athlete.

| Colonne | Type | Description |
|---------|------|-------------|
| coach_id | uuid (FK -> profiles) | Coach |
| athlete_id | uuid (FK -> profiles) | Athlete |
| last_message_at | timestamptz | Dernier message |

**Contrainte** : UNIQUE (coach_id, athlete_id)

**RLS** : Visible et modifiable par les deux participants.

### 12. `messages`

Messages dans une conversation.

| Colonne | Type | Description |
|---------|------|-------------|
| conversation_id | uuid (FK -> conversations) | Conversation |
| sender_id | uuid (FK -> profiles) | Expediteur |
| content | text | Contenu |
| message_type | message_type | text, image, session_log |
| related_session_log_id | uuid (FK -> session_logs) | Ref optionnelle |
| read_at | timestamptz | Date de lecture |

**RLS** : Visible par les participants de la conversation.

### 13. `session_images`

Photos attachees aux logs de seance.

| Colonne | Type | Description |
|---------|------|-------------|
| session_log_id | uuid (FK -> session_logs) | Log parent |
| athlete_id | uuid (FK -> profiles) | Athlete |
| image_url | text | URL dans Supabase Storage |
| caption | text | Legende |

**RLS** : Athlete CRUD ses images, coach SELECT pour ses athletes.

### 14. `coach_notes`

Notes privees du coach sur un athlete ou une seance.

| Colonne | Type | Description |
|---------|------|-------------|
| coach_id | uuid (FK -> profiles) | Coach |
| athlete_id | uuid (FK -> profiles) | Athlete concerne |
| session_log_id | uuid (FK -> session_logs) | Ref optionnelle |
| content | text | Contenu de la note |
| is_private | boolean | Toujours prive (defaut: true) |

**RLS** : Coach uniquement — l'athlete n'a **jamais** acces.

## Triggers

| Trigger                | Table      | Description                                |
|------------------------|------------|--------------------------------------------|
| `on_auth_user_created` | auth.users | Auto-cree un profil dans `profiles`        |
| `update_*_updated_at`  | Toutes     | Met a jour `updated_at` sur chaque UPDATE  |

## Conventions

- Toutes les tables utilisent `uuid` comme cle primaire (`gen_random_uuid()`)
- `created_at` et `updated_at` sont en `timestamptz`
- Soft delete : `is_deleted BOOLEAN DEFAULT FALSE` + `deleted_at TIMESTAMPTZ`
- RLS est **toujours** active — toutes les policies filtrent `WHERE NOT is_deleted`
- Les index sont des **partial indexes** `WHERE NOT is_deleted`
- Les enums utilisent des types PostgreSQL natifs
- Les foreign keys ont des `ON DELETE CASCADE` appropries
