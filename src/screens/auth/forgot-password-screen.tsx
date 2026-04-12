import { useState, useEffect, useRef } from "react";
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

export function ForgotPasswordScreen() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startCooldown = () => {
    setCooldown(60);
    timerRef.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleReset = async () => {
    if (!email.trim()) {
      setError("Veuillez entrer votre courriel");
      return;
    }

    setError("");
    setLoading(true);
    const result = await resetPassword(email.trim());
    setLoading(false);

    if (result.error) {
      setError(result.error);
    } else {
      setSent(true);
      startCooldown();
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
            Mot de passe oublié
          </Text>
          <Text variant="caption" className="text-center mb-8">
            Entrez votre courriel pour recevoir un lien de réinitialisation
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

            {error ? <Text variant="error">{error}</Text> : null}

            {sent ? (
              <Text variant="body" className="text-green-600 dark:text-green-400 text-center">
                Courriel envoyé! Vérifiez votre boîte de réception.
              </Text>
            ) : null}

            <Button
              title={
                cooldown > 0
                  ? `Renvoyer dans ${cooldown}s`
                  : sent
                    ? "Renvoyer le courriel"
                    : "Envoyer le lien"
              }
              onPress={handleReset}
              loading={loading}
              disabled={cooldown > 0}
            />
          </View>

          <View className="mt-6 items-center">
            <Link href="/(auth)/login">
              <Text variant="caption" className="text-blue-600 dark:text-blue-400">
                Retour à la connexion
              </Text>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
