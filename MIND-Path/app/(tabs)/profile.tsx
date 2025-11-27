import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Text,
  View,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import LoginScreen from "./login";
import {
  fetchProvidersByIds,
  type ProviderRow,
} from "@/utils/supabaseProvider";
import {
  fetchResourcesByIds,
  type Resource,
} from "@/utils/supabaseContent";

/** ---------- Theme colors ---------- */
const GREEN_MAIN = "#3F9360";
const GREEN_LIGHT = "#DDEFE6";
const GREEN_BORDER = "rgba(6,95,70,0.14)";
const GREEN_TEXT = "#065F46";
const PLACEHOLDER = "#3a6a54";

const ensureHttp = (url: string) =>
  /^https?:\/\//i.test(url) ? url : `https://${url}`;

/** ---------- Profile clinic card colors ---------- */
const PEACH_LIGHT = "#FEF3E7";
const PEACH_BORDER = "rgba(240, 180, 140, 0.35)";

const EMPTY_PROFILE = {
  username: "",
  password: "",
  zipcode: "",
  previousChatSessionIds: [] as string[],
  recommendedResourceIds: [] as string[],
  clinicIds: [] as string[],
};

function ProfileContent() {
  const { logOut, profile, updateProfile } = useAuth();
  const safeProfile = useMemo(() => profile ?? EMPTY_PROFILE, [profile]);

  const {
    previousChatSessionIds,
    recommendedResourceIds,
    clinicIds,
    username,
  } = safeProfile;

  const normalizedResourceIds = useMemo(
    () =>
      recommendedResourceIds
        .map(id => id.trim())
        .filter(id => id.length > 0),
    [recommendedResourceIds]
  );

  const [resourceRows, setResourceRows] = useState<Resource[]>([]);
  const [resourceLoading, setResourceLoading] = useState(false);
  const [resourceError, setResourceError] = useState<string | null>(null);
  const [removingResourceId, setRemovingResourceId] = useState<string | null>(null);
  const [resourceEditMode, setResourceEditMode] = useState(false);

  const displayName = username || "Guest Explorer";

  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const togglePick = (key: string) =>
    setPicked(prev => ({ ...prev, [key]: !prev[key] }));

  const clinicIdNumbers = useMemo(
    () =>
      clinicIds
        .map(id => Number.parseInt(String(id), 10))
        .filter(id => Number.isFinite(id)),
    [clinicIds]
  );

  const [clinicRows, setClinicRows] = useState<ProviderRow[]>([]);
  const [clinicLoading, setClinicLoading] = useState(false);
  const [clinicError, setClinicError] = useState<string | null>(null);
  const [removingClinicId, setRemovingClinicId] = useState<string | null>(null);
  const [clinicEditMode, setClinicEditMode] = useState(false);

  useEffect(() => {
    if (normalizedResourceIds.length === 0) {
      setResourceRows([]);
      setResourceError(null);
      setResourceLoading(false);
      return;
    }

    let cancelled = false;
    setResourceLoading(true);
    setResourceError(null);

    fetchResourcesByIds(normalizedResourceIds)
      .then(rows => {
        if (cancelled) return;
        const rowMap = new Map(rows.map(row => [row.id, row]));
        const ordered = normalizedResourceIds
          .map(id => rowMap.get(id))
          .filter((row): row is Resource => Boolean(row));
        setResourceRows(ordered);
      })
      .catch(error => {
        if (cancelled) return;
        console.error("Failed to load saved resources", error);
        setResourceRows([]);
        setResourceError(error?.message ?? String(error));
      })
      .finally(() => {
        if (cancelled) return;
        setResourceLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [normalizedResourceIds]);

  useEffect(() => {
    if (resourceEditMode && normalizedResourceIds.length === 0) {
      setResourceEditMode(false);
    }
  }, [resourceEditMode, normalizedResourceIds.length]);

  useEffect(() => {
    if (clinicIdNumbers.length === 0) {
      setClinicRows([]);
      setClinicError(null);
      setClinicLoading(false);
      return;
    }

    let cancelled = false;
    setClinicLoading(true);
    setClinicError(null);

    fetchProvidersByIds(clinicIdNumbers)
      .then(rows => {
        if (cancelled) return;
        const rowMap = new Map(rows.map(row => [row.provider_id, row]));
        const ordered = clinicIdNumbers
          .map(id => rowMap.get(id))
          .filter((row): row is ProviderRow => Boolean(row));
        setClinicRows(ordered);
      })
      .catch(error => {
        if (cancelled) return;
        console.error("Failed to load saved clinics", error);
        setClinicRows([]);
        setClinicError(error?.message ?? String(error));
      })
      .finally(() => {
        if (cancelled) return;
        setClinicLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [clinicIdNumbers]);

  useEffect(() => {
    if (clinicEditMode && clinicIds.length === 0) {
      setClinicEditMode(false);
    }
  }, [clinicEditMode, clinicIds.length]);

  const handleRemoveResource = useCallback(
    async (resourceId?: string | null) => {
      const trimmedId = resourceId?.trim();
      if (!trimmedId) {
        return;
      }

      setRemovingResourceId(trimmedId);
      try {
        const next = recommendedResourceIds.filter(id => id.trim() !== trimmedId);
        await updateProfile({ recommendedResourceIds: next });
        setPicked(prev => {
          if (!prev[trimmedId]) {
            return prev;
          }
          const nextPicked = { ...prev };
          delete nextPicked[trimmedId];
          return nextPicked;
        });
      } catch (error) {
        console.warn("Failed to remove resource", error);
      } finally {
        setRemovingResourceId(prev => (prev === trimmedId ? null : prev));
      }
    },
    [recommendedResourceIds, updateProfile]
  );

  const handleRemoveClinic = useCallback(
    async (clinicId?: string | null) => {
      const trimmedId = clinicId?.trim();
      if (!trimmedId) {
        return;
      }

      setRemovingClinicId(trimmedId);
      try {
        const next = clinicIds.filter(id => id.trim() !== trimmedId);
        await updateProfile({ clinicIds: next });
        setPicked(prev => {
          if (!prev[trimmedId]) {
            return prev;
          }
          const nextPicked = { ...prev };
          delete nextPicked[trimmedId];
          return nextPicked;
        });
      } catch (error) {
        console.warn("Failed to remove clinic", error);
      } finally {
        setRemovingClinicId(prev => (prev === trimmedId ? null : prev));
      }
    },
    [clinicIds, updateProfile]
  );

  const toggleResourceEditMode = useCallback(() => {
    setResourceEditMode(prev => !prev);
  }, []);

  const toggleClinicEditMode = useCallback(() => {
    setClinicEditMode(prev => !prev);
  }, []);

  const noSavedResources =
    normalizedResourceIds.length === 0 ||
    (!resourceLoading && !resourceError && resourceRows.length === 0);

  const openResourceUrl = useCallback((resource?: Resource | null) => {
    const raw = resource?.url?.trim();
    if (!raw) return;
    const target = ensureHttp(raw);
    Linking.openURL(target).catch(error => {
      console.warn("Failed to open resource URL", error);
    });
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f3f4f6" }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 10,
          paddingBottom: 32,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Reuse shared header (avatar + bell) */}
        <View style={styles.header}>
          <View style={styles.avatar}><Text style={{ fontSize: 18 }}>🧑🏻‍🦱</Text></View>
          <View style={{ flex: 1 }} />
          <View style={styles.bellWrap}>
            <Text style={{ fontSize: 20 }}>🔔</Text>
            <View style={styles.badge}><Text style={styles.badgeText}>3</Text></View>
          </View>
        </View>

        {/* Top green card: Previous chats / Resources */}
        <View style={styles.profileTopCard}>
          <View style={styles.profileTopHeaderRow}>
            <Text style={styles.profileTopTitle}>Previous chats / Resources</Text>
            {normalizedResourceIds.length > 0 ? (
              <Pressable
                accessibilityRole="button"
                hitSlop={8}
                onPress={toggleResourceEditMode}
                style={[styles.editToggleBtn, styles.profileTopEditBtn]}
              >
                <Text style={styles.editToggleText}>
                  {resourceEditMode ? "Done" : "Edit"}
                </Text>
              </Pressable>
            ) : null}
          </View>
          <Text style={styles.profileTopSubtitle}>
            Hi {displayName}, resume a conversation or revisit a recommended
            resource.
          </Text>

          <View style={styles.choiceRow}>
            {/* Left column: Chats */}
            <View
              style={[
                styles.choiceColumnCard,
                styles.choiceColumnCardChats,
              ]}
            >
              <View style={styles.choiceColumnHeaderRow}>
                <Text style={styles.choiceColumnTitle}>Saved chats</Text>
                {previousChatSessionIds.length ? (
                  <Text style={styles.choiceColumnBadge}>
                    {previousChatSessionIds.length}
                  </Text>
                ) : null}
              </View>
              {previousChatSessionIds.length === 0 ? (
                <Text style={styles.emptyText}>No saved chats yet.</Text>
              ) : (
                previousChatSessionIds.map(label => {
                  const isSelected = !!picked[label];
                  return (
                    <Pressable
                      key={label}
                      accessibilityRole="button"
                      onPress={() => togglePick(label)}
                      style={[
                        styles.choiceItem,
                        {
                          backgroundColor: isSelected
                            ? "#ffffff"
                            : GREEN_LIGHT,
                          borderWidth: isSelected ? 1 : 0,
                          borderColor: isSelected ? "#cbd5e1" : "transparent",
                        },
                      ]}
                    >
                      <Text style={styles.choiceLabel}>{label}</Text>
                    </Pressable>
                  );
                })
              )}
            </View>

            {/* Right column: Resources */}
            <View
              style={[
                styles.choiceColumnCard,
                styles.choiceColumnCardRight,
                styles.choiceColumnCardResource,
              ]}
            >
              <View style={styles.choiceColumnHeaderRow}>
                <Text style={styles.choiceColumnTitle}>Saved resources</Text>
              </View>
              {resourceLoading ? (
                <View style={styles.resourceStatusRow}>
                  <ActivityIndicator color={GREEN_TEXT} size="small" />
                  <Text style={styles.resourceStatusText}>
                    Loading resources...
                  </Text>
                </View>
              ) : resourceError ? (
                <Text style={styles.resourceErrorText}>
                  Unable to load saved resources. {resourceError}
                </Text>
              ) : noSavedResources ? (
                <Text style={styles.emptyText}>No resources saved yet.</Text>
              ) : (
                resourceRows.map(row => {
                  const key = row.id;
                  if (!key) {
                    return null;
                  }
                  if (resourceEditMode) {
                    const removingThisResource = removingResourceId === key;
                    return (
                      <View key={key} style={styles.savedResourceBlock}>
                        <Pressable
                          accessibilityRole="button"
                          style={[
                            styles.choiceItem,
                            styles.savedChoice,
                            {
                              backgroundColor: GREEN_LIGHT,
                              borderWidth: 0,
                              borderColor: "transparent",
                            },
                          ]}
                        >
                          <Text style={styles.choiceLabel} numberOfLines={1}>
                            {row.title || `Resource ${key}`}
                          </Text>
                          {row.type ? (
                            <Text style={styles.choiceMeta} numberOfLines={1}>
                              {row.type}
                            </Text>
                          ) : null}
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          hitSlop={8}
                          onPress={() => handleRemoveResource(key)}
                          disabled={removingThisResource}
                          style={[
                            styles.removeSavedBtn,
                            styles.removeSavedBtnFull,
                            removingThisResource && styles.removeSavedBtnDisabled,
                          ]}
                        >
                          <Text style={styles.removeSavedBtnText}>
                            {removingThisResource ? "Removing..." : "Remove"}
                          </Text>
                        </Pressable>
                      </View>
                    );
                  }

                  return (
                    <Pressable
                      key={key}
                      accessibilityRole="button"
                      onPress={() => openResourceUrl(row)}
                      style={[
                        styles.choiceItem,
                        {
                          backgroundColor: GREEN_LIGHT,
                          borderWidth: 0,
                          borderColor: "transparent",
                        },
                      ]}
                    >
                      <Text style={styles.choiceLabel} numberOfLines={1}>
                        {row.title || `Resource ${key}`}
                      </Text>
                      {row.type ? (
                        <Text style={styles.choiceMeta} numberOfLines={1}>
                          {row.type}
                        </Text>
                      ) : null}
                    </Pressable>
                  );
                })
              )}
            </View>
          </View>

          {/* Decorative blob */}
          <View style={styles.profileTopDecor} />
        </View>


        {/* Saved clinics */}
        <View style={[styles.sectionHeaderRow, styles.savedClinicHeader]}>
          <Text style={styles.savedProvidersTitle}>Saved providers</Text>
          {clinicIds.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              hitSlop={8}
              onPress={toggleClinicEditMode}
              style={[styles.editToggleBtn, styles.savedClinicEditBtn]}
            >
              <Text style={styles.editToggleText}>
                {clinicEditMode ? "Done" : "Edit"}
              </Text>
            </Pressable>
          ) : null}
        </View>
        {clinicIds.length === 0 ? (
          <View style={styles.clinicCard}>
            <Text style={styles.clinicTitle}>No clinics saved yet</Text>
            <View style={styles.clinicDivider} />
            <Text style={styles.clinicSubtitle}>
              Pin clinics you like and they will appear here for quick access.
            </Text>
          </View>
        ) : clinicLoading ? (
          <View style={[styles.clinicCard, styles.clinicStatusCard]}>
            <ActivityIndicator color={GREEN_TEXT} />
            <Text style={styles.clinicStatusText}>Loading saved clinics…</Text>
          </View>
        ) : clinicError ? (
          <View style={[styles.clinicCard, styles.clinicStatusCard]}>
            <Text style={styles.clinicErrorText}>
              Unable to load saved clinics. {clinicError}
            </Text>
          </View>
        ) : clinicRows.length === 0 ? (
          <View style={styles.clinicCard}>
            <Text style={styles.clinicTitle}>No clinic details found</Text>
            <View style={styles.clinicDivider} />
            <Text style={styles.clinicSubtitle}>
              We could not find these providers in the MIND-Path directory. Try
              saving them again from the resources tab.
            </Text>
          </View>
        ) : (
          clinicRows.map(row => {
            const providerId =
              typeof row.provider_id === "number" ? row.provider_id : null;
            if (providerId == null) {
              return null;
            }

            const key = providerId.toString();
            const isSelected = !!picked[key];
            const removingThisClinic = removingClinicId === key;
            const locationLine = [row.city, row.state]
              .filter(Boolean)
              .join(", ");
            return (
              <View
                key={key}
                style={[
                  styles.clinicCard,
                  isSelected && styles.clinicCardSelected,
                ]}
              >
                <View style={styles.clinicHeaderRow}>
                  <Text style={[styles.clinicTitle, styles.clinicHeaderTitle]}>
                    {row.basic_name ?? `Provider #${key}`}
                  </Text>
                  {clinicEditMode ? (
                    <Pressable
                      accessibilityRole="button"
                      hitSlop={8}
                      onPress={() => handleRemoveClinic(key)}
                      disabled={removingThisClinic}
                      style={[
                        styles.removeSavedBtn,
                        styles.clinicRemoveBtn,
                        removingThisClinic && styles.removeSavedBtnDisabled,
                      ]}
                    >
                      <Text style={styles.removeSavedBtnText}>
                        {removingThisClinic ? "Removing..." : "Remove"}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
                <View style={styles.clinicDivider} />
                <View style={styles.clinicDetails}>
                  {locationLine ? (
                    <Text style={styles.clinicDetailText}>{locationLine}</Text>
                  ) : null}
                  {row.specialty ? (
                    <Text style={styles.clinicDetailText}>{row.specialty}</Text>
                  ) : null}
                  {row.phone ? (
                    <Text style={styles.clinicDetailText}>
                      Phone: {row.phone}
                    </Text>
                  ) : null}
                </View>
                <Pressable
                  style={styles.apptBtn}
                  accessibilityRole="button"
                  onPress={() => togglePick(key)}
                >
                  <Text style={styles.apptBtnText}>Appointment time</Text>
                </Pressable>
              </View>
            );
          })
        )}

        <Pressable
          style={styles.logoutBtn}
          accessibilityRole="button"
          onPress={logOut}
        >
          <Text style={styles.logoutText}>Log out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

export default function ProfileScreen() {
  const { isLoggedIn } = useAuth();
  if (!isLoggedIn) {
    return <LoginScreen embedded />;
  }
  return <ProfileContent />;
}

const styles = StyleSheet.create({
  /** ---------- Profile styles ---------- */
  profileTopCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(6,95,70,0.1)",
    padding: 18,
    position: "relative",
    overflow: "hidden",
    marginBottom: 20,
    shadowColor: "#0f172a",
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
  profileTopHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 4,
  },
  profileTopTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: GREEN_TEXT,
    marginBottom: 6,
  },
  profileTopEditBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  profileTopSubtitle: {
    fontSize: 12,
    color: PLACEHOLDER,
    marginTop: 2,
    marginBottom: 12,
    lineHeight: 18,
  },
  profileTopDecor: {
    position: "absolute",
    right: -60,
    bottom: -60,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "rgba(63,147,96,0.18)",
    transform: [{ rotate: "12deg" }],
    pointerEvents: "none",
  },
  choiceRow: {
    flexDirection: "row",
    marginTop: 6,
  },
  choiceColumnCard: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(6,95,70,0.08)",
    padding: 14,
  },
  choiceColumnCardRight: {
    marginLeft: 12,
  },
  choiceColumnCardChats: {
    backgroundColor: GREEN_LIGHT,
    borderColor: GREEN_BORDER,
  },
  choiceColumnCardResource: {
    backgroundColor: GREEN_LIGHT,
    borderColor: GREEN_BORDER,
  },
  choiceColumnHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  choiceColumnTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: GREEN_TEXT,
  },
  choiceColumnBadge: {
    minWidth: 26,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: GREEN_LIGHT,
    color: GREEN_TEXT,
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },
/** Clinic cards */
  clinicCard: {
    backgroundColor: PEACH_LIGHT,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: PEACH_BORDER,
    paddingHorizontal: 18,
    paddingVertical: 16,
    marginBottom: 16,
    shadowColor: "#0f172a",
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  clinicStatusCard: {
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  clinicCardSelected: {
    borderColor: GREEN_BORDER,
    borderWidth: 2,
    backgroundColor: "#fff5e6",
  },
  clinicHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 6,
  },
  clinicHeaderTitle: {
    flex: 1,
    marginBottom: 0,
  },
  clinicTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#4c3428",
    marginBottom: 8,
  },
  clinicDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(0,0,0,0.08)",
    marginBottom: 8,
  },
  clinicSubtitle: {
    fontSize: 13,
    color: "#7a6f68",
    marginBottom: 12,
  },
  clinicStatusText: {
    fontSize: 13,
    color: "#7a6f68",
    textAlign: "center",
  },
  clinicErrorText: {
    fontSize: 13,
    color: "#b91c1c",
    textAlign: "center",
  },
  clinicDetails: {
    gap: 4,
    marginBottom: 12,
  },
  clinicDetailText: {
    fontSize: 13,
    color: "#5c4235",
  },
  apptBtn: {
    alignSelf: "flex-start",
    backgroundColor: GREEN_LIGHT,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: GREEN_BORDER,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  apptBtnText: {
    color: GREEN_TEXT,
    fontWeight: "700",
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 6,
    gap: 8,
  },
  savedClinicHeader: {
    marginTop: 12,
  },
  sectionHeaderLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#374151",
  },
  savedProvidersTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#5c4235",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  editToggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: GREEN_LIGHT,
    borderWidth: 1,
    borderColor: GREEN_BORDER,
  },
  savedClinicEditBtn: {
    marginLeft: 12,
  },
  editToggleText: {
    fontSize: 12,
    fontWeight: "700",
    color: GREEN_TEXT,
  },
  savedResourceBlock: {
    marginBottom: 10,
  },
  savedChoice: {
    flex: 1,
    marginBottom: 0,
  },
  removeSavedBtn: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#fecaca",
    backgroundColor: "#fff1f2",
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 84,
  },
  clinicRemoveBtn: {
    minWidth: undefined,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignSelf: "flex-start",
  },
  removeSavedBtnFull: {
    marginTop: 8,
    width: "100%",
  },
  removeSavedBtnDisabled: {
    opacity: 0.5,
  },
  removeSavedBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#b91c1c",
  },

  // "Mood-card style" choice buttons used in Profile's top card
  choiceItem: {
    minHeight: 44,
    borderRadius: 16,
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginBottom: 8,
  },
  choiceLabel: {
    fontSize: 14,
    color: "#374151",
    fontWeight: "600",
  },
  choiceMeta: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 2,
  },
  emptyText: {
    fontSize: 12,
    color: PLACEHOLDER,
    fontStyle: "italic",
  },
  resourceStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 4,
  },
  resourceStatusText: {
    fontSize: 12,
    color: PLACEHOLDER,
  },
  resourceErrorText: {
    fontSize: 12,
    color: "#b91c1c",
  },

  /** Shared header */
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 4,
    marginBottom: 10,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#e5e7eb",
    alignItems: "center",
    justifyContent: "center",
  },
  bellWrap: { position: "relative" },
  badge: {
    position: "absolute",
    right: -4,
    top: -2,
    backgroundColor: "#22c55e",
    borderRadius: 8,
    paddingHorizontal: 4,
    minWidth: 16,
    alignItems: "center",
  },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },

  logoutBtn: {
    marginTop: 12,
    backgroundColor: GREEN_MAIN,
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: "center",
  },
  logoutText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
});
