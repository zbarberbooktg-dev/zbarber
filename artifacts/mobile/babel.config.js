const path = require("path");

// Expo Router resolves its routes via `require.context(process.env.EXPO_ROUTER_APP_ROOT)`,
// which Babel inlines at transform time inside Metro's worker processes. The Expo CLI
// auto-detects this on Linux, but in a pnpm monorepo on Windows the value does not reliably
// reach the worker. Setting it here (loaded by each worker) guarantees it is defined where
// the substitution happens. `__dirname/app` is correct on every OS, so this is a no-op on
// platforms where the CLI already set it.
process.env.EXPO_ROUTER_APP_ROOT =
  process.env.EXPO_ROUTER_APP_ROOT || path.resolve(__dirname, "app");

module.exports = function (api) {
  api.cache(true);
  return {
    presets: [["babel-preset-expo", { unstable_transformImportMeta: true }]],
  };
};
