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

## Security

Cadence handles health-related data and takes security seriously:

- **Dependabot** monitors dependencies weekly for vulnerabilities
- **ESLint Security Plugin** enforces secure coding patterns
- **TruffleHog** scans for accidentally committed secrets
- **pnpm audit** runs on every PR

```bash
# Run security audit locally
./scripts/audit-deps.sh

# Just audit dependencies
pnpm audit

# Security-focused lint
pnpm lint:security
```

See [docs/SECURITY.md](docs/SECURITY.md) for our full security policy.

## Development Workflow

### Local Development

```bash
# Install dependencies
pnpm install

# Run all CI checks locally before pushing
pnpm ci

# Individual checks
pnpm lint          # ESLint (zero warnings tolerated)
pnpm type-check    # TypeScript strict mode
pnpm test          # Jest unit tests
pnpm build         # Expo export (verify compilation)

# Format code
pnpm format        # Auto-fix formatting with Prettier
pnpm format:check  # Check formatting without fixing
```

### Pull Request Process

1. Create a feature branch: `git checkout -b feature/123-my-feature`
2. Make your changes and commit using [Conventional Commits](https://www.conventionalcommits.org/)
3. Run `pnpm ci` locally to verify all checks pass
4. Push and create a PR to `develop` (or `main` for hotfixes)
5. Wait for CI checks to pass:
   - **Lint** — ESLint with zero warnings
   - **Type Check** — TypeScript strict mode
   - **Test** — Jest unit tests with coverage
   - **Build** — Expo export verification

### CI/CD Pipeline

The CI pipeline runs automatically on:
- Push to `main` or `develop`
- Pull requests to `main` or `develop`

All 4 jobs run in parallel for speed (~3-5 min total).

### EAS Preview Builds

Preview builds are automatically created for PRs when `EXPO_TOKEN` is configured.

```bash
# Manual EAS build
eas build --platform all --profile preview
```

### Branch Protection (GitHub Settings)

**main branch:**
- Require PR reviews (1 reviewer)
- Require status checks: lint, typecheck, test, build
- Require branches to be up to date
- No bypassing (even for admins)

**develop branch:**
- Require status checks: lint, typecheck, test
- No PR review required (solo dev during MVP)

## Documentation

Voir le [Wiki](../../wiki) pour la documentation complète.

## Liens

- **Issues & Sprint Board** : [GitHub Projects](https://github.com/users/ralphgabriel04/projects)
- **Documentation** : [Notion](https://notion.so)
- **Design** : [Figma](https://figma.com)
- **Repo Web** : [the-project](https://github.com/ralphgabriel04/the-project)

---

*Cadence — Connecte chaque athlète à son coach avec des données actionnables.*
