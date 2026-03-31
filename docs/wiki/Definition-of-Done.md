# ✅ Definition of Done

## Checklist obligatoire avant merge

Chaque PR doit satisfaire **tous** les critères suivants avant d'être mergée :

### Code
- [ ] Le code compile sans erreur (`npx tsc --noEmit`)
- [ ] Pas de warnings ESLint (`pnpm lint`)
- [ ] TypeScript strict — pas de `any`, pas de `@ts-ignore`
- [ ] Pas de `console.log` oubliés (sauf debug intentionnel)
- [ ] Imports organisés et sans duplications

### Tests
- [ ] Tests unitaires ajoutés/mis à jour pour les changements
- [ ] Tous les tests passent (`pnpm test`)
- [ ] Couverture ≥ 70% sur les fichiers modifiés

### UI/UX
- [ ] Dark mode testé et fonctionnel
- [ ] Responsive sur iPhone SE (petit écran) et iPhone 15 Pro Max (grand écran)
- [ ] Animations fluides (60fps)
- [ ] Accessibilité : labels, contrastes, taille de touch targets (≥ 44px)

### Performance
- [ ] Pas de re-renders inutiles (vérifier avec React DevTools)
- [ ] Images optimisées (WebP, taille appropriée)
- [ ] Lazy loading si applicable

### Documentation
- [ ] Types TypeScript à jour
- [ ] Commentaires pour la logique complexe uniquement
- [ ] CHANGELOG.md mis à jour si changement visible par l'utilisateur

### Git
- [ ] Commits suivent les Conventional Commits
- [ ] PR description claire avec screenshots/vidéos si UI
- [ ] Branche à jour avec `develop` (rebase)
- [ ] Issue liée dans la PR (`Closes #XX`)

### Review
- [ ] Code review par au moins 1 personne
- [ ] Pas de secrets/credentials dans le code
- [ ] Pas de TODO sans issue associée

---

> **Règle d'or** : Si tu n'es pas fier de le montrer en demo, ce n'est pas Done.
