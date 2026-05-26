import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";

import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { useAuthedFetch } from "@/lib/api";

type Props = {
  visible: boolean;
  onClose: () => void;
  barberId: number;
  salonName?: string;
  onSubmitted?: () => void;
};

export function ReviewModal({ visible, onClose, barberId, salonName, onSubmitted }: Props) {
  const c = useColors();
  const { t } = useApp();
  const fetcher = useAuthedFetch();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setRating(0);
    setComment("");
  };

  const submit = async () => {
    if (rating < 1) {
      Alert.alert(t.rateBarberTitle ?? "Note requise", t.ratingRequired ?? "Sélectionnez une note de 1 à 5 étoiles.");
      return;
    }
    setSubmitting(true);
    try {
      await fetcher("/api/reviews", {
        method: "POST",
        body: JSON.stringify({ barberId, rating, comment: comment.trim() || undefined }),
      });
      Alert.alert(t.reviewThanks ?? "Merci !", t.reviewSent ?? "Votre avis a été publié.");
      reset();
      onSubmitted?.();
      onClose();
    } catch (e: any) {
      Alert.alert(t.error ?? "Erreur", e?.message ?? "Impossible d'envoyer l'avis.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" }}
      >
        <View
          style={{
            backgroundColor: c.card,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: 24,
            paddingBottom: 36,
            gap: 18,
          }}
        >
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ color: c.foreground, fontFamily: "Inter_700Bold", fontSize: 18 }}>
              {t.rateBarberTitle ?? "Laisser un avis"}
            </Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Feather name="x" size={22} color={c.mutedForeground} />
            </Pressable>
          </View>

          {salonName && (
            <Text style={{ color: c.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13 }}>
              {salonName}
            </Text>
          )}

          <View style={{ flexDirection: "row", justifyContent: "center", gap: 8 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable key={n} onPress={() => setRating(n)} hitSlop={6}>
                <Feather
                  name="star"
                  size={36}
                  color={n <= rating ? "#D4AF37" : c.border}
                />
              </Pressable>
            ))}
          </View>

          <TextInput
            value={comment}
            onChangeText={setComment}
            placeholder={t.reviewCommentPlaceholder ?? "Partagez votre expérience (optionnel)"}
            placeholderTextColor={c.mutedForeground}
            multiline
            numberOfLines={4}
            style={{
              color: c.foreground,
              fontFamily: "Inter_400Regular",
              fontSize: 14,
              borderWidth: 1,
              borderColor: c.border,
              borderRadius: c.radius - 4,
              padding: 12,
              minHeight: 96,
              textAlignVertical: "top",
            }}
          />

          <Pressable
            onPress={submit}
            disabled={submitting}
            style={({ pressed }) => ({
              backgroundColor: c.primary,
              paddingVertical: 14,
              borderRadius: c.radius - 4,
              alignItems: "center",
              opacity: pressed || submitting ? 0.7 : 1,
            })}
          >
            {submitting ? (
              <ActivityIndicator color={c.primaryForeground} />
            ) : (
              <Text style={{ color: c.primaryForeground, fontFamily: "Inter_700Bold", fontSize: 15 }}>
                {t.submitReview ?? "Publier l'avis"}
              </Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
