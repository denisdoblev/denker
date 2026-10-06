import {
  addUserMessage,
  createChat,
  createEmptyWorkspace,
  createProject,
  decodeWorkspaceEnvelope,
  encodeWorkspaceEnvelope,
  resolveActiveSelection,
  saveRepositoryConfiguration,
  type WorkspaceState,
} from "./workspace";

const workspaceWithChats = (): WorkspaceState => ({
  projects: [
    {
      id: "project-1",
      name: "First project",
      productContext: { markdown: "# Context" },
      repository: null,
      prds: [
        {
          id: "prd-1",
          title: "PRD 001",
          lifecycle: "draft",
          document: { markdown: "# PRD" },
          chats: [
            {
              id: "chat-1",
              title: "Discovery",
              messages: [],
              scenarioId: null,
              scenarioStep: 0,
            },
          ],
          snapshots: [],
          findings: [],
          proposals: [],
        },
      ],
    },
  ],
  activeSelection: {
    projectId: "project-1",
    prdId: "prd-1",
    chatId: "chat-1",
  },
  syncState: "unsynced",
});

describe("workspace ownership transitions", () => {
  it("creates the owned initial branch and explicit TBD documents", () => {
    const workspace = createProject(createEmptyWorkspace(), " Atlas ");
    const project = workspace.projects[0];
    const prd = project.prds[0];
    const chat = prd.chats[0];

    expect(project.name).toBe("Atlas");
    expect(project.productContext.markdown).toContain("TBD");
    expect(prd).toMatchObject({ title: "PRD 001", lifecycle: "draft" });
    expect(prd.document.markdown).toContain("TBD");
    expect(chat.messages).toEqual([]);
    expect(workspace.activeSelection).toEqual({
      projectId: project.id,
      prdId: prd.id,
      chatId: chat.id,
    });
  });

  it("keeps Chat creation and messages inside their owning PRD", () => {
    let workspace = createProject(createEmptyWorkspace(), "Atlas");
    const firstSelection = workspace.activeSelection!;
    workspace = addUserMessage(workspace, firstSelection, "Primera historia");
    workspace = createChat(workspace, firstSelection.projectId, firstSelection.prdId);
    const secondSelection = workspace.activeSelection!;
    workspace = addUserMessage(workspace, secondSelection, "Segunda historia");
    const chats = workspace.projects[0].prds[0].chats;

    expect(chats[0].messages.map(({ content }) => content)).toEqual(["Primera historia"]);
    expect(chats[1].messages.map(({ content }) => content)).toEqual(["Segunda historia"]);
  });

  it("materializes repository defaults when optional values are omitted", () => {
    let workspace = createProject(createEmptyWorkspace(), "Atlas");
    workspace = saveRepositoryConfiguration(workspace, workspace.projects[0].id, {
      provider: "GitHub",
      ownerOrOrganization: "denker",
      repository: "producto",
    });

    expect(workspace.projects[0].repository).toEqual({
      provider: "GitHub",
      ownerOrOrganization: "denker",
      repository: "producto",
      branch: "main",
      documentationPath: "/docs",
    });
  });
});

describe("workspace envelope", () => {
  it("round trips a valid v1 workspace", () => {
    const workspace = workspaceWithChats();

    expect(decodeWorkspaceEnvelope(encodeWorkspaceEnvelope(workspace))).toEqual({
      status: "valid",
      workspace,
    });
  });

  it.each([
    "not-json",
    JSON.stringify({ version: 2, workspace: createEmptyWorkspace() }),
    JSON.stringify({ version: 1, workspace: { projects: "unknown" } }),
  ])("rejects invalid or unknown payload %s", (raw) => {
    expect(decodeWorkspaceEnvelope(raw)).toEqual({ status: "invalid" });
  });

  it("resolves a stale selection to the first existing chat", () => {
    const workspace = workspaceWithChats();
    workspace.activeSelection = {
      projectId: "missing",
      prdId: "missing",
      chatId: "missing",
    };

    expect(resolveActiveSelection(workspace).activeSelection).toEqual({
      projectId: "project-1",
      prdId: "prd-1",
      chatId: "chat-1",
    });
  });

  it("clears the selection when no chat exists", () => {
    const workspace = workspaceWithChats();
    workspace.projects[0].prds[0].chats = [];

    expect(resolveActiveSelection(workspace).activeSelection).toBeNull();
  });
});
