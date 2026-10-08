import type { DemoSyncResult } from "@/domain/workspace";

export interface DemoSyncScenario {
  result: DemoSyncResult;
  schedule(completion: () => void): () => void;
}

export function createDemoSyncScenario(
  result: DemoSyncResult = "synced",
  delayMs = 800,
): DemoSyncScenario {
  return {
    result,
    schedule(completion) {
      const timeout = setTimeout(completion, delayMs);
      return () => clearTimeout(timeout);
    },
  };
}

export const defaultDemoSyncScenario = createDemoSyncScenario();
