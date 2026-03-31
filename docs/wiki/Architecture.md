# 🏗️ Architecture

## Vue d'ensemble

```
┌─────────────────────────────────────────────────────┐
│                    Client Mobile                      │
│              React Native + Expo SDK 52+              │
│                                                       │
│  ┌───────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │ Expo Router│  │NativeWind│  │  React Native    │  │
│  │   v4      │  │   v4     │  │  Reanimated      │  │
│  └───────────┘  └──────────┘  └──────────────────┘  │
└────────────────────────┬────────────────────────────┘
                         │ HTTPS
                         ▼
┌─────────────────────────────────────────────────────┐
│                    Supabase                          │
│                                                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │   Auth   │  │ Realtime │  │    Storage       │  │
│  │  (GoTrue)│  │(WebSocket)│  │   (S3-like)     │  │
│  └──────────┘  └──────────┘  └──────────────────┘  │
│                                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │           PostgreSQL + RLS                    │   │
│  │    13+ tables, Row Level Security policies    │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

## Principes architecturaux

1. **Offline-first** — L'app doit fonctionner sans connexion pour les fonctions critiques
2. **Mobile-native** — Utiliser les APIs natives (haptics, notifications, caméra)
3. **Shared backend** — Même Supabase que le web (source unique de vérité)
4. **Type-safe** — TypeScript strict, types générés depuis la DB
5. **Performance** — 60fps, cold start < 2s, bundle < 15MB

## Flux de données

```
User Action → Component → Hook → Supabase Client → PostgreSQL
                                      ↕
                              Realtime (WebSocket)
                                      ↓
                              Other connected clients
```

## Authentification

- Supabase Auth (GoTrue) avec deep linking
- Magic Link + OAuth (Google, Apple)
- Session persistée dans SecureStore (Expo)
- Redirection automatique via `(auth)` layout group

## Navigation

Expo Router v4 avec file-based routing :
- `(auth)/` — Login, Register, Forgot Password
- `(tabs)/coach/` — Dashboard coach, gestion athlètes, programmes
- `(tabs)/athlete/` — Dashboard athlète, sessions, progression
