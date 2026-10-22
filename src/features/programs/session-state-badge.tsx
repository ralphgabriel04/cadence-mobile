import { View } from "react-native";

import { Text } from "@/components/ui/text";
import type { SessionOccurrenceState } from "@/utils/program-schedule";

/**
 * State pill for one scheduled session.
 *
 * LOCAL TO THIS FEATURE, DELIBERATELY. src/components/ui/ has no Badge or Pill
 * primitive and belongs to the design system track, so nothing is added there
 * from here. This is a candidate for a shared `Badge` primitive -- see the note
 * in the R7 hand-off.
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

const STATE_STYLE: Record<SessionOccurrenceState, string> = {
  completed: "bg-green-100 dark:bg-green-900/40",
  skipped: "bg-gray-100 dark:bg-gray-700",
  missed: "bg-amber-100 dark:bg-amber-900/40",
  today: "bg-blue-100 dark:bg-blue-900/40",
  upcoming: "bg-gray-100 dark:bg-gray-700",
};

const STATE_TEXT: Record<SessionOccurrenceState, string> = {
  completed: "text-green-800 dark:text-green-200",
  skipped: "text-gray-600 dark:text-gray-300",
  missed: "text-amber-800 dark:text-amber-200",
  today: "text-blue-800 dark:text-blue-200",
  upcoming: "text-gray-600 dark:text-gray-300",
};

export function SessionStateBadge({ state }: { state: SessionOccurrenceState }) {
  // eslint-disable-next-line security/detect-object-injection -- state is a typed union, not user input
  const container = STATE_STYLE[state];
  // eslint-disable-next-line security/detect-object-injection -- state is a typed union, not user input
  const textColour = STATE_TEXT[state];
  // eslint-disable-next-line security/detect-object-injection -- state is a typed union, not user input
  const label = STATE_LABEL[state];

  return (
    <View className={`rounded-full px-2.5 py-1 ${container}`}>
      <Text variant="caption" className={`text-xs font-semibold ${textColour}`}>
        {label}
      </Text>
    </View>
  );
}
