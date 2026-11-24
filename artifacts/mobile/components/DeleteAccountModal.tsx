import React, { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";

import { useApp } from "@/contexts/AppContext";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useColors } from "@workspace/zbarber-design/hooks/use-colors";
import { useAuthedFetch } from "@/lib/api";

type Props = { visible: boolean; onClose: () => void };

export function DeleteAccountModal({ visible, onClose }: Props) {
  const c = useColors();
  const { t, signOut } = useApp();
  const fetcher = useAuthedFetch();
  const [confirm, setConfirm] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [accountDeleted, setAccountDeleted] = useState(false);
  const deleteLock = React.useRef(false);

  React.useEffect(() => {
    if (visible) { setConfirm(""); setReason(""); setErr(null); setAccountDeleted(false); }
  }, [visible]);

  const confirmWord = (t as any).deleteAccountConfirmWord ?? "SUPPRIMER";
  const canDelete = (accountDeleted || confirm.trim().toUpperCase() === confirmWord) && !busy;

  const handleDelete = async () => {
    if (deleteLock.current || !canDelete) return;
    deleteLock.current = true;
    setErr(null);
    setBusy(true);
    try {
      if (!accountDeleted) {
        await fetcher("/api/auth/me", { method: "DELETE" });
        setAccountDeleted(true);
      }
      await signOut({ destination: "/role-select" });
      onClose();
    } catch (e: any) {
      setErr(e?.message ?? "Erreur");
    } finally {
      deleteLock.current = false;
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => { if (!busy && !accountDeleted) onClose(); }}>
      <View style={{ flex: 1, backgroundColor: c.background }}>
        <View style={{ flexDirection: "row", padding: 16, borderBottomWidth: 1, borderBottomColor: c.border, alignItems: "center", justifyContent: "space-between" }}>
          <Pressable onPress={onClose} hitSlop={10} disabled={busy || accountDeleted}>
            <Text style={{ color: c.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 15 }}>{(t as any).cancel ?? "Annuler"}</Text>
          </Pressable>
          <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 17 }}>{(t as any).deleteAccountTitle}</Text>
          <View style={{ width: 60 }} />
        </View>

        <KeyboardAwareScrollViewCompat
          contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 48 }}
          bottomOffset={32}
        >
          <View style={{ backgroundColor: c.destructive + "15", padding: 16, borderRadius: c.radius, flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
            <Feather name="alert-triangle" size={22} color={c.destructive} />
            <Text style={{ flex: 1, color: c.foreground, fontFamily: "Inter_400Regular", lineHeight: 20 }}>
              {(t as any).deleteAccountDesc}
            </Text>
          </View>

          <View>
            <Text style={{ color: c.foreground, fontFamily: "Inter_500Medium", marginBottom: 8 }}>
              {(t as any).deleteAccountReason}
            </Text>
            <TextInput
              value={reason}
              onChangeText={setReason}
              placeholder={(t as any).deleteAccountReasonPh}
              placeholderTextColor={c.mutedForeground}
              multiline
              numberOfLines={3}
              style={{
                backgroundColor: c.card, color: c.foreground, borderWidth: 1, borderColor: c.border,
                borderRadius: c.radius, padding: 12, fontFamily: "Inter_400Regular", minHeight: 80, textAlignVertical: "top",
              }}
            />
          </View>

          <View>
            <Text style={{ color: c.foreground, fontFamily: "Inter_500Medium", marginBottom: 8 }}>
              {(t as any).deleteAccountConfirmLabel}
            </Text>
            <TextInput
              value={confirm}
              onChangeText={setConfirm}
              autoCapitalize="characters"
              autoCorrect={false}
              placeholder={confirmWord}
              placeholderTextColor={c.mutedForeground}
              style={{
                backgroundColor: c.card, color: c.foreground, borderWidth: 1, borderColor: c.border,
                borderRadius: c.radius, padding: 14, fontFamily: "Inter_400Regular",
              }}
            />
          </View>

          {err && <Text style={{ color: c.destructive, fontFamily: "Inter_400Regular", fontSize: 13 }}>{err}</Text>}

          <Pressable
            onPress={handleDelete}
            disabled={!canDelete}
            style={({ pressed }) => ({
              backgroundColor: c.destructive, padding: 16, borderRadius: c.radius, alignItems: "center",
              opacity: !canDelete ? 0.5 : pressed ? 0.85 : 1, marginTop: 8,
            })}
          >
            {busy ? <ActivityIndicator color="#fff" /> : (
              <Text style={{ color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 16 }}>
                {accountDeleted ? "Réessayer la déconnexion" : (t as any).deleteAccountConfirmBtn}
              </Text>
            )}
          </Pressable>
        </KeyboardAwareScrollViewCompat>
      </View>
    </Modal>
  );
}
