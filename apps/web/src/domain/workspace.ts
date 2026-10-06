export type PrdLifecycle = "draft" | "review" | "final";
export type SyncState = "synced" | "unsynced" | "syncing" | "failed";
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
