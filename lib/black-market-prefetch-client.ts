const STORAGE_KEY = "bm-shared-scan";

export type SharedScanState = {
  done: number;
  total: number | null;
  active: boolean;
  updatedAt: number;
};

function readRaw(): SharedScanState | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SharedScanState;
    if (typeof parsed.done !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function readSharedScanState(): SharedScanState | null {
  const state = readRaw();
  if (!state) return null;
  if (!state.active) return null;
  if (Date.now() - state.updatedAt > 15 * 60 * 1000) {
    clearSharedScanState();
    return null;
  }
  return state;
}

export function writeSharedScanState(patch: Partial<SharedScanState>): void {
  if (typeof sessionStorage === "undefined") return;
  const prev = readRaw();
  const next: SharedScanState = {
    done: patch.done ?? prev?.done ?? 0,
    total: patch.total ?? prev?.total ?? null,
    active: patch.active ?? prev?.active ?? false,
    updatedAt: Date.now(),
  };
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function clearSharedScanState(): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.removeItem(STORAGE_KEY);
}
