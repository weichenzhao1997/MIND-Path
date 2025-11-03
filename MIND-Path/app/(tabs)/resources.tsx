// app/(tabs)/resources.tsx
import React from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";

const G_BG = "#F5FAF7";
const G_CARD = "#FFFFFF";
const G_BORDER = "rgba(16,82,60,0.12)";
const G_TEXT = "#0F3D2E";
const G_MUTED = "#6B7F75";
const G_PRIMARY = "#2F6F4E";
const G_PRIMARY_WEAK = "#8DB7A4";

export default function ResourcesSwitch() {
  const router = useRouter();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: G_BG }}>
      <View style={styles.container}>
        <Text style={styles.title}>Pick a Resources UI</Text>
        <Text style={styles.subtitle}>You can switch between two implementations.</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Option A — Symptom search (Supabase)</Text>
          <Text style={styles.cardDesc}>输入症状关键词（anxiety / ocd / adhd）。</Text>
          <Pressable
            onPress={() => router.push("/(tabs)/resourcesContent")}
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          >
            <Text style={styles.buttonText}>Go to Choice 1</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Option B — Provider finder (Geo-aware)</Text>
          <Text style={styles.cardDesc}>按城市/州/专长搜索，支持距离排序与分页。</Text>
          <Pressable
            onPress={() => router.push("/(tabs)/resourcesProvider")}
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          >
            <Text style={styles.buttonText}>Go to Choice 2</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },
  title: { fontSize: 22, fontWeight: "800", textAlign: "center", marginTop: 8, color: G_TEXT },
  subtitle: { textAlign: "center", color: G_MUTED, marginTop: 4, marginBottom: 12 },
  card: {
    backgroundColor: G_CARD,
    borderRadius: 16,
    padding: 14,
    marginTop: 12,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: G_BORDER,
  },
  cardTitle: { fontSize: 16, fontWeight: "800", color: G_TEXT },
  cardDesc: { marginTop: 6, color: G_MUTED },
  button: {
    height: 44, borderRadius: 12, backgroundColor: G_PRIMARY,
    alignItems: "center", justifyContent: "center", marginTop: 12,
  },
  buttonPressed: { backgroundColor: G_PRIMARY_WEAK },
  buttonText: { color: "#FFFFFF", fontWeight: "700", fontSize: 16 },
});
