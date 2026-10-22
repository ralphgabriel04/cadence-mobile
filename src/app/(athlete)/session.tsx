import { LiveSessionScreen } from "@/features/training/live-session-screen";

/**
 * Live workout logging (cm#25). Thin route wrapper, per ADR-003.
 *
 * Not a tab: this is pushed for the duration of a session and dismissed when it
 * ends, so it is hidden from the tab bar in (athlete)/_layout.tsx.
 */
export default function SessionRoute() {
  return <LiveSessionScreen />;
}
