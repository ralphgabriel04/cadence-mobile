import { CoachNoticeScreen } from "@/features/coach-notice/coach-notice-screen";

/**
 * The 2026 release ships no coach features (ADR-003 at product level), so a
 * coach account lands on an explicit notice rather than on CoachDashboardScreen,
 * which would render an empty dashboard and read as a broken app.
 *
 * src/screens/coach/dashboard-screen.tsx is left in place for the 2027 work.
 */
export default function CoachHomeRoute() {
  return <CoachNoticeScreen />;
}
