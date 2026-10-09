import { isChatAvailable } from "./workspace";
import type {
  ActiveSelection,
  ChatMessage,
  Prd,
  PrdLifecycle,
  PrdSnapshot,
  ReviewFinding,
  SensitiveProposal,
  SyncState,
  WorkspaceState,
} from "./workspace";

export type DemoScenarioId =
  | "conversacion-vacia"
  | "pregunta-del-agente"
  | "respuesta-del-usuario"
  | "prd-actualizado"
  | "cambio-pendiente-de-aprobacion"
  | "propuesta-de-cambio-de-product-context"
  | "review-con-warnings"
  | "prd-finalizado"
  | "nueva-version"
  | "recomendacion-de-otro-prd"
  | "respuesta-interrumpida"
  | "escenario-no-disponible"
  | "estados-de-sincronizacion";

export type DemoErrorScenarioId = Extract<
  DemoScenarioId,
  "respuesta-interrumpida" | "escenario-no-disponible"
>;

interface DemoMessageFixture {
  role: ChatMessage["role"];
  content: string;
}

interface DemoScenarioDocumentState {
  prdMarkdown?: string;
  lifecycle?: PrdLifecycle;
  findings?: ReviewFinding[];
  proposals?: SensitiveProposal[];
  snapshots?: PrdSnapshot[];
  syncState?: SyncState;
}

interface DemoScenarioBase {
  id: DemoScenarioId;
  name: string;
  messages: readonly DemoMessageFixture[];
  responses: readonly string[];
}

interface DemoConversationScenario extends DemoScenarioBase {
  kind: "conversation";
  documentState?: DemoScenarioDocumentState;
}

export interface DemoErrorScenario extends DemoScenarioBase {
  id: DemoErrorScenarioId;
  kind: "error";
  error: {
    description: string;
    recoveryLabel: string;
    recovery:
      | { kind: "append-message"; content: string }
      | { kind: "return-to-chat" };
  };
}

export type DemoScenario = DemoConversationScenario | DemoErrorScenario;

const DEFAULT_RESPONSES = [
  "¿Qué problema quieres resolver y para quién?",
  "He registrado esa respuesta en este guion de demostración.",
  "El siguiente paso predefinido es revisar el borrador del PRD.",
] as const;

const FINAL_PRD_MARKDOWN = "# PRD 001\n\n## Objetivo\n\nValidar el flujo local de discovery.\n\n## Requisitos\n\n- Conservar esta versión final como snapshot inmutable.";
const FINAL_PRD_SNAPSHOT: PrdSnapshot = {
  id: "demo-prd-001-snapshot-1",
  version: 1,
  markdown: FINAL_PRD_MARKDOWN,
};

const PRD_PROPOSALS: SensitiveProposal[] = [
  {
    id: "demo-proposal-requirement-1",
    category: "remove-requirement",
    proposedMarkdown: "# PRD 001\n\n## Objetivo\n\nValidar el flujo local de discovery.\n\n## Requisitos\n\nTBD",
    resolution: "pending",
  },
  {
    id: "demo-proposal-decision-1",
    category: "change-decision",
    proposedMarkdown: "# PRD 001\n\n## Objetivo\n\nValidar el flujo local de discovery.\n\n## Decisiones consolidadas\n\n- Priorizar una experiencia guiada.",
    resolution: "pending",
  },
  {
    id: "demo-proposal-scope-1",
    category: "change-scope",
    proposedMarkdown: "# PRD 001\n\n## Objetivo\n\nAmpliar el alcance del discovery.\n\n## Requisitos\n\nTBD",
    resolution: "pending",
  },
  {
    id: "demo-proposal-destructive-1",
    category: "destructive",
    proposedMarkdown: "# PRD 001\n\n## Objetivo\n\nTBD\n\n## Requisitos\n\nTBD",
    resolution: "pending",
  },
];

export const DEMO_SCENARIOS = [
  {
    id: "conversacion-vacia",
    name: "Conversación vacía",
    kind: "conversation",
    messages: [],
    responses: DEFAULT_RESPONSES,
  },
  {
    id: "pregunta-del-agente",
    name: "Pregunta del agente",
    kind: "conversation",
    messages: [{ role: "agent", content: DEFAULT_RESPONSES[0] }],
    responses: DEFAULT_RESPONSES.slice(1),
  },
  {
    id: "respuesta-del-usuario",
    name: "Respuesta del usuario",
    kind: "conversation",
    messages: [
      { role: "agent", content: DEFAULT_RESPONSES[0] },
      { role: "user", content: "Quiero aclarar el alcance del producto." },
    ],
    responses: DEFAULT_RESPONSES.slice(1),
  },
  {
    id: "prd-actualizado",
    name: "PRD actualizado",
    kind: "conversation",
    messages: [{ role: "agent", content: "El borrador del PRD se actualizó con el resultado previsto por el escenario." }],
    responses: ["La actualización del PRD ya está reflejada en el documento."],
    documentState: {
      prdMarkdown: "# PRD 001\n\n## Objetivo\n\nValidar el flujo local de discovery.\n\n## Requisitos\n\n- Mantener el Markdown bajo control de la persona usuaria.",
    },
  },
  {
    id: "cambio-pendiente-de-aprobacion",
    name: "Cambio pendiente de aprobación",
    kind: "conversation",
    messages: [{ role: "agent", content: "Hay un cambio sensible pendiente de aprobación explícita." }],
    responses: ["La propuesta sigue pendiente hasta que elijas una acción visible."],
    documentState: {
      proposals: PRD_PROPOSALS,
    },
  },
  {
    id: "propuesta-de-cambio-de-product-context",
    name: "Propuesta de cambio de Product Context",
    kind: "conversation",
    messages: [{ role: "agent", content: "Se preparó una propuesta para cambiar Product Context; todavía no se aplicó." }],
    responses: ["Product Context permanece sin cambios mientras la propuesta está pendiente."],
    documentState: {
      proposals: [{
        id: "demo-proposal-context-1",
        category: "change-product-context",
        proposedMarkdown: "# Contexto del producto: Atlas\n\n## Problema\n\nAclarar el problema validado.\n\n## Usuarios\n\nTBD",
        resolution: "pending",
      }],
    },
  },
  {
    id: "review-con-warnings",
    name: "Revisión con advertencias",
    kind: "conversation",
    messages: [{ role: "agent", content: "El PRD está en revisión y conserva una advertencia visible." }],
    responses: ["La advertencia seguirá visible hasta una decisión explícita."],
    documentState: {
      lifecycle: "review",
      findings: [{
        id: "demo-warning-1",
        kind: "warning",
        description: "Falta validar el supuesto principal con personas usuarias.",
        resolved: false,
      }],
    },
  },
  {
    id: "prd-finalizado",
    name: "PRD finalizado",
    kind: "conversation",
    messages: [{ role: "agent", content: "El escenario muestra el PRD como finalizado y de sólo lectura." }],
    responses: ["Un PRD finalizado no recibe cambios del guion."],
    documentState: {
      prdMarkdown: FINAL_PRD_MARKDOWN,
      lifecycle: "final",
      snapshots: [FINAL_PRD_SNAPSHOT],
    },
  },
  {
    id: "nueva-version",
    name: "Nueva versión",
    kind: "conversation",
    messages: [{ role: "agent", content: "Hay una nueva versión editable preparada en este escenario." }],
    responses: ["La versión anterior permanece como referencia inmutable."],
    documentState: {
      prdMarkdown: FINAL_PRD_MARKDOWN,
      lifecycle: "draft",
      snapshots: [FINAL_PRD_SNAPSHOT],
    },
  },
  {
    id: "recomendacion-de-otro-prd",
    name: "Recomendación de crear otro PRD",
    kind: "conversation",
    messages: [{ role: "agent", content: "La demostración recomienda crear otro PRD, pero no lo hará sin confirmación." }],
    responses: ["La recomendación no ejecuta ninguna acción automáticamente."],
  },
  {
    id: "respuesta-interrumpida",
    name: "Respuesta de demostración interrumpida",
    kind: "error",
    messages: [],
    responses: [],
    error: {
      description: "No se pudo completar la respuesta de demostración. Tu contenido guardado no cambió.",
      recoveryLabel: "Reintentar respuesta",
      recovery: {
        kind: "append-message",
        content: "La respuesta fija de demostración se completó correctamente.",
      },
    },
  },
  {
    id: "escenario-no-disponible",
    name: "Escenario no disponible",
    kind: "error",
    messages: [],
    responses: [],
    error: {
      description: "No se pudo cargar el escenario de demostración. Tu contenido guardado no cambió.",
      recoveryLabel: "Volver al Chat",
      recovery: { kind: "return-to-chat" },
    },
  },
  {
    id: "estados-de-sincronizacion",
    name: "Estados de sincronización",
    kind: "conversation",
    messages: [{ role: "agent", content: "La sincronización de demostración puede mostrar cambios sin sincronizar, sincronizando, sincronizado o error." }],
    responses: ["Estos estados son locales y no contactan ningún repositorio."],
    documentState: { syncState: "unsynced" },
  },
] as const satisfies readonly DemoScenario[];

export const DEFAULT_DEMO_SCENARIO_ID: DemoScenarioId = "conversacion-vacia";

export function getDemoScenario(id: DemoScenarioId | string): DemoScenario {
  return DEMO_SCENARIOS.find((scenario) => scenario.id === id)
    ?? DEMO_SCENARIOS[0];
}

export function isDemoErrorScenario(
  id: DemoScenarioId,
): id is DemoErrorScenarioId {
  return getDemoScenario(id).kind === "error";
}

const selectedBranch = (
  workspace: WorkspaceState,
  selection: ActiveSelection,
) => {
  const project = workspace.projects.find(({ id }) => id === selection.projectId);
  const prd = project?.prds.find(({ id }) => id === selection.prdId);
  const chat = prd?.chats.find(({ id }) => id === selection.chatId);
  return project && prd && chat ? { project, prd, chat } : null;
};

const fixtureMessages = (scenario: DemoScenario): ChatMessage[] =>
  scenario.messages.map((message, index) => ({
    id: `demo-${scenario.id}-${index + 1}`,
    ...message,
  }));

export function demoScenarioWouldReplaceConfirmedState(
  workspace: WorkspaceState,
  selection: ActiveSelection,
  scenarioId: DemoScenarioId,
): boolean {
  const branch = selectedBranch(workspace, selection);
  const scenario = getDemoScenario(scenarioId);
  if (!branch || scenario.kind === "error") return false;
  const documentState = scenario.documentState;
  return branch.chat.messages.length > 0
    || branch.chat.scenarioId !== null
    || branch.chat.scenarioStep > 0
    || (documentState?.prdMarkdown !== undefined
      && documentState.prdMarkdown !== branch.prd.document.markdown)
    || (documentState?.lifecycle !== undefined
      && documentState.lifecycle !== branch.prd.lifecycle)
    || (documentState?.findings !== undefined
      && JSON.stringify(documentState.findings) !== JSON.stringify(branch.prd.findings))
    || (documentState?.proposals !== undefined
      && JSON.stringify(documentState.proposals) !== JSON.stringify(branch.prd.proposals))
    || (documentState?.snapshots !== undefined
      && JSON.stringify(documentState.snapshots) !== JSON.stringify(branch.prd.snapshots))
    || (documentState?.syncState !== undefined
      && documentState.syncState !== workspace.syncState);
}

const copySnapshots = (snapshots: readonly PrdSnapshot[]): PrdSnapshot[] =>
  snapshots.map((snapshot) => ({ ...snapshot }));

const stateForScenario = (
  scenario: DemoConversationScenario,
  prd: Prd,
): DemoScenarioDocumentState | undefined => {
  if (prd.lifecycle !== "final") return scenario.documentState;

  const snapshots = prd.snapshots.length > 0
    ? copySnapshots(prd.snapshots)
    : [{
        id: `demo-${prd.id}-snapshot-1`,
        version: 1,
        markdown: prd.document.markdown,
      }];

  if (scenario.id === "nueva-version") {
    return {
      ...scenario.documentState,
      prdMarkdown: snapshots.at(-1)!.markdown,
      lifecycle: "draft",
      snapshots,
    };
  }

  return {
    ...scenario.documentState,
    prdMarkdown: prd.document.markdown,
    lifecycle: "final",
    findings: prd.findings,
    proposals: prd.proposals,
    snapshots,
  };
};

export function loadDemoScenario(
  workspace: WorkspaceState,
  selection: ActiveSelection,
  scenarioId: DemoScenarioId,
): WorkspaceState {
  const branch = selectedBranch(workspace, selection);
  const scenario = getDemoScenario(scenarioId);
  if (!branch || !isChatAvailable(branch.prd, branch.chat) || scenario.kind === "error") return workspace;
  const documentState = stateForScenario(scenario, branch.prd);

  return {
    ...workspace,
    projects: workspace.projects.map((project) =>
      project.id !== selection.projectId
        ? project
        : {
            ...project,
            prds: project.prds.map((prd) =>
              prd.id !== selection.prdId
                ? prd
                : {
                    ...prd,
                    lifecycle: documentState?.lifecycle ?? prd.lifecycle,
                    document: documentState?.prdMarkdown === undefined
                      ? prd.document
                      : { markdown: documentState.prdMarkdown },
                    findings: documentState?.findings
                      ? documentState.findings.map((finding) => ({ ...finding }))
                      : prd.findings,
                    proposals: documentState?.proposals
                      ? documentState.proposals.map((proposal) => ({ ...proposal }))
                      : prd.proposals,
                    snapshots: documentState?.snapshots
                      ? copySnapshots(documentState.snapshots)
                      : prd.snapshots,
                    chats: prd.chats.map((chat) =>
                      chat.id !== selection.chatId
                        ? chat
                        : {
                            ...chat,
                            messages: fixtureMessages(scenario),
                            scenarioId,
                            scenarioStep: 0,
                          }),
                  },
            ),
          },
    ),
    syncState: documentState?.syncState ?? workspace.syncState,
  };
}

const nextMessageId = (messages: ChatMessage[]): string => {
  const ids = new Set(messages.map(({ id }) => id));
  let index = 1;
  while (ids.has(`message-${index}`)) index += 1;
  return `message-${index}`;
};

export function advanceDemoConversation(
  workspace: WorkspaceState,
  selection: ActiveSelection,
  content: string,
): WorkspaceState {
  const normalizedContent = content.trim();
  const branch = selectedBranch(workspace, selection);
  if (!normalizedContent || !branch || !isChatAvailable(branch.prd, branch.chat)) return workspace;
  const persistedScenarioId = branch.chat.scenarioId ?? DEFAULT_DEMO_SCENARIO_ID;
  const scenario = getDemoScenario(persistedScenarioId);
  const scenarioId = scenario.id;
  if (scenario.kind === "error") return workspace;
  const response = scenario.responses[
    Math.min(branch.chat.scenarioStep, scenario.responses.length - 1)
  ];
  const userId = nextMessageId(branch.chat.messages);
  const messages: ChatMessage[] = [
    ...branch.chat.messages,
    { id: userId, role: "user", content: normalizedContent },
  ];
  if (response) {
    messages.push({
      id: nextMessageId(messages),
      role: "agent",
      content: response,
    });
  }

  return {
    ...workspace,
    projects: workspace.projects.map((project) =>
      project.id !== selection.projectId
        ? project
        : {
            ...project,
            prds: project.prds.map((prd) =>
              prd.id !== selection.prdId
                ? prd
                : {
                    ...prd,
                    chats: prd.chats.map((chat) =>
                      chat.id !== selection.chatId
                        ? chat
                        : {
                            ...chat,
                            messages,
                            scenarioId,
                            scenarioStep: chat.scenarioStep + 1,
                          }),
                  },
            ),
          },
    ),
    syncState: "unsynced",
  };
}

export function recoverDemoError(
  workspace: WorkspaceState,
  selection: ActiveSelection,
  scenarioId: DemoErrorScenarioId,
): WorkspaceState {
  const scenario = getDemoScenario(scenarioId);
  if (scenario.kind !== "error" || scenario.error.recovery.kind === "return-to-chat") {
    return workspace;
  }
  const branch = selectedBranch(workspace, selection);
  if (!branch || !isChatAvailable(branch.prd, branch.chat)) return workspace;
  const messages = [
    ...branch.chat.messages,
    {
      id: nextMessageId(branch.chat.messages),
      role: "agent" as const,
      content: scenario.error.recovery.content,
    },
  ];

  return {
    ...workspace,
    projects: workspace.projects.map((project) =>
      project.id !== selection.projectId
        ? project
        : {
            ...project,
            prds: project.prds.map((prd) =>
              prd.id !== selection.prdId
                ? prd
                : {
                    ...prd,
                    chats: prd.chats.map((chat) =>
                      chat.id === selection.chatId ? { ...chat, messages } : chat,
                    ),
                  },
            ),
          },
    ),
  };
}
