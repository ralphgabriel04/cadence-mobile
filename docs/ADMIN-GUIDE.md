# Guide d'administration — Cadence Mobile

> Ce guide explique comment modifier les points importants de l'application Cadence Mobile.
> Dernière mise à jour : Sprint 1 (2026-03-31)

---

## Table des matières

1. [Architecture de l'app](#1-architecture-de-lapp)
2. [Gestion des utilisateurs (Supabase)](#2-gestion-des-utilisateurs-supabase)
3. [Authentification](#3-authentification)
4. [Base de données](#4-base-de-données)
5. [Routes et navigation](#5-routes-et-navigation)
6. [Composants UI](#6-composants-ui)
7. [Variables d'environnement](#7-variables-denvironnement)
8. [Build et déploiement](#8-build-et-déploiement)

---

## 1. Architecture de l'app

```
cadence-mobile/
├── app/                        # Écrans (Expo Router file-based routing)
│   ├── _layout.tsx             # Layout racine (AuthProvider, Stack)
│   ├── index.tsx               # Point d'entrée — redirige selon rôle
│   ├── (auth)/                 # Groupe auth (non-connectés)
│   │   ├── _layout.tsx         # Redirige vers coach/athlete si déjà connecté
│   │   ├── login.tsx           # Écran de connexion
│   │   ├── register.tsx        # Écran d'inscription
│   │   ├── forgot-password.tsx # Mot de passe oublié
│   │   └── reset-password.tsx  # Réinitialisation du mot de passe
│   ├── (coach)/                # Groupe coach (tab bar)
│   │   ├── _layout.tsx         # Auth guard + Tabs (Accueil, Programmes, Athlètes, Profil)
│   │   ├── index.tsx           # Dashboard coach (placeholder)
│   │   ├── programs.tsx        # Gestion des programmes (placeholder)
│   │   ├── athletes.tsx        # Liste des athlètes (placeholder)
│   │   └── profile.tsx         # Profil coach
│   └── (athlete)/              # Groupe athlète (tab bar)
│       ├── _layout.tsx         # Auth guard + Tabs (Aujourd'hui, Historique, Profil)
│       ├── index.tsx           # Entraînement du jour (placeholder)
│       ├── history.tsx         # Historique (placeholder)
│       └── profile.tsx         # Profil athlète
├── components/ui/              # Composants réutilisables
│   ├── Button.tsx              # Bouton (primary, secondary, outline, ghost, danger)
│   ├── Input.tsx               # Champ de saisie avec label et erreur
│   ├── Text.tsx                # Texte (heading, body, caption, error)
│   └── Card.tsx                # Conteneur carte avec ombre
├── lib/                        # Utilitaires et services
│   ├── supabase.ts             # Client Supabase singleton
│   ├── auth-context.tsx        # AuthProvider + useAuth hook
│   ├── constants.ts            # Variables d'environnement
│   └── mask-email.ts           # Masquage d'email (sécurité)
├── hooks/
│   └── useSupabase.ts          # Hook Supabase
├── types/
│   └── database.ts             # Types TypeScript de la DB
├── supabase/
│   ├── config.toml             # Configuration Supabase CLI
│   └── migrations/
│       └── 001_initial_schema.sql  # Schéma complet (14 tables + RLS)
└── .env.local                  # Secrets (gitignored)
```

---

## 2. Gestion des utilisateurs (Supabase)

### Dashboard Supabase

- **URL** : https://supabase.com/dashboard/project/iijmwbaaauihqxqxxwce
- **Utilisateurs auth** : `/auth/users`
- **Table profiles** : `/editor` → table `profiles`

### Supprimer un utilisateur

1. Aller sur **Authentication → Users**
2. Trouver l'utilisateur par email
3. Cliquer sur les **3 points** → **Delete user**
4. Cela supprime l'entrée auth ET le profil associé (cascade)

### Changer le rôle d'un utilisateur

1. Aller sur **Table Editor → profiles**
2. Trouver le profil par email ou ID
3. Modifier la colonne `role` → `coach` ou `athlete`
4. Sauvegarder
5. L'utilisateur devra se déconnecter/reconnecter pour voir le changement

### Confirmer manuellement un email

1. Aller sur **Authentication → Users**
2. Trouver l'utilisateur
3. Cliquer sur les 3 points → **Confirm email**

### Voir/modifier les données d'un profil

| Colonne | Description | Modifiable |
|---------|-------------|------------|
| `id` | UUID (= auth.users.id) | Non |
| `email` | Courriel | Oui |
| `first_name` | Prénom | Oui |
| `last_name` | Nom | Oui |
| `role` | `coach` ou `athlete` | Oui |
| `avatar_url` | URL de l'avatar | Oui |
| `onboarding_completed` | Onboarding terminé | Oui |

---

## 3. Authentification

### Fichier principal : `lib/auth-context.tsx`

Ce fichier contient toute la logique d'auth. Voici comment modifier chaque aspect :

### Modifier les champs d'inscription

1. **Ajouter un champ au formulaire** : `app/(auth)/register.tsx`
   - Ajouter un `useState` pour le nouveau champ
   - Ajouter un composant `<Input>` dans le JSX
   - Passer le champ dans `signUp({ ... })`

2. **Sauvegarder le champ en DB** : `lib/auth-context.tsx` → fonction `signUp()`
   - Ajouter le champ dans l'objet `options.data` (metadata auth)
   - Ajouter le champ dans l'upsert `supabase.from("profiles").upsert({ ... })`

3. **Mettre à jour le type Profile** : `lib/auth-context.tsx` ligne ~12
   ```typescript
   type Profile = {
     id: string;
     email: string;
     first_name: string;
     last_name: string;
     role: "coach" | "athlete";
     avatar_url: string | null;
     onboarding_completed: boolean;
     // Ajouter le nouveau champ ici
   };
   ```

4. **Mettre à jour le SELECT** : `lib/auth-context.tsx` → `fetchProfile()`
   - Ajouter le nom de la colonne dans `.select("id, email, ... , nouveau_champ")`

### Modifier les messages d'erreur

Tous les messages sont en français dans `lib/auth-context.tsx` :

| Message | Localisation |
|---------|-------------|
| `"Courriel ou mot de passe incorrect"` | `signIn()` |
| `"Ce courriel est déjà utilisé"` | `signUp()` |

Et dans `app/(auth)/register.tsx` :

| Message | Contexte |
|---------|---------|
| `"Veuillez remplir tous les champs"` | Champs vides |
| `"Courriel invalide"` | Format email invalide |
| `"Minimum 8 caractères"` | Mot de passe trop court |
| `"Au moins 1 majuscule requise"` | Pas de majuscule |
| `"Au moins 1 chiffre requis"` | Pas de chiffre |
| `"Les mots de passe ne correspondent pas"` | Confirmation différente |

### Modifier les règles de validation du mot de passe

Fichier : `app/(auth)/register.tsx` → fonction `validatePassword()`

```typescript
function validatePassword(password: string) {
  if (password.length < 8) return "Minimum 8 caractères";
  if (!/[A-Z]/.test(password)) return "Au moins 1 majuscule requise";
  if (!/\d/.test(password)) return "Au moins 1 chiffre requis";
  return null;
}
```

### Modifier le deep link de reset password

Fichier : `lib/auth-context.tsx` → `resetPassword()`

```typescript
redirectTo: "cadence://reset-password"
```

Le scheme `cadence://` est défini dans `app.json` → `"scheme": "cadence"`.

---

## 4. Base de données

### Schéma complet : `supabase/migrations/001_initial_schema.sql`

14 tables avec RLS (Row Level Security) activé sur chacune.

| Table | Description | Rôle principal |
|-------|-------------|----------------|
| `profiles` | Profils utilisateurs | Tous |
| `coach_athletes` | Relations coach-athlète | Coach |
| `exercises` | Bibliothèque d'exercices | Coach |
| `programs` | Programmes d'entraînement | Coach |
| `sessions` | Séances dans un programme | Coach |
| `session_exercises` | Exercices dans une séance | Coach |
| `program_assignments` | Attribution programme → athlète | Coach |
| `session_logs` | Journaux de séances complétées | Athlète |
| `exercise_logs` | Journaux d'exercices (sets, reps, poids) | Athlète |
| `readiness_logs` | Questionnaire de disponibilité | Athlète |
| `conversations` | Conversations coach-athlète | Tous |
| `messages` | Messages dans une conversation | Tous |
| `session_images` | Photos liées à une séance | Athlète |
| `coach_notes` | Notes privées du coach | Coach |

### Appliquer le schéma à Supabase

```bash
cd cadence-mobile
npx supabase db push
```

> **Important** : Cette commande n'a pas encore été exécutée. Le trigger `handle_new_user()` et les tables ne sont pas encore créés dans Supabase.

### Ajouter une nouvelle table

1. Créer un nouveau fichier de migration :
   ```bash
   npx supabase migration new nom_de_la_migration
   ```
2. Écrire le SQL dans le fichier généré (`supabase/migrations/xxx_nom.sql`)
3. Appliquer : `npx supabase db push`
4. Régénérer les types : `npx supabase gen types typescript --project-id iijmwbaaauihqxqxxwce > types/database.ts`

### Modifier une table existante

1. Créer une nouvelle migration (NE PAS modifier `001_initial_schema.sql`)
2. Écrire un `ALTER TABLE` dans le fichier
3. Appliquer et régénérer les types

### Modifier les politiques RLS

Les policies sont dans `001_initial_schema.sql`. Pour les modifier :

1. Créer une nouvelle migration
2. `DROP POLICY IF EXISTS "nom_policy" ON table;`
3. `CREATE POLICY "nouveau_nom" ON table ...;`
4. Appliquer : `npx supabase db push`

### Convention soft delete

Toutes les tables ont :
- `is_deleted BOOLEAN DEFAULT false`
- `deleted_at TIMESTAMPTZ`

Les queries doivent filtrer avec `WHERE NOT is_deleted` (ou utiliser les index partiels).

---

## 5. Routes et navigation

### Flux de routing

```
app/index.tsx
  ├── loading → splash screen
  ├── pas de session → (auth)/login
  ├── role = "coach" → (coach)/
  └── role = "athlete" (ou autre) → (athlete)/
```

### Ajouter un nouvel écran (coach)

1. Créer `app/(coach)/nouvel-ecran.tsx`
2. Ajouter le tab dans `app/(coach)/_layout.tsx` :
   ```tsx
   <Tabs.Screen
     name="nouvel-ecran"
     options={{ title: "Mon Écran" }}
   />
   ```

### Ajouter un nouvel écran (athlète)

1. Créer `app/(athlete)/nouvel-ecran.tsx`
2. Ajouter le tab dans `app/(athlete)/_layout.tsx`

### Ajouter un écran auth (sans tab bar)

1. Créer `app/(auth)/nouvel-ecran.tsx`
2. Il sera automatiquement dans le Stack navigator du groupe auth

### Modifier les onglets de la tab bar

**Coach** — `app/(coach)/_layout.tsx` :
- Onglets actuels : Accueil, Programmes, Athlètes, Profil

**Athlète** — `app/(athlete)/_layout.tsx` :
- Onglets actuels : Aujourd'hui, Historique, Profil

Pour réordonner : changer l'ordre des `<Tabs.Screen>` dans le JSX.
Pour renommer : modifier `options={{ title: "Nouveau nom" }}`.

### Ajouter un nouveau rôle

1. Modifier le type dans `lib/auth-context.tsx` :
   ```typescript
   role: "coach" | "athlete" | "nouveau_role";
   ```
2. Créer `app/(nouveau_role)/_layout.tsx` avec auth guard
3. Mettre à jour `app/index.tsx` pour gérer la redirection
4. Mettre à jour `app/(auth)/_layout.tsx` pour la redirection post-connexion
5. Ajouter le rôle dans le sélecteur de `app/(auth)/register.tsx`
6. Mettre à jour le schema DB (`profiles.role` enum) et les policies RLS

---

## 6. Composants UI

### Tous dans `components/ui/`

| Composant | Props principales | Variants |
|-----------|-------------------|----------|
| `Button` | `title`, `onPress`, `loading`, `disabled`, `variant` | primary, secondary, outline, ghost, danger |
| `Input` | `label`, `value`, `onChangeText`, `error`, `secureTextEntry` | — |
| `Text` | `children`, `variant`, `className` | heading, body, caption, error |
| `Card` | `children`, `className` | — |

### Modifier un composant

Chaque composant utilise **NativeWind** (Tailwind CSS classes). Modifier les classes dans le fichier du composant.

### Ajouter un nouveau composant

1. Créer `components/ui/NomComposant.tsx`
2. Utiliser `className` avec NativeWind pour le style
3. Supporter le dark mode avec `dark:` prefix (ex: `dark:bg-gray-800`)

---

## 7. Variables d'environnement

### Fichier : `.env.local` (gitignored)

```
EXPO_PUBLIC_SUPABASE_URL=https://iijmwbaaauihqxqxxwce.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
```

### Ajouter une variable

1. Ajouter dans `.env.local` avec le préfixe `EXPO_PUBLIC_`
2. Ajouter dans `.env.example` (sans la valeur réelle)
3. Référencer dans `lib/constants.ts`
4. Ajouter la validation dans `lib/supabase.ts` si critique

> **Important** : Seules les variables avec le préfixe `EXPO_PUBLIC_` sont accessibles dans le code côté client. Ne jamais mettre la `service_role` key ici.

---

## 8. Build et déploiement

### Développement local

```bash
cd cadence-mobile
pnpm install
npx expo start
```

Scanner le QR code avec Expo Go sur le téléphone (même réseau Wi-Fi).

### Build preview (APK Android)

```bash
eas build --profile preview --platform android
```

### Build production

```bash
eas build --profile production --platform android
eas build --profile production --platform ios
```

### Configuration EAS : `eas.json`

3 profils de build :
- `development` — client de développement
- `preview` — APK interne pour tests
- `production` — build de production

### Vérifier le TypeScript

```bash
npx tsc --noEmit
```

### Firewall (Windows — dev local avec téléphone)

Si le téléphone ne se connecte pas au Metro bundler :

```powershell
# Exécuter en admin
netsh advfirewall firewall add rule name="Expo Metro" dir=in action=allow protocol=TCP localport=8081 profile=any
```
