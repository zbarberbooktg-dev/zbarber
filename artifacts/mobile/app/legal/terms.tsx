import { Stack } from "expo-router";
import React from "react";

import { LegalScreen } from "@/components/LegalScreen";
import { useApp } from "@/contexts/AppContext";
import { LEGAL } from "@/constants/legal";

export default function TermsScreen() {
  const { lang } = useApp();
  const doc = LEGAL[lang].terms;
  return (
    <>
      <Stack.Screen options={{ title: doc.title, headerBackTitle: "Retour" }} />
      <LegalScreen doc={doc} />
    </>
  );
}
