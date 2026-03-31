# 🗃️ Database Schema

## Vue d'ensemble

Cadence utilise **PostgreSQL via Supabase** avec **Row Level Security (RLS)** activé sur toutes les tables. Le schéma est partagé entre le web et le mobile.

## Tables

### `profiles`
Extension de `auth.users`. Contient les infos publiques de l'utilisateur.

| Colonne | Type | Description |
|---------|------|-------------|
| id | uuid (PK, FK → auth.users) | ID utilisateur |
| full_name | text | Nom complet |
| avatar_url | text | URL de l'avatar |
| role | enum('coach', 'athlete') | Rôle principal |
| created_at | timestamptz | Date de création |
| updated_at | timestamptz | Dernière mise à jour |

**RLS** : Lecture publique, écriture par le propriétaire uniquement.

### `coach_athletes`
Relation many-to-many entre coachs et athlètes.

| Colonne | Type | Description |
|---------|------|-------------|
| id | uuid (PK) | ID relation |
| coach_id | uuid (FK → profiles) | Coach |
| athlete_id | uuid (FK → profiles) | Athlète |
| status | enum('pending', 'active', 'inactive') | Statut |
| created_at | timestamptz | Date de création |

**RLS** : Visible par le coach et l'athlète concernés.

### `programs`
Programmes d'entraînement créés par les coachs.

| Colonne | Type | Description |
|---------|------|-------------|
| id | uuid (PK) | ID programme |
| coach_id | uuid (FK → profiles) | Créateur |
| name | text | Nom du programme |
| description | text | Description |
| duration_weeks | integer | Durée en semaines |
| created_at | timestamptz | Date de création |

**RLS** : CRUD par le coach créateur, lecture par les athlètes assignés.

### `program_assignments`
Assignation d'un programme à un athlète.

| Colonne | Type | Description |
|---------|------|-------------|
| id | uuid (PK) | ID assignation |
| program_id | uuid (FK → programs) | Programme |
| athlete_id | uuid (FK → profiles) | Athlète |
| start_date | date | Date de début |
| status | enum('active', 'completed', 'paused') | Statut |

**RLS** : Visible par le coach du programme et l'athlète assigné.

### `sessions`
Séances d'entraînement dans un programme.

| Colonne | Type | Description |
|---------|------|-------------|
| id | uuid (PK) | ID séance |
| program_id | uuid (FK → programs) | Programme parent |
| name | text | Nom de la séance |
| day_of_week | integer | Jour (1-7) |
| week_number | integer | Semaine dans le programme |
| order_index | integer | Ordre d'affichage |

**RLS** : Hérité du programme parent.

### `exercises`
Exercices dans une séance.

| Colonne | Type | Description |
|---------|------|-------------|
| id | uuid (PK) | ID exercice |
| session_id | uuid (FK → sessions) | Séance parent |
| name | text | Nom de l'exercice |
| sets | integer | Nombre de séries |
| reps | text | Répétitions (ex: "8-12") |
| rest_seconds | integer | Repos entre séries |
| notes | text | Instructions du coach |
| order_index | integer | Ordre d'affichage |
| type | enum('strength', 'cardio', 'flexibility', 'other') | Type |

**RLS** : Hérité du programme parent.

### `session_logs`
Logs de complétion d'une séance par un athlète.

| Colonne | Type | Description |
|---------|------|-------------|
| id | uuid (PK) | ID log |
| session_id | uuid (FK → sessions) | Séance |
| athlete_id | uuid (FK → profiles) | Athlète |
| completed_at | timestamptz | Date de complétion |
| duration_minutes | integer | Durée réelle |
| rpe | integer (1-10) | Effort perçu |
| notes | text | Notes de l'athlète |

**RLS** : Écriture par l'athlète, lecture par l'athlète et son coach.

### `exercise_logs`
Logs détaillés par exercice.

| Colonne | Type | Description |
|---------|------|-------------|
| id | uuid (PK) | ID log |
| session_log_id | uuid (FK → session_logs) | Log de séance |
| exercise_id | uuid (FK → exercises) | Exercice |
| sets_completed | integer | Séries complétées |
| reps_completed | text | Reps par série (JSON) |
| weight | numeric | Poids utilisé |
| notes | text | Notes |

**RLS** : Hérité du session_log parent.

### `session_images`
Photos attachées aux logs de séance.

| Colonne | Type | Description |
|---------|------|-------------|
| id | uuid (PK) | ID image |
| session_log_id | uuid (FK → session_logs) | Log parent |
| image_url | text | URL dans Supabase Storage |
| created_at | timestamptz | Date d'upload |

**RLS** : Écriture par l'athlète, lecture par l'athlète et son coach.

### `conversations`
Conversations de messagerie.

| Colonne | Type | Description |
|---------|------|-------------|
| id | uuid (PK) | ID conversation |
| coach_id | uuid (FK → profiles) | Coach |
| athlete_id | uuid (FK → profiles) | Athlète |
| created_at | timestamptz | Date de création |

**RLS** : Visible uniquement par les deux participants.

### `messages`
Messages dans une conversation.

| Colonne | Type | Description |
|---------|------|-------------|
| id | uuid (PK) | ID message |
| conversation_id | uuid (FK → conversations) | Conversation |
| sender_id | uuid (FK → profiles) | Expéditeur |
| content | text | Contenu du message |
| created_at | timestamptz | Date d'envoi |
| read_at | timestamptz | Date de lecture |

**RLS** : Visible par les participants de la conversation.

### `readiness_logs`
Formulaire de readiness quotidien de l'athlète.

| Colonne | Type | Description |
|---------|------|-------------|
| id | uuid (PK) | ID log |
| athlete_id | uuid (FK → profiles) | Athlète |
| date | date | Date |
| sleep_quality | integer (1-5) | Qualité du sommeil |
| energy_level | integer (1-5) | Niveau d'énergie |
| stress_level | integer (1-5) | Niveau de stress |
| muscle_soreness | integer (1-5) | Douleurs musculaires |
| motivation | integer (1-5) | Motivation |
| notes | text | Notes libres |

**RLS** : Écriture par l'athlète, lecture par l'athlète et son coach.

### `coach_messages`
Messages broadcast du coach vers tous ses athlètes.

| Colonne | Type | Description |
|---------|------|-------------|
| id | uuid (PK) | ID message |
| coach_id | uuid (FK → profiles) | Coach |
| content | text | Contenu |
| created_at | timestamptz | Date d'envoi |

**RLS** : Écriture par le coach, lecture par ses athlètes.

### `motivational_quotes`
Citations motivationnelles affichées dans l'app.

| Colonne | Type | Description |
|---------|------|-------------|
| id | uuid (PK) | ID citation |
| content | text | Texte de la citation |
| author | text | Auteur |
| category | text | Catégorie |

**RLS** : Lecture publique.

## Conventions

- Toutes les tables utilisent `uuid` comme clé primaire
- `created_at` et `updated_at` sont en `timestamptz`
- RLS est **toujours** activé — aucune table n'est publique en écriture
- Les enums utilisent des types PostgreSQL natifs
- Les foreign keys ont des `ON DELETE CASCADE` appropriés
