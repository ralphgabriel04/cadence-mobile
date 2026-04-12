import { useState } from "react";
import {
  View,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { Link } from "expo-router";
import { useAuth } from "@/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";

export function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setError("Veuillez remplir tous les champs");
      return;
    }

    setError("");
    setLoading(true);
    const result = await signIn(email.trim(), password);
    setLoading(false);

    if (result.error) {
      setError(result.error);
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
            Cadence
          </Text>
          <Text variant="caption" className="text-center mb-10">
            Connectez-vous pour continuer
          </Text>

          <View className="gap-4">
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
              placeholder="Votre mot de passe"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="current-password"
            />

            {error ? <Text variant="error">{error}</Text> : null}

            <Button
              title="Se connecter"
              onPress={handleLogin}
              loading={loading}
            />
          </View>

          <View className="mt-6 items-center gap-3">
            <Link href="/(auth)/forgot-password">
              <Text variant="caption" className="text-blue-600 dark:text-blue-400">
                Mot de passe oublié?
              </Text>
            </Link>
            <Link href="/(auth)/register">
              <Text variant="caption">
                Pas encore de compte?{" "}
                <Text variant="caption" className="text-blue-600 dark:text-blue-400 font-semibold">
                  S{"'"}inscrire
                </Text>
              </Text>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
