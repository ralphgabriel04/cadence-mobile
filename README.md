# Cadence Mobile

> L'app qui connecte entraîneurs et athlètes autour de la performance mesurable.

## Stack technique

- **React Native** + Expo SDK 52+
- **Expo Router v4** — Navigation file-based
- **NativeWind v4** — Tailwind CSS pour React Native
- **Supabase** — Auth + PostgreSQL + RLS + Realtime + Storage
- **TypeScript strict** — Zéro `any`

## Démarrage rapide

```bash
pnpm install
npx expo start
```

## Structure du projet

```
cadence-mobile/
├── app/                  # Routes (Expo Router v4)
│   ├── (auth)/           # Écrans d'authentification  
│   ├── (tabs)/           # Navigation principale
│   │   ├── coach/        # Écrans coach
│   │   └── athlete/      # Écrans athlète
│   └── _layout.tsx       # Layout racine
├── components/           # Composants réutilisables
│   ├── ui/               # Design system
│   └── features/         # Composants métier
├── lib/                  # Utilitaires et configuration
├── types/                # Types TypeScript
├── constants/            # Constantes
├── hooks/                # Custom hooks
├── assets/               # Images, fonts, icônes
└── docs/                 # Documentation technique
```

## Conventions

- **Code** : Anglais (variables, fonctions, commentaires)
- **UI** : Français québécois
- **Commits** : Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`)
- **Branches** : `main` (prod), `develop` (dev), `feature/issue-N-description`
- **TypeScript** : Strict mode, zéro `any`, zéro `@ts-ignore`
- **RLS** : Activé sur toutes les tables Supabase

## Versioning

```
0.X.0-alpha.N  → Dev interne (Ralph + Alexandre)
1.0.0-beta.N   → Beta fermée
1.0.0-rc.N     → Release candidate
1.0.0          → Production (App Store + Google Play)
```

## Documentation

Voir le [Wiki](../../wiki) pour la documentation complète.

## Liens

- [GitHub Projects](https://github.com/users/ralphgabriel04/projects)
- [the-project (repo web)](https://github.com/ralphgabriel04/the-project)

---

*Cadence — Connecte chaque athlète à son coach avec des données actionnables.*
