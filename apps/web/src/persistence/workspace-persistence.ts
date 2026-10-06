import {
  decodeWorkspaceEnvelope,
  encodeWorkspaceEnvelope,
  type WorkspaceState,
} from "@/domain/workspace";

export const WORKSPACE_STORAGE_KEY = "denker.workspace";

export type WorkspaceLoadResult =
  | { status: "absent" }
  | { status: "valid"; workspace: WorkspaceState }
  | { status: "invalid" }
  | { status: "unavailable" };

export interface WorkspacePersistence {
  load(): Promise<WorkspaceLoadResult>;
  save(workspace: WorkspaceState): Promise<void>;
  reset(workspace: WorkspaceState): Promise<void>;
}

export interface StringStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export class MemoryWorkspacePersistence implements WorkspacePersistence {
  private rawValue: string | null;

  constructor(rawValue: string | null = null) {
    this.rawValue = rawValue;
  }

  async load(): Promise<WorkspaceLoadResult> {
    if (this.rawValue === null) return { status: "absent" };
    return decodeWorkspaceEnvelope(this.rawValue);
  }

  async save(workspace: WorkspaceState): Promise<void> {
    this.rawValue = encodeWorkspaceEnvelope(workspace);
  }

  async reset(workspace: WorkspaceState): Promise<void> {
    await this.save(workspace);
  }

  inspectRawValue(): string | null {
    return this.rawValue;
  }
}

export class BrowserWorkspacePersistence implements WorkspacePersistence {
  private readonly memory = new MemoryWorkspacePersistence();
  private storageAvailable: boolean | null = null;

  constructor(private readonly getStorage: () => StringStorage) {}

  async load(): Promise<WorkspaceLoadResult> {
    if (this.storageAvailable === false) return this.memory.load();

    try {
      const rawValue = this.getStorage().getItem(WORKSPACE_STORAGE_KEY);
      this.storageAvailable = true;
      if (rawValue === null) return { status: "absent" };
      return decodeWorkspaceEnvelope(rawValue);
    } catch {
      this.storageAvailable = false;
      return { status: "unavailable" };
    }
  }

  async save(workspace: WorkspaceState): Promise<void> {
    if (this.storageAvailable === false) {
      await this.memory.save(workspace);
      return;
    }

    try {
      this.getStorage().setItem(
        WORKSPACE_STORAGE_KEY,
        encodeWorkspaceEnvelope(workspace),
      );
      this.storageAvailable = true;
    } catch {
      this.storageAvailable = false;
      await this.memory.save(workspace);
    }
  }

  async reset(workspace: WorkspaceState): Promise<void> {
    await this.save(workspace);
  }
}

export const browserWorkspacePersistence = new BrowserWorkspacePersistence(
  () => window.localStorage,
);
