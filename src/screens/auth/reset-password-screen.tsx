import { useEffect, useState } from "react";
import { View, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { Link, router } from "expo-router";
import * as Linking from "expo-linking";
import { useAuth } from "@/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { EXPIRED_LINK_MESSAGE, parseRecoveryLink } from "@/features/auth-routing/recovery-link";

const MIN_LENGTH = 8;

type LinkState = "checking" | "ready" | "invalid";

/**
 * Opened from the recovery email (cadence://reset-password#...). The link is
 * turned into a short session first; without a valid one there is no form, so a
 * link already used leads to an explanation, never to a password field.
 */
export function ResetPasswordScreen() {
  const { updatePassword, acceptRecoveryLink, signOut } = useAuth();
  const url = Linking.useURL();
  const [linkState, setLinkState] = useState<LinkState>("checking");
  const [linkError, setLinkError] = useState(EXPIRED_LINK_MESSAGE);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<{ password?: string; confirm?: string; form?: string }>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!url) return;
    const link = parseRecoveryLink(url);
    if (link.kind === "error") {
      setLinkError(link.message);
      setLinkState("invalid");
      return;
    }
    let active = true;
    void acceptRecoveryLink(url).then(({ error }) => {
      if (!active) return;
      if (error) setLinkError(error);
      setLinkState(error ? "invalid" : "ready");
    });
    return () => {
      active = false;
    };
  }, [url, acceptRecoveryLink]);

  const handleUpdate = async () => {
    const next: typeof errors = {};
    if (password.length < MIN_LENGTH) {
      next.password = `Le mot de passe doit contenir au moins ${MIN_LENGTH} caractères`;
    }
    // eslint-disable-next-line security/detect-possible-timing-attacks -- UI form validation, not cryptographic comparison
    if (password !== confirmPassword) next.confirm = "Les mots de passe ne correspondent pas";
    setErrors(next);
    if (next.password || next.confirm) return;

    setLoading(true);
    const result = await updatePassword(password);
    if (result.error) {
      setLoading(false);
      setErrors({ form: result.error });
      return;
    }
    // End the temporary recovery session: the user signs in with the new password.
    await signOut();
    setLoading(false);
    router.replace("/(auth)/login");
  };

  if (linkState !== "ready") {
    return (
      <View className="flex-1 items-center justify-center bg-bg px-5">
        <Text variant="heading" className="mb-4 text-center">
          {linkState === "checking" ? "Vérification du lien…" : "Lien invalide"}
        </Text>
        {linkState === "invalid" ? (
          <>
            <Text className="mb-8 text-center leading-5">{linkError}</Text>
            <Link href="/(auth)/forgot-password">
              <Text weight="bold" className="text-accent">
                Demander un nouveau lien
              </Text>
            </Link>
          </>
        ) : null}
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-bg"
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View className="flex-1 justify-center px-5 py-12">
          <Text variant="heading" className="mb-2 text-center">
            Nouveau mot de passe
          </Text>
          <Text variant="caption" className="mb-8 text-center text-[13px]">
            Choisissez un nouveau mot de passe sécurisé
          </Text>

          <View className="gap-3.5">
            <Input
              label="Nouveau mot de passe"
              placeholder="Minimum 8 caractères"
              value={password}
              onChangeText={(v) => {
                setPassword(v);
                setErrors((e) => ({ ...e, password: undefined }));
              }}
              secureTextEntry
              autoComplete="new-password"
              error={errors.password}
            />

            <Input
              label="Confirmer le mot de passe"
              placeholder="Retapez votre mot de passe"
              value={confirmPassword}
              onChangeText={(v) => {
                setConfirmPassword(v);
                setErrors((e) => ({ ...e, confirm: undefined }));
              }}
              secureTextEntry
              error={errors.confirm}
            />

            {errors.form ? <Text variant="error">{errors.form}</Text> : null}

            <Button
              title="Mettre à jour"
              onPress={handleUpdate}
              loading={loading}
              className="mt-2"
            />
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
