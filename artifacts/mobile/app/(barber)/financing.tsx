import { Feather } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as DocumentPicker from "expo-document-picker";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import { Button, Card, EmptyState, Pill, SectionTitle } from "@/components/UI";
import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { apiUrl, useAuthedFetch } from "@/lib/api";

type Purpose = "renovation" | "tools" | "products" | "other";
type Status = "pending" | "reviewing" | "approved" | "rejected";

type FinancingRequest = {
  id: number;
  amount: number;
  purpose: Purpose;
  description: string;
  monthlyRevenue: number;
  yearsActive: number;
  repaymentMonths: number;
  documents: string[];
  status: Status;
  adminNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
};

const PURPOSE_LABEL: Record<Purpose, string> = {
  renovation: "Rénovation",
  tools: "Outils",
  products: "Produits",
  other: "Autre",
};

const STATUS_TONE: Record<Status, "success" | "warning" | "danger" | "neutral"> = {
  approved: "success",
  pending: "warning",
  reviewing: "warning",
  rejected: "danger",
};

const STATUS_LABEL: Record<Status, string> = {
  pending: "En attente",
  reviewing: "En révision",
  approved: "Approuvée",
  rejected: "Rejetée",
};

export default function BarberFinancing() {
  const c = useColors();
  const fetcher = useAuthedFetch();
  const { locale } = useApp();
  const qc = useQueryClient();
  const [openForm, setOpenForm] = useState(false);

  const { data, isLoading, refetch } = useQuery<{ data: FinancingRequest[]; total: number }>({
    queryKey: ["myFinancing"],
    queryFn: () => fetcher<{ data: FinancingRequest[]; total: number }>("/api/financing-requests?limit=50"),
  });

  const requests = data?.data ?? [];
  const hasActive = requests.some(r => r.status === "pending" || r.status === "reviewing");

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
        <Card>
          <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 16, marginBottom: 6 }}>
            Demande de financement
          </Text>
          <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 18 }}>
            Conditions : salon approuvé, montant 50 000 – 5 000 000 FC, remboursement 3–24 mois, au moins un justificatif (pièce d'identité, RCCM, photos du salon). Une seule demande active à la fois.
          </Text>
          <View style={{ marginTop: 12 }}>
            <Button
              label={hasActive ? "Demande en cours" : "Nouvelle demande"}
              icon={hasActive ? "clock" : "plus"}
              onPress={() => setOpenForm(true)}
              disabled={hasActive}
              fullWidth
            />
          </View>
        </Card>

        <SectionTitle title="Mes demandes" />

        {isLoading ? (
          <View style={{ paddingVertical: 24, alignItems: "center" }}>
            <ActivityIndicator color={c.primary} />
          </View>
        ) : requests.length === 0 ? (
          <EmptyState icon="file-text" title="Aucune demande" description="Soumettez votre première demande de financement." />
        ) : (
          requests.map(r => (
            <Card key={r.id}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 15 }}>
                    {r.amount.toLocaleString()} FC
                  </Text>
                  <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 }}>
                    {PURPOSE_LABEL[r.purpose]} · {r.repaymentMonths} mois
                  </Text>
                  <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 11, marginTop: 2 }}>
                    {new Date(r.createdAt).toLocaleDateString(locale)}
                  </Text>
                </View>
                <Pill label={STATUS_LABEL[r.status]} tone={STATUS_TONE[r.status]} />
              </View>
              <Text style={{ color: c.foreground, fontFamily: "Inter_400Regular", fontSize: 13, marginTop: 10 }}>
                {r.description}
              </Text>
              <View style={{ flexDirection: "row", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                {r.documents.map((d, i) => (
                  <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: c.accent, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 }}>
                    <Feather name="paperclip" size={10} color={c.primary} />
                    <Text style={{ color: c.primary, fontFamily: "Inter_500Medium", fontSize: 10 }}>
                      Doc {i + 1}
                    </Text>
                  </View>
                ))}
              </View>
              {r.adminNote && (
                <View style={{ marginTop: 10, padding: 10, backgroundColor: c.muted, borderRadius: 8 }}>
                  <Text style={{ color: c.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 10, marginBottom: 2 }}>
                    NOTE ADMIN
                  </Text>
                  <Text style={{ color: c.foreground, fontFamily: "Inter_400Regular", fontSize: 12 }}>
                    {r.adminNote}
                  </Text>
                </View>
              )}
            </Card>
          ))
        )}
      </ScrollView>

      <FinancingFormModal
        visible={openForm}
        onClose={() => setOpenForm(false)}
        onCreated={() => {
          setOpenForm(false);
          qc.invalidateQueries({ queryKey: ["myFinancing"] });
          refetch();
        }}
      />
    </View>
  );
}

function FinancingFormModal({ visible, onClose, onCreated }: { visible: boolean; onClose: () => void; onCreated: () => void }) {
  const c = useColors();
  const fetcher = useAuthedFetch();
  const [amount, setAmount] = useState("");
  const [purpose, setPurpose] = useState<Purpose>("renovation");
  const [description, setDescription] = useState("");
  const [monthlyRevenue, setMonthlyRevenue] = useState("");
  const [yearsActive, setYearsActive] = useState("");
  const [repaymentMonths, setRepaymentMonths] = useState("12");
  const [docs, setDocs] = useState<{ name: string; objectPath: string }[]>([]);
  const [uploading, setUploading] = useState(false);

  const reset = () => {
    setAmount(""); setPurpose("renovation"); setDescription("");
    setMonthlyRevenue(""); setYearsActive(""); setRepaymentMonths("12"); setDocs([]);
  };

  const submitMutation = useMutation({
    mutationFn: async () => {
      const amt = Number(amount);
      const rev = Number(monthlyRevenue);
      const yrs = Number(yearsActive);
      const months = Number(repaymentMonths);
      if (!Number.isFinite(amt) || amt < 50000 || amt > 5000000) throw new Error("Montant entre 50 000 et 5 000 000 FC");
      if (!Number.isFinite(rev) || rev < 0) throw new Error("Revenu mensuel invalide");
      if (!Number.isFinite(yrs) || yrs < 0) throw new Error("Années d'activité invalides");
      if (!Number.isFinite(months) || months < 3 || months > 24) throw new Error("Remboursement entre 3 et 24 mois");
      if (description.trim().length < 30) throw new Error("Description : 30 caractères minimum");
      if (docs.length < 1) throw new Error("Joignez au moins un justificatif");
      return await fetcher<FinancingRequest>("/api/financing-requests", {
        method: "POST",
        body: JSON.stringify({
          amount: amt,
          purpose,
          description: description.trim(),
          monthlyRevenue: rev,
          yearsActive: yrs,
          repaymentMonths: months,
          documents: docs.map(d => d.objectPath),
        }),
      });
    },
    onSuccess: () => { reset(); onCreated(); },
    onError: (e: Error) => Alert.alert("Erreur", e.message || "Échec de l'envoi"),
  });

  async function pickDocument() {
    try {
      setUploading(true);
      const res = await DocumentPicker.getDocumentAsync({ type: ["image/*", "application/pdf"], copyToCacheDirectory: true });
      if (res.canceled || !res.assets?.[0]) return;
      const asset = res.assets[0];
      const ct = asset.mimeType || "application/octet-stream";
      const presigned = await fetcher<{ uploadURL: string; objectPath: string }>("/api/storage/uploads/request-url", {
        method: "POST",
        body: JSON.stringify({ name: asset.name, size: asset.size ?? 0, contentType: ct }),
      });
      const fileResp = await fetch(asset.uri);
      const blob = await fileResp.blob();
      const put = await fetch(presigned.uploadURL, { method: "PUT", headers: { "content-type": ct }, body: blob });
      if (!put.ok) throw new Error(`Upload échoué (${put.status})`);
      setDocs(prev => [...prev, { name: asset.name, objectPath: presigned.objectPath }]);
    } catch (e) {
      Alert.alert("Erreur", e instanceof Error ? e.message : "Upload échoué");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.background }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderBottomWidth: 1, borderBottomColor: c.border }}>
          <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 16 }}>Nouvelle demande</Text>
          <Pressable onPress={onClose}>
            <Feather name="x" size={22} color={c.foreground} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
          <Field c={c} label="Montant souhaité (FC) *">
            <TextInput value={amount} onChangeText={setAmount} keyboardType="numeric" placeholder="50 000 – 5 000 000" placeholderTextColor={c.mutedForeground} style={inputStyle(c)} />
          </Field>

          <Field c={c} label="Objet du financement *">
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {(Object.keys(PURPOSE_LABEL) as Purpose[]).map(p => (
                <Pressable key={p} onPress={() => setPurpose(p)} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: purpose === p ? c.primary : c.border, backgroundColor: purpose === p ? c.primary : "transparent" }}>
                  <Text style={{ color: purpose === p ? c.primaryForeground : c.foreground, fontFamily: "Inter_500Medium", fontSize: 12 }}>{PURPOSE_LABEL[p]}</Text>
                </Pressable>
              ))}
            </View>
          </Field>

          <Field c={c} label="Description du projet * (min 30 car.)">
            <TextInput value={description} onChangeText={setDescription} multiline numberOfLines={4} placeholder="Décrivez en détail l'utilisation des fonds" placeholderTextColor={c.mutedForeground} style={[inputStyle(c), { height: 100, textAlignVertical: "top" }]} />
            <Text style={{ color: description.length < 30 ? c.destructive : c.mutedForeground, fontSize: 11, marginTop: 4 }}>{description.length}/30</Text>
          </Field>

          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Field c={c} label="Revenu mensuel (FC) *">
                <TextInput value={monthlyRevenue} onChangeText={setMonthlyRevenue} keyboardType="numeric" placeholder="0" placeholderTextColor={c.mutedForeground} style={inputStyle(c)} />
              </Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field c={c} label="Années d'activité *">
                <TextInput value={yearsActive} onChangeText={setYearsActive} keyboardType="numeric" placeholder="0" placeholderTextColor={c.mutedForeground} style={inputStyle(c)} />
              </Field>
            </View>
          </View>

          <Field c={c} label="Durée de remboursement (3–24 mois) *">
            <TextInput value={repaymentMonths} onChangeText={setRepaymentMonths} keyboardType="numeric" placeholder="12" placeholderTextColor={c.mutedForeground} style={inputStyle(c)} />
          </Field>

          <Field c={c} label="Justificatifs * (au moins 1)">
            <View style={{ gap: 8 }}>
              {docs.map((d, i) => (
                <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderRadius: 8, backgroundColor: c.muted }}>
                  <Feather name="paperclip" size={14} color={c.primary} />
                  <Text numberOfLines={1} style={{ flex: 1, color: c.foreground, fontFamily: "Inter_500Medium", fontSize: 12 }}>{d.name}</Text>
                  <Pressable onPress={() => setDocs(prev => prev.filter((_, j) => j !== i))}>
                    <Feather name="x" size={14} color={c.destructive} />
                  </Pressable>
                </View>
              ))}
              <Button label={uploading ? "Téléversement..." : "Ajouter un document"} icon="upload" onPress={pickDocument} disabled={uploading} fullWidth />
            </View>
          </Field>

          <View style={{ height: 8 }} />
          <Button label={submitMutation.isPending ? "Envoi..." : "Envoyer la demande"} icon="send" onPress={() => submitMutation.mutate()} disabled={submitMutation.isPending} fullWidth />
          <View style={{ height: 24 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Field({ c, label, children }: { c: ReturnType<typeof useColors>; label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: c.foreground, fontFamily: "Inter_600SemiBold", fontSize: 12 }}>{label}</Text>
      {children}
    </View>
  );
}

function inputStyle(c: ReturnType<typeof useColors>) {
  return {
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.card,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: c.foreground,
    fontFamily: "Inter_400Regular" as const,
    fontSize: 14,
  };
}

// keep apiUrl referenced (so unused import warning doesn't trip)
void apiUrl;
