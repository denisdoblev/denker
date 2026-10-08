export type PrdLifecycle = "draft" | "review" | "final";
export type SyncState = "synced" | "unsynced" | "syncing" | "failed";
export type DemoSyncResult = Extract<SyncState, "synced" | "failed">;
export type ProposalCategory =
  | "remove-requirement"
  | "change-decision"
  | "change-scope"
  | "change-product-context"
  | "destructive";

export interface MarkdownDocument {
  markdown: string;
}

export interface RepositoryConfiguration {
  provider: string;
  ownerOrOrganization: string;
  repository: string;
  branch: string;
  documentationPath: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "agent";
  content: string;
}

export interface Chat {
  id: string;
  title: string;
  messages: ChatMessage[];
  scenarioId: string | null;
  scenarioStep: number;
}

export interface PrdSnapshot {
  id: string;
  version: number;
  markdown: string;
}

export interface ReviewFinding {
  id: string;
  kind:
    | "gap"
    | "contradiction"
    | "ambiguity"
    | "risk"
    | "pending-decision"
    | "open-question"
    | "warning";
  description: string;
  resolved: boolean;
}

export interface SensitiveProposal {
  id: string;
  category: ProposalCategory;
  proposedMarkdown: string;
  resolution: "pending" | "accepted" | "rejected";
}

export type ProposalResolution = Extract<
  SensitiveProposal["resolution"],
  "accepted" | "rejected"
>;

export interface Prd {
  id: string;
  title: string;
  lifecycle: PrdLifecycle;
  document: MarkdownDocument;
  chats: Chat[];
  snapshots: PrdSnapshot[];
  findings: ReviewFinding[];
  proposals: SensitiveProposal[];
}

export interface Project {
  id: string;
  name: string;
  productContext: MarkdownDocument;
  repository: RepositoryConfiguration | null;
  prds: Prd[];
}

export interface ActiveSelection {
  projectId: string;
  prdId: string;
  chatId: string;
}

export interface WorkspaceState {
  projects: Project[];
  activeSelection: ActiveSelection | null;
  syncState: SyncState;
}

export interface WorkspaceEnvelopeV1 {
  version: 1;
  workspace: WorkspaceState;
}

export type PrdContinuation = "new-version" | "new-prd";

export const createEmptyWorkspace = (): WorkspaceState => ({
  projects: [],
  activeSelection: null,
  syncState: "synced",
});

export interface RepositoryConfigurationInput {
  provider?: string;
  ownerOrOrganization?: string;
  repository?: string;
  branch?: string;
  documentationPath?: string;
}

export function materializeRepositoryConfiguration(
  input: RepositoryConfigurationInput,
): RepositoryConfiguration {
  return {
    provider: input.provider?.trim() ?? "",
    ownerOrOrganization: input.ownerOrOrganization?.trim() ?? "",
    repository: input.repository?.trim() ?? "",
    branch: input.branch?.trim() || "main",
    documentationPath: input.documentationPath?.trim() || "/docs",
  };
}

const nextId = (prefix: string, existingIds: string[]): string => {
  const existing = new Set(existingIds);
  let index = 1;
  while (existing.has(`${prefix}-${index}`)) index += 1;
  return `${prefix}-${index}`;
};

export function createProject(
  workspace: WorkspaceState,
  name: string,
  repository?: RepositoryConfigurationInput,
): WorkspaceState {
  const normalizedName = name.trim();
  if (!normalizedName) return workspace;

  const projectId = nextId("project", workspace.projects.map(({ id }) => id));
  const prdId = `${projectId}-prd-1`;
  const chatId = `${prdId}-chat-1`;
  const project: Project = {
    id: projectId,
    name: normalizedName,
    productContext: {
      markdown: `# Contexto del producto: ${normalizedName}\n\n## Problema\n\nTBD\n\n## Usuarios\n\nTBD`,
    },
    repository: repository
      ? materializeRepositoryConfiguration(repository)
      : null,
    prds: [
      {
        id: prdId,
        title: "PRD 001",
        lifecycle: "draft",
        document: {
          markdown: `# PRD 001\n\n## Objetivo\n\nTBD\n\n## Requisitos\n\nTBD`,
        },
        chats: [
          {
            id: chatId,
            title: "Chat 1",
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
  };

  return {
    ...workspace,
    projects: [...workspace.projects, project],
    activeSelection: { projectId, prdId, chatId },
    syncState: "unsynced",
  };
}

export function createChat(
  workspace: WorkspaceState,
  projectId: string,
  prdId: string,
): WorkspaceState {
  const project = workspace.projects.find(({ id }) => id === projectId);
  const prd = project?.prds.find(({ id }) => id === prdId);
  if (!project || !prd) return workspace;

  const chatId = nextId(
    `${prdId}-chat`,
    prd.chats.map(({ id }) => id),
  );
  const chatNumber = prd.chats.length + 1;
  return {
    ...workspace,
    projects: workspace.projects.map((candidateProject) =>
      candidateProject.id !== projectId
        ? candidateProject
        : {
            ...candidateProject,
            prds: candidateProject.prds.map((candidatePrd) =>
              candidatePrd.id !== prdId
                ? candidatePrd
                : {
                    ...candidatePrd,
                    chats: [
                      ...candidatePrd.chats,
                      {
                        id: chatId,
                        title: `Chat ${chatNumber}`,
                        messages: [],
                        scenarioId: null,
                        scenarioStep: 0,
                      },
                    ],
                  },
            ),
          },
    ),
    activeSelection: { projectId, prdId, chatId },
    syncState: "unsynced",
  };
}

export function selectChat(
  workspace: WorkspaceState,
  selection: ActiveSelection,
): WorkspaceState {
  const project = workspace.projects.find(({ id }) => id === selection.projectId);
  const prd = project?.prds.find(({ id }) => id === selection.prdId);
  if (!prd?.chats.some(({ id }) => id === selection.chatId)) return workspace;
  return { ...workspace, activeSelection: selection };
}

export function addUserMessage(
  workspace: WorkspaceState,
  selection: ActiveSelection,
  content: string,
): WorkspaceState {
  const normalizedContent = content.trim();
  if (!normalizedContent) return workspace;
  const project = workspace.projects.find(({ id }) => id === selection.projectId);
  const prd = project?.prds.find(({ id }) => id === selection.prdId);
  const chat = prd?.chats.find(({ id }) => id === selection.chatId);
  if (!chat) return workspace;

  const messageId = nextId("message", chat.messages.map(({ id }) => id));
  return {
    ...workspace,
    projects: workspace.projects.map((candidateProject) =>
      candidateProject.id !== selection.projectId
        ? candidateProject
        : {
            ...candidateProject,
            prds: candidateProject.prds.map((candidatePrd) =>
              candidatePrd.id !== selection.prdId
                ? candidatePrd
                : {
                    ...candidatePrd,
                    chats: candidatePrd.chats.map((candidateChat) =>
                      candidateChat.id !== selection.chatId
                        ? candidateChat
                        : {
                            ...candidateChat,
                            messages: [
                              ...candidateChat.messages,
                              { id: messageId, role: "user", content: normalizedContent },
                            ],
                          },
                    ),
                  },
            ),
          },
    ),
    syncState: "unsynced",
  };
}

export function saveRepositoryConfiguration(
  workspace: WorkspaceState,
  projectId: string,
  input: RepositoryConfigurationInput,
): WorkspaceState {
  if (!workspace.projects.some(({ id }) => id === projectId)) return workspace;
  return {
    ...workspace,
    projects: workspace.projects.map((project) =>
      project.id === projectId
        ? { ...project, repository: materializeRepositoryConfiguration(input) }
        : project,
    ),
    syncState: "unsynced",
  };
}

export function savePrdMarkdown(
  workspace: WorkspaceState,
  projectId: string,
  prdId: string,
  markdown: string,
): WorkspaceState {
  const project = workspace.projects.find(({ id }) => id === projectId);
  const prd = project?.prds.find(({ id }) => id === prdId);
  if (!prd || prd.lifecycle === "final") return workspace;

  return {
    ...workspace,
    projects: workspace.projects.map((candidateProject) =>
      candidateProject.id !== projectId
        ? candidateProject
        : {
            ...candidateProject,
            prds: candidateProject.prds.map((candidatePrd) =>
              candidatePrd.id === prdId
                ? { ...candidatePrd, document: { markdown } }
                : candidatePrd,
            ),
          },
    ),
    syncState: "unsynced",
  };
}

export function saveProductContextMarkdown(
  workspace: WorkspaceState,
  projectId: string,
  markdown: string,
): WorkspaceState {
  if (!workspace.projects.some(({ id }) => id === projectId)) return workspace;

  return {
    ...workspace,
    projects: workspace.projects.map((project) =>
      project.id === projectId
        ? { ...project, productContext: { markdown } }
        : project,
    ),
    syncState: "unsynced",
  };
}

export function startPrdReview(
  workspace: WorkspaceState,
  projectId: string,
  prdId: string,
): WorkspaceState {
  return changePrdLifecycle(workspace, projectId, prdId, "draft", "review");
}

export function returnPrdToDraft(
  workspace: WorkspaceState,
  projectId: string,
  prdId: string,
): WorkspaceState {
  return changePrdLifecycle(workspace, projectId, prdId, "review", "draft");
}

function changePrdLifecycle(
  workspace: WorkspaceState,
  projectId: string,
  prdId: string,
  expected: PrdLifecycle,
  next: PrdLifecycle,
): WorkspaceState {
  const project = workspace.projects.find(({ id }) => id === projectId);
  const prd = project?.prds.find(({ id }) => id === prdId);
  if (!prd || prd.lifecycle !== expected) return workspace;

  return {
    ...workspace,
    projects: workspace.projects.map((candidateProject) =>
      candidateProject.id !== projectId
        ? candidateProject
        : {
            ...candidateProject,
            prds: candidateProject.prds.map((candidatePrd) =>
              candidatePrd.id === prdId
                ? { ...candidatePrd, lifecycle: next }
                : candidatePrd,
            ),
          },
    ),
    syncState: "unsynced",
  };
}

export function finalizePrd(
  workspace: WorkspaceState,
  projectId: string,
  prdId: string,
  acceptsRemainingWarnings: boolean,
): WorkspaceState {
  const project = workspace.projects.find(({ id }) => id === projectId);
  const prd = project?.prds.find(({ id }) => id === prdId);
  if (!prd || prd.lifecycle !== "review") return workspace;
  const hasRemainingWarnings = prd.findings.some(
    ({ kind, resolved }) => kind === "warning" && !resolved,
  );
  if (hasRemainingWarnings && !acceptsRemainingWarnings) return workspace;

  const version = Math.max(0, ...prd.snapshots.map((snapshot) => snapshot.version)) + 1;
  const snapshot: PrdSnapshot = {
    id: nextId(`${prd.id}-snapshot`, prd.snapshots.map(({ id }) => id)),
    version,
    markdown: prd.document.markdown,
  };

  return {
    ...workspace,
    projects: workspace.projects.map((candidateProject) =>
      candidateProject.id !== projectId
        ? candidateProject
        : {
            ...candidateProject,
            prds: candidateProject.prds.map((candidatePrd) =>
              candidatePrd.id === prdId
                ? {
                    ...candidatePrd,
                    lifecycle: "final",
                    snapshots: [...candidatePrd.snapshots, snapshot],
                  }
                : candidatePrd,
            ),
          },
    ),
    syncState: "unsynced",
  };
}

const initialPrdMarkdown = (title: string): string =>
  `# ${title}\n\n## Objetivo\n\nTBD\n\n## Requisitos\n\nTBD`;

export function continueFinalPrd(
  workspace: WorkspaceState,
  selection: ActiveSelection,
  continuation: PrdContinuation,
): WorkspaceState {
  const project = workspace.projects.find(({ id }) => id === selection.projectId);
  const prd = project?.prds.find(({ id }) => id === selection.prdId);
  if (!project || !prd || prd.lifecycle !== "final") return workspace;

  if (continuation === "new-version") {
    const lastSnapshot = prd.snapshots.reduce<PrdSnapshot | null>(
      (latest, snapshot) => !latest || snapshot.version > latest.version ? snapshot : latest,
      null,
    );
    if (!lastSnapshot) return workspace;
    const chatId = nextId(`${prd.id}-chat`, prd.chats.map(({ id }) => id));
    const chat: Chat = {
      id: chatId,
      title: `Chat ${prd.chats.length + 1}`,
      messages: [],
      scenarioId: null,
      scenarioStep: 0,
    };
    return {
      ...workspace,
      projects: workspace.projects.map((candidateProject) =>
        candidateProject.id !== project.id
          ? candidateProject
          : {
              ...candidateProject,
              prds: candidateProject.prds.map((candidatePrd) =>
                candidatePrd.id !== prd.id
                  ? candidatePrd
                  : {
                      ...candidatePrd,
                      lifecycle: "draft",
                      document: { markdown: lastSnapshot.markdown },
                      chats: [...candidatePrd.chats, chat],
                      findings: [],
                    },
              ),
            },
      ),
      activeSelection: { projectId: project.id, prdId: prd.id, chatId },
      syncState: "unsynced",
    };
  }

  const nextNumber = Math.max(
    0,
    ...project.prds.map(({ title }) => {
      const match = /^PRD (\d{3})$/.exec(title);
      return match ? Number(match[1]) : 0;
    }),
  ) + 1;
  const title = `PRD ${String(nextNumber).padStart(3, "0")}`;
  const prdId = nextId(`${project.id}-prd`, project.prds.map(({ id }) => id));
  const chatId = `${prdId}-chat-1`;
  const nextPrd: Prd = {
    id: prdId,
    title,
    lifecycle: "draft",
    document: { markdown: initialPrdMarkdown(title) },
    chats: [{
      id: chatId,
      title: "Chat 1",
      messages: [],
      scenarioId: null,
      scenarioStep: 0,
    }],
    snapshots: [],
    findings: [],
    proposals: [],
  };
  return {
    ...workspace,
    projects: workspace.projects.map((candidateProject) =>
      candidateProject.id === project.id
        ? { ...candidateProject, prds: [...candidateProject.prds, nextPrd] }
        : candidateProject,
    ),
    activeSelection: { projectId: project.id, prdId, chatId },
    syncState: "unsynced",
  };
}

export function resolveSensitiveProposal(
  workspace: WorkspaceState,
  selection: ActiveSelection,
  proposalId: string,
  resolution: ProposalResolution,
): WorkspaceState {
  const project = workspace.projects.find(({ id }) => id === selection.projectId);
  const prd = project?.prds.find(({ id }) => id === selection.prdId);
  const proposal = prd?.proposals.find(({ id }) => id === proposalId);
  if (!project || !prd || !proposal || proposal.resolution !== "pending") {
    return workspace;
  }
  if (resolution === "accepted" && prd.lifecycle === "final") return workspace;

  const changesProductContext = proposal.category === "change-product-context";
  return {
    ...workspace,
    projects: workspace.projects.map((candidateProject) =>
      candidateProject.id !== project.id
        ? candidateProject
        : {
            ...candidateProject,
            productContext:
              resolution === "accepted" && changesProductContext
                ? { markdown: proposal.proposedMarkdown }
                : candidateProject.productContext,
            prds: candidateProject.prds.map((candidatePrd) =>
              candidatePrd.id !== prd.id
                ? candidatePrd
                : {
                    ...candidatePrd,
                    document:
                      resolution === "accepted" && !changesProductContext
                        ? { markdown: proposal.proposedMarkdown }
                        : candidatePrd.document,
                    proposals: candidatePrd.proposals.map((candidateProposal) =>
                      candidateProposal.id === proposal.id
                        ? { ...candidateProposal, resolution }
                        : candidateProposal,
                    ),
                  },
            ),
          },
    ),
    syncState: "unsynced",
  };
}

export function beginDemoSync(
  workspace: WorkspaceState,
  projectId: string,
): WorkspaceState {
  const project = workspace.projects.find(({ id }) => id === projectId);
  if (!project?.repository || workspace.syncState === "syncing") return workspace;

  return { ...workspace, syncState: "syncing" };
}

export function completeDemoSync(
  workspace: WorkspaceState,
  result: DemoSyncResult,
): WorkspaceState {
  if (workspace.syncState !== "syncing") return workspace;
  return { ...workspace, syncState: result };
}

export function applyPrdFixtureMarkdown(
  workspace: WorkspaceState,
  projectId: string,
  prdId: string,
  expectedMarkdown: string,
  markdown: string,
): WorkspaceState {
  const project = workspace.projects.find(({ id }) => id === projectId);
  const prd = project?.prds.find(({ id }) => id === prdId);
  if (
    !prd
    || prd.lifecycle === "final"
    || prd.document.markdown !== expectedMarkdown
  ) {
    return workspace;
  }

  return {
    ...workspace,
    projects: workspace.projects.map((candidateProject) =>
      candidateProject.id !== projectId
        ? candidateProject
        : {
            ...candidateProject,
            prds: candidateProject.prds.map((candidatePrd) =>
              candidatePrd.id === prdId
                ? { ...candidatePrd, document: { markdown } }
                : candidatePrd,
            ),
          },
    ),
  };
}

export const encodeWorkspaceEnvelope = (workspace: WorkspaceState): string =>
  JSON.stringify({ version: 1, workspace } satisfies WorkspaceEnvelopeV1);

export type DecodeResult =
  | { status: "valid"; workspace: WorkspaceState }
  | { status: "invalid" };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isString = (value: unknown): value is string => typeof value === "string";
const isBoolean = (value: unknown): value is boolean =>
  typeof value === "boolean";
const isNonNegativeInteger = (value: unknown): value is number =>
  Number.isInteger(value) && (value as number) >= 0;
const isArrayOf = <T>(
  value: unknown,
  predicate: (candidate: unknown) => candidate is T,
): value is T[] => Array.isArray(value) && value.every(predicate);

const isMarkdownDocument = (value: unknown): value is MarkdownDocument =>
  isRecord(value) && isString(value.markdown);

const isRepositoryConfiguration = (
  value: unknown,
): value is RepositoryConfiguration =>
  isRecord(value) &&
  isString(value.provider) &&
  isString(value.ownerOrOrganization) &&
  isString(value.repository) &&
  isString(value.branch) &&
  isString(value.documentationPath);

const isChatMessage = (value: unknown): value is ChatMessage =>
  isRecord(value) &&
  isString(value.id) &&
  (value.role === "user" || value.role === "agent") &&
  isString(value.content);

const isChat = (value: unknown): value is Chat =>
  isRecord(value) &&
  isString(value.id) &&
  isString(value.title) &&
  isArrayOf(value.messages, isChatMessage) &&
  (value.scenarioId === null || isString(value.scenarioId)) &&
  isNonNegativeInteger(value.scenarioStep);

const isPrdSnapshot = (value: unknown): value is PrdSnapshot =>
  isRecord(value) &&
  isString(value.id) &&
  isNonNegativeInteger(value.version) &&
  isString(value.markdown);

const findingKinds = new Set<ReviewFinding["kind"]>([
  "gap",
  "contradiction",
  "ambiguity",
  "risk",
  "pending-decision",
  "open-question",
  "warning",
]);

const isReviewFinding = (value: unknown): value is ReviewFinding =>
  isRecord(value) &&
  isString(value.id) &&
  findingKinds.has(value.kind as ReviewFinding["kind"]) &&
  isString(value.description) &&
  isBoolean(value.resolved);

const proposalCategories = new Set<ProposalCategory>([
  "remove-requirement",
  "change-decision",
  "change-scope",
  "change-product-context",
  "destructive",
]);

const isSensitiveProposal = (value: unknown): value is SensitiveProposal =>
  isRecord(value) &&
  isString(value.id) &&
  proposalCategories.has(value.category as ProposalCategory) &&
  isString(value.proposedMarkdown) &&
  (value.resolution === "pending" ||
    value.resolution === "accepted" ||
    value.resolution === "rejected");

const isPrd = (value: unknown): value is Prd =>
  isRecord(value) &&
  isString(value.id) &&
  isString(value.title) &&
  (value.lifecycle === "draft" ||
    value.lifecycle === "review" ||
    value.lifecycle === "final") &&
  isMarkdownDocument(value.document) &&
  isArrayOf(value.chats, isChat) &&
  isArrayOf(value.snapshots, isPrdSnapshot) &&
  isArrayOf(value.findings, isReviewFinding) &&
  isArrayOf(value.proposals, isSensitiveProposal);

const isProject = (value: unknown): value is Project =>
  isRecord(value) &&
  isString(value.id) &&
  isString(value.name) &&
  isMarkdownDocument(value.productContext) &&
  (value.repository === null || isRepositoryConfiguration(value.repository)) &&
  isArrayOf(value.prds, isPrd);

const isActiveSelection = (value: unknown): value is ActiveSelection =>
  isRecord(value) &&
  isString(value.projectId) &&
  isString(value.prdId) &&
  isString(value.chatId);

const syncStates = new Set<SyncState>([
  "synced",
  "unsynced",
  "syncing",
  "failed",
]);

const isWorkspaceState = (value: unknown): value is WorkspaceState =>
  isRecord(value) &&
  isArrayOf(value.projects, isProject) &&
  (value.activeSelection === null || isActiveSelection(value.activeSelection)) &&
  syncStates.has(value.syncState as SyncState);

export function resolveActiveSelection(workspace: WorkspaceState): WorkspaceState {
  const selected = workspace.activeSelection;
  if (selected) {
    const project = workspace.projects.find(({ id }) => id === selected.projectId);
    const prd = project?.prds.find(({ id }) => id === selected.prdId);
    if (prd?.chats.some(({ id }) => id === selected.chatId)) {
      return workspace;
    }
  }

  for (const project of workspace.projects) {
    for (const prd of project.prds) {
      const chat = prd.chats[0];
      if (chat) {
        return {
          ...workspace,
          activeSelection: {
            projectId: project.id,
            prdId: prd.id,
            chatId: chat.id,
          },
        };
      }
    }
  }

  return { ...workspace, activeSelection: null };
}

export function decodeWorkspaceEnvelope(raw: string): DecodeResult {
  try {
    const envelope: unknown = JSON.parse(raw);
    if (
      !isRecord(envelope) ||
      envelope.version !== 1 ||
      !isWorkspaceState(envelope.workspace)
    ) {
      return { status: "invalid" };
    }

    return {
      status: "valid",
      workspace: resolveActiveSelection(envelope.workspace),
    };
  } catch {
    return { status: "invalid" };
  }
}
