import {
  addUserMessage,
  applyPrdFixtureMarkdown,
  beginDemoSync,
  completeDemoSync,
  continueFinalPrd,
  createChat,
  createEmptyWorkspace,
  createProject,
  decodeWorkspaceEnvelope,
  encodeWorkspaceEnvelope,
  finalizePrd,
  resolveActiveSelection,
  resolveSensitiveProposal,
  returnPrdToDraft,
  savePrdMarkdown,
  saveProductContextMarkdown,
  saveRepositoryConfiguration,
  startPrdReview,
  type WorkspaceState,
  type ProposalCategory,
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

  it("saves editable Markdown without mutating final PRDs", () => {
    const workspace = workspaceWithChats();
    const savedPrd = savePrdMarkdown(workspace, "project-1", "prd-1", "# Nuevo PRD");
    const savedContext = saveProductContextMarkdown(savedPrd, "project-1", "# Nuevo contexto");

    expect(savedContext.projects[0].prds[0].document.markdown).toBe("# Nuevo PRD");
    expect(savedContext.projects[0].productContext.markdown).toBe("# Nuevo contexto");
    expect(workspace.projects[0].prds[0].document.markdown).toBe("# PRD");

    const finalWorkspace = {
      ...workspace,
      projects: workspace.projects.map((project) => ({
        ...project,
        prds: project.prds.map((prd) => ({ ...prd, lifecycle: "final" as const })),
      })),
    };
    expect(savePrdMarkdown(finalWorkspace, "project-1", "prd-1", "alterado"))
      .toBe(finalWorkspace);
  });

  it("enforces lifecycle transitions and warning acceptance before finalization", () => {
    const workspace = workspaceWithChats();
    workspace.projects[0].prds[0].findings = [{
      id: "warning-1",
      kind: "warning",
      description: "Queda una advertencia",
      resolved: false,
    }];

    const review = startPrdReview(workspace, "project-1", "prd-1");
    expect(review.projects[0].prds[0].lifecycle).toBe("review");
    expect(finalizePrd(review, "project-1", "prd-1", false)).toBe(review);

    const final = finalizePrd(review, "project-1", "prd-1", true);
    expect(final.projects[0].prds[0]).toMatchObject({
      lifecycle: "final",
      snapshots: [{ version: 1, markdown: "# PRD" }],
    });
    expect(finalizePrd(final, "project-1", "prd-1", true)).toBe(final);
    expect(returnPrdToDraft(review, "project-1", "prd-1").projects[0].prds[0].lifecycle)
      .toBe("draft");
  });

  it("continues a final PRD only through an explicit owned choice", () => {
    const workspace = workspaceWithChats();
    const review = startPrdReview(workspace, "project-1", "prd-1");
    const final = finalizePrd(review, "project-1", "prd-1", false);
    const snapshot = final.projects[0].prds[0].snapshots[0];

    expect(final.projects).toHaveLength(1);
    expect(final.projects[0].prds).toHaveLength(1);

    const nextVersion = continueFinalPrd(
      final,
      final.activeSelection!,
      "new-version",
    );
    const continuedPrd = nextVersion.projects[0].prds[0];
    expect(continuedPrd).toMatchObject({
      title: "PRD 001",
      lifecycle: "draft",
      document: { markdown: snapshot.markdown },
    });
    expect(continuedPrd.snapshots[0]).toEqual(snapshot);
    expect(continuedPrd.chats.at(-1)).toMatchObject({ messages: [], scenarioId: null });
    expect(nextVersion.activeSelection?.chatId).toBe(continuedPrd.chats.at(-1)?.id);

    const nextPrd = continueFinalPrd(final, final.activeSelection!, "new-prd");
    expect(nextPrd.projects[0].productContext).toEqual(final.projects[0].productContext);
    expect(nextPrd.projects[0].prds).toHaveLength(2);
    expect(nextPrd.projects[0].prds[1]).toMatchObject({
      title: "PRD 002",
      lifecycle: "draft",
      document: { markdown: expect.stringContaining("## Objetivo\n\nTBD") },
      chats: [{ messages: [] }],
    });
  });

  it("applies fixture Markdown only against its expected saved baseline", () => {
    const workspace = workspaceWithChats();
    const applied = applyPrdFixtureMarkdown(
      workspace,
      "project-1",
      "prd-1",
      "# PRD",
      "# Fixture",
    );
    const saved = savePrdMarkdown(workspace, "project-1", "prd-1", "# Guardado");

    expect(applied.projects[0].prds[0].document.markdown).toBe("# Fixture");
    expect(
      applyPrdFixtureMarkdown(
        saved,
        "project-1",
        "prd-1",
        "# PRD",
        "# Fixture obsoleto",
      ),
    ).toBe(saved);
  });

  it.each([
    "remove-requirement",
    "change-decision",
    "change-scope",
    "change-product-context",
    "destructive",
  ] as ProposalCategory[])(
    "resolves the sensitive proposal category %s without premature or repeated mutation",
    (category) => {
      const workspace = workspaceWithChats();
      const prd = workspace.projects[0].prds[0];
      const originalPrd = prd.document.markdown;
      const originalContext = workspace.projects[0].productContext.markdown;
      const proposedMarkdown = `# Propuesta ${category}`;
      prd.proposals = [{
        id: `proposal-${category}`,
        category,
        proposedMarkdown,
        resolution: "pending",
      }];

      expect(prd.document.markdown).toBe(originalPrd);
      expect(workspace.projects[0].productContext.markdown).toBe(originalContext);

      const accepted = resolveSensitiveProposal(
        workspace,
        workspace.activeSelection!,
        `proposal-${category}`,
        "accepted",
      );
      const acceptedPrd = accepted.projects[0].prds[0];
      expect(acceptedPrd.proposals[0].resolution).toBe("accepted");
      expect(acceptedPrd.document.markdown).toBe(
        category === "change-product-context" ? originalPrd : proposedMarkdown,
      );
      expect(accepted.projects[0].productContext.markdown).toBe(
        category === "change-product-context" ? proposedMarkdown : originalContext,
      );
      expect(resolveSensitiveProposal(
        accepted,
        accepted.activeSelection!,
        `proposal-${category}`,
        "accepted",
      )).toBe(accepted);

      const rejected = resolveSensitiveProposal(
        workspace,
        workspace.activeSelection!,
        `proposal-${category}`,
        "rejected",
      );
      expect(rejected.projects[0].prds[0].proposals[0].resolution).toBe("rejected");
      expect(rejected.projects[0].prds[0].document.markdown).toBe(originalPrd);
      expect(rejected.projects[0].productContext.markdown).toBe(originalContext);
      expect(resolveSensitiveProposal(
        rejected,
        rejected.activeSelection!,
        `proposal-${category}`,
        "accepted",
      )).toBe(rejected);
    },
  );

  it.each(["synced", "failed"] as const)(
    "runs deterministic demo sync to %s without changing confirmed documents",
    (result) => {
      const workspace = workspaceWithChats();
      workspace.projects[0].repository = {
        provider: "GitHub",
        ownerOrOrganization: "denker",
        repository: "atlas",
        branch: "main",
        documentationPath: "/docs",
      };
      const projects = workspace.projects;

      const syncing = beginDemoSync(workspace, "project-1");
      const completed = completeDemoSync(syncing, result);

      expect(syncing.syncState).toBe("syncing");
      expect(completed.syncState).toBe(result);
      expect(completed.projects).toBe(projects);
      expect(completed.projects[0].prds[0].document.markdown).toBe("# PRD");
    },
  );

  it("does not start without repository configuration or overwrite a later local save", () => {
    const workspace = workspaceWithChats();
    expect(beginDemoSync(workspace, "project-1")).toBe(workspace);

    workspace.projects[0].repository = {
      provider: "GitHub",
      ownerOrOrganization: "denker",
      repository: "atlas",
      branch: "main",
      documentationPath: "/docs",
    };
    const syncing = beginDemoSync(workspace, "project-1");
    const savedDuringSync = savePrdMarkdown(
      syncing,
      "project-1",
      "prd-1",
      "# Guardado durante sync",
    );

    expect(savedDuringSync.syncState).toBe("unsynced");
    expect(completeDemoSync(savedDuringSync, "synced")).toBe(savedDuringSync);
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
