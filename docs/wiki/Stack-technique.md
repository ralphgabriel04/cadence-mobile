# 🛠️ Stack technique

## Choix technologiques

| Catégorie | Technologie | Version | Justification |
|-----------|-------------|---------|---------------|
| Framework | React Native | 0.81 | Écosystème React, code partagé |
| Plateforme | Expo SDK | 54 | DX supérieure, EAS, OTA updates |
| Routing | Expo Router | v6 | File-based routing, deep linking natif |
| Styling | NativeWind | v4 | Tailwind CSS pour RN, cohérence avec le web |
| Backend | Supabase | Latest | Auth, DB, Realtime, Storage — tout-en-un |
| Language | TypeScript | 5.x | Strict mode, type safety |
| State | React Query | v5 | Cache, sync, optimistic updates |
| Animations | Reanimated | v3 | 60fps, animations sur le UI thread |
| Forms | React Hook Form | v7 | Performance, validation |
| Navigation UI | Bottom Tabs | Expo | Natif, performant |
| Icons | Lucide React Native | Latest | Cohérence avec le web (Lucide) |
| Testing | Jest + RNTL | Latest | Unit + component tests |

## ADRs (Architecture Decision Records)

### ADR-001 : Expo plutôt que React Native CLI
- **Statut** : Accepté
- **Contexte** : Équipe de 1-2 devs, besoin de vélocité maximale
- **Décision** : Expo SDK 54 avec Expo Router v6
- **Conséquences** : DX supérieure, EAS builds, OTA updates, mais limitations sur certains modules natifs

### ADR-002 : NativeWind plutôt que StyleSheet
- **Statut** : Accepté
- **Contexte** : Le web utilise Tailwind CSS 4, besoin de cohérence design
- **Décision** : NativeWind v4 pour le styling
- **Conséquences** : Même vocabulaire de classes que le web, dark mode simplifié, mais courbe d'apprentissage pour l'équipe

### ADR-003 : Supabase partagé (web + mobile)
- **Statut** : Accepté
- **Contexte** : Les deux apps accèdent aux mêmes données
- **Décision** : Instance Supabase unique, RLS policies partagées
- **Conséquences** : Source unique de vérité, realtime cross-platform, mais attention aux migrations

### ADR-004 : Monorepo séparé (pas de monorepo unifié)
- **Statut** : Accepté
- **Contexte** : Web (Next.js) et Mobile (Expo) ont des toolchains très différentes
- **Décision** : Deux repos séparés (`the-project` et `cadence-mobile`)
- **Conséquences** : Indépendance des CI/CD, pas de conflits de dépendances, mais duplication possible de types/utils
