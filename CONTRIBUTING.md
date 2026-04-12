# Contribuer a Cadence

## Setup

```bash
# Cloner le repo
git clone https://github.com/ralphgabriel04/cadence-mobile.git
cd cadence-mobile

# Installer les dependances
pnpm install

# Lancer le serveur de dev
npx expo start
```

## Conventions de commits

Nous utilisons [Conventional Commits](https://www.conventionalcommits.org/) :

- `feat:` — Nouvelle fonctionnalite
- `fix:` — Correction de bug
- `chore:` — Taches de maintenance
- `docs:` — Documentation
- `style:` — Formatage (pas de changement de logique)
- `refactor:` — Refactoring de code
- `test:` — Ajout ou modification de tests
- `ci:` — Changements CI/CD

Exemple : `feat(auth): ajouter le password reset flow (#123)`

## Branches

| Type | Pattern | Exemple |
|------|---------|---------|
| Feature | `feature/issue-N-description` | `feature/37-ci-cd-pipeline` |
| Bug fix | `fix/issue-N-description` | `fix/42-login-error` |
| Hotfix | `hotfix/description` | `hotfix/critical-auth-bug` |
| Release | `release/X.X.X` | `release/0.1.0` |
| Refactor | `refactor/description` | `refactor/project-structure` |

Branches principales :
- `main` — Production (protegee)
- `develop` — Developpement (branche par defaut)

## CI/CD Pipeline

Avant de pusher, lancer les checks localement :

```bash
pnpm ci  # lint + type-check + test
```

### Checks individuels

```bash
pnpm lint          # ESLint (zero warnings)
pnpm type-check    # TypeScript strict
pnpm test          # Jest tests
pnpm build         # Expo export
pnpm format        # Prettier auto-fix
```

### Workflow PR

1. Creer une branche : `git checkout -b feature/123-ma-feature`
2. Commiter avec Conventional Commits
3. Lancer `pnpm ci` localement
4. Pousser et creer une PR vers `develop`
5. Attendre que les 4 checks CI passent :
   - **Lint** — ESLint zero warnings
   - **Type Check** — TypeScript strict
   - **Test** — Jest avec coverage
   - **Build** — Expo export

## Code Standards

### TypeScript
- **Strict mode** — Zero `any`, zero `@ts-ignore`
- Typer toutes les fonctions
- Interfaces pour les objets, types pour unions

### ESLint
- Zero warnings (`--max-warnings 0`)
- `pnpm lint:fix` pour auto-corriger

### Prettier
- 2 espaces, double quotes, semicolons
- `pnpm format` avant chaque commit

### Tests
- Tests dans `__tests__/`
- Couvrir les fonctions utilitaires
- `pnpm test` pour verifier

## Definition of Done

Avant de merger une PR :

- [ ] `pnpm ci` passe localement
- [ ] TypeScript strict (zero `any`)
- [ ] RLS policy testee si nouvelle table
- [ ] UI responsive mobile + dark mode
- [ ] Loading, error, empty states implementes
- [ ] Teste manuellement sur le flow complet
- [ ] Preview build EAS envoye a Alexandre
- [ ] Tous les checks CI passent

## GitHub Secrets

Pour les EAS Preview builds, ajouter dans GitHub Settings :

| Secret | Description |
|--------|-------------|
| `EXPO_TOKEN` | Token EAS depuis expo.dev |

## Questions?

- Voir le [README](README.md)
- Ouvrir une issue pour bugs ou features
- Consulter les [ADRs](docs/) pour les decisions d'architecture
