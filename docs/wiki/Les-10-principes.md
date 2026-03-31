# 🧭 Les 10 principes

## Principes non-négociables de Cadence

### 1. Athlete-first
L'athlète n'est pas un utilisateur secondaire. Chaque feature doit créer de la valeur pour l'athlète ET le coach.

### 2. Simplicité > Fonctionnalités
Moins de features, mieux exécutées. Chaque ajout doit passer le test : "Est-ce que 80% des utilisateurs vont l'utiliser ?"

### 3. Mobile-native, pas mobile-adapted
L'app mobile n'est pas une version réduite du web. Elle exploite les capacités natives (haptics, notifications push, caméra, gestures).

### 4. Performance non-négociable
- Cold start < 2 secondes
- Transitions à 60fps
- Bundle < 15MB
- Offline-first pour les features critiques

### 5. Dark mode partout
Chaque écran, chaque composant, dès le premier jour. Pas un afterthought.

### 6. Type-safe de bout en bout
TypeScript strict. Types générés depuis la DB. Pas de `any`. Si ça compile, ça devrait marcher.

### 7. Test before ship
Pas de merge sans tests. Couverture minimale 70%. Tests E2E sur les happy paths critiques.

### 8. Design = Code
Le design n'est pas une étape séparée. Alexandre (design) et Ralph (dev) travaillent en parallèle, pas en séquentiel.

### 9. Ship small, ship often
PRs < 400 lignes. Releases fréquentes. Feedback rapide. Pas de big bang.

### 10. Données > Opinions
Les décisions product sont basées sur les métriques (WACAP, rétention, NPS), pas sur les opinions. A/B test quand c'est possible.

## Bibliothèque de référence

| Livre | Concept clé |
|-------|------------|
| *Inspired* — Marty Cagan | Product discovery, empowered teams |
| *Shape Up* — Basecamp | Appetite-based development, 6-week cycles |
| *The Lean Startup* — Eric Ries | Build-Measure-Learn, MVP |
| *Hooked* — Nir Eyal | Trigger-Action-Reward-Investment loop |
| *Atomic Habits* — James Clear | Habit formation (pertinent pour l'engagement athlète) |
