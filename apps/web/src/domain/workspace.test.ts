import {
  addUserMessage,
  applyPrdFixtureMarkdown,
  beginDemoSync,
  changeGuidedChatProgress,
  completeDemoSync,
  continueFinalPrd,
  createChat,
  createEmptyWorkspace,
  createProject,
  decodeWorkspaceEnvelope,
  encodeWorkspaceEnvelope,
  finalizePrd,
  getGuidedChatAvailability,
  resolveActiveSelection,
  selectChat,
  resolveSensitiveProposal,
  returnPrdToDraft,
  savePrdMarkdown,
  saveProductContextMarkdown,
  saveRepositoryConfiguration,
  startPrdReview,
  type WorkspaceState,
  type ProposalCategory,
  type GuidedChatProgress,
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
              kind: "additional",
              phase: null,
              progress: null,
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
    expect(prd.chats.map(({ title }) => title)).toEqual([
      "PRD",
      "Diseño de pantallas",
      "Diseño de base de datos",
      "Plan de implementación",
      "Implementación",
      "Pruebas y revisión",
    ]);
    expect(prd.chats.map(({ kind, phase, progress }) => ({ kind, phase, progress }))).toEqual([
      { kind: "guided", phase: "prd", progress: null },
      { kind: "guided", phase: "screen-design", progress: "pending" },
      { kind: "guided", phase: "database-design", progress: "pending" },
      { kind: "guided", phase: "implementation-plan", progress: "pending" },
      { kind: "guided", phase: "implementation", progress: "pending" },
      { kind: "guided", phase: "testing-review", progress: "pending" },
    ]);
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
    expect(chats.at(-1)?.messages.map(({ content }) => content)).toEqual(["Segunda historia"]);
    expect(chats.at(-1)).toMatchObject({ title: "Chat adicional 1", kind: "additional", phase: null, progress: null });
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
    expect(continuedPrd.chats).toHaveLength(2);
    expect(continuedPrd.chats.at(-1)).toMatchObject({ title: "Chat adicional 2", kind: "additional", messages: [], scenarioId: null });
    expect(nextVersion.activeSelection?.chatId).toBe(continuedPrd.chats.at(-1)?.id);

    const nextPrd = continueFinalPrd(final, final.activeSelection!, "new-prd");
    expect(nextPrd.projects[0].productContext).toEqual(final.projects[0].productContext);
    expect(nextPrd.projects[0].prds).toHaveLength(2);
    expect(nextPrd.projects[0].prds[1]).toMatchObject({
      title: "PRD 002",
      lifecycle: "draft",
      document: { markdown: expect.stringContaining("## Objetivo\n\nTBD") },
      chats: [
        { title: "PRD", kind: "guided", phase: "prd", progress: null, messages: [] },
        { title: "Diseño de pantallas", kind: "guided", phase: "screen-design", progress: "pending", messages: [] },
        { title: "Diseño de base de datos", kind: "guided", phase: "database-design", progress: "pending", messages: [] },
        { title: "Plan de implementación", kind: "guided", phase: "implementation-plan", progress: "pending", messages: [] },
        { title: "Implementación", kind: "guided", phase: "implementation", progress: "pending", messages: [] },
        { title: "Pruebas y revisión", kind: "guided", phase: "testing-review", progress: "pending", messages: [] },
      ],
    });
  });

  it("keeps the single guided path when continuing the same PRD as a new version", () => {
    let workspace = createProject(createEmptyWorkspace(), "Atlas");
    const selection = workspace.activeSelection!;
    workspace = addUserMessage(workspace, selection, "Historia conservada");
    workspace = finalizePrd(startPrdReview(workspace, selection.projectId, selection.prdId), selection.projectId, selection.prdId, false);

    const continued = continueFinalPrd(workspace, selection, "new-version");
    const chats = continued.projects[0].prds[0].chats;

    expect(chats.filter(({ kind }) => kind === "guided")).toHaveLength(6);
    expect(chats.filter(({ kind }) => kind === "additional")).toHaveLength(1);
    expect(chats[0].messages.map(({ content }) => content)).toEqual(["Historia conservada"]);
    expect(chats.at(-1)).toMatchObject({ title: "Chat adicional 1", kind: "additional", messages: [] });
    expect(continued.activeSelection?.chatId).toBe(chats.at(-1)?.id);
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

describe("guided Chat progress and availability", () => {
  const availability = (workspace: WorkspaceState) => {
    const prd = workspace.projects[0].prds[0];
    return Object.fromEntries(prd.chats
      .filter((chat) => chat.kind === "guided" && chat.phase !== null)
      .map((chat) => [chat.phase!, getGuidedChatAvailability(prd, chat.phase!).available]));
  };

  const selectionFor = (workspace: WorkspaceState, phase: string) => {
    const prd = workspace.projects[0].prds[0];
    return {
      projectId: workspace.projects[0].id,
      prdId: prd.id,
      chatId: prd.chats.find((chat) => chat.phase === phase)!.id,
    };
  };

  it("derives the full unlock sequence from lifecycle and explicit progress", () => {
    let workspace = createProject(createEmptyWorkspace(), "Atlas");
    expect(availability(workspace)).toEqual({
      prd: true,
      "screen-design": false,
      "database-design": false,
      "implementation-plan": false,
      implementation: false,
      "testing-review": false,
    });

    workspace = startPrdReview(workspace, workspace.projects[0].id, workspace.projects[0].prds[0].id);
    expect(availability(workspace)).toMatchObject({ "screen-design": true, "database-design": true, "implementation-plan": false });
    workspace = changeGuidedChatProgress(workspace, selectionFor(workspace, "screen-design"), "ready");
    workspace = changeGuidedChatProgress(workspace, selectionFor(workspace, "database-design"), "not-applicable");
    expect(availability(workspace)).toMatchObject({ "implementation-plan": true, implementation: false });
    workspace = changeGuidedChatProgress(workspace, selectionFor(workspace, "implementation-plan"), "ready");
    expect(availability(workspace)).toMatchObject({ implementation: true, "testing-review": false });
    workspace = changeGuidedChatProgress(workspace, selectionFor(workspace, "implementation"), "ready");
    expect(availability(workspace)["testing-review"]).toBe(true);
  });

  it.each(["pending", "in-progress", "ready", "not-applicable"] as GuidedChatProgress[])(
    "accepts the permitted design progress %s",
    (progress) => {
      let workspace = createProject(createEmptyWorkspace(), "Atlas");
      const project = workspace.projects[0];
      workspace = startPrdReview(workspace, project.id, project.prds[0].id);
      const changed = changeGuidedChatProgress(workspace, selectionFor(workspace, "screen-design"), progress);
      expect(changed.projects[0].prds[0].chats[1].progress).toBe(progress);
      if (progress !== "pending") expect(changed.syncState).toBe("unsynced");
    },
  );

  it("rejects invalid, PRD, additional, and blocked progress changes", () => {
    let workspace = createProject(createEmptyWorkspace(), "Atlas");
    expect(changeGuidedChatProgress(workspace, selectionFor(workspace, "screen-design"), "ready")).toBe(workspace);
    expect(changeGuidedChatProgress(workspace, selectionFor(workspace, "prd"), "ready")).toBe(workspace);
    workspace = startPrdReview(workspace, workspace.projects[0].id, workspace.projects[0].prds[0].id);
    expect(changeGuidedChatProgress(workspace, selectionFor(workspace, "implementation-plan"), "ready")).toBe(workspace);
    expect(changeGuidedChatProgress(workspace, selectionFor(workspace, "implementation"), "not-applicable")).toBe(workspace);
    const withAdditional = createChat(workspace, workspace.projects[0].id, workspace.projects[0].prds[0].id);
    expect(changeGuidedChatProgress(withAdditional, withAdditional.activeSelection!, "ready")).toBe(withAdditional);
  });

  it("blocks transitive dependants without changing progress or history and restores them", () => {
    let workspace = createProject(createEmptyWorkspace(), "Atlas");
    const project = workspace.projects[0];
    workspace = startPrdReview(workspace, project.id, project.prds[0].id);
    for (const [phase, progress] of [
      ["screen-design", "ready"],
      ["database-design", "not-applicable"],
      ["implementation-plan", "ready"],
      ["implementation", "ready"],
    ] as const) workspace = changeGuidedChatProgress(workspace, selectionFor(workspace, phase), progress);
    const implementationSelection = selectionFor(workspace, "implementation");
    workspace = { ...addUserMessage(workspace, implementationSelection, "Trabajo conservado"), activeSelection: implementationSelection };
    const before = workspace.projects[0].prds[0].chats;

    const regressed = changeGuidedChatProgress(workspace, selectionFor(workspace, "screen-design"), "in-progress");
    const prd = regressed.projects[0].prds[0];
    expect(getGuidedChatAvailability(prd, "implementation-plan").blockers).toEqual(["screen-design"]);
    expect(getGuidedChatAvailability(prd, "implementation").blockers).toEqual(["screen-design"]);
    expect(getGuidedChatAvailability(prd, "testing-review").blockers).toEqual(["screen-design"]);
    expect(prd.chats).toEqual(before.map((chat) => chat.phase === "screen-design" ? { ...chat, progress: "in-progress" } : chat));
    expect(addUserMessage(regressed, implementationSelection, "No permitido")).toBe(regressed);
    expect(changeGuidedChatProgress(regressed, implementationSelection, "pending")).toBe(regressed);
    expect(selectChat(regressed, selectionFor(regressed, "testing-review"))).toBe(regressed);

    const restored = changeGuidedChatProgress(regressed, selectionFor(regressed, "screen-design"), "ready");
    expect(getGuidedChatAvailability(restored.projects[0].prds[0], "implementation").available).toBe(true);
    expect(restored.projects[0].prds[0].chats.find(({ phase }) => phase === "implementation")?.messages)
      .toEqual([{ id: "message-1", role: "user", content: "Trabajo conservado" }]);

    const databaseRegressed = changeGuidedChatProgress(restored, selectionFor(restored, "database-design"), "pending");
    expect(getGuidedChatAvailability(databaseRegressed.projects[0].prds[0], "implementation").blockers)
      .toEqual(["database-design"]);
    const lifecycleRegressed = returnPrdToDraft(restored, project.id, project.prds[0].id);
    expect(getGuidedChatAvailability(lifecycleRegressed.projects[0].prds[0], "implementation").blockers)
      .toEqual(["prd"]);
    expect(lifecycleRegressed.projects[0].prds[0].chats).toEqual(restored.projects[0].prds[0].chats);
  });

  it.each(["review", "final"] as const)("unlocks both designs for lifecycle %s", (lifecycle) => {
    let workspace = createProject(createEmptyWorkspace(), "Atlas");
    const project = workspace.projects[0];
    workspace = startPrdReview(workspace, project.id, project.prds[0].id);
    if (lifecycle === "final") workspace = finalizePrd(workspace, project.id, project.prds[0].id, false);
    expect(availability(workspace)).toMatchObject({ "screen-design": true, "database-design": true });
  });
});

describe("workspace envelope", () => {
  it("round trips guided and additional histories, progress, lifecycle and selection in v2", () => {
    let workspace = createProject(createEmptyWorkspace(), "Atlas");
    const project = workspace.projects[0];
    workspace = startPrdReview(workspace, project.id, project.prds[0].id);
    const design = {
      projectId: project.id,
      prdId: project.prds[0].id,
      chatId: workspace.projects[0].prds[0].chats.find(
        ({ phase }) => phase === "screen-design",
      )!.id,
    };
    workspace = changeGuidedChatProgress(workspace, design, "ready");
    workspace = addUserMessage(workspace, design, "Diseño persistido");
    workspace = createChat(workspace, project.id, project.prds[0].id);
    workspace = addUserMessage(workspace, workspace.activeSelection!, "Historia adicional");

    expect(decodeWorkspaceEnvelope(encodeWorkspaceEnvelope(workspace))).toEqual({
      status: "valid",
      workspace,
    });
  });

  it.each([
    "not-json",
    JSON.stringify({ version: 1, workspace: createEmptyWorkspace() }),
    JSON.stringify({ version: 3, workspace: createEmptyWorkspace() }),
    JSON.stringify({ version: 2, workspace: { projects: "unknown" } }),
  ])("rejects invalid or unknown payload %s", (raw) => {
    expect(decodeWorkspaceEnvelope(raw)).toEqual({ status: "invalid" });
  });

  it.each([
    { kind: "unknown", phase: null, progress: null },
    { kind: "guided", phase: "unknown", progress: "pending" },
    { kind: "guided", phase: "prd", progress: "ready" },
    { kind: "guided", phase: "implementation", progress: "not-applicable" },
    { kind: "additional", phase: "prd", progress: null },
    { kind: "additional", phase: null, progress: "pending" },
  ])("rejects invalid Chat metadata $kind/$phase/$progress", (metadata) => {
    const workspace = workspaceWithChats();
    Object.assign(workspace.projects[0].prds[0].chats[0], metadata);

    expect(decodeWorkspaceEnvelope(JSON.stringify({ version: 2, workspace })))
      .toEqual({ status: "invalid" });
  });

  it("rejects missing Chat metadata", () => {
    const workspace = workspaceWithChats();
    const { kind, ...chatWithoutKind } = workspace.projects[0].prds[0].chats[0];
    expect(kind).toBe("additional");
    workspace.projects[0].prds[0].chats[0] = chatWithoutKind as typeof workspace.projects[0]["prds"][0]["chats"][0];

    expect(decodeWorkspaceEnvelope(JSON.stringify({ version: 2, workspace })))
      .toEqual({ status: "invalid" });
  });

  it("rejects persisted derived availability instead of treating it as state", () => {
    const workspace = workspaceWithChats();
    Object.assign(workspace.projects[0].prds[0].chats[0], { available: true });

    expect(decodeWorkspaceEnvelope(JSON.stringify({ version: 2, workspace })))
      .toEqual({ status: "invalid" });
    expect(encodeWorkspaceEnvelope(workspaceWithChats())).not.toContain("available");
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
