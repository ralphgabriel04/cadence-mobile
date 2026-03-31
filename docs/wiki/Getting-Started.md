# 🚀 Getting Started

## Prérequis

| Outil | Version | Installation |
|-------|---------|-------------|
| Node.js | 20 LTS | [nodejs.org](https://nodejs.org) |
| pnpm | 10+ | `npm install -g pnpm` |
| Expo CLI | Latest | `npx expo` |
| EAS CLI | Latest | `npm install -g eas-cli` |
| Xcode | 15+ | Mac App Store (iOS) |
| Android Studio | Latest | [developer.android.com](https://developer.android.com/studio) |

## Installation

```bash
# 1. Cloner le repo
git clone https://github.com/ralphgabriel04/cadence-mobile.git
cd cadence-mobile

# 2. Installer les dépendances
pnpm install

# 3. Configurer les variables d'environnement
cp .env.example .env.local
# Remplir les valeurs Supabase

# 4. Lancer le serveur de développement
npx expo start
```

## Variables d'environnement

| Variable | Description |
|----------|-------------|
| `EXPO_PUBLIC_SUPABASE_URL` | URL du projet Supabase |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Clé anonyme Supabase |

## Commandes utiles

| Commande | Description |
|----------|-------------|
| `npx expo start` | Lancer le dev server |
| `npx expo start --ios` | Lancer sur simulateur iOS |
| `npx expo start --android` | Lancer sur émulateur Android |
| `pnpm lint` | Lancer ESLint |
| `pnpm typecheck` | Vérifier les types TypeScript |
| `eas build --platform ios` | Build iOS via EAS |
| `eas build --platform android` | Build Android via EAS |
| `eas submit` | Soumettre aux stores |

## Structure du projet

```
cadence-mobile/
├── app/                  # Expo Router v6 (file-based routing)
│   ├── (auth)/           # Login, Register, Forgot/Reset Password
│   ├── (coach)/          # Tab bar coach (Accueil, Programmes, Athlètes, Profil)
│   ├── (athlete)/        # Tab bar athlète (Aujourd'hui, Historique, Profil)
│   ├── _layout.tsx       # Root layout (AuthProvider)
│   └── index.tsx         # Router: loading → auth → role redirect
├── components/           # Composants React Native
│   └── ui/               # Design system (Button, Input, Text, Card)
├── lib/                  # Supabase client, AuthContext, constants
├── types/                # Types TypeScript (database.ts)
├── hooks/                # Custom hooks (useSupabase)
├── supabase/             # Migrations SQL (14 tables + RLS)
├── assets/               # Images, icônes
└── docs/                 # ADRs + Wiki
```
