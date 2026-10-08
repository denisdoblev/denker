import {
  advanceDemoConversation,
  DEMO_SCENARIOS,
  type DemoScenarioId,
  demoScenarioWouldReplaceConfirmedState,
  isDemoErrorScenario,
  loadDemoScenario,
  recoverDemoError,
} from "./demo-scenarios";
import { createEmptyWorkspace, createProject, type WorkspaceState } from "./workspace";

const createdWorkspace = () => createProject(createEmptyWorkspace(), "Atlas");

const expectedScenarioStates: readonly [
  DemoScenarioId,
  (workspace: WorkspaceState) => void,
][] = [
  ["conversacion-vacia", (workspace) => {
    expect(workspace.projects[0].prds[0].chats[0].messages).toEqual([]);
  }],
  ["pregunta-del-agente", (workspace) => {
    expect(workspace.projects[0].prds[0].chats[0].messages[0]?.content)
      .toBe("¿Qué problema quieres resolver y para quién?");
  }],
  ["respuesta-del-usuario", (workspace) => {
    expect(workspace.projects[0].prds[0].chats[0].messages.at(-1)).toMatchObject({
      role: "user",
      content: "Quiero aclarar el alcance del producto.",
    });
  }],
  ["prd-actualizado", (workspace) => {
    expect(workspace.projects[0].prds[0].document.markdown)
      .toContain("Validar el flujo local de discovery.");
  }],
  ["cambio-pendiente-de-aprobacion", (workspace) => {
    expect(workspace.projects[0].prds[0].proposals.map(({ category, resolution }) => ({ category, resolution }))).toEqual([
      { category: "remove-requirement", resolution: "pending" },
      { category: "change-decision", resolution: "pending" },
      { category: "change-scope", resolution: "pending" },
      { category: "destructive", resolution: "pending" },
    ]);
  }],
  ["propuesta-de-cambio-de-product-context", (workspace) => {
    expect(workspace.projects[0].prds[0].proposals).toEqual([
      expect.objectContaining({ category: "change-product-context", resolution: "pending" }),
    ]);
    expect(workspace.projects[0].productContext.markdown).toContain("TBD");
  }],
  ["review-con-warnings", (workspace) => {
    expect(workspace.projects[0].prds[0]).toMatchObject({
      lifecycle: "review",
      findings: [expect.objectContaining({ kind: "warning", resolved: false })],
    });
  }],
  ["prd-finalizado", (workspace) => {
    const prd = workspace.projects[0].prds[0];
    expect(prd.lifecycle).toBe("final");
    expect(prd.snapshots).toHaveLength(1);
    expect(prd.snapshots[0].markdown).toBe(prd.document.markdown);
  }],
  ["nueva-version", (workspace) => {
    const prd = workspace.projects[0].prds[0];
    expect(prd.lifecycle).toBe("draft");
    expect(prd.snapshots).toHaveLength(1);
    expect(prd.document.markdown).toBe(prd.snapshots[0].markdown);
  }],
  ["recomendacion-de-otro-prd", (workspace) => {
    expect(workspace.projects[0].prds).toHaveLength(1);
    expect(workspace.projects[0].prds[0].chats[0].messages[0]?.content)
      .toContain("recomienda crear otro PRD");
  }],
  ["respuesta-interrumpida", (workspace) => {
    expect(workspace).toEqual(createdWorkspace());
  }],
  ["escenario-no-disponible", (workspace) => {
    expect(workspace).toEqual(createdWorkspace());
  }],
  ["estados-de-sincronizacion", (workspace) => {
    expect(workspace.syncState).toBe("unsynced");
  }],
];

describe("deterministic Demo Mode scenarios", () => {
  it("exposes the complete approved catalog with Spanish display names", () => {
    expect(DEMO_SCENARIOS.map(({ name }) => name)).toEqual([
      "Conversación vacía",
      "Pregunta del agente",
      "Respuesta del usuario",
      "PRD actualizado",
      "Cambio pendiente de aprobación",
      "Propuesta de cambio de Product Context",
      "Revisión con advertencias",
      "PRD finalizado",
      "Nueva versión",
      "Recomendación de crear otro PRD",
      "Respuesta de demostración interrumpida",
      "Escenario no disponible",
      "Estados de sincronización",
    ]);
  });

  it.each(DEMO_SCENARIOS)(
    "loads $name repeatably from the same starting state",
    ({ id, kind }) => {
      const workspace = createdWorkspace();
      const selection = workspace.activeSelection!;

      const first = loadDemoScenario(workspace, selection, id);
      const second = loadDemoScenario(workspace, selection, id);

      expect(first).toEqual(second);
      if (kind === "conversation") {
        expect(first.projects[0].prds[0].chats[0].scenarioId).toBe(id);
      } else {
        expect(first).toBe(workspace);
      }
    },
  );

  it.each(expectedScenarioStates)(
    "%s establishes its declared observable starting state",
    (id, assertExpectedState) => {
      const workspace = createdWorkspace();
      const loaded = loadDemoScenario(workspace, workspace.activeSelection!, id);

      assertExpectedState(loaded);
      if (!isDemoErrorScenario(id)) {
        expect(loaded.projects[0].prds[0].chats[0].scenarioId).toBe(id);
      }
    },
  );

  it.each(DEMO_SCENARIOS.filter(({ kind }) => kind === "error"))(
    "$name activation does not replace confirmed workspace state",
    ({ id }) => {
      const workspace = createdWorkspace();
      expect(loadDemoScenario(workspace, workspace.activeSelection!, id)).toBe(workspace);
    },
  );

  it("uses message presence, not message meaning, to choose the fixed transition", () => {
    const workspace = createdWorkspace();
    const selection = workspace.activeSelection!;

    const first = advanceDemoConversation(workspace, selection, "Una idea");
    const second = advanceDemoConversation(workspace, selection, "Contenido totalmente distinto");
    const firstChat = first.projects[0].prds[0].chats[0];
    const secondChat = second.projects[0].prds[0].chats[0];

    expect(firstChat.messages.at(-1)).toEqual(secondChat.messages.at(-1));
    expect(firstChat.scenarioStep).toBe(1);
    expect(secondChat.scenarioStep).toBe(1);
    expect(advanceDemoConversation(workspace, selection, "   \n ")).toBe(workspace);
  });

  it("detects replacement of confirmed scenario state before loading", () => {
    const workspace = createdWorkspace();
    const selection = workspace.activeSelection!;
    const advanced = advanceDemoConversation(workspace, selection, "Mensaje confirmado");

    expect(
      demoScenarioWouldReplaceConfirmedState(
        advanced,
        selection,
        "pregunta-del-agente",
      ),
    ).toBe(true);
  });

  it("preserves a final snapshot when another scenario is loaded and starts a new version from it", () => {
    const workspace = createdWorkspace();
    const selection = workspace.activeSelection!;
    const finalized = loadDemoScenario(workspace, selection, "prd-finalizado");
    const finalPrd = finalized.projects[0].prds[0];

    const attemptedUpdate = loadDemoScenario(finalized, selection, "prd-actualizado");
    expect(attemptedUpdate.projects[0].prds[0]).toMatchObject({
      lifecycle: "final",
      document: finalPrd.document,
      snapshots: finalPrd.snapshots,
    });

    const nextVersion = loadDemoScenario(finalized, selection, "nueva-version");
    const nextPrd = nextVersion.projects[0].prds[0];
    expect(nextPrd.lifecycle).toBe("draft");
    expect(nextPrd.snapshots).toEqual(finalPrd.snapshots);
    expect(nextPrd.document.markdown).toBe(finalPrd.snapshots[0].markdown);
  });

  it.each(DEMO_SCENARIOS.filter((scenario) => scenario.kind === "error"))(
    "$name declares repeatable recovery without changing the last confirmed document",
    (scenario) => {
      const workspace = createdWorkspace();
      const selection = workspace.activeSelection!;
      const advanced = advanceDemoConversation(workspace, selection, "Mensaje confirmado");
      const confirmedDocument = advanced.projects[0].prds[0].document;

      const first = recoverDemoError(advanced, selection, scenario.id);
      const second = recoverDemoError(advanced, selection, scenario.id);

      expect(first).toEqual(second);
      expect(first.projects[0].prds[0].document).toBe(confirmedDocument);
      if (scenario.error.recovery.kind === "append-message") {
        expect(first.projects[0].prds[0].chats[0].messages.at(-1)?.content)
          .toBe(scenario.error.recovery.content);
      } else {
        expect(first).toBe(advanced);
      }
    },
  );

  it("identifies only the two approved error fixtures", () => {
    expect(DEMO_SCENARIOS.filter(({ id }) => isDemoErrorScenario(id)).map(({ id }) => id))
      .toEqual(["respuesta-interrumpida", "escenario-no-disponible"]);
  });
});
