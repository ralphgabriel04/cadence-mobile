import { ProgramPlanScreen } from "@/features/programs/program-plan-screen";

/**
 * Thin route wrapper, per ADR-003: the route file only renders the screen.
 */
export default function PlanRoute() {
  return <ProgramPlanScreen />;
}
