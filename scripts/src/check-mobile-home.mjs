import { chromium } from "playwright-core";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";

const origin = `https://${process.env.REPLIT_EXPO_DEV_DOMAIN}`;
const api = `https://${process.env.REPLIT_DEV_DOMAIN}`;
const output = new URL("../../generated-artifacts/home-redesign/", import.meta.url).pathname;
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/repl/tools/bin/chromium",
  headless: true, args: ["--no-sandbox"],
});
const report = { kind: "Signed-out React Native Web preview, not a native simulator", checks: [], captures: [], errors: [], consoleErrors: [] };
const record = (check) => { report.checks.push(check); console.log("PASS", check); };
const capture = async (page, name) => {
  await page.screenshot({ path: `${output}${name}.png` });
  report.captures.push(`${name}.png`);
};
async function visitor({ width, height, scale, language = "fr", colorScheme = "dark" }) {
  const context = await browser.newContext({
    viewport: { width, height }, deviceScaleFactor: scale, isMobile: true, hasTouch: true, colorScheme,
  });
  // Set only saved UI preferences. Auth is untouched; no API is intercepted.
  // RN Web onboarding's scrollToIndex does not reliably paginate headlessly.
  await context.addInitScript(({ language }) => {
    localStorage.setItem("gbc.onboarding.v1", "1");
    localStorage.setItem("gbc.lang", language);
  }, { language });
  const page = await context.newPage();
  page.on("pageerror", error => report.errors.push(error.message));
  page.on("console", message => {
    if (message.type() === "error") report.consoleErrors.push(message.text().slice(0, 250));
  });
  return { context, page };
}
const openHome = async page => {
  await page.goto(`${origin}/browse`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.getByTestId("home-salon-search").waitFor({ timeout: 60000 });
  await page.getByTestId("new-salons-carousel").waitFor({ timeout: 30000 });
  // Controls can be mounted beneath the animated launch overlay.
  await page.waitForTimeout(6000);
};

try {
  const { context, page } = await visitor({ width: 414, height: 896, scale: 3 });
  await openHome(page);
  record("Public home renders with no authenticated session");
  assert.equal(await page.getByRole("tab").count(), 5);
  record("Five main navigation actions are available");
  assert.ok(await page.getByTestId("home-salon-search").evaluate(element => parseFloat(getComputedStyle(element).paddingLeft) >= 34));
  record("Search text stays clear of its leading icon");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  assert.equal(overflow, false);
  record("No horizontal page overflow at 414 CSS pixels");
  await capture(page, "iphone-65-dark-home");

  const video = page.locator("video");
  if (await video.count()) {
    assert.equal(await video.count(), 1);
    assert.equal(await video.evaluate(v => v.muted), true);
    record("One visible advertising video starts muted");
    const toggle = page.getByTestId("ad-toggle-sound");
    await toggle.click();
    assert.equal(await video.evaluate(v => v.muted), false);
    await toggle.click();
    assert.equal(await video.evaluate(v => v.muted), true);
    record("Icon-only speaker toggles audio");
    await page.getByTestId("ad-expand-video").click();
    await page.getByTestId("ad-expanded-video").waitFor();
    assert.equal(await video.count(), 1);
    await page.getByTestId("ad-close-expanded-video").click();
    record("Video enlarges and closes without a second video surface");
  }

  const inspiration = page.getByTestId("home-inspiration");
  const journal = page.getByTestId("home-journal");
  if (await inspiration.count()) await inspiration.scrollIntoViewIfNeeded();
  else await page.getByTestId("home-salon-catalog-preview").scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);
  assert.equal(await page.locator("video").count(), 0);
  record("Advertising video is removed when it leaves the viewport");
  await capture(page, "iphone-65-dark-lower");
  if (await journal.count()) {
    await journal.scrollIntoViewIfNeeded();
    await capture(page, "iphone-65-journal-catalog");
  }

  const response = await page.request.get(`${api}/api/barbers?status=approved&limit=1`);
  assert.equal(response.status(), 200);
  const sample = (await response.json()).data?.[0];
  if (sample) {
    const search = page.getByTestId("home-salon-search");
    await search.fill(sample.salonName);
    const results = page.getByTestId("home-search-results");
    await results.getByText(sample.salonName, { exact: true }).first().waitFor({ timeout: 20000 });
    record("Home search returns a real approved salon by its name");
    await capture(page, "iphone-65-search");
    await results.getByText(sample.salonName, { exact: true }).first().click();
    await page.waitForURL(new RegExp(`/salon/${sample.id}(?:$|\\?)`));
    record("Salon result opens its existing detail route");
  }

  await openHome(page);
  await page.getByTestId("home-nav-explore").click();
  await page.getByTestId("directory-salon-search").waitFor();
  await page.getByTestId("catalog-filters-toggle").click();
  await page.getByText("Prix d’un service (FC)", { exact: true }).waitFor();
  record("Explore opens the full catalog with the real location and price filters");
  await capture(page, "iphone-65-catalog");

  await openHome(page);
  const favorite = page.getByTestId(/discover-salon-\d+-favorite/).first();
  await favorite.click();
  await page.waitForURL(/sign-in/);
  record("Guest favorite action opens sign-in rather than silently failing");

  await openHome(page);
  await page.getByRole("button", { name: "Carte", exact: true }).click();
  await page.waitForURL(/\/map/);
  await page.getByTestId("map-locate-me").waitFor();
  record("Map shortcut opens the existing proximity map");

  const light = await visitor({ width: 414, height: 896, scale: 3, colorScheme: "light" });
  await openHome(light.page);
  await capture(light.page, "iphone-65-light-home");
  record("Light theme renders at iPhone 6.5-inch dimensions");
  await light.context.close();

  const android = await visitor({ width: 360, height: 800, scale: 3, language: "en" });
  await openHome(android.page);
  await android.page.getByText("Find your barber", { exact: true }).waitFor();
  assert.equal(await android.page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await capture(android.page, "android-1080x2400-en");
  record("English home renders without page overflow at 360 CSS pixels");
  await android.context.close();
  await context.close();
  assert.deepEqual(report.errors, [], "Unexpected JavaScript errors");
} catch (error) {
  report.failure = error.message;
  throw error;
} finally {
  await writeFile(`${output}browser-report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
}
