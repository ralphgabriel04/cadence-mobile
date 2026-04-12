import { useState } from "react";
import {
  View,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { Link } from "expo-router";
import { useAuth } from "@/providers/auth-provider";
import { maskEmail } from "@/utils/mask-email";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

export function RegisterScreen() {
  const { signUp } = useAuth();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState<"coach" | "athlete">("athlete");
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
      <View className="flex-1 items-center justify-center px-6 bg-white dark:bg-gray-900">
        <Text variant="heading" className="text-center mb-4">
          Vérifiez votre courriel
        </Text>
        <Text variant="body" className="text-center mb-8">
          Un lien de confirmation a été envoyé à {maskEmail(email)}. Cliquez dessus pour
          activer votre compte.
        </Text>
        <Link href="/(auth)/login">
          <Text variant="body" className="text-blue-600 dark:text-blue-400 font-semibold">
            Retour à la connexion
          </Text>
        </Link>
      </View>
    );
  }

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
            Créer un compte
          </Text>
          <Text variant="caption" className="text-center mb-8">
            Rejoignez Cadence
          </Text>

          <View className="gap-4">
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

            <View>
              <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Je suis
              </Text>
              <View className="flex-row gap-3">
                <TouchableOpacity
                  className={`flex-1 rounded-xl py-3 items-center border ${
                    role === "coach"
                      ? "bg-blue-600 border-blue-600"
                      : "border-gray-300 dark:border-gray-600"
                  }`}
                  onPress={() => setRole("coach")}
                >
                  <Text
                    className={`font-semibold ${
                      role === "coach" ? "text-white" : "text-gray-700 dark:text-gray-300"
                    }`}
                  >
                    Coach
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className={`flex-1 rounded-xl py-3 items-center border ${
                    role === "athlete"
                      ? "bg-blue-600 border-blue-600"
                      : "border-gray-300 dark:border-gray-600"
                  }`}
                  onPress={() => setRole("athlete")}
                >
                  <Text
                    className={`font-semibold ${
                      role === "athlete" ? "text-white" : "text-gray-700 dark:text-gray-300"
                    }`}
                  >
                    Athlète
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {error ? <Text variant="error">{error}</Text> : null}

            <Button
              title="S'inscrire"
              onPress={handleRegister}
              loading={loading}
            />
          </View>

          <View className="mt-6 items-center">
            <Link href="/(auth)/login">
              <Text variant="caption">
                Déjà un compte?{" "}
                <Text variant="caption" className="text-blue-600 dark:text-blue-400 font-semibold">
                  Se connecter
                </Text>
              </Text>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
