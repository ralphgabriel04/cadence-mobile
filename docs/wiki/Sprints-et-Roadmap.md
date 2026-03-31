# Sprints et Roadmap

## Vue d'ensemble

Cadence suit un cycle de **11 sprints** pour atteindre le MVP (v1.0.0). Chaque sprint dure **2 semaines**.

## Sprints

| Sprint | Nom | Focus | Version |
|--------|-----|-------|---------|
| 1 | Setup & Auth | Expo init, Supabase, DB schema, Auth system | v0.1.0-alpha.1 |
| 2 | Coach Core | Dashboard coach, gestion athlètes, programmes | v0.2.0-alpha.1 |
| 3 | Program Builder | Création de programmes, exercices, sessions | v0.3.0-alpha.1 |
| 4 | Athlete Core | Vue athlète, sessions du jour, logging | v0.4.0-alpha.1 |
| 5 | Workout Tracker | Timer, sets/reps logging, RPE, PR detection | v0.5.0-beta.1 |
| 6 | Messaging | Chat coach-athlète, realtime | v0.6.0-beta.1 |
| 7 | Readiness & Analytics | Formulaire readiness, graphiques, trends | v0.7.0-beta.1 |
| 8 | Media & Storage | Photos de session, avatars, Supabase Storage | v0.8.0-beta.1 |
| 9 | Onboarding & Landing | Onboarding flows, landing page | v0.9.0-beta.1 |
| 10 | Notifications & A11y | Push notifications, accessibilité | v0.10.0-rc.1 |
| 11 | Launch & Security | Stripe, OWASP audit, store submission | v1.0.0 |

## Sprint 1 — Complété (v0.1.0-alpha.1)

- Expo SDK 54 + TypeScript strict + NativeWind v4 + Expo Router v6
- Supabase client + SecureStore adapter + env vars
- EAS Build profiles (development, preview, production)
- 14 tables PostgreSQL avec RLS, soft delete, triggers
- Auth system complet (login, register, forgot/reset password)
- Role-based routing (coach/athlete tab bars)
- 4 UI components (Button, Input, Text, Card)

## Conventions de sprint

1. **Pas de scope creep** — chaque sprint a un perimetre defini
2. **Demo** a la fin de chaque sprint
3. **Retrospective** informelle apres chaque sprint
4. **Tag** a la fin de chaque sprint (ex: v0.1.0-alpha.1)
5. **Issues** fermees via commit messages (`Closes #N`)

## Post-MVP Roadmap

| Phase | Features | Timeline |
|-------|----------|----------|
| v1.1 | Workout templates, export PDF | Post-launch +1 mois |
| v1.2 | Stripe payments, abonnements | Post-launch +2 mois |
| v1.3 | AI suggestions (GPT-powered) | Post-launch +3 mois |
| v2.0 | Marketplace de programmes, social features | Post-launch +6 mois |
