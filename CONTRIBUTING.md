# Contribuer à Cadence

## Conventions de commits

Nous utilisons [Conventional Commits](https://www.conventionalcommits.org/) :

- `feat:` — Nouvelle fonctionnalité
- `fix:` — Correction de bug
- `chore:` — Tâches de maintenance
- `docs:` — Documentation
- `style:` — Formatage (pas de changement de logique)
- `refactor:` — Refactoring de code
- `test:` — Ajout ou modification de tests

Exemple : `feat: ajouter le timer de repos entre les séries (#74)`

## Branches

- `main` — Production (protégée)
- `develop` — Développement (branche par défaut)
- `feature/issue-N-description` — Feature branches
- `release/X.X.X` — Branches de stabilisation
- `hotfix/description` — Corrections urgentes

## Definition of Done

Avant de merger une PR :

- [ ] TypeScript strict (zéro `any`)
- [ ] RLS policy testée si nouvelle table
- [ ] UI responsive mobile + dark mode
- [ ] Loading, error, empty states implémentés
- [ ] Testé manuellement sur le flow complet
- [ ] Preview build EAS envoyé à Alexandre
- [ ] Merge sur `develop` vérifié
