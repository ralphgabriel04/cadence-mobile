# Cadence Mobile

> L'app qui connecte entraîneurs et athlètes autour de la performance mesurable.

## Stack technique

- **React Native** 0.81 + Expo SDK 54
- **Expo Router v6** — Navigation file-based
- **NativeWind v4** — Tailwind CSS 3.4 pour React Native
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
├── app/                  # Routes (Expo Router v6)
│   ├── (auth)/           # Login, Register, Forgot/Reset Password
│   ├── (coach)/          # Tab bar coach (Accueil, Programmes, Athlètes, Profil)
│   ├── (athlete)/        # Tab bar athlète (Aujourd'hui, Historique, Profil)
│   ├── _layout.tsx       # Root layout (AuthProvider)
│   └── index.tsx         # Router: loading → auth → role redirect
├── components/           # Composants réutilisables
│   └── ui/               # Design system (Button, Input, Text, Card)
├── lib/                  # Utilitaires et configuration
│   ├── supabase.ts       # Client Supabase + SecureStore adapter
│   ├── auth-context.tsx  # AuthProvider + useAuth hook
│   └── constants.ts      # Variables d'environnement
├── types/                # Types TypeScript (database.ts)
├── hooks/                # Custom hooks (useSupabase)
├── supabase/             # Migrations SQL (14 tables + RLS)
├── assets/               # Images, icônes
└── docs/                 # ADRs + Wiki
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
