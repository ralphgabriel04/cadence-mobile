# 🏗️ Architecture

## Vue d'ensemble

```
┌─────────────────────────────────────────────────────┐
│                    Client Mobile                      │
│              React Native + Expo SDK 54               │
│                                                       │
│  ┌───────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │ Expo Router│  │NativeWind│  │  React Native    │  │
│  │   v6      │  │   v4     │  │  Reanimated      │  │
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
│  │    14 tables, Row Level Security policies      │   │
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
- Email/Password avec confirmation par courriel
- Session persistée dans SecureStore (expo-secure-store)
- Redirection automatique via auth guards dans les layouts
- Password reset via deep link (`cadence://reset-password`)

## Navigation

Expo Router v6 avec file-based routing :

- `(auth)/` — Login, Register, Forgot Password, Reset Password
- `(coach)/` — Tab bar coach : Accueil, Programmes, Athlètes, Profil
- `(athlete)/` — Tab bar athlète : Aujourd'hui, Historique, Profil

Auth guards dans chaque `_layout.tsx` :

- `(auth)` redirige si déjà authentifié
- `(coach)` requiert auth + rôle coach
- `(athlete)` requiert auth + rôle athlète
