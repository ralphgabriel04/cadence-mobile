# ADR-003: Project Structure — src/ Architecture

## Status
Accepted

## Date
2026-03-31

## Context

Cadence Mobile is a bilateral SaaS app (coach + athlete) that will scale to 30+ screens and 100+ components over 11 sprints. The initial flat structure (`app/`, `components/`, `lib/`, `hooks/`, `types/` at root) worked for Sprint 1 bootstrap but would not scale well:

- Route files contained full screen logic (state, handlers, complex JSX), making them hard to test and reuse
- `lib/` was a catch-all for auth context, Supabase config, utilities, and constants
- No separation between shared and screen-specific components
- No data access layer (services)
- File naming was inconsistent (PascalCase components, camelCase hooks)

## Decision

Adopt the `src/` architecture recommended by Expo (Kadi Kraman, January 2026 blog post) with adaptations for our bilateral coach/athlete SaaS model.

### Key principles

1. **All application code lives in `src/`** — config files, assets, docs, and supabase stay at root
2. **Route files are thin wrappers** — `src/app/` files only import and render screen components
3. **Screens contain the logic** — `src/screens/` holds the full UI, state, and handlers for each route
4. **Semantic organization** — `providers/`, `config/`, `utils/`, `services/` instead of a catch-all `lib/`
5. **kebab-case file naming** — `button.tsx`, `use-supabase.ts`, `auth-provider.tsx` (PascalCase exports)
6. **Role-based screen folders** — `screens/auth/`, `screens/coach/`, `screens/athlete/` mirror route groups

### Structure

```
src/
├── app/            # Thin route wrappers + layouts (Expo Router)
├── screens/        # Full screen components with logic
│   ├── auth/
│   ├── coach/
│   └── athlete/
├── components/ui/  # Shared design system primitives
├── hooks/          # Reusable hooks
├── services/       # Data access layer (Supabase queries)
├── providers/      # React context providers
├── utils/          # Pure utility functions
├── config/         # App configuration (Supabase client, constants)
└── types/          # Global TypeScript types
```

### Path alias

`@/*` resolves to `./src/*` via `tsconfig.json`.

### Naming conventions

| Category | File naming | Export naming |
|----------|-------------|---------------|
| Components | `button.tsx` | `Button` |
| Screens | `login-screen.tsx` | `LoginScreen` |
| Hooks | `use-supabase.ts` | `useSupabase` |
| Providers | `auth-provider.tsx` | `AuthProvider` |
| Services | `auth-service.ts` | `signIn`, `signUp` |
| Utils | `mask-email.ts` | `maskEmail` |

## Consequences

- **Positive**: Clear separation of concerns, scalable to 30+ screens, testable screen components, consistent naming
- **Positive**: Route files are trivial — easy to understand navigation at a glance
- **Positive**: Screen-specific components can live in `screens/{role}/components/` without polluting shared components
- **Negative**: More files and directories to navigate initially
- **Negative**: One-time migration effort (this ADR)
- **Tradeoff**: Services layer is empty for now — will be populated as screens move from direct Supabase calls to service functions

## References

- Expo blog: "Project structure" by Kadi Kraman (January 2026)
- Expo Router documentation: `src/app/` convention
