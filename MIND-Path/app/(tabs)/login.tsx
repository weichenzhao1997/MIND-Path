import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useSegments } from "expo-router";
import { useAuth } from "@/context/AuthContext";

/** ---------- Theme colors ---------- */
const GREEN_MAIN = "#3F9360";
const GREEN_LIGHT = "#DDEFE6";
const GREEN_BORDER = "rgba(6,95,70,0.14)";
const GREEN_TEXT = "#065F46";
const PLACEHOLDER = "#3a6a54";
const ERROR_TEXT = "#dc2626";

export default function LoginScreen() {
  const { logIn, profile, isLoggedIn } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  const inProfileTab =
    segments.length >= 2 && segments[0] === "(tabs)" && segments[1] === "profile";

  const [username, setUsername] = useState(profile?.username ?? "");
  const [password, setPassword] = useState("");
  const [secureEntry, setSecureEntry] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (profile) {
      setUsername(profile.username);
    } else {
      setUsername("");
      setPassword("");
    }
  }, [profile]);

  useEffect(() => {
      if (isLoggedIn) {
      if (!inProfileTab) {
        router.replace("/(tabs)/profile");
      }
    }
  }, [isLoggedIn, router]);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 18) return "Good Afternoon";
    return "Good Evening";
  }, []);

  const handleLogin = async () => {
    setError(null);
    const trimmedUsername = username.trim();
    const trimmedPassword = password.trim();

    if (!trimmedUsername || !trimmedPassword) return;

    setSubmitting(true);

    let shouldResetSubmitting = true;

    try {
      await new Promise(resolve => setTimeout(resolve, 16));

      const success = await logIn({
        username: trimmedUsername,
        password: trimmedPassword,
      });

      if (!success) {
        setError("Incorrect username or password. Please try again.");
        return;
      }

      setSubmitting(false);
      shouldResetSubmitting = false;

      if (!inProfileTab) {
        router.replace("/(tabs)/profile");
      }
    } catch (error) {
      console.warn("Failed to sign in", error);
      setError("Something went wrong while signing in. Please try again.");
    } finally {
      if (shouldResetSubmitting) {
        setSubmitting(false);
      }
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f3f4f6" }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.greeting}>{greeting}</Text>
          <Text style={styles.subhead}>
            Welcome back. Sign in to continue your path to calm.
          </Text>
        </View>

        <View style={styles.card}>
          <View style={styles.cardAccent} />
          <Text style={styles.cardTitle}>Log in</Text>
          <Text style={styles.cardSubtitle}>
            Pick up your chats, explore resources, and continue your path to calm.
          </Text>

          <View style={styles.field}>
            <Text style={styles.label}>Username</Text>
            <TextInput
              value={username}
              onChangeText={setUsername}
              placeholder="Your name here"
              placeholderTextColor={PLACEHOLDER}
              autoCapitalize="none"
              style={styles.input}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.passwordRow}>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Enter your password"
                placeholderTextColor={PLACEHOLDER}
                secureTextEntry={secureEntry}
                style={styles.passwordInput}
              />
              <Pressable
                accessibilityRole="button"
                onPress={() => setSecureEntry(prev => !prev)}
                style={styles.toggle}
              >
                <Text style={styles.toggleText}>
                  {secureEntry ? "Show" : "Hide"}
                </Text>
              </Pressable>
            </View>
          </View>

          {!!error && (
            <View style={styles.errorBanner} accessibilityLiveRegion="polite">
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <Pressable
            style={[styles.loginBtn, submitting && styles.loginBtnDisabled]}
            onPress={handleLogin}
            accessibilityRole="button"
            disabled={submitting}
          >
            <Text style={styles.loginBtnText}>Log in</Text>
          </Pressable>
        </View>

        <View style={styles.footerRow}>
          <Text style={styles.footerText}>New here?</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/(tabs)/create-account")}
          >
            <Text style={styles.footerLink}>Create an account</Text>
          </Pressable>
        </View>
      </ScrollView>
      {submitting ? (
        <View style={styles.loadingOverlay} pointerEvents="auto">
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color={GREEN_MAIN} />
            <Text style={styles.loadingText}>Signing you in…</Text>
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingVertical: 32,
  },
  header: {
    marginBottom: 20,
  },
  greeting: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },
  subhead: {
    fontSize: 14,
    color: "#6b7280",
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: GREEN_BORDER,
    marginBottom: 28,
    shadowColor: "#000000",
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  cardAccent: {
    width: 56,
    height: 4,
    borderRadius: 2,
    backgroundColor: GREEN_MAIN,
    alignSelf: "center",
    marginBottom: 18,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: GREEN_TEXT,
    textAlign: "center",
    marginBottom: 8,
  },
  cardSubtitle: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 20,
  },
  field: {
    marginBottom: 14,
  },
  label: {
    fontSize: 13,
    color: "#374151",
    marginBottom: 6,
    fontWeight: "600",
  },
  input: {
    backgroundColor: GREEN_LIGHT,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: GREEN_BORDER,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: "#1f2937",
  },
  passwordRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: GREEN_LIGHT,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: GREEN_BORDER,
    paddingRight: 4,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: "#1f2937",
  },
  toggle: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  toggleText: {
    fontSize: 13,
    fontWeight: "700",
    color: GREEN_TEXT,
  },
  loginBtn: {
    backgroundColor: GREEN_MAIN,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 10,
    marginBottom: 14,
  },
  loginBtnDisabled: {
    opacity: 0.6,
  },
  loginBtnText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
  linkText: {
    color: GREEN_MAIN,
    textAlign: "center",
    fontSize: 13,
    fontWeight: "600",
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  footerText: {
    fontSize: 13,
    color: "#6b7280",
  },
  footerLink: {
    fontSize: 13,
    color: GREEN_TEXT,
    fontWeight: "700",
  },
  errorBanner: {
    backgroundColor: "#fee2e2",
    borderColor: "#fca5a5",
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginTop: 6,
    marginBottom: 12,
  },
  errorText: {
    color: ERROR_TEXT,
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15,23,42,0.25)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  loadingCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    paddingVertical: 28,
    paddingHorizontal: 32,
    alignItems: "center",
    gap: 12,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  loadingText: {
    fontSize: 15,
    color: GREEN_TEXT,
    fontWeight: "600",
  },
});
