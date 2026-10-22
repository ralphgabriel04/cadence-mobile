import { Pill } from "@/components/ui/pill";
import type { SessionOccurrenceState } from "@/utils/program-schedule";

/**
 * State pill for one scheduled session, mapped onto the design-system Pill.
 *
 * The colour is not the only signal: each state also carries distinct wording.
 * A pill that says "manquée" reads correctly for someone who cannot distinguish
 * amber from green, and screen readers get the label rather than a colour.
 */
const STATE_LABEL: Record<SessionOccurrenceState, string> = {
  completed: "Complétée",
  skipped: "Passée",
  missed: "Manquée",
  today: "Aujourd'hui",
  upcoming: "À venir",
};

const STATE_VARIANT: Record<SessionOccurrenceState, "default" | "active" | "accent" | "warning"> = {
  completed: "accent",
  skipped: "default",
  missed: "warning",
  today: "active",
  upcoming: "default",
};

export function SessionStateBadge({ state }: { state: SessionOccurrenceState }) {
  // eslint-disable-next-line security/detect-object-injection -- state is a typed union, not user input
  const label = STATE_LABEL[state];
  // eslint-disable-next-line security/detect-object-injection -- state is a typed union, not user input
  const variant = STATE_VARIANT[state];

  return <Pill label={label} variant={variant} />;
}
