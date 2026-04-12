# Screens

Screen components contain the full UI and logic for each route.
Route files in `src/app/` are thin wrappers that import and render screen components.

## Structure
Each role has its own subfolder:
- `auth/` — authentication screens
- `coach/` — coach-specific screens
- `athlete/` — athlete-specific screens

Each subfolder can contain a `components/` folder for screen-specific components
that are NOT reusable across other screens.
