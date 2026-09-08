# Design — wireframes mobiles Cadence

Miroir des maquettes mobiles du monorepo `the-project` (`design/wireframe/mobile/` et `design/mobile/`).
**La source de vérité reste `the-project`** : on y dessine, on recopie ici pour que le repo mobile soit autonome.

```
design/
├── wireframe/        # wireframes d'Alexandre (36 écrans HTML)
│   ├── cadence-kit.jsx      # design system : tokens Signal/Pulse + primitives React
│   ├── design-canvas.jsx    # runtime canvas (pan/zoom, artboards)
│   ├── design-tokens.md     # spec des tokens (couleurs, typo, espacements)
│   ├── shared/              # connexion, inscription, mot-de-passe-oublie, onboarding, profil
│   ├── athlete/             # progression, session-live/*, settings
│   └── coach/               # accueil, athletes/*, en direct/*, programmes/*, settings
└── final/            # designs finaux (Claude Design) — athlete/accueil, athlete/programmes
```

## Ouvrir un wireframe

Les écrans « kit » chargent React depuis unpkg et Babel lit `../../cadence-kit.jsx` en XHR :
**ouvrir le fichier en `file://` ne marche pas**, il faut un serveur local.

```bash
pnpm design
# puis http://localhost:3000/wireframe/athlete/settings/cadence_athlete_settings.html
# ou   http://localhost:3000/final/athlete/accueil/cadence_athlete_accueil.html
```

Chaque page rend l'écran en **Signal** (dark, défaut) et **Pulse** (light).

## Wireframe → route expo-router

| Wireframe | Route / écran dans `src/` | État |
|---|---|---|
| `shared/connexion` | `app/(auth)/login` → `screens/auth/login-screen` | implémenté |
| `shared/inscription` | `app/(auth)/register` → `screens/auth/register-screen` | implémenté |
| `shared/mot-de-passe-oublie` | `app/(auth)/forgot-password`, `reset-password` | implémenté |
| `shared/onboarding` | — | à faire |
| `final/athlete/accueil` | `app/(athlete)/index` → `screens/athlete/today-screen` | implémenté |
| `final/athlete/programmes` | `app/(athlete)/plan` → `features/programs/program-plan-screen` | implémenté |
| `athlete/progression` | `app/(athlete)/history` → `screens/athlete/history-screen` | placeholder (pas d'agrégats en base) |
| `shared/profil` | `app/(athlete)/profile` → `screens/athlete/profile-screen` | implémenté |
| `athlete/settings` | `app/(athlete)/settings` → `screens/athlete/settings-screen` | implémenté (réduit) |
| `athlete/session-live/*` | `app/(athlete)/session` → `features/training/live-session-screen` | implémenté (cm#25, cm#27) |
| `coach/*` | `app/(coach)/*` | différé (ADR : pas de coach en 2026) |

## Trois formats de fichiers

| Format | Fichiers | Comment ça rend |
|---|---|---|
| **Kit React** (`cadence-kit.jsx` + `design-canvas.jsx`) | `shared/*`, `athlete/{progression,settings}`, `final/*`, `coach/{programmes/modification,settings}` | parfait via `pnpm design` |
| **React autonome** | `athlete/session-live/*`, `coach/programmes/{creation,details-bloc,liste}` | parfait, sans dépendance au kit |
| **Fragments Tabler** | `coach/accueil`, `coach/athletes/**`, `coach/en direct/**` | fragments HTML avec des variables CSS non définies (`--color-background-primary`…) : lisibles comme structure, pas comme rendu |

## Tokens dans l'app

Les tokens du kit sont portés dans `global.css` (variables CSS `:root` light + `@media dark`) et exposés par `tailwind.config.js` (`bg-bg`, `bg-surface`, `text-text-sub`, `border-border`, `bg-accent`, `rounded-card`, `font-sans-bold`, `font-mono`…). Les valeurs hex pour les props non-className (tab bar, spinners) sont dans `src/theme/tokens.ts`.
