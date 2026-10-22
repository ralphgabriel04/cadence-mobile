import { useState } from "react";
import {
  View,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
} from "react-native";
import { Link } from "expo-router";
import { useAuth } from "@/providers/auth-provider";
import { maskEmail } from "@/utils/mask-email";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pill } from "@/components/ui/pill";
import { Text } from "@/components/ui/text";

function validateEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePassword(password: string) {
  if (password.length < 8) return "Minimum 8 caractères";
  if (!/[A-Z]/.test(password)) return "Au moins 1 majuscule requise";
  if (!/\d/.test(password)) return "Au moins 1 chiffre requis";
  return null;
}

type Role = "coach" | "athlete";

const ROLE_LABEL: Record<Role, string> = { athlete: "Athlète", coach: "Coach" };

export function RegisterScreen() {
  const { signUp } = useAuth();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState<Role>("athlete");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const passwordError = password ? validatePassword(password) : undefined;
  const confirmError =
    confirmPassword && password !== confirmPassword
      ? "Les mots de passe ne correspondent pas"
      : undefined;

  const handleRegister = async () => {
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !password || !confirmPassword) {
      setError("Veuillez remplir tous les champs");
      return;
    }
    if (!validateEmail(email.trim())) {
      setError("Courriel invalide");
      return;
    }
    if (passwordError) {
      setError(passwordError);
      return;
    }
    // eslint-disable-next-line security/detect-possible-timing-attacks -- UI form validation, not cryptographic comparison
    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas");
      return;
    }

    setError("");
    setLoading(true);
    const result = await signUp({
      email: email.trim(),
      password,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      role,
    });
    setLoading(false);

    if (result.error) {
      setError(result.error);
    } else {
      setSuccess(true);
    }
  };

  if (success) {
    return (
      <View className="flex-1 items-center justify-center bg-bg px-5">
        <Text variant="heading" className="mb-4 text-center">
          Vérifiez votre courriel
        </Text>
        <Text className="mb-8 text-center leading-5">
          Un lien de confirmation a été envoyé à {maskEmail(email)}. Cliquez dessus pour
          activer votre compte.
        </Text>
        <Link href="/(auth)/login">
          <Text weight="bold" className="text-accent">
            Retour à la connexion
          </Text>
        </Link>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-bg"
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="flex-1 justify-center px-5 py-12">
          <Text variant="heading" className="mb-2 text-center">
            Créer un compte
          </Text>
          <Text variant="caption" className="mb-8 text-center text-[13px]">
            Rejoignez Cadence
          </Text>

          <View className="gap-3.5">
            <View className="flex-row gap-3">
              <View className="flex-1">
                <Input
                  label="Prénom"
                  placeholder="Prénom"
                  value={firstName}
                  onChangeText={setFirstName}
                  autoComplete="given-name"
                />
              </View>
              <View className="flex-1">
                <Input
                  label="Nom"
                  placeholder="Nom"
                  value={lastName}
                  onChangeText={setLastName}
                  autoComplete="family-name"
                />
              </View>
            </View>

            <Input
              label="Courriel"
              placeholder="nom@exemple.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />

            <Input
              label="Mot de passe"
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

            <View className="gap-2">
              <Text weight="bold" className="text-[10px] uppercase tracking-[0.8px] text-text-sub">
                Je suis
              </Text>
              <View className="flex-row gap-2">
                {(["athlete", "coach"] as const).map((r) => (
                  <Pressable
                    key={r}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: role === r }}
                    onPress={() => setRole(r)}
                  >
                    {/* eslint-disable-next-line security/detect-object-injection -- r is a typed literal, not user input */}
                    <Pill label={ROLE_LABEL[r]} variant={role === r ? "active" : "default"} />
                  </Pressable>
                ))}
              </View>
            </View>

            {error ? <Text variant="error">{error}</Text> : null}

            <Button
              title="Créer mon compte"
              onPress={handleRegister}
              loading={loading}
              className="mt-2"
            />
          </View>

          <View className="mt-8 flex-row items-center justify-center gap-1.5">
            <Text variant="caption" weight="medium" className="text-[13px]">
              Déjà un compte ?
            </Text>
            <Link href="/(auth)/login">
              <Text variant="caption" weight="bold" className="text-[13px] text-accent">
                Se connecter
              </Text>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
