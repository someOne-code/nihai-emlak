import test from "node:test";
import assert from "node:assert/strict";

import {
  CONTENT_REFRESH_MIN_INTERVAL_MS,
  createContentRefreshGate,
  refreshContentViews,
  shouldRefreshContentOnResume,
} from "../lib/admin-ui/content-refresh.ts";

test("content resume refresh gate throttles repeated focus/visibility events", () => {
  const gate = createContentRefreshGate(1_000);

  assert.equal(shouldRefreshContentOnResume(gate, 1_100), false);
  assert.equal(
    shouldRefreshContentOnResume(
      gate,
      1_000 + CONTENT_REFRESH_MIN_INTERVAL_MS,
    ),
    true,
  );
  assert.equal(shouldRefreshContentOnResume(gate, 1_000 + CONTENT_REFRESH_MIN_INTERVAL_MS + 1), false);
});

test("refreshContentViews runs independent refresh tasks in parallel", async () => {
  const events: string[] = [];
  let releaseFirstTask: (() => void) | null = null;

  const firstTask = async () => {
    events.push("first:start");
    await new Promise<void>((resolve) => {
      releaseFirstTask = resolve;
    });
    events.push("first:end");
  };

  const secondTask = async () => {
    events.push("second:start");
  };

  const refresh = refreshContentViews([firstTask, secondTask]);
  await Promise.resolve();

  assert.deepEqual(events, ["first:start", "second:start"]);
  releaseFirstTask?.();
  await refresh;
  assert.deepEqual(events, ["first:start", "second:start", "first:end"]);
});
