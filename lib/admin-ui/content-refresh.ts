export const CONTENT_REFRESH_MIN_INTERVAL_MS = 1_000;

export type ContentRefreshGate = {
  lastRefreshAt: number;
  minIntervalMs: number;
};

export function createContentRefreshGate(
  now = Date.now(),
  minIntervalMs = CONTENT_REFRESH_MIN_INTERVAL_MS,
): ContentRefreshGate {
  return { lastRefreshAt: now, minIntervalMs };
}

export function shouldRefreshContentOnResume(
  gate: ContentRefreshGate,
  now = Date.now(),
): boolean {
  if (now - gate.lastRefreshAt < gate.minIntervalMs) {
    return false;
  }

  gate.lastRefreshAt = now;
  return true;
}

export async function refreshContentViews(
  tasks: Array<() => Promise<unknown>>,
): Promise<void> {
  await Promise.all(tasks.map((task) => task()));
}
