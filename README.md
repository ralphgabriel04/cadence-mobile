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
# Installer les dépendances
pnpm install

# Lancer le serveur de développement
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
│   ├── ui/               # Design system (boutons, inputs, cards...)
│   └── features/         # Composants métier
├── lib/                  # Utilitaires et configuration
│   ├── supabase.ts       # Client Supabase
│   ├── auth-context.tsx  # Contexte d'authentification
│   └── utils.ts          # Fonctions utilitaires
├── types/                # Types TypeScript
├── constants/            # Constantes (couleurs, spacing, config)
├── hooks/                # Custom hooks
├── assets/               # Images, fonts, icônes
└── docs/                 # Documentation technique (ADRs, etc.)
```

## Conventions

- **Code** : Anglais (variables, fonctions, commentaires)
- **UI** : Français québécois
- **Commits** : [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `chore:`, `docs:`)
- **Branches** : `main` (prod), `develop` (dev), `feature/issue-N-description`, `release/X.X.X`
- **TypeScript** : Strict mode, zéro `any`, zéro `@ts-ignore`
- **RLS** : Activé sur toutes les tables Supabase

## Versioning

```
0.X.0-alpha.N  → Dev interne (Ralph + Alexandre)
1.0.0-beta.N   → Beta fermée (3-5 coachs + athlètes)
1.0.0-rc.N     → Release candidate
1.0.0          → Production (App Store + Google Play)
```

## Documentation

Voir le [Wiki](../../wiki) pour la documentation complète.

## Liens

- **Issues & Sprint Board** : [GitHub Projects](https://github.com/users/ralphgabriel04/projects)
- **Documentation** : [Notion](https://notion.so)
- **Design** : [Figma](https://figma.com)
- **Repo Web** : [the-project](https://github.com/ralphgabriel04/the-project)

---

*Cadence — Connecte chaque athlète à son coach avec des données actionnables.*
