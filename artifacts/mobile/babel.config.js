// const path = require("path");

// function expoRouterEnvInlinePlugin({ types: t }) {
//   const getBundler = (caller) => {
//     if (!caller) return null;
//     if (caller.bundler) return caller.bundler;
//     if (caller.name === "babel-loader" || caller.name === "next-babel-turbo-loader")
//       return "webpack";
//     return "metro";
//   };
//   const getPlatform = (caller) => {
//     if (!caller) return null;
//     if (caller.platform) return caller.platform;
//     if (getBundler(caller) === "webpack") return "web";
//     return caller.platform;
//   };

//   return {
//     name: "expo-router-env-inline",
//     pre() {
//       const opts = (this.file && this.file.opts) || {};
//       const caller = opts.caller || {};

//       const possibleProjectRoot =
//         caller.projectRoot != null ? caller.projectRoot : process.env.EXPO_PROJECT_ROOT;
//       this._erProjectRoot = possibleProjectRoot || opts.root || "";

//       const routerRootId = caller.routerRoot != null ? caller.routerRoot : "./app";
//       this._erAbsAppRoot = path.isAbsolute(routerRootId)
//         ? routerRootId
//         : path.join(possibleProjectRoot || "/", routerRootId);

//       const platform = getPlatform(caller);
//       const isProd =
//         caller.isDev != null
//           ? caller.isDev === false
//           : process.env.BABEL_ENV === "production" ||
//             process.env.NODE_ENV === "production";
//       const isServer = caller.isServer != null ? caller.isServer : false;
//       const asyncRoutes = isServer
//         ? false
//         : platform !== "web" && isProd
//           ? false
//           : caller.asyncRoutes != null
//             ? caller.asyncRoutes
//             : false;
//       this._erImportMode = asyncRoutes ? "lazy" : "sync";

//       this._erIsTest = process.env.NODE_ENV === "test";
//     },
//     visitor: {
//       MemberExpression(nodePath, state) {
//         const object = nodePath.node.object;
//         if (!t.isMemberExpression(object)) return;
//         if (!t.isIdentifier(object.object) || object.object.name !== "process") return;
//         if (!t.isIdentifier(object.property) || object.property.name !== "env") return;
//         if (t.isAssignmentExpression(nodePath.parent) && nodePath.parent.left === nodePath.node)
//           return;

//         const key = nodePath.toComputedKey();
//         if (!t.isStringLiteral(key)) return;

//         switch (key.value) {
//           case "EXPO_PROJECT_ROOT":
//             nodePath.replaceWith(t.stringLiteral(state._erProjectRoot));
//             return;
//           case "EXPO_ROUTER_IMPORT_MODE":
//             nodePath.replaceWith(t.stringLiteral(state._erImportMode));
//             return;
//           default:
//             break;
//         }

//         if (state._erIsTest) return;

//         switch (key.value) {
//           case "EXPO_ROUTER_ABS_APP_ROOT":
//             nodePath.replaceWith(t.stringLiteral(state._erAbsAppRoot));
//             return;
//           case "EXPO_ROUTER_APP_ROOT": {
//             const filename =
//               state.filename || (state.file && state.file.opts.filename);
//             if (!filename) return;
//             nodePath.replaceWith(
//               t.stringLiteral(
//                 path.relative(path.dirname(filename), state._erAbsAppRoot),
//               ),
//             );
//             return;
//           }
//           default:
//             break;
//         }
//       },
//     },
//   };
// }

// module.exports = function (api) {
//   api.cache(true);
//   return {
//     presets: [["babel-preset-expo", { unstable_transformImportMeta: true }]],
//     plugins: [expoRouterEnvInlinePlugin],
//   };
// };


const path = require("path");

// --- expo-router env inlining (node-linker–agnostic) ------------------------
// babel-preset-expo only registers the plugin that inlines the EXPO_ROUTER_*
// env vars inside `expo-router/_ctx.*.js` when its internal
// `hasModule("expo-router")` (a `require.resolve`) succeeds. Under pnpm's
// `node-linker=hoisted` layout — which we rely on for native Android builds on
// Windows — `babel-preset-expo` and `expo-router` can resolve to different
// node_modules trees, so that check fails and the plugin is silently skipped.
// Metro then transforms `require.context(process.env.EXPO_ROUTER_APP_ROOT, ...)`
// with a non-string first argument and the bundle fails with:
//   "First argument of `require.context` should be a string"
//
// This is a faithful, self-contained re-implementation of that inlining (it
// mirrors babel-preset-expo's expo-router-plugin + common.js helpers). It has no
// module-resolution dependency, so it works on every node-linker layout. It
// reads its inputs from Babel's `caller` per file (so it is cache-safe), runs
// before the preset (plugins run before presets), and is idempotent: on layouts
// where the preset's own plugin still runs, it simply finds nothing left to
// replace.
function expoRouterEnvInlinePlugin({ types: t }) {
  // Mirror of common.js getBundler.
  const getBundler = (caller) => {
    if (!caller) return null;
    if (caller.bundler) return caller.bundler;
    if (caller.name === "babel-loader" || caller.name === "next-babel-turbo-loader")
      return "webpack";
    return "metro";
  };
  // Mirror of common.js getPlatform (infers `web` for webpack when omitted).
  const getPlatform = (caller) => {
    if (!caller) return null;
    if (caller.platform) return caller.platform;
    if (getBundler(caller) === "webpack") return "web";
    return caller.platform;
  };

  return {
    name: "expo-router-env-inline",
    pre() {
      const opts = (this.file && this.file.opts) || {};
      const caller = opts.caller || {};

      // common.js getPossibleProjectRoot: caller.projectRoot ?? EXPO_PROJECT_ROOT.
      const possibleProjectRoot =
        caller.projectRoot != null ? caller.projectRoot : process.env.EXPO_PROJECT_ROOT;

      // EXPO_PROJECT_ROOT inlines the state project root, which additionally
      // falls back to `file.opts.root` (matches the upstream plugin's `pre`).
      this._erProjectRoot = possibleProjectRoot || opts.root || "";

      // common.js getExpoRouterAbsoluteAppRoot uses `possibleProjectRoot || "/"`
      // (NOT the file.opts.root fallback above).
      const routerRootId = caller.routerRoot != null ? caller.routerRoot : "./app";
      this._erAbsAppRoot = path.isAbsolute(routerRootId)
        ? routerRootId
        : path.join(possibleProjectRoot || "/", routerRootId);

      // common.js getAsyncRoutes -> import mode.
      const platform = getPlatform(caller);
      const isProd =
        caller.isDev != null
          ? caller.isDev === false
          : process.env.BABEL_ENV === "production" ||
            process.env.NODE_ENV === "production";
      const isServer = caller.isServer != null ? caller.isServer : false;
      const asyncRoutes = isServer
        ? false
        : platform !== "web" && isProd
          ? false
          : caller.asyncRoutes != null
            ? caller.asyncRoutes
            : false;
      this._erImportMode = asyncRoutes ? "lazy" : "sync";

      this._erIsTest = process.env.NODE_ENV === "test";
    },
    visitor: {
      MemberExpression(nodePath, state) {
        const object = nodePath.node.object;
        if (!t.isMemberExpression(object)) return;
        if (!t.isIdentifier(object.object) || object.object.name !== "process") return;
        if (!t.isIdentifier(object.property) || object.property.name !== "env") return;
        // Don't rewrite assignment targets (e.g. `process.env.X = ...`).
        if (t.isAssignmentExpression(nodePath.parent) && nodePath.parent.left === nodePath.node)
          return;

        const key = nodePath.toComputedKey();
        if (!t.isStringLiteral(key)) return;

        switch (key.value) {
          case "EXPO_PROJECT_ROOT":
            nodePath.replaceWith(t.stringLiteral(state._erProjectRoot));
            return;
          case "EXPO_ROUTER_IMPORT_MODE":
            nodePath.replaceWith(t.stringLiteral(state._erImportMode));
            return;
          default:
            break;
        }

        // App-root transforms are handled by testing utilities under test.
        if (state._erIsTest) return;

        switch (key.value) {
          case "EXPO_ROUTER_ABS_APP_ROOT":
            nodePath.replaceWith(t.stringLiteral(state._erAbsAppRoot));
            return;
          case "EXPO_ROUTER_APP_ROOT": {
            const filename =
              state.filename || (state.file && state.file.opts.filename);
            if (!filename) return;
            nodePath.replaceWith(
              t.stringLiteral(
                path.relative(path.dirname(filename), state._erAbsAppRoot),
              ),
            );
            return;
          }
          default:
            break;
        }
      },
    },
  };
}

module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      [
        "babel-preset-expo",
        // Disable the preset's auto-add of the worklets/reanimated plugin. The
        // preset only adds `react-native-worklets/plugin` when its internal
        // `hasModule("react-native-worklets")` (a `require.resolve` from deep
        // inside babel-preset-expo's own .pnpm dir) succeeds. Under pnpm's
        // `node-linker=hoisted` layout (used for native Android builds on
        // Windows) that resolve fails, so the plugin is silently skipped and the
        // app crashes at runtime with "[Worklets] Failed to create a worklet".
        // We add the plugin explicitly below instead — resolved from this
        // config's location, which works on every node-linker layout — so we
        // turn off the preset's copy to avoid a duplicate on isolated linkers.
        { unstable_transformImportMeta: true, worklets: false, reanimated: false },
      ],
    ],
    // `react-native-worklets/plugin` must be the LAST plugin.
    plugins: [expoRouterEnvInlinePlugin, "react-native-worklets/plugin"],
  };
};