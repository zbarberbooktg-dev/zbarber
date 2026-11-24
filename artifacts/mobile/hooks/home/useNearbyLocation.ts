import * as Location from "expo-location";
import { useEffect, useRef, useState } from "react";
import { Alert, Linking, Platform } from "react-native";
import { coordinates, type Coordinates } from "@/lib/salonSearch";

/**
 * Nearby-salon location flow moved verbatim from the home screen: one automatic
 * read once the home is usable, explicit retry, and a Settings deep-link when
 * the OS will not ask again. The position never leaves the device here.
 */
export function useNearbyLocation(fr: boolean, autoStart: boolean) {
  const [permission, requestPermission] = Location.useForegroundPermissions();
  const [position, setPosition] = useState<Coordinates | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const prompted = useRef(false);
  const lock = useRef(false);

  const locate = async () => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const granted = permission?.granted ? permission : await requestPermission();
      if (!granted.granted) {
        setPosition(null);
        setError(fr ? "Autorisez la localisation pour afficher les salons proches." : "Allow location access to see nearby salons.");
        return;
      }
      const { coords: point } = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const next = coordinates(point.latitude, point.longitude);
      if (!next) throw new Error("Invalid device location");
      setPosition(next);
    } catch {
      setPosition(null);
      setError(fr ? "Votre position n’a pas pu être récupérée. Réessayez." : "We couldn't get your location. Try again.");
    } finally {
      setBusy(false);
      lock.current = false;
    }
  };
  const locateRef = useRef(locate);
  locateRef.current = locate;

  useEffect(() => {
    if (!autoStart || !permission || prompted.current) return;
    prompted.current = true;
    void locateRef.current();
  }, [autoStart, permission]);

  const openSettingsOrLocate = () => {
    if (permission && !permission.canAskAgain && Platform.OS !== "web") {
      Alert.alert(
        fr ? "Localisation désactivée" : "Location is disabled",
        fr ? "Autorisez la localisation dans les réglages pour voir les salons proches." : "Allow location in Settings to see nearby salons.",
        [
          { text: fr ? "Annuler" : "Cancel", style: "cancel" },
          { text: fr ? "Réglages" : "Settings", onPress: () => { void Linking.openSettings(); } },
        ],
      );
      return;
    }
    void locate();
  };
  return { permission, position, updatePosition: setPosition, busy, error, openSettingsOrLocate };
}
export type NearbyLocation = ReturnType<typeof useNearbyLocation>;
