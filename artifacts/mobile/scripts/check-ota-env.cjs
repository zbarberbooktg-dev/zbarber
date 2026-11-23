const { build } = require("../eas.json");
const { expo } = require("../app.json");

const profile = process.argv[2];
if (profile !== "test" && profile !== "production") {
  console.error("Expected an OTA profile: test or production.");
  process.exit(1);
}

const { channel, env } = build[profile];
const problems = [];
if (channel !== profile) problems.push(`Expected the build channel to be ${profile}.`);
if (!expo.updates?.enabled || !expo.updates.url || expo.updates.requestHeaders) {
  problems.push("Enable updates without overriding request headers in app.json.");
}
if (typeof expo.runtimeVersion !== "string" || !expo.runtimeVersion) {
  problems.push("Set an explicit OTA runtime in app.json.");
}

for (const name of ["EXPO_PUBLIC_DOMAIN", "EXPO_PUBLIC_CLERK_PROXY_URL", "EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY"]) {
  if (!process.env[name]) {
    problems.push(`Missing ${name} in the Expo ${build[profile].environment} environment or workflow.`);
  } else if (process.env[name] !== env[name]) {
    problems.push(`${name} does not match the ${profile} build profile in eas.json.`);
  }
}

if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log(`OTA configuration verified: channel ${channel}, runtime ${expo.runtimeVersion}.`);
