vi.mock("../engine/battle", () => ({
  simulateBattle: vi.fn(() => ({ frames: [{ mock: true }], result: "win" })),
}));

import { runBattleAsync } from "./client";
import { simulateBattle } from "../engine/battle";
import { makeUnit, makeEnemyTeam } from "../engine/test-helpers";

const dummyBoard = [makeUnit({ uid: "p1" }), null, null, null, null];
const dummyEnemy = makeEnemyTeam([makeUnit({ uid: "e1" })]);
const dummyRound = 1;
const dummyLastResult = null;

// --- Mock Worker ---

class MockWorker {
  onmessage: ((e: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  terminated = false;
  lastMessage: unknown = null;

  postMessage(data: unknown) {
    this.lastMessage = data;
  }

  terminate() {
    this.terminated = true;
  }

  // Helper: simulate worker responding
  respond(data: unknown) {
    this.onmessage?.({ data });
  }

  triggerError() {
    this.onerror?.();
  }
}

let mockWorkerInstance: MockWorker;

beforeEach(() => {
  mockWorkerInstance = new MockWorker();
  vi.stubGlobal(
    "Worker",
    class {
      onmessage: ((e: { data: unknown }) => void) | null = null;
      onerror: (() => void) | null = null;
      constructor() {
        // Proxy to our instance
        mockWorkerInstance = new MockWorker();
        const inst = mockWorkerInstance;
        // Defer so that client can set handlers first
        return new Proxy(inst, {
          set(target, prop, value) {
            return Reflect.set(target, prop, value);
          },
          get(target, prop) {
            return Reflect.get(target, prop);
          },
        });
      }
    },
  );
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

// --- Sync fallback ---

describe("runBattleAsync - sync fallback", () => {
  it("returns ok result when Worker is undefined", async () => {
    vi.stubGlobal("Worker", undefined);
    const result = await runBattleAsync(dummyBoard, dummyEnemy, dummyRound, dummyLastResult);
    expect(result.isOk()).toBe(true);
  });

  it("calls simulateBattle with correct arguments", async () => {
    vi.stubGlobal("Worker", undefined);
    await runBattleAsync(dummyBoard, dummyEnemy, dummyRound, dummyLastResult);
    expect(vi.mocked(simulateBattle)).toHaveBeenCalledWith(
      dummyBoard,
      dummyEnemy,
      dummyRound,
      dummyLastResult,
    );
  });
});

// --- Worker path ---

describe("runBattleAsync - worker path", () => {
  it("resolves with ok on successful worker response", async () => {
    const promise = runBattleAsync(dummyBoard, dummyEnemy, dummyRound, dummyLastResult);
    // Give event loop a tick for handlers to be set
    await vi.waitFor(() => expect(mockWorkerInstance.onmessage).not.toBeNull());
    mockWorkerInstance.respond({ ok: true, frames: [], result: "win" });
    const result = await promise;
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.result).toBe("win");
    }
  });

  it("resolves with err on worker error response", async () => {
    const promise = runBattleAsync(dummyBoard, dummyEnemy, dummyRound, dummyLastResult);
    await vi.waitFor(() => expect(mockWorkerInstance.onmessage).not.toBeNull());
    mockWorkerInstance.respond({ ok: false, error: "some_error" });
    const result = await promise;
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toEqual({ type: "PRECONDITION_FAILED", reason: "some_error" });
    }
  });

  it("resolves with err on worker onerror", async () => {
    const promise = runBattleAsync(dummyBoard, dummyEnemy, dummyRound, dummyLastResult);
    await vi.waitFor(() => expect(mockWorkerInstance.onerror).not.toBeNull());
    mockWorkerInstance.triggerError();
    const result = await promise;
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toEqual({ type: "PRECONDITION_FAILED", reason: "worker_error" });
    }
  });

  it("terminates worker after successful response", async () => {
    const promise = runBattleAsync(dummyBoard, dummyEnemy, dummyRound, dummyLastResult);
    await vi.waitFor(() => expect(mockWorkerInstance.onmessage).not.toBeNull());
    mockWorkerInstance.respond({ ok: true, frames: [], result: "win" });
    await promise;
    expect(mockWorkerInstance.terminated).toBe(true);
  });

  it("resolves with timeout error after 5 seconds", async () => {
    vi.useFakeTimers();
    const promise = runBattleAsync(dummyBoard, dummyEnemy, dummyRound, dummyLastResult);
    vi.advanceTimersByTime(5000);
    const result = await promise;
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toEqual({ type: "PRECONDITION_FAILED", reason: "battle_timeout" });
    }
  });

  it("terminates worker on timeout", async () => {
    vi.useFakeTimers();
    const promise = runBattleAsync(dummyBoard, dummyEnemy, dummyRound, dummyLastResult);
    vi.advanceTimersByTime(5000);
    await promise;
    expect(mockWorkerInstance.terminated).toBe(true);
  });
});
