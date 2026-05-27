import AsyncStorage from "@react-native-async-storage/async-storage";
import { frFR, enUS } from "@clerk/localizations";
import { useEffect, useState } from "react";
import { DeviceEventEmitter } from "react-native";

const LANG_KEY = "gbc.lang";
export const LANG_CHANGE_EVENT = "gbc:lang-change";

type Lang = "fr" | "en";
const map = { fr: frFR, en: enUS } as const;

export function useClerkLocalization() {
  const [lang, setLang] = useState<Lang>("fr");

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(LANG_KEY).then((v) => {
      if (mounted && (v === "fr" || v === "en")) setLang(v);
    });
    const sub = DeviceEventEmitter.addListener(LANG_CHANGE_EVENT, (v: Lang) => {
      setLang(v);
    });
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  return map[lang];
}
