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
import { Logo } from "@/components/ui/logo";
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
      className="flex-1 bg-bg"
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="flex-1 justify-center px-5 py-12">
          <View className="mb-10 items-center">
            <Logo size={72} />
            <Text weight="bold" className="mt-4 text-2xl tracking-[-0.7px]">
              Cadence
            </Text>
            <Text variant="caption" className="mt-1 text-[13px] italic">
              Entraîne ton rythme
            </Text>
          </View>

          <View className="gap-3.5">
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

            <Link href="/(auth)/forgot-password" className="self-end">
              <Text variant="caption" weight="bold" className="text-[13px] text-accent">
                Mot de passe oublié ?
              </Text>
            </Link>

            {error ? <Text variant="error">{error}</Text> : null}

            <Button
              title="Se connecter"
              onPress={handleLogin}
              loading={loading}
              className="mt-2 h-14"
            />
          </View>

          <View className="mt-8 flex-row items-center justify-center gap-1.5">
            <Text variant="caption" weight="medium" className="text-[13px]">
              Pas encore de compte ?
            </Text>
            <Link href="/(auth)/register">
              <Text variant="caption" weight="bold" className="text-[13px] text-accent">
                Créer un compte
              </Text>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
