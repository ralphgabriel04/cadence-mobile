# ADR-001: Authentication System

## Status
Accepted

## Context
Cadence needs authentication with role-based routing (coach vs athlete), session persistence, and password reset via deep links.

## Decision

### Architecture
- **AuthProvider** wraps the entire app at root layout level, providing session/user/profile state via React Context
- **Supabase Auth** handles all auth operations (signUp, signIn, signOut, resetPassword, updateUser)
- **Session persistence** via expo-secure-store on native, localStorage on web
- **Role-based routing** via Expo Router route groups: `(auth)/`, `(coach)/`, `(athlete)/`

### Auth Guard Strategy
- `(auth)/_layout.tsx` redirects authenticated users away from auth screens
- `(coach)/_layout.tsx` requires auth + coach role, redirects athletes
- `(athlete)/_layout.tsx` requires auth + athlete role, redirects coaches
- `app/index.tsx` acts as the router: loading → splash, no session → login, coach → coach dashboard, athlete → athlete dashboard

### Password Reset Flow
- Forgot password sends email via `resetPasswordForEmail()` with `redirectTo: 'cadence://reset-password'`
- Deep link opens the reset-password screen where user sets new password via `updateUser()`
- 60-second cooldown on resend to prevent abuse

### Security Decisions
- Generic error message on login failure ("Courriel ou mot de passe incorrect") — no enumeration
- Password requirements: >= 8 chars, 1 uppercase, 1 digit
- Tokens stored in SecureStore (not AsyncStorage) on native
- `detectSessionInUrl: false` in Supabase client config

## Consequences
- Auth state is global — any component can access via `useAuth()`
- Profile fetch happens on every auth state change (acceptable for MVP, can be optimized with caching later)
- Deep link handling for password reset requires the `cadence://` scheme configured in app.json
