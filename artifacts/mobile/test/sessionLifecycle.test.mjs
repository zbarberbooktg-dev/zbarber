import assert from "node:assert/strict";
import { test } from "vitest";
import { SessionGeneration, SignOutRunner, withDeadline, authErrorMessage, isSessionConflictError } from "../lib/sessionLifecycle.ts";

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

test("logout waits for the actual SDK result before clearing private data", async () => {
  const sdk = deferred();
  const events = [];
  let active = true;
  const runner = new SignOutRunner();
  const flight = runner.run({
    beforeRevoke: async () => { events.push("push"); },
    revoke: async () => { events.push("sdk"); await sdk.promise; active = false; },
    isStillSignedIn: () => active,
    afterRevoke: () => { events.push("clear"); },
  });
  await new Promise((r) => setImmediate(r));
  assert.deepEqual(events, ["push", "sdk"]);
  assert.equal(runner.running, true);
  sdk.resolve();
  await flight;
  assert.deepEqual(events, ["push", "sdk", "clear"]);
  assert.equal(runner.running, false);
});

test("failed SDK logout preserves the profile, selection and cache", async () => {
  const privateState = { user: "A", selection: 42, cache: ["A private reservation"] };
  await assert.rejects(new SignOutRunner().run({
    beforeRevoke: async () => {},
    revoke: async () => { throw new Error("Network unavailable"); },
    isStillSignedIn: () => true,
    afterRevoke: () => { Object.keys(privateState).forEach((k) => delete privateState[k]); },
  }));
  assert.deepEqual(privateState, { user: "A", selection: 42, cache: ["A private reservation"] });
});

test("double taps share one logout operation", async () => {
  const sdk = deferred();
  const runner = new SignOutRunner();
  let calls = 0;
  let active = true;
  const actions = {
    beforeRevoke: async () => {},
    revoke: async () => { calls++; await sdk.promise; active = false; },
    isStillSignedIn: () => active,
    afterRevoke: () => {},
  };
  const a = runner.run(actions);
  const b = runner.run(actions);
  assert.equal(a, b);
  sdk.resolve();
  await Promise.all([a, b]);
  assert.equal(calls, 1);
});

test("a push cleanup failure cannot prevent logout", async () => {
  let active = true, cleared = false;
  await new SignOutRunner().run({
    beforeRevoke: async () => { throw new Error("Notifications offline"); },
    revoke: async () => { active = false; },
    isStillSignedIn: () => active,
    afterRevoke: () => { cleared = true; },
  });
  assert.equal(cleared, true);
});

test("a hung push cleanup is aborted and cannot hold logout indefinitely", async () => {
  let signal, active = true;
  await new SignOutRunner().run({
    beforeRevoke: (s) => { signal = s; return new Promise(() => {}); },
    secondaryTimeoutMs: 10,
    revoke: async () => { active = false; },
    isStillSignedIn: () => active,
    afterRevoke: () => {},
  });
  assert.equal(signal.aborted, true);
  assert.equal(active, false);
});

test("an SDK timeout reports failure and does not claim local logout succeeded", async () => {
  let cleared = false;
  const runner = new SignOutRunner();
  await assert.rejects(runner.run({
    beforeRevoke: async () => {},
    revoke: () => new Promise(() => {}),
    revokeTimeoutMs: 10,
    isStillSignedIn: () => true,
    afterRevoke: () => { cleared = true; },
  }), /déconnexion/);
  assert.equal(cleared, false);
  assert.equal(runner.running, false);
});

test("an already-ended session is cleaned even if the SDK lost its response", async () => {
  let cleared = false;
  await new SignOutRunner().run({
    beforeRevoke: async () => {},
    revoke: async () => { throw new Error("Response lost"); },
    isStillSignedIn: () => false,
    afterRevoke: () => { cleared = true; },
  });
  assert.equal(cleared, true);
});

test("a resolved SDK call cannot falsely sign out a still-active session", async () => {
  let cleared = false;
  await assert.rejects(new SignOutRunner().run({
    beforeRevoke: async () => {},
    revoke: async () => {},
    isStillSignedIn: () => true,
    afterRevoke: () => { cleared = true; },
  }));
  assert.equal(cleared, false);
});

test("a failed logout can be retried successfully", async () => {
  const runner = new SignOutRunner();
  let active = true, cleared = 0;
  const actions = {
    beforeRevoke: async () => {},
    revoke: async () => { throw new Error("Offline"); },
    isStillSignedIn: () => active,
    afterRevoke: () => { cleared++; },
  };
  await assert.rejects(runner.run(actions));
  await runner.run({ ...actions, revoke: async () => { active = false; } });
  assert.equal(cleared, 1);
});

test("late profile sync after logout cannot restore the old account", async () => {
  const generation = new SessionGeneration();
  const response = deferred();
  const ticket = generation.capture();
  let user = "A";
  const sync = response.promise.then((value) => { if (generation.isCurrent(ticket)) user = value; });
  generation.invalidate();
  user = null;
  response.resolve("A stale private profile");
  await sync;
  assert.equal(user, null);
});

test("switching A to B rejects A's late profile response", async () => {
  const generation = new SessionGeneration();
  const a = generation.capture();
  generation.invalidate();
  const b = generation.capture();
  assert.equal(generation.isCurrent(a), false);
  assert.equal(generation.isCurrent(b), true);
  const cache = new Map([["bookings", ["A booking"]]]);
  cache.clear();
  if (generation.isCurrent(a)) cache.set("bookings", ["A late booking"]);
  assert.equal(cache.size, 0);
});

test("deadline aborts profile fetches and does not apply their late result", async () => {
  const late = deferred();
  let signal, applied = false;
  await assert.rejects(withDeadline((s) => { signal = s; return late.promise; }, 10, "Profil indisponible").then(() => { applied = true; }), /Profil/);
  assert.equal(signal.aborted, true);
  late.resolve({ user: "old" });
  await new Promise((r) => setImmediate(r));
  assert.equal(applied, false);
});

test("a normal profile request resolves without a false timeout", async () => {
  assert.deepEqual(await withDeadline(async () => ({ user: "B" }), 100, "late"), { user: "B" });
});

test("Clerk session conflicts are recognized by code and older error wording", () => {
  assert.equal(isSessionConflictError({ errors: [{ code: "session_exists" }] }), true);
  assert.equal(isSessionConflictError({ message: "You're already signed in." }), true);
  assert.equal(isSessionConflictError({ code: "form_password_incorrect" }), false);
  assert.match(authErrorMessage({ code: "session_exists" }, "fallback"), /session.*ouverte/);
});

test("password, verification and network errors are understandable in French", () => {
  assert.match(authErrorMessage({ code: "form_password_incorrect" }, "fallback"), /incorrect/);
  assert.match(authErrorMessage({ code: "form_code_incorrect" }, "fallback"), /Code invalide/);
  assert.match(authErrorMessage(new Error("Failed to fetch"), "fallback"), /connexion/);
  assert.equal(authErrorMessage({ message: "Unknown private SDK diagnostic" }, "Erreur de connexion."), "Erreur de connexion.");
});
