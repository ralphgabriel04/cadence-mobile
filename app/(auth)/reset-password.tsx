import { useState } from "react";
import {
  View,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { router } from "expo-router";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Text } from "@/components/ui/Text";

function validatePassword(password: string) {
  if (password.length < 8) return "Minimum 8 caractères";
  if (!/[A-Z]/.test(password)) return "Au moins 1 majuscule requise";
  if (!/\d/.test(password)) return "Au moins 1 chiffre requis";
  return null;
}

export default function ResetPasswordScreen() {
  const { updatePassword } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const passwordError = password ? validatePassword(password) : undefined;
  const confirmError =
    confirmPassword && password !== confirmPassword
      ? "Les mots de passe ne correspondent pas"
      : undefined;

  const handleUpdate = async () => {
    if (!password || !confirmPassword) {
      setError("Veuillez remplir tous les champs");
      return;
    }
    if (passwordError) {
      setError(passwordError);
      return;
    }
    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas");
      return;
    }

    setError("");
    setLoading(true);
    const result = await updatePassword(password);
    setLoading(false);

    if (result.error) {
      setError(result.error);
    } else {
      router.replace("/(auth)/login");
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white dark:bg-gray-900"
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="flex-1 justify-center px-6 py-12">
          <Text variant="heading" className="text-center mb-2">
            Nouveau mot de passe
          </Text>
          <Text variant="caption" className="text-center mb-8">
            Choisissez un nouveau mot de passe sécurisé
          </Text>

          <View className="gap-4">
            <Input
              label="Nouveau mot de passe"
              placeholder="Minimum 8 caractères"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="new-password"
              error={passwordError ?? undefined}
            />

            <Input
              label="Confirmer le mot de passe"
              placeholder="Retapez votre mot de passe"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              error={confirmError}
            />

            {error ? <Text variant="error">{error}</Text> : null}

            <Button
              title="Mettre à jour"
              onPress={handleUpdate}
              loading={loading}
            />
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
