# Services

Data access layer — all Supabase queries go here.
Each service file groups related operations (e.g., auth-service.ts, program-service.ts).
Screens import from services, never call Supabase directly.

## Convention
- One file per domain: `auth-service.ts`, `program-service.ts`, `athlete-service.ts`
- Named exports only
- All functions are async and return typed data
- Error handling at the service level (throw typed errors)
