# 🔀 Git Workflow

## Branches

| Branche | Rôle | Protection |
|---------|------|-----------|
| `main` | Production, releases tagguées | Protected, PR required |
| `develop` | Intégration, branche par défaut | Protected, PR required |
| `feature/issue-N-description` | Développement de features | — |
| `fix/issue-N-description` | Corrections de bugs | — |
| `chore/description` | Tâches techniques | — |

## Workflow Feature

```
1. git checkout develop
2. git pull origin develop
3. git checkout -b feature/issue-42-workout-tracker
4. # ... développer ...
5. git add -A && git commit -m "feat(workout): add tracker component"
6. git push origin feature/issue-42-workout-tracker
7. # Créer PR → develop
8. # Code review + CI verte
9. # Squash & merge
```

## Conventional Commits

Format : `type(scope): description`

| Type | Usage |
|------|-------|
| `feat` | Nouvelle fonctionnalité |
| `fix` | Correction de bug |
| `docs` | Documentation |
| `style` | Formatting, pas de changement de logique |
| `refactor` | Refactoring sans changement de comportement |
| `test` | Ajout/modification de tests |
| `chore` | Tâches techniques (deps, config, CI) |
| `perf` | Amélioration de performance |

### Exemples

```
feat(auth): add Apple Sign-In support
fix(workout): correct rep counter overflow
docs(readme): update installation steps
chore(deps): upgrade expo SDK to 52
refactor(profile): extract avatar component
test(session): add unit tests for timer hook
```

## Tags et versions

Format : `vMAJOR.MINOR.PATCH[-prerelease]`

| Phase | Tag | Exemple |
|-------|-----|---------|
| Alpha | `v0.X.0-alpha.N` | `v0.1.0-alpha.1` |
| Beta | `v0.X.0-beta.N` | `v0.5.0-beta.1` |
| RC | `v1.0.0-rc.N` | `v1.0.0-rc.1` |
| Release | `vX.Y.Z` | `v1.0.0` |

## Règles

1. **Jamais** de push direct sur `main` ou `develop`
2. **Toujours** créer une PR avec description
3. **Squash & merge** par défaut
4. **Supprimer** la branche après merge
5. **Référencer** l'issue dans le commit : `feat(auth): add login (#42)`
