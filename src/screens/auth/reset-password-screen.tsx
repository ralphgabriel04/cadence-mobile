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
const NO_LINK_DELAY_MS = 1500;
const SIGN_OUT_FAILED = "Impossible de terminer la session pour l'instant, réessaie.";

type LinkState = "checking" | "ready" | "invalid" | "missing";

/**
 * Opened from the recovery email (cadence://reset-password#...). The link is
 * turned into a short session first; without a valid one there is no form, so a
 * link already used leads to an explanation, never to a password field.
 */
export function ResetPasswordScreen() {
  const { state, updatePassword, acceptRecoveryLink, signOut } = useAuth();
  const url = Linking.useURL();
  const [linkState, setLinkState] = useState<LinkState>("checking");
  const [linkError, setLinkError] = useState(EXPIRED_LINK_MESSAGE);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<{ password?: string; confirm?: string; form?: string }>({});
  const [loading, setLoading] = useState(false);

  // Without a link there is nothing to wait for forever: after a moment, say so.
  const [waited, setWaited] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setWaited(true), NO_LINK_DELAY_MS);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    if (!url) return;
    // A new link starts over: no stale "ready" or typed passwords from the previous one.
    setLinkState("checking");
    setPassword("");
    setConfirmPassword("");
    setErrors({});
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

  // Abandoning ends the temporary session: nothing stays open without a new password.
  const handleCancel = async () => {
    if ((await signOut()) === false) return setErrors({ form: SIGN_OUT_FAILED });
    router.replace("/(auth)/login");
  };

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
    const ended = await signOut();
    setLoading(false);
    if (ended === false) return setErrors({ form: SIGN_OUT_FAILED });
    router.replace("/(auth)/login");
  };

  // No link at all: the form only shows for a recovery already in progress
  // (sent here by the route guards), otherwise there is nothing to do here.
  let shown: LinkState = linkState;
  if (!url) shown = state.status === "recovery" ? "ready" : waited ? "missing" : "checking";

  if (shown !== "ready") {
    const noLink = shown === "missing";
    return (
      <View className="flex-1 items-center justify-center bg-bg px-5">
        <Text variant="heading" className="mb-4 text-center">
          {shown === "checking"
            ? "Vérification du lien…"
            : noLink
              ? "Aucun lien reçu"
              : "Lien invalide"}
        </Text>
        {shown === "invalid" || noLink ? (
          <>
            <Text className="mb-8 text-center leading-5">
              {noLink ? "Ouvre le lien reçu par courriel, ou demande-en un nouveau." : linkError}
            </Text>
            <Link href="/(auth)/forgot-password">
              <Text weight="bold" className="underline">
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
            <Button title="Annuler" variant="outline" onPress={handleCancel} />
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
