import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

/** Tracks the OS "reduce motion" preference; starts true so nothing animates before we know. */
export function useReducedMotion() {
  const [reduce, setReduce] = useState(true);
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((v) => { if (mounted) setReduce(v); });
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduce);
    return () => { mounted = false; sub.remove(); };
  }, []);
  return reduce;
}
