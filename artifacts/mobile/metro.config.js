const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Force singleton resolution for React-context-bearing packages.
//
// Under pnpm's `node-linker=hoisted` layout (which we rely on for native Android
// builds on Windows), a request for e.g. `@clerk/shared` or `react` that
// originates *inside* another package's node_modules (such as `@clerk/expo`) can
// resolve to a different physical copy than the one app code sees. Clerk's React
// contexts (`ClerkInstanceContext`, etc.) live in `@clerk/shared/react`, so two
// copies = two distinct context objects, and the provider set up by
// `@clerk/expo`'s `<ClerkProvider/>` is invisible to `useAuth`, throwing at
// runtime: "@clerk/react: useAuth can only be used within the <ClerkProvider/>".
//
// Re-rooting every request for these packages at the app directory makes them all
// resolve to one instance under the hoisted layout. Under the isolated linker
// (Replit/EAS), transitive singletons like `@clerk/react` live under `.pnpm` and
// are NOT present in `<app>/node_modules` or the workspace root, so the re-rooted
// resolve throws. There is already a single physical copy under the isolated
// layout, so in that case we fall back to default resolution (see below).

const SINGLETONS = [
  "react",
  "react-dom",
  "@clerk/react",
  "@clerk/shared",
  "@clerk/clerk-js",
];

// Metro only uses the *directory* of originModulePath; the file itself need not
// exist. Pointing it at the app root forces resolution to start from
// `<app>/node_modules` and walk up.
const ROOTED_ORIGIN = path.join(__dirname, "metro-singleton-origin.js");

const defaultResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolver = defaultResolveRequest || context.resolveRequest;
  if (typeof resolver !== "function") {
    throw new Error(
      "metro.config.js: no Metro resolver available (context.resolveRequest missing). " +
        "Metro's resolver API may have changed; update this override.",
    );
  }

  const isSingleton = SINGLETONS.some(
    (name) => moduleName === name || moduleName.startsWith(name + "/"),
  );

  if (isSingleton) {
    // Hoisted layout (Windows native builds): re-rooting at the app dir collapses
    // duplicate physical copies into one, keeping Clerk's React contexts singletons.
    // Isolated layout (Replit/EAS): transitive singletons (e.g. `@clerk/react`) are
    // not reachable from the app dir, so the re-rooted resolve throws -- fall back to
    // default resolution from the real origin, which already yields a single copy.
    try {
      return resolver(
        { ...context, originModulePath: ROOTED_ORIGIN },
        moduleName,
        platform,
      );
    } catch {
      return resolver(context, moduleName, platform);
    }
  }

  return resolver(context, moduleName, platform);
};

module.exports = config;