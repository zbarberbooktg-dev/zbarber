import { Stack } from "expo-router";
import React from "react";

import { LegalScreen } from "@/components/LegalScreen";
import { LegalHeaderBack } from "@/components/LegalHeaderBack";
import { useApp } from "@/contexts/AppContext";
import { LEGAL } from "@/constants/legal";

export default function PrivacyScreen() {
  const { lang } = useApp();
  const doc = LEGAL[lang].privacy;
  return (
    <>
      <Stack.Screen
        options={{
          title: doc.title,
          headerBackTitle: "Retour",
          headerLeft: () => <LegalHeaderBack />,
        }}
      />
      <LegalScreen doc={doc} />
    </>
  );
}
