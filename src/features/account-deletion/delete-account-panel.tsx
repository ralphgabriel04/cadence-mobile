import { View } from "react-native";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";

import { DELETION_BACKUPS, DELETION_ERASED, DELETION_INTRO, DELETION_TITLE } from "./deletion-copy";

type Props = {
  busy: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
};

/** Confirmation shown in Réglages before the account is deleted. */
export function DeleteAccountPanel({ busy, error, onConfirm, onCancel }: Props) {
  return (
    <View className="gap-3 rounded-card border border-border bg-surface p-4">
      <Text variant="heading">{DELETION_TITLE}</Text>
      <Text>{DELETION_INTRO}</Text>
      <View className="gap-1">
        <Text weight="semibold">Ce qui sera effacé :</Text>
        {DELETION_ERASED.map((item) => (
          <Text key={item}>{`• ${item}`}</Text>
        ))}
      </View>
      <Text variant="caption">{DELETION_BACKUPS}</Text>
      {error ? <Text variant="error">{error}</Text> : null}
      <Button
        title="Supprimer définitivement"
        variant="danger"
        accessibilityRole="button"
        loading={busy}
        onPress={onConfirm}
      />
      <Button
        title="Annuler"
        variant="outline"
        accessibilityRole="button"
        disabled={busy}
        onPress={onCancel}
      />
    </View>
  );
}
