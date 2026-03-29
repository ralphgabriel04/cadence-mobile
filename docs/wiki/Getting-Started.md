# 🚀 Getting Started

## Prérequis

| Outil | Version | Installation |
|-------|---------|-------------|
| Node.js | 20 LTS | [nodejs.org](https://nodejs.org) |
| pnpm | 9+ | `npm install -g pnpm` |
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
| `pnpm test` | Lancer les tests |
| `eas build --platform ios` | Build iOS via EAS |
| `eas build --platform android` | Build Android via EAS |
| `eas submit` | Soumettre aux stores |

## Structure du projet

```
cadence-mobile/
├── app/                  # Expo Router (file-based routing)
│   ├── (auth)/           # Écrans d'authentification
│   ├── (tabs)/           # Navigation par onglets
│   │   ├── coach/        # Vue coach
│   │   └── athlete/      # Vue athlète
│   ├── _layout.tsx       # Root layout
│   └── index.tsx         # Entry point
├── components/           # Composants React Native
│   ├── ui/               # Composants UI réutilisables
│   └── features/         # Composants métier
├── lib/                  # Utilitaires, Supabase client
├── types/                # Types TypeScript
├── constants/            # Constantes (couleurs, config)
├── hooks/                # Custom hooks
└── assets/               # Images, fonts
```
