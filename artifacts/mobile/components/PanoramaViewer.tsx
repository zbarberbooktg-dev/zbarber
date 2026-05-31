import { Feather } from "@expo/vector-icons";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Modal, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { WebView } from "react-native-webview";

import { resolveObjectUrl } from "@/lib/imageUpload";

export type PanoramaScene = { id: number; title: string; imageUrl: string };

const GOLD = "#D4AF37";

// Builds a self-contained HTML document that renders an equirectangular 360°
// viewer with Pannellum (loaded from CDN). All scenes are registered up front so
// switching rooms is instant via `viewer.loadScene(id)`.
function buildHtml(scenes: { id: string; title: string; url: string }[], firstId: string): string {
  const sceneConfig: Record<string, unknown> = {};
  for (const s of scenes) {
    sceneConfig[s.id] = { type: "equirectangular", panorama: s.url, title: s.title, autoLoad: true };
  }
  const config = {
    default: { firstScene: firstId, sceneFadeDuration: 600, autoLoad: true, showControls: false },
    scenes: sceneConfig,
  };
  // Escape `<` so untrusted scene titles/urls cannot break out of the inline
  // <script> tag (e.g. a "</script>" payload). JSON.stringify alone does not.
  const configJson = JSON.stringify(config).replace(/</g, "\\u003c");
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.css" />
  <script src="https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.js"></script>
  <style>
    html, body { margin: 0; padding: 0; height: 100%; background: #000; overflow: hidden; }
    #pano { width: 100vw; height: 100vh; }
  </style>
</head>
<body>
  <div id="pano"></div>
  <script>
    var viewer = pannellum.viewer('pano', ${configJson});
    function loadScene(id) { try { viewer.loadScene(String(id)); } catch (e) {} }
    window.loadScene = loadScene;
    // Allow the host (RN WebView injectJS or web iframe postMessage) to switch scenes.
    window.addEventListener('message', function (e) {
      var id = e && e.data && e.data.loadScene;
      if (id != null) loadScene(id);
    });
  </script>
</body>
</html>`;
}

export function PanoramaViewer({
  scenes,
  visible,
  onClose,
}: {
  scenes: PanoramaScene[];
  visible: boolean;
  onClose: () => void;
}) {
  const webRef = useRef<WebView>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [activeId, setActiveId] = useState<number | null>(scenes[0]?.id ?? null);

  // Reset to the first scene each time the viewer opens so chip state matches the panorama.
  useEffect(() => {
    if (visible) setActiveId(scenes[0]?.id ?? null);
  }, [visible, scenes]);

  const resolved = useMemo(
    () =>
      scenes
        .map((s) => ({ id: String(s.id), title: s.title, url: resolveObjectUrl(s.imageUrl) }))
        .filter((s): s is { id: string; title: string; url: string } => !!s.url),
    [scenes],
  );

  // Pannellum textures the panorama into a WebGL canvas with crossOrigin
  // "anonymous"; the WebView baseUrl must share the image origin so the texture
  // is not CORS-tainted. Both the WebView and the images live on EXPO_PUBLIC_DOMAIN.
  const origin = useMemo(() => {
    const first = resolved[0]?.url;
    if (!first) return undefined;
    try {
      return new URL(first).origin;
    } catch {
      return undefined;
    }
  }, [resolved]);

  const html = useMemo(
    () => (resolved.length > 0 ? buildHtml(resolved, resolved[0].id) : ""),
    [resolved],
  );

  const switchScene = (id: number) => {
    setActiveId(id);
    if (Platform.OS === "web") {
      iframeRef.current?.contentWindow?.postMessage({ loadScene: String(id) }, "*");
    } else {
      // id is a DB integer, safe to interpolate.
      webRef.current?.injectJavaScript(`window.loadScene && window.loadScene('${id}'); true;`);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: "#000" }}>
        {resolved.length > 0 && (
          Platform.OS === "web" ? (
            // @ts-ignore react-native-web renders div for View; raw iframe for WebGL
            <iframe
              ref={iframeRef}
              srcDoc={html}
              sandbox="allow-scripts allow-same-origin"
              style={{ border: 0, width: "100%", height: "100%", flex: 1 }}
              title="360"
            />
          ) : (
            <WebView
              ref={webRef}
              originWhitelist={["*"]}
              source={{ html, baseUrl: origin }}
              allowsInlineMediaPlayback
              javaScriptEnabled
              domStorageEnabled
              style={{ flex: 1, backgroundColor: "#000" }}
            />
          )
        )}

        {/* Close button */}
        <Pressable
          onPress={onClose}
          hitSlop={12}
          style={{
            position: "absolute", top: 48, right: 16,
            width: 40, height: 40, borderRadius: 20,
            backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center",
          }}
        >
          <Feather name="x" size={22} color="#fff" />
        </Pressable>

        {/* Scene navigation */}
        {scenes.length > 1 && (
          <View style={{ position: "absolute", bottom: 32, left: 0, right: 0 }}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}
            >
              {scenes.map((s) => {
                const active = s.id === activeId;
                return (
                  <Pressable
                    key={s.id}
                    onPress={() => switchScene(s.id)}
                    style={{
                      paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999,
                      backgroundColor: active ? GOLD : "rgba(0,0,0,0.6)",
                      borderWidth: 1, borderColor: active ? GOLD : "rgba(255,255,255,0.25)",
                    }}
                  >
                    <Text style={{ color: active ? "#000" : "#fff", fontFamily: "Inter_600SemiBold", fontSize: 13 }}>
                      {s.title}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        )}
      </View>
    </Modal>
  );
}
