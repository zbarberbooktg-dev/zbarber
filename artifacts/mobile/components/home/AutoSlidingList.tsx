import React, { useCallback, useEffect, useRef, useState } from "react";
import { AppState, FlatList, type FlatListProps } from "react-native";
import { useFocusEffect } from "expo-router";
import { useReducedMotion } from "@/hooks/home/useReducedMotion";

// One timing for salon discovery and inspiration. A gesture pauses the timer.
export const HOME_SLIDE_INTERVAL_MS = 4200;
export function AutoSlidingList<T>({ itemStride, ...props }: FlatListProps<T> & { itemStride: number }) {
  const list = useRef<FlatList<T>>(null);
  const index = useRef(0);
  const dragging = useRef(false);
  const resumeAfter = useRef(0);
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(AppState.currentState === "active");
  const reduced = useReducedMotion();
  const count = props.data?.length ?? 0;
  useFocusEffect(useCallback(() => {
    setFocused(true);
    return () => setFocused(false);
  }, []));
  useEffect(() => {
    const sub = AppState.addEventListener("change", state => setActive(state === "active"));
    return () => sub.remove();
  }, []);
  useEffect(() => { index.current = 0; }, [props.data]);
  useEffect(() => {
    if (!focused || !active || reduced || count < 2) return;
    const timer = setInterval(() => {
      if (dragging.current || Date.now() < resumeAfter.current) return;
      index.current = (index.current + 1) % count;
      list.current?.scrollToOffset({ offset: index.current * itemStride, animated: true });
    }, HOME_SLIDE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [focused, active, reduced, count, itemStride]);
  return <FlatList {...props} ref={list} horizontal
    onScrollBeginDrag={event => {
      dragging.current = true;
      resumeAfter.current = Date.now() + HOME_SLIDE_INTERVAL_MS * 2;
      props.onScrollBeginDrag?.(event);
    }}
    onScrollEndDrag={event => {
      dragging.current = false;
      index.current = Math.max(0, Math.round(event.nativeEvent.contentOffset.x / itemStride));
      props.onScrollEndDrag?.(event);
    }} />;
}
