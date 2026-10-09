import { createEmptyWorkspace } from "@/domain/workspace";

import {
  BrowserWorkspacePersistence,
  MemoryWorkspacePersistence,
  WORKSPACE_STORAGE_KEY,
} from "./workspace-persistence";

describe("workspace persistence", () => {
  it("loads absent data and saves valid v2 data", async () => {
    const persistence = new MemoryWorkspacePersistence();
    const workspace = createEmptyWorkspace();

    await expect(persistence.load()).resolves.toEqual({ status: "absent" });
    await persistence.save(workspace);
    await expect(persistence.load()).resolves.toEqual({
      status: "valid",
      workspace,
    });
  });

  it("reports invalid data without changing its bytes", async () => {
    const persistence = new MemoryWorkspacePersistence("invalid bytes");

    await expect(persistence.load()).resolves.toEqual({ status: "invalid" });
    expect(persistence.inspectRawValue()).toBe("invalid bytes");
  });

  it("reports a v1 payload invalid without writing until reset", async () => {
    const v1 = JSON.stringify({ version: 1, workspace: createEmptyWorkspace() });
    const persistence = new MemoryWorkspacePersistence(v1);

    await expect(persistence.load()).resolves.toEqual({ status: "invalid" });
    expect(persistence.inspectRawValue()).toBe(v1);

    await persistence.reset(createEmptyWorkspace());
    expect(persistence.inspectRawValue()).toContain('"version":2');
  });

  it("falls back to memory when browser storage throws", async () => {
    const storage = {
      getItem: jest.fn(() => {
        throw new Error("blocked");
      }),
      setItem: jest.fn(),
    };
    const persistence = new BrowserWorkspacePersistence(() => storage);
    const workspace = { ...createEmptyWorkspace(), syncState: "failed" as const };

    await expect(persistence.load()).resolves.toEqual({
      status: "unavailable",
    });
    await persistence.save(workspace);
    await expect(persistence.load()).resolves.toEqual({
      status: "valid",
      workspace,
    });
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it("uses one dedicated browser key", async () => {
    const storage = {
      getItem: jest.fn(() => null),
      setItem: jest.fn(),
    };
    const persistence = new BrowserWorkspacePersistence(() => storage);

    await persistence.load();
    await persistence.save(createEmptyWorkspace());

    expect(storage.getItem).toHaveBeenCalledWith(WORKSPACE_STORAGE_KEY);
    expect(storage.setItem).toHaveBeenCalledWith(
      WORKSPACE_STORAGE_KEY,
      expect.stringContaining('"version":2'),
    );
  });
});
