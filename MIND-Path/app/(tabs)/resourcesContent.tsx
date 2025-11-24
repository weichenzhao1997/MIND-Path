// app/(tabs)/resourcesContent.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  Text,
  View,
  ScrollView,
  Dimensions,
  StyleSheet,
  TextInput,
  Pressable,
  Linking,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Resource, searchResourcesFuzzy } from "@/utils/supabaseContent";
import { fetchSymptomSynonyms } from "@/utils/supabaseContent";
import { useAuth } from "@/context/AuthContext";

/** ---------- Theme ---------- */
const GREEN_LIGHT = "#DDEFE6";
const GREEN_BORDER = "rgba(6,95,70,0.14)";
const GREEN_TEXT = "#065F46";
const GREEN_TEXT_SOFT = "rgba(6,95,70,0.75)";
const CARD_BG = "#ffffff";
const BLUE_LINK = "#2563eb";
const { height: H } = Dimensions.get("window");

/** ---------- Helpers ---------- */
const ensureHttp = (url: string) =>
  /^https?:\/\//i.test(url) ? url : `https://${url}`;

export default function ResourcesContent() {
  const router = useRouter();
  const { isLoggedIn, profile, updateProfile } = useAuth();
  const PAGE_SIZE = 5;
  const STOPWORDS = useMemo(
    () => new Set(["i", "and", "the", "a", "an", "to", "of", "in", "on", "for", "with", "feel", "am", "is", "are"]),
    []
  );
  const [synonymMap, setSynonymMap] = useState<Record<string, string[]>>({});

  const toTagText = (input: any): string => {
    if (Array.isArray(input)) return input.join(" ").toLowerCase();
    if (typeof input === "string") return input.toLowerCase();
    return "";
  };

  const getVariants = (token: string): string[] =>
    synonymMap[token] ? synonymMap[token] : [token];

  // symptom input state
  const [symptom, setSymptom] = useState("");

  // search state
  const [didSearch, setDidSearch] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Resource[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastQuery, setLastQuery] = useState("");
  const [page, setPage] = useState(0);
  const [savingResourceId, setSavingResourceId] = useState<string | null>(null);
  const [removingResourceId, setRemovingResourceId] = useState<string | null>(null);

  // load synonyms from Supabase
  useEffect(() => {
    let canceled = false;
    (async () => {
      try {
        const map = await fetchSymptomSynonyms();
        if (!canceled) setSynonymMap(map);
      } catch (e) {
        console.warn("Failed to load synonyms", e);
      }
    })();
    return () => {
      canceled = true;
    };
  }, []);

  const savedResourceIds = useMemo(
    () =>
      new Set(
        (profile?.recommendedResourceIds ?? [])
          .map(id => id.trim())
          .filter(id => id.length > 0)
      ),
    [profile?.recommendedResourceIds]
  );

  /** ---------- runSearch Supabase RPC ---------- */
  const runSearch = async () => {
    const raw = symptom.trim();
    const q = raw.toLowerCase();
    if (!q) return;

    setDidSearch(true);
    setLoading(true);
    setErrorMsg(null);

    try {
      const rows = await searchResourcesFuzzy(q);
      setResults(rows);
      setPage(0);
      setLastQuery(raw);
    } catch (e: any) {
      setResults([]);
      setErrorMsg(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  const totalPages = useMemo(
    () => (results.length === 0 ? 0 : Math.ceil(results.length / PAGE_SIZE)),
    [results.length]
  );
  const orderedResults = useMemo(() => {
    const tokens = lastQuery
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .map(t => t.trim())
      .filter(t => t.length > 2 && !STOPWORDS.has(t));

    if (tokens.length === 0) return results;

    const seen = new Set<string>();
    const bucketed: Resource[] = [];

    for (const token of tokens) {
      const variants = getVariants(token);
      for (const r of results) {
        if (seen.has(r.id)) continue;
        const fullText = [
          (r as any).title ?? "",
          (r as any).short_desc ?? "",
          (r as any).tags ?? "",
          (r as any).symptom_tags ?? "",
        ]
          .join(" ")
          .toLowerCase();
        if (variants.some(v => fullText.includes(v))) {
          bucketed.push(r);
          seen.add(r.id);
        }
      }
    }

    // append any remaining results preserving original order
    for (const r of results) {
      if (!seen.has(r.id)) {
        bucketed.push(r);
        seen.add(r.id);
      }
    }
    return bucketed;
  }, [results, lastQuery, STOPWORDS]);

  const pagedResults = useMemo(
    () => orderedResults.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE),
    [orderedResults, page]
  );

  const queryTokenCounts = useMemo(() => {
    const rawTokens = lastQuery
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .map(t => t.trim())
      .filter(t => t.length > 2 && !STOPWORDS.has(t));

    // de-duplicate while preserving order
    const seenTokens = new Set<string>();
    const tokens: string[] = [];
    for (const t of rawTokens) {
      if (!seenTokens.has(t)) {
        seenTokens.add(t);
        tokens.push(t);
      }
    }

    if (tokens.length === 0) return [];

    return tokens
      .map(token => {
        const count = results.reduce((acc, r) => {
          const tagText = `${toTagText((r as any).tags)} ${toTagText((r as any).symptom_tags)}`.trim();
          const variants = getVariants(token);
          return variants.some(v => tagText.includes(v)) ? acc + 1 : acc;
        }, 0);
        return { token, count };
      })
      .filter(entry => entry.count > 0);
  }, [lastQuery, results, STOPWORDS, synonymMap]);

  const handleToggleResource = async (resource: Resource) => {
    const resourceId = resource.id?.trim();
    if (!resourceId) return;

    if (!isLoggedIn) {
      router.push("/(tabs)/login");
      return;
    }

    const currentlySaved = savedResourceIds.has(resourceId);
    if (currentlySaved) {
      if (removingResourceId === resourceId) {
        return;
      }
      setRemovingResourceId(resourceId);
      try {
        const current = profile?.recommendedResourceIds ?? [];
        const next = current.filter(id => id.trim() !== resourceId);
        await updateProfile({ recommendedResourceIds: next });
      } catch (error) {
        console.warn("Failed to remove resource", error);
      } finally {
        setRemovingResourceId(prev => (prev === resourceId ? null : prev));
      }
      return;
    }

    if (savingResourceId === resourceId) {
      return;
    }

    setSavingResourceId(resourceId);
    try {
      const current = profile?.recommendedResourceIds ?? [];
      const next = Array.from(new Set([...current, resourceId]));
      await updateProfile({ recommendedResourceIds: next });
    } catch (error) {
      console.warn("Failed to save resource", error);
    } finally {
      setSavingResourceId(prev => (prev === resourceId ? null : prev));
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f3f4f6" }}>
      {/* Back to switch page */}
      <View style={styles.backBar}>
        <Text
          onPress={() => router.push("/(tabs)/resources")}
          style={styles.backText}
        >
          ← Back to Resources
        </Text>
      </View>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Search by Symptom</Text>
        <Text style={styles.headerSub}>Enter your symptoms to get relevant educational materials.</Text>
      </View>

      {/* Search Card */}
      <View style={styles.searchCard}>
        <TextInput
          value={symptom}
          onChangeText={setSymptom}
          placeholder="Symptom (in English), e.g., anxiety / ocd / adhd"
          placeholderTextColor={GREEN_TEXT_SOFT}
          style={styles.input}
          returnKeyType="search"
          onSubmitEditing={runSearch}
        />
        <Pressable onPress={runSearch} style={styles.searchBtn}>
          <Text style={styles.searchBtnText}>Search</Text>
        </Pressable>
      </View>

      {/* Results */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.resultList}
        showsVerticalScrollIndicator={false}
      >
        {!didSearch ? null : (
          <>
            {loading ? (
              <View style={[styles.card, styles.centerCard]}>
                <ActivityIndicator />
                <Text style={{ marginTop: 8, color: GREEN_TEXT_SOFT }}>
                  Searching…
                </Text>
              </View>
            ) : errorMsg ? (
              <View style={[styles.card, styles.centerCard]}>
                <Text style={styles.errorText}>
                  Failed to load resources: {errorMsg}
                </Text>
              </View>
            ) : results.length === 0 ? (
              <View style={[styles.card, styles.centerCard]}>
                <Text style={styles.emptyText}>
                  No resources found. Try a different keyword.
                </Text>
              </View>
            ) : (
              <>
                <Text style={styles.resultHint}>
                  Showing {results.length} results for "{lastQuery}"
                  {queryTokenCounts.length > 0
                    ? `; matches — ${queryTokenCounts
                      .map(entry => `${entry.token}: ${entry.count}`)
                      .join(", ")}`
                    : " (sorted by relevance)"}
                  .
                </Text>
                {pagedResults.map(r => {
                  const isSaved = savedResourceIds.has(r.id);
                  const isSaving = savingResourceId === r.id;
                  const isRemoving = removingResourceId === r.id;
                  return (
                    <View key={r.id} style={styles.card}>
                    {/* Title */}
                    <Text numberOfLines={2} style={styles.title}>
                      {r.title}
                    </Text>

                    {/* Meta row: org + type */}
                    <View style={styles.metaRow}>
                      {r.org ? (
                        <Text style={styles.org} numberOfLines={1}>
                          {r.org}
                        </Text>
                      ) : null}

                      <View style={styles.typePill}>
                        <Text style={styles.typePillText}>{r.type}</Text>
                      </View>
                    </View>

                    {/* URL */}
                    <Pressable
                      onPress={() => Linking.openURL(ensureHttp(r.url))}
                      hitSlop={8}
                    >
                      <Text numberOfLines={1} style={styles.url}>
                        {r.url}
                      </Text>
                    </Pressable>

                    <Pressable
                      accessibilityRole="button"
                      onPress={() => handleToggleResource(r)}
                      disabled={isSaving || isRemoving}
                      style={[
                        styles.saveBtn,
                        (isSaved || isSaving || isRemoving) && styles.saveBtnDisabled,
                      ]}
                    >
                      <Text style={styles.saveBtnText}>
                        {isSaving
                          ? "Saving..."
                          : isRemoving
                            ? "Removing..."
                            : isSaved
                              ? "Saved — tap to remove"
                              : "Save to profile"}
                      </Text>
                      </Pressable>
                    </View>
                  );
                })}

                {/* Pagination */}
                {totalPages > 1 && (
                  <View style={styles.paginationRow}>
                    <Pressable
                      style={[styles.pageBtn, page === 0 && styles.pageBtnDisabled]}
                      disabled={page === 0}
                      onPress={() => setPage(p => Math.max(0, p - 1))}
                    >
                      <Text style={styles.pageBtnText}>Previous</Text>
                    </Pressable>
                    <Text style={styles.pageInfo}>
                      Page {page + 1} of {totalPages}
                    </Text>
                    <Pressable
                      style={[styles.pageBtn, page >= totalPages - 1 && styles.pageBtnDisabled]}
                      disabled={page >= totalPages - 1}
                      onPress={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                    >
                      <Text style={styles.pageBtnText}>Next</Text>
                    </Pressable>
                  </View>
                )}
              </>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/** ---------- styles ---------- */
const styles = StyleSheet.create({
  backBar: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  backText: {
    color: "#1E855F",
    fontWeight: "700",
  },

  header: {
    paddingTop: 12,
    paddingBottom: 8,
    paddingHorizontal: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#0f172a",
  },
  headerSub: {
    marginTop: 4,
    fontSize: 14,
    color: "#6b7280",
  },

  searchCard: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 14,
    borderRadius: 18,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: GREEN_BORDER,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  input: {
    backgroundColor: GREEN_LIGHT,
    borderColor: GREEN_BORDER,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: GREEN_TEXT,
    fontSize: 16,
    marginBottom: 10,
  },
  searchBtn: {
    backgroundColor: GREEN_TEXT,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  searchBtnText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.4,
  },

  resultList: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 28,
  },

  card: {
    backgroundColor: GREEN_LIGHT,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: GREEN_BORDER,
    paddingVertical: 18,
    paddingHorizontal: 18,
    minHeight: Math.round(H * 0.16),
    justifyContent: "center",
    marginBottom: 16,
  },
  centerCard: {
    minHeight: 90,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0f172a",
  },
  metaRow: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  org: {
    fontSize: 14,
    color: "#6b7280",
    maxWidth: "70%",
  },
  typePill: {
    backgroundColor: "#e2f0e9",
    borderColor: GREEN_BORDER,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  typePillText: {
    fontSize: 12,
    fontWeight: "700",
    color: GREEN_TEXT,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  url: {
    marginTop: 10,
    fontSize: 15,
    fontWeight: "600",
    color: BLUE_LINK,
  },
  saveBtn: {
    marginTop: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: GREEN_BORDER,
    backgroundColor: "#ffffff",
    paddingVertical: 10,
    alignItems: "center",
  },
  saveBtnDisabled: {
    backgroundColor: "#e0ebdf",
    borderColor: "rgba(6,95,70,0.3)",
  },
  saveBtnText: {
    color: GREEN_TEXT,
    fontWeight: "700",
  },

  emptyText: {
    color: GREEN_TEXT_SOFT,
    fontSize: 15,
    textAlign: "center",
  },
  errorText: {
    color: "#b91c1c",
    fontSize: 15,
    textAlign: "center",
  },

  paginationRow: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  pageBtn: {
    flex: 1,
    backgroundColor: GREEN_TEXT,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  pageBtnDisabled: {
    backgroundColor: GREEN_BORDER,
  },
  pageBtnText: {
    color: "#ffffff",
    fontWeight: "700",
  },
  pageInfo: {
    color: GREEN_TEXT,
    fontWeight: "700",
  },
  resultHint: {
    color: GREEN_TEXT_SOFT,
    marginBottom: 8,
  },
});
