import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { NativeThemeProvider } from "../hooks/use-colors";
import { Button } from "../components/native/button";
import { Typography } from "../components/native/typography";
import { Card, CardContent, CardHeader, CardTitle } from "../components/native/card";
import { Input } from "../components/native/input";
import { Badge } from "../components/native/badge";
import { Skeleton } from "../components/native/skeleton";

export function NativeComponentsPage() {
  const [dark, setDark] = useState(document.documentElement.classList.contains("dark"));
  const [message, setMessage] = useState("");
  useEffect(() => {
    const observer = new MutationObserver(() => setDark(document.documentElement.classList.contains("dark")));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);
  return <NativeThemeProvider mode={dark ? "dark" : "light"}>
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">Les mêmes composants React Native que dans l’accueil, rendus ici avec React Native Web. Les données restent dans l’application.</p>
      <Card>
        <CardHeader><CardTitle>Composants mobiles partagés</CardTitle></CardHeader>
        <CardContent>
          <Typography variant="display">À découvrir</Typography>
          <Typography>Une typographie lisible, sans information superflue.</Typography>
          <Input accessibilityLabel="Recherche de démonstration" placeholder="Salon, ville, quartier…" />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            <Button onPress={() => setMessage("Bouton principal testé.")}>Découvrir</Button>
            <Button variant="outline" onPress={() => setMessage("Bouton secondaire testé.")}>Voir sur la carte</Button>
            <Button disabled>Indisponible</Button>
          </View>
          <Badge variant="secondary">Étiquette de démonstration</Badge>
          <Typography accessibilityLiveRegion="polite">{message}</Typography>
          <Skeleton style={{ width: "75%", height: 20 }} />
          <Skeleton style={{ width: "55%", height: 14 }} />
        </CardContent>
      </Card>
    </div>
  </NativeThemeProvider>;
}
