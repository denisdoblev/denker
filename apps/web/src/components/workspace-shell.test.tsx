import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useEffect, type RefObject } from "react";
import { renderToString } from "react-dom/server";

import { addUserMessage, applyPrdFixtureMarkdown, changeGuidedChatProgress, createChat, createEmptyWorkspace, createProject, decodeWorkspaceEnvelope, encodeWorkspaceEnvelope, selectChat, startPrdReview, type ProposalCategory, type SyncState, type WorkspaceState } from "@/domain/workspace";
import { DEMO_SCENARIOS } from "@/domain/demo-scenarios";
import {
  BrowserWorkspacePersistence,
  MemoryWorkspacePersistence,
} from "@/persistence/workspace-persistence";
import { WorkspaceProvider, useWorkspace } from "@/store/workspace-store";
import { createDemoSyncScenario } from "@/sync/demo-sync";

import { WorkspaceShell, WorkspaceSurface } from "./workspace-shell";

function WorkspaceProbe() {
  const { hydrationStatus, replaceWorkspace, workspace } = useWorkspace();

  if (hydrationStatus === "loading") return <p>Loading probe</p>;
  if (hydrationStatus === "invalid") return <p>Invalid probe</p>;

  return (
    <div>
      <p>{workspace.syncState}</p>
      <button
        type="button"
        onClick={() =>
          replaceWorkspace({ ...workspace, syncState: "unsynced" })
        }
      >
        Change workspace
      </button>
    </div>
  );
}

const markdownWorkspace = (): WorkspaceState => ({
  projects: [{
    id: "project-docs",
    name: "Atlas",
    productContext: { markdown: "# Contexto flexible\n\nPregunta abierta: ¿para quién?" },
    repository: null,
    prds: [{
      id: "prd-docs",
      title: "PRD 001",
      lifecycle: "draft",
      document: {
        markdown: "# PRD flexible\n\nTBD\n\n> Warning: falta decidir\n\nhttps://example.com/una/ruta/muy/larga/que/debe/poder/ajustarse\n\n```ts\nconst seguro = true\n```\n\n| Estado | Valor |\n| --- | --- |\n| Abierto | TBD |\n\n<script>window.unsafe = true</script>",
      },
      chats: [
        { id: "chat-1", title: "Chat 1", kind: "additional", phase: null, progress: null, messages: [], scenarioId: null, scenarioStep: 0 },
        { id: "chat-2", title: "Chat 2", kind: "additional", phase: null, progress: null, messages: [], scenarioId: null, scenarioStep: 0 },
      ],
      snapshots: [{ id: "snapshot-1", version: 1, markdown: "# PRD final\n\nContenido inmutable" }],
      findings: [],
      proposals: [],
    }, {
      id: "prd-atlas-second",
      title: "PRD 002",
      lifecycle: "draft",
      document: { markdown: "# Segundo PRD de Atlas" },
      chats: [{ id: "chat-atlas-second", title: "Chat Atlas PRD 002", kind: "additional", phase: null, progress: null, messages: [], scenarioId: "scenario-atlas", scenarioStep: 1 }],
      snapshots: [],
      findings: [],
      proposals: [],
    }],
  }, {
    id: "project-boreal",
    name: "Boreal",
    productContext: { markdown: "# Contexto Boreal" },
    repository: null,
    prds: [{
      id: "prd-boreal",
      title: "PRD 003",
      lifecycle: "draft",
      document: { markdown: "# PRD de Boreal" },
      chats: [{ id: "chat-boreal", title: "Chat Boreal", kind: "additional", phase: null, progress: null, messages: [], scenarioId: "scenario-boreal", scenarioStep: 0 }],
      snapshots: [],
      findings: [],
      proposals: [],
    }],
  }],
  activeSelection: { projectId: "project-docs", prdId: "prd-docs", chatId: "chat-1" },
  syncState: "synced",
});

const configuredSyncWorkspace = (syncState: SyncState): WorkspaceState => {
  const workspace = markdownWorkspace();
  return {
    ...workspace,
    projects: workspace.projects.map((project, index) => index === 0
      ? {
          ...project,
          repository: {
            provider: "GitHub",
            ownerOrOrganization: "denker",
            repository: "atlas",
            branch: "main",
            documentationPath: "/docs",
          },
        }
      : project),
    syncState,
  };
};

const persistedWorkspace = (persistence: MemoryWorkspacePersistence): WorkspaceState => {
  const decoded = decodeWorkspaceEnvelope(persistence.inspectRawValue() ?? "");
  if (decoded.status !== "valid") throw new Error("Expected a persisted workspace");
  return decoded.workspace;
};

const persistedPrdMarkdown = (persistence: MemoryWorkspacePersistence): string =>
  persistedWorkspace(persistence).projects[0].prds[0].document.markdown;

const proposalCategories = [
  "remove-requirement",
  "change-decision",
  "change-scope",
  "change-product-context",
  "destructive",
] as const satisfies readonly ProposalCategory[];

const workspaceWithProposal = (category: ProposalCategory): WorkspaceState => {
  const workspace = markdownWorkspace();
  workspace.projects[0].prds[0].proposals = [{
    id: `proposal-${category}`,
    category,
    proposedMarkdown: `# Propuesta aplicada: ${category}`,
    resolution: "pending",
  }];
  return workspace;
};

const installViewport = (width: number): (() => void) => {
  const original = window.matchMedia;
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: jest.fn((query: string) => {
      const minimum = /min-width:\s*(\d+)px/.exec(query)?.[1];
      const matches = minimum ? width >= Number(minimum) : false;
      return {
        matches,
        media: query,
        onchange: null,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        addListener: jest.fn(),
        removeListener: jest.fn(),
        dispatchEvent: jest.fn(() => true),
      } satisfies MediaQueryList;
    }),
  });
  return () => {
    if (original) Object.defineProperty(window, "matchMedia", { configurable: true, value: original });
    else Reflect.deleteProperty(window, "matchMedia");
  };
};

function WorkspaceFixtureUpdater({ markdown, updaterRef }: { markdown: string; updaterRef: RefObject<(() => void) | null> }) {
  const { replaceWorkspace, workspace } = useWorkspace();
  useEffect(() => {
    updaterRef.current = () => replaceWorkspace(applyPrdFixtureMarkdown(
      workspace,
      "project-docs",
      "prd-docs",
      markdownWorkspace().projects[0].prds[0].document.markdown,
      markdown,
    ));
    return () => { updaterRef.current = null; };
  }, [markdown, replaceWorkspace, updaterRef, workspace]);
  return null;
}

describe("WorkspaceShell", () => {
  it("renders the neutral loading shell before browser hydration", () => {
    expect(renderToString(<WorkspaceShell />)).toContain(
      "Cargando espacio de trabajo local",
    );
  });

  it("resolves to the local workspace after hydration", async () => {
    render(<WorkspaceShell persistence={new MemoryWorkspacePersistence()} />);

    expect(await screen.findByRole("heading", { name: "Convierte una idea en contexto claro" })).toBeInTheDocument();
  });

  it("muestra navegación, Chat y documentos simultáneos a 1440 px", async () => {
    const restoreViewport = installViewport(1440);
    try {
      const user = userEvent.setup();
      render(<WorkspaceShell persistence={new MemoryWorkspacePersistence(encodeWorkspaceEnvelope(markdownWorkspace()))} />);

      expect(await screen.findByRole("complementary", { name: "Navegación del espacio de trabajo" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Abrir navegación" })).not.toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Abrir documentos" }));

      expect(screen.getByRole("complementary", { name: "Documentos compartidos" })).toBeInTheDocument();
      expect(screen.queryByRole("dialog", { name: "Documentos compartidos" })).not.toBeInTheDocument();
      expect(screen.getByRole("textbox", { name: "Mensaje" })).toBeInTheDocument();
      expect(screen.getByRole("combobox", { name: "Documento" })).toHaveFocus();
    } finally {
      restoreViewport();
    }
  });

  it("usa rail de navegación y documentos modales a 768 px con restauración de foco", async () => {
    const restoreViewport = installViewport(768);
    try {
      const user = userEvent.setup();
      render(<WorkspaceShell persistence={new MemoryWorkspacePersistence(encodeWorkspaceEnvelope(markdownWorkspace()))} />);

      const navigationTrigger = await screen.findByRole("button", { name: "Abrir navegación" });
      expect(screen.getByRole("complementary", { name: "Navegación contraída" })).toBeInTheDocument();
      expect(screen.queryByRole("navigation", { name: "Projects, PRDs y Chats" })).not.toBeInTheDocument();
      await user.click(navigationTrigger);
      const navigationSheet = screen.getByRole("dialog", { name: "Navegación" });
      expect(within(navigationSheet).getByRole("navigation", { name: "Projects, PRDs y Chats" })).toBeInTheDocument();
      await user.keyboard("{Escape}");
      expect(screen.queryByRole("dialog", { name: "Navegación" })).not.toBeInTheDocument();
      expect(navigationTrigger).toHaveFocus();

      const documentsTrigger = screen.getByRole("button", { name: "Abrir documentos" });
      await user.click(documentsTrigger);
      expect(screen.getByRole("dialog", { name: "Documentos compartidos" })).toBeInTheDocument();
      await waitFor(() => expect(screen.getByRole("combobox", { name: "Documento" })).toHaveFocus());
      await user.keyboard("{Escape}");
      expect(screen.queryByRole("dialog", { name: "Documentos compartidos" })).not.toBeInTheDocument();
      expect(documentsTrigger).toHaveFocus();
    } finally {
      restoreViewport();
    }
  });

  it("mantiene Chat persistente y sheets excluyentes a 390 px sin perder un borrador con Escape", async () => {
    const restoreViewport = installViewport(390);
    try {
      const user = userEvent.setup();
      render(<WorkspaceShell persistence={new MemoryWorkspacePersistence(encodeWorkspaceEnvelope(markdownWorkspace()))} />);

      expect(await screen.findByRole("textbox", { name: "Mensaje" })).toBeInTheDocument();
      expect(screen.queryByRole("complementary", { name: "Navegación contraída" })).not.toBeInTheDocument();
      const navigationTrigger = screen.getByRole("button", { name: "Abrir navegación" });
      await user.click(navigationTrigger);
      const navigationSheet = screen.getByRole("dialog", { name: "Navegación" });
      expect(navigationSheet).toBeInTheDocument();
      expect(screen.queryByRole("dialog", { name: "Documentos compartidos" })).not.toBeInTheDocument();
      await user.click(within(navigationSheet).getByRole("button", { name: "Chat 2" }));
      expect(await screen.findByRole("heading", { name: "Chat 2" })).toHaveFocus();
      expect(screen.queryByRole("dialog", { name: "Navegación" })).not.toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Abrir documentos" }));
      expect(screen.getByRole("dialog", { name: "Documentos compartidos" })).toBeInTheDocument();
      expect(screen.queryByRole("dialog", { name: "Navegación" })).not.toBeInTheDocument();
      await user.click(screen.getByRole("tab", { name: "Editar" }));
      await user.type(screen.getByRole("textbox", { name: "Fuente Markdown" }), "\nBorrador móvil");
      await user.keyboard("{Escape}");
      expect(screen.getByRole("dialog", { name: "¿Descartar cambios sin guardar?" })).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Seguir editando" }));
      expect((screen.getByRole("textbox", { name: "Fuente Markdown" }) as HTMLTextAreaElement).value).toContain("Borrador móvil");
      expect(screen.getByRole("dialog", { name: "Documentos compartidos" })).toBeInTheDocument();
    } finally {
      restoreViewport();
    }
  });

  it("does not flash workspace content before persistence resolves", async () => {
    let resolveLoad: ((value: { status: "valid"; workspace: WorkspaceState }) => void) | undefined;
    const persistence = {
      load: jest.fn(
        () =>
          new Promise<{ status: "valid"; workspace: WorkspaceState }>((resolve) => {
            resolveLoad = resolve;
          }),
      ),
      save: jest.fn(async () => undefined),
      reset: jest.fn(async () => undefined),
    };

    render(<WorkspaceShell persistence={persistence} />);
    expect(screen.getByText("Cargando espacio de trabajo local")).toBeInTheDocument();
    expect(screen.queryByText("Convierte una idea en contexto claro")).not.toBeInTheDocument();

    await act(async () => {
      resolveLoad?.({ status: "valid", workspace: createEmptyWorkspace() });
    });

    expect(
      await screen.findByRole("heading", { name: "Convierte una idea en contexto claro" }),
    ).toBeInTheDocument();
  });

  it("preserves changes across a simulated reload without presentation access to localStorage", async () => {
    const user = userEvent.setup();
    const persistence = new MemoryWorkspacePersistence();
    const localStorageRead = jest.spyOn(Storage.prototype, "getItem");
    const firstRender = render(
      <WorkspaceProvider persistence={persistence}>
        <WorkspaceProbe />
      </WorkspaceProvider>,
    );

    await user.click(await screen.findByRole("button", { name: "Change workspace" }));
    await waitFor(() => expect(persistence.inspectRawValue()).toContain("unsynced"));
    firstRender.unmount();

    render(
      <WorkspaceProvider persistence={persistence}>
        <WorkspaceProbe />
      </WorkspaceProvider>,
    );

    expect(await screen.findByText("unsynced")).toBeInTheDocument();
    expect(localStorageRead).not.toHaveBeenCalled();
    localStorageRead.mockRestore();
  });

  it("restores the active guided flow, additional history and isolated Projects after reload without network", async () => {
    const previousFetch = globalThis.fetch;
    const fetchSpy = jest.fn().mockRejectedValue(new Error("sin red"));
    Object.defineProperty(globalThis, "fetch", { configurable: true, value: fetchSpy });
    try {
      let workspace = createProject(createEmptyWorkspace(), "Atlas");
      const atlas = workspace.projects[0];
      const atlasPrd = atlas.prds[0];
      workspace = startPrdReview(workspace, atlas.id, atlasPrd.id);
      const screenDesign = {
        projectId: atlas.id,
        prdId: atlasPrd.id,
        chatId: workspace.projects[0].prds[0].chats.find(({ phase }) => phase === "screen-design")!.id,
      };
      workspace = changeGuidedChatProgress(workspace, screenDesign, "ready");
      workspace = createChat(workspace, atlas.id, atlasPrd.id);
      const additional = workspace.activeSelection!;
      workspace = addUserMessage(workspace, additional, "Historia adicional restaurada");
      workspace = createProject(workspace, "Boreal");
      workspace = selectChat(workspace, additional);

      const persistence = new MemoryWorkspacePersistence(encodeWorkspaceEnvelope(workspace));
      const firstRender = render(<WorkspaceShell persistence={persistence} />);
      expect(await screen.findByText("Historia adicional restaurada")).toBeInTheDocument();
      firstRender.unmount();

      render(<WorkspaceShell persistence={persistence} />);
      expect(await screen.findByText("Atlas / PRD 001 / Chat adicional 1")).toBeInTheDocument();
      expect(screen.getByText("Historia adicional restaurada")).toBeInTheDocument();
      const atlasBranch = screen.getByRole("heading", { name: "Atlas" }).closest("section")!;
      const borealBranch = screen.getByRole("heading", { name: "Boreal" }).closest("section")!;
      expect(within(atlasBranch).getByRole("button", { name: "Diseño de pantallas. Listo para avanzar" })).toBeInTheDocument();
      expect(within(borealBranch).getByRole("button", { name: "Diseño de pantallas. Pendiente. Bloqueado. Mostrar requisitos" })).toBeInTheDocument();
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      if (previousFetch) {
        Object.defineProperty(globalThis, "fetch", { configurable: true, value: previousFetch });
      } else {
        Reflect.deleteProperty(globalThis, "fetch");
      }
    }
  });

  it("keeps a usable in-memory session when browser storage is unavailable", async () => {
    const user = userEvent.setup();
    const persistence = new BrowserWorkspacePersistence(() => ({
      getItem: () => {
        throw new Error("storage blocked");
      },
      setItem: () => {
        throw new Error("storage blocked");
      },
    }));
    const firstRender = render(
      <WorkspaceProvider persistence={persistence}>
        <WorkspaceProbe />
      </WorkspaceProvider>,
    );

    await user.click(await screen.findByRole("button", { name: "Change workspace" }));
    await waitFor(() => expect(screen.getByText("unsynced")).toBeInTheDocument());
    firstRender.unmount();

    render(
      <WorkspaceProvider persistence={persistence}>
        <WorkspaceProbe />
      </WorkspaceProvider>,
    );
    expect(await screen.findByText("unsynced")).toBeInTheDocument();
  });

  it("preserves invalid bytes on cancel and resets only after confirmation", async () => {
    const user = userEvent.setup();
    const persistence = new MemoryWorkspacePersistence("invalid bytes");
    render(<WorkspaceShell persistence={persistence} />);

    expect(
      await screen.findByRole("heading", {
        name: "Denker no pudo cargar este espacio de trabajo",
      }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Restablecer datos locales" }));
    const cancel = await screen.findByRole("button", { name: "Cancelar" });
    expect(cancel).toHaveFocus();
    await user.click(cancel);

    expect(persistence.inspectRawValue()).toBe("invalid bytes");
    expect(
      screen.getByRole("heading", {
        name: "Denker no pudo cargar este espacio de trabajo",
      }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Restablecer datos locales" }));
    const resetButtons = await screen.findAllByRole("button", {
      name: "Restablecer datos locales",
    });
    await user.click(resetButtons.at(-1)!);

    expect(
      await screen.findByRole("heading", { name: "Convierte una idea en contexto claro" }),
    ).toBeInTheDocument();
    expect(persistence.inspectRawValue()).toContain('"version":2');
    expect(persistence.inspectRawValue()).toContain('"projects":[]');
  });

  it("crea sólo con nombre, inicializa documentos con TBD y lleva el foco al composer", async () => {
    const user = userEvent.setup();
    render(<WorkspaceShell persistence={new MemoryWorkspacePersistence()} />);

    await user.click(await screen.findByRole("button", { name: "Crear Project" }));
    const name = screen.getByRole("textbox", { name: "Nombre del Project" });
    expect(name).toHaveFocus();
    const dialog = screen.getByRole("dialog", { name: "Crear Project" });
    expect(within(dialog).getByRole("button", { name: "Crear Project" })).toBeDisabled();
    await user.type(name, "Atlas");
    await user.click(within(dialog).getByRole("button", { name: "Crear Project" }));

    expect(await screen.findByText("Define esta iniciativa")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Mensaje" })).toHaveFocus();
    expect(screen.getByText(/Repositorio no conectado/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "PRD. Borrador" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByText("Recorrido guiado")).toBeInTheDocument();
    expect(screen.getByText("Chats adicionales")).toBeInTheDocument();
    for (const phase of [
      "Diseño de pantallas",
      "Diseño de base de datos",
      "Plan de implementación",
      "Implementación",
      "Pruebas y revisión",
    ]) {
      expect(screen.getByRole("button", { name: `${phase}. Pendiente. Bloqueado. Mostrar requisitos` })).toBeInTheDocument();
    }

    await user.click(screen.getByRole("button", { name: "Diseño de pantallas. Pendiente. Bloqueado. Mostrar requisitos" }));
    expect(screen.getByRole("button", { name: "PRD. Borrador" })).toHaveAttribute("aria-current", "page");

    await user.click(screen.getByRole("button", { name: "Abrir documentos" }));
    expect(screen.getByRole("heading", { name: "PRD 001" })).toBeInTheDocument();
    expect(screen.getAllByText("TBD").length).toBeGreaterThan(0);
    await user.selectOptions(screen.getByRole("combobox", { name: "Documento" }), "context");
    expect(screen.getByRole("heading", { name: "Contexto del producto: Atlas" })).toBeInTheDocument();
  });

  it("permite avanzar fases disponibles con progreso explícito y anuncia el desbloqueo", async () => {
    const user = userEvent.setup();
    const persistence = new MemoryWorkspacePersistence();
    render(<WorkspaceShell persistence={persistence} />);

    await user.click(await screen.findByRole("button", { name: "Crear Project" }));
    await user.type(screen.getByRole("textbox", { name: "Nombre del Project" }), "Atlas");
    await user.click(within(screen.getByRole("dialog", { name: "Crear Project" })).getByRole("button", { name: "Crear Project" }));
    expect(screen.queryByRole("combobox", { name: "Progreso de la fase" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Abrir documentos" }));
    await user.click(screen.getByRole("button", { name: "Iniciar revisión" }));
    await user.click(screen.getByRole("button", { name: "Cerrar" }));

    await user.click(screen.getByRole("button", { name: "Diseño de pantallas. Pendiente" }));
    const progress = screen.getByRole("combobox", { name: "Progreso de la fase" });
    expect(within(progress).getAllByRole("option").map(({ textContent }) => textContent)).toEqual([
      "Pendiente", "En curso", "Listo para avanzar", "No aplica",
    ]);
    await user.selectOptions(progress, "ready");
    expect(progress).toHaveFocus();

    await user.click(screen.getByRole("button", { name: "Diseño de base de datos. Pendiente" }));
    await user.selectOptions(screen.getByRole("combobox", { name: "Progreso de la fase" }), "not-applicable");
    expect(screen.getByText(/Plan de implementación ya está disponible/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Plan de implementación. Pendiente" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Plan de implementación. Pendiente" }));
    expect(within(screen.getByRole("combobox", { name: "Progreso de la fase" })).getAllByRole("option")).toHaveLength(3);
    await waitFor(() => expect(persistedWorkspace(persistence).syncState).toBe("unsynced"));
    expect(screen.queryByRole("button", { name: /Agregar fase|Eliminar fase|Configurar dependencias/ })).not.toBeInTheDocument();
  });

  it("explica bloqueos por teclado y conserva un Chat re-bloqueado como sólo lectura", async () => {
    const user = userEvent.setup();
    render(<WorkspaceShell persistence={new MemoryWorkspacePersistence()} />);

    await user.click(await screen.findByRole("button", { name: "Crear Project" }));
    await user.type(screen.getByRole("textbox", { name: "Nombre del Project" }), "Atlas");
    await user.click(within(screen.getByRole("dialog", { name: "Crear Project" })).getByRole("button", { name: "Crear Project" }));

    const blockedRow = screen.getByRole("button", { name: "Plan de implementación. Pendiente. Bloqueado. Mostrar requisitos" });
    blockedRow.focus();
    await user.keyboard("{Enter}");
    expect(blockedRow).toHaveFocus();
    expect(blockedRow).toHaveAttribute("aria-expanded", "true");
    expect(document.getElementById(blockedRow.getAttribute("aria-controls")!)).toHaveTextContent("El PRD debe estar En revisión o Final");
    expect(screen.getByRole("button", { name: "PRD. Borrador" })).toHaveAttribute("aria-current", "page");

    const implementationRow = screen.getByRole("button", { name: "Implementación. Pendiente. Bloqueado. Mostrar requisitos" });
    implementationRow.focus();
    await user.keyboard(" ");
    expect(implementationRow).toHaveFocus();
    expect(implementationRow).toHaveAttribute("aria-expanded", "true");
    expect(blockedRow).toHaveAttribute("aria-expanded", "false");

    await user.click(screen.getByRole("button", { name: "Abrir documentos" }));
    await user.click(screen.getByRole("button", { name: "Iniciar revisión" }));
    await user.click(screen.getByRole("button", { name: "Cerrar" }));
    await user.click(screen.getByRole("button", { name: "Diseño de pantallas. Pendiente" }));
    await user.type(screen.getByRole("textbox", { name: "Mensaje" }), "Historia conservada");
    await user.click(screen.getByRole("button", { name: "Enviar" }));

    await user.click(screen.getByRole("button", { name: "Abrir documentos" }));
    await user.click(screen.getByRole("button", { name: "Volver a borrador" }));
    await user.click(screen.getByRole("button", { name: "Cerrar" }));

    expect(screen.getByRole("button", { name: "Diseño de pantallas. Pendiente. Bloqueado. Mostrar requisitos" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("alert")).toHaveTextContent("Esta fase volvió a bloquearse");
    expect(screen.getByRole("log", { name: "Historial del Chat, sólo lectura" })).toHaveTextContent("Historia conservada");
    expect(screen.getByRole("button", { name: "Ir a PRD" })).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Progreso de la fase" })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Escenario" })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Mensaje" })).not.toBeInTheDocument();
  });

  it("mantiene el foco dentro de los diálogos y lo restaura al cerrar", async () => {
    const user = userEvent.setup();
    render(<WorkspaceShell persistence={new MemoryWorkspacePersistence()} />);

    const trigger = await screen.findByRole("button", { name: "Crear Project" });
    await user.click(trigger);

    const dialog = screen.getByRole("dialog", { name: "Crear Project" });
    expect(screen.getByRole("textbox", { name: "Nombre del Project" })).toHaveFocus();

    await user.tab({ shift: true });
    expect(within(dialog).getByRole("button", { name: "Cerrar" })).toHaveFocus();
    await user.tab({ shift: true });
    await waitFor(() => expect(within(dialog).getByRole("button", { name: "Cancelar" })).toHaveFocus());
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog", { name: "Crear Project" })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("aísla ramas e historiales al crear varios Projects y Chats", async () => {
    const user = userEvent.setup();
    render(<WorkspaceShell persistence={new MemoryWorkspacePersistence()} />);
    await user.click(await screen.findByRole("button", { name: "Crear Project" }));
    await user.type(screen.getByRole("textbox", { name: "Nombre del Project" }), "Atlas");
    await user.click(within(screen.getByRole("dialog", { name: "Crear Project" })).getByRole("button", { name: "Crear Project" }));
    await user.type(screen.getByRole("textbox", { name: "Mensaje" }), "Historia Atlas uno");
    await user.click(screen.getByRole("button", { name: "Enviar" }));
    await user.click(screen.getByRole("button", { name: "Nuevo Chat adicional en PRD 001 de Atlas" }));
    await user.type(screen.getByRole("textbox", { name: "Mensaje" }), "Historia Atlas dos");
    await user.click(screen.getByRole("button", { name: "Enviar" }));

    await user.click(screen.getByRole("button", { name: "Nuevo Project" }));
    await user.type(screen.getByRole("textbox", { name: "Nombre del Project" }), "Boreal");
    await user.click(within(screen.getByRole("dialog", { name: "Crear Project" })).getByRole("button", { name: "Crear Project" }));
    expect(screen.queryByText("Historia Atlas uno")).not.toBeInTheDocument();
    expect(screen.queryByText("Historia Atlas dos")).not.toBeInTheDocument();

    const composer = screen.getByRole("textbox", { name: "Mensaje" });
    expect(composer).toHaveValue("");
    await user.type(composer, "Borrador sin enviar de Boreal");

    const atlasBranch = screen.getByRole("heading", { name: "Atlas" }).closest("section")!;
    const atlasPrdChat = within(atlasBranch).getByRole("button", { name: "PRD. Borrador" });
    const atlasAdditionalChat = within(atlasBranch).getByRole("button", { name: "Chat adicional 1" });
    await user.click(atlasPrdChat);
    expect(screen.getByRole("textbox", { name: "Mensaje" })).toHaveValue("");
    expect(screen.queryByDisplayValue("Borrador sin enviar de Boreal")).not.toBeInTheDocument();
    expect(await screen.findByText("Historia Atlas uno")).toBeInTheDocument();
    expect(screen.queryByText("Historia Atlas dos")).not.toBeInTheDocument();
    expect(atlasPrdChat).toHaveAttribute("aria-current", "page");
    await user.click(screen.getByRole("button", { name: "Abrir documentos" }));
    expect(screen.getByRole("heading", { name: "PRD 001" })).toBeInTheDocument();
    await user.selectOptions(screen.getByRole("combobox", { name: "Documento" }), "context");
    expect(screen.getByRole("heading", { name: "Contexto del producto: Atlas" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(screen.getByRole("button", { name: "Abrir documentos" })).toHaveFocus();

    await user.click(atlasAdditionalChat);
    expect(await screen.findByText("Historia Atlas dos")).toBeInTheDocument();
    expect(screen.queryByText("Historia Atlas uno")).not.toBeInTheDocument();
    expect(atlasAdditionalChat).toHaveAttribute("aria-current", "page");
    await user.click(screen.getByRole("button", { name: "Abrir documentos" }));
    expect(screen.getByRole("heading", { name: "PRD 001" })).toBeInTheDocument();
    await user.selectOptions(screen.getByRole("combobox", { name: "Documento" }), "context");
    expect(screen.getByRole("heading", { name: "Contexto del producto: Atlas" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cerrar" }));

    const borealBranch = screen.getByRole("heading", { name: "Boreal" }).closest("section")!;
    await user.click(within(borealBranch).getByRole("button", { name: "PRD. Borrador" }));
    await user.click(screen.getByRole("button", { name: "Abrir documentos" }));
    expect(screen.getByRole("heading", { name: "PRD 001" })).toBeInTheDocument();
    await user.selectOptions(screen.getByRole("combobox", { name: "Documento" }), "context");
    expect(screen.getByRole("heading", { name: "Contexto del producto: Boreal" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Contexto del producto: Atlas" })).not.toBeInTheDocument();
  });

  it("expande y contrae ramas de Project y PRD de forma independiente", async () => {
    const user = userEvent.setup();
    render(<WorkspaceShell persistence={new MemoryWorkspacePersistence()} />);

    await user.click(await screen.findByRole("button", { name: "Crear Project" }));
    await user.type(screen.getByRole("textbox", { name: "Nombre del Project" }), "Atlas");
    await user.click(within(screen.getByRole("dialog", { name: "Crear Project" })).getByRole("button", { name: "Crear Project" }));
    await user.click(screen.getByRole("button", { name: "Nuevo Project" }));
    await user.type(screen.getByRole("textbox", { name: "Nombre del Project" }), "Boreal");
    await user.click(within(screen.getByRole("dialog", { name: "Crear Project" })).getByRole("button", { name: "Crear Project" }));

    const atlas = screen.getByRole("heading", { name: "Atlas" }).closest("section")!;
    const boreal = screen.getByRole("heading", { name: "Boreal" }).closest("section")!;
    const atlasProjectToggle = within(atlas).getByRole("button", { name: "Contraer Project Atlas" });
    const borealProjectToggle = within(boreal).getByRole("button", { name: "Contraer Project Boreal" });
    expect(atlasProjectToggle).toHaveAttribute("aria-expanded", "true");
    expect(borealProjectToggle).toHaveAttribute("aria-expanded", "true");

    await user.click(atlasProjectToggle);
    expect(document.getElementById(atlasProjectToggle.getAttribute("aria-controls")!)).toHaveAttribute("hidden");
    expect(within(boreal).getByText(/PRD 001/)).toBeInTheDocument();
    expect(within(boreal).getByRole("button", { name: "PRD. Borrador" })).toBeInTheDocument();

    const borealPrdToggle = within(boreal).getByRole("button", { name: "Contraer PRD 001 de Boreal" });
    expect(borealPrdToggle).toHaveAttribute("aria-controls");
    await user.click(borealPrdToggle);
    expect(within(boreal).queryByRole("button", { name: "PRD. Borrador" })).not.toBeInTheDocument();
    expect(within(atlas).queryByRole("button", { name: "PRD. Borrador" })).not.toBeInTheDocument();

    await user.click(within(atlas).getByRole("button", { name: "Expandir Project Atlas" }));
    expect(within(atlas).getByRole("button", { name: "PRD. Borrador" })).toBeInTheDocument();
    expect(within(boreal).queryByRole("button", { name: "PRD. Borrador" })).not.toBeInTheDocument();
  });

  it("mantiene el resumen y la configuración de repositorio en el Project propietario", async () => {
    const user = userEvent.setup();
    render(<WorkspaceShell persistence={new MemoryWorkspacePersistence()} />);

    await user.click(await screen.findByRole("button", { name: "Crear Project" }));
    await user.type(screen.getByRole("textbox", { name: "Nombre del Project" }), "Atlas");
    await user.click(within(screen.getByRole("dialog", { name: "Crear Project" })).getByRole("button", { name: "Crear Project" }));
    await user.click(screen.getByRole("button", { name: "Nuevo Project" }));
    await user.type(screen.getByRole("textbox", { name: "Nombre del Project" }), "Boreal");
    await user.click(within(screen.getByRole("dialog", { name: "Crear Project" })).getByRole("button", { name: "Crear Project" }));

    const atlas = screen.getByRole("heading", { name: "Atlas" }).closest("section")!;
    const boreal = screen.getByRole("heading", { name: "Boreal" }).closest("section")!;
    expect(within(atlas).getByText(/Repositorio no conectado/)).toBeInTheDocument();
    expect(within(boreal).getByText(/Repositorio no conectado/)).toBeInTheDocument();

    await user.click(within(atlas).getByRole("button", { name: "Configurar repositorio de Atlas" }));
    await user.type(screen.getByRole("textbox", { name: "Proveedor" }), "GitHub");
    await user.type(screen.getByRole("textbox", { name: "Propietario u organización" }), "denker");
    await user.type(screen.getByRole("textbox", { name: "Repositorio" }), "atlas-docs");
    await user.click(screen.getByRole("button", { name: "Guardar configuración" }));

    expect(within(atlas).getByText(/GitHub · denker\/atlas-docs · main · \/docs/)).toBeInTheDocument();
    expect(within(boreal).getByText(/Repositorio no conectado/)).toBeInTheDocument();
    expect(screen.getByText("Boreal / PRD 001 / PRD")).toBeInTheDocument();
  });

  it("configura después un repositorio local con defaults y sin controles de identidad", async () => {
    const user = userEvent.setup();
    const fetchSpy = jest.fn().mockRejectedValue(new Error("sin red"));
    Object.defineProperty(globalThis, "fetch", { configurable: true, value: fetchSpy });
    render(<WorkspaceShell persistence={new MemoryWorkspacePersistence()} />);
    await user.click(await screen.findByRole("button", { name: "Crear Project" }));
    await user.type(screen.getByRole("textbox", { name: "Nombre del Project" }), "Atlas");
    await user.click(within(screen.getByRole("dialog", { name: "Crear Project" })).getByRole("button", { name: "Crear Project" }));
    await user.click(screen.getByRole("button", { name: "Configurar repositorio de Atlas" }));

    expect(screen.getByText(/Sin credenciales ni conexión remota/)).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Rama" })).toHaveValue("main");
    expect(screen.getByRole("textbox", { name: "Ruta de documentación" })).toHaveValue("/docs");
    await user.type(screen.getByRole("textbox", { name: "Proveedor" }), "GitHub");
    await user.type(screen.getByRole("textbox", { name: "Propietario u organización" }), "denker");
    await user.type(screen.getByRole("textbox", { name: "Repositorio" }), "producto");
    await user.click(screen.getByRole("button", { name: "Guardar configuración" }));

    expect(screen.getByText(/GitHub · denker\/producto · main · \/docs/)).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /login|oauth|rol|permiso|conectar/i })).not.toBeInTheDocument();
    Reflect.deleteProperty(globalThis, "fetch");
  });

  it("mantiene el sync no disponible sin configuración de repositorio", async () => {
    render(
      <WorkspaceShell
        persistence={new MemoryWorkspacePersistence(encodeWorkspaceEnvelope(markdownWorkspace()))}
      />,
    );

    expect(await screen.findAllByText("Sincronización de demostración no disponible.")).toHaveLength(2);
    expect(screen.queryByRole("button", { name: /Sincronizar ahora/ })).not.toBeInTheDocument();
  });

  it.each([
    ["synced", "Sincronizado", false],
    ["unsynced", "Cambios sin sincronizar", false],
    ["syncing", "Sincronizando", true],
    ["failed", "Error de sincronización", false],
  ] as const)(
    "distingue Guardado localmente del estado de sync %s",
    async (syncState, label, disabled) => {
      const user = userEvent.setup();
      render(
        <WorkspaceShell
          persistence={new MemoryWorkspacePersistence(
            encodeWorkspaceEnvelope(configuredSyncWorkspace(syncState)),
          )}
        />,
      );

      await user.click(await screen.findByRole("button", { name: "Abrir documentos" }));

      expect(screen.getByText("Guardado localmente")).toBeInTheDocument();
      expect(screen.getByText(label)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Sincronizar ahora Atlas" }))
        .toHaveProperty("disabled", disabled);
    },
  );

  it("marca cambios sin sincronizar después de guardar contenido local confirmado", async () => {
    const user = userEvent.setup();
    const persistence = new MemoryWorkspacePersistence(
      encodeWorkspaceEnvelope(configuredSyncWorkspace("synced")),
    );
    render(<WorkspaceShell persistence={persistence} />);

    await user.click(await screen.findByRole("button", { name: "Abrir documentos" }));
    await user.click(screen.getByRole("tab", { name: "Editar" }));
    const editor = screen.getByRole("textbox", { name: "Fuente Markdown" });
    await user.clear(editor);
    await user.type(editor, "# Guardado local confirmado");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(screen.getByText("Guardado localmente")).toBeInTheDocument();
    expect(screen.getByText("Cambios sin sincronizar")).toBeInTheDocument();
    await waitFor(() => expect(persistedWorkspace(persistence).syncState).toBe("unsynced"));
    expect(persistedPrdMarkdown(persistence)).toBe("# Guardado local confirmado");
  });

  it("recorre Unsynced → Syncing → Synced sin red ni mutación documental", async () => {
    jest.useFakeTimers();
    const previousFetch = globalThis.fetch;
    const fetchSpy = jest.fn().mockRejectedValue(new Error("sin red"));
    Object.defineProperty(globalThis, "fetch", { configurable: true, value: fetchSpy });
    try {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      const initial = configuredSyncWorkspace("unsynced");
      const expectedMarkdown = initial.projects[0].prds[0].document.markdown;
      const persistence = new MemoryWorkspacePersistence(encodeWorkspaceEnvelope(initial));
      render(
        <WorkspaceShell
          persistence={persistence}
          demoSync={createDemoSyncScenario("synced", 500)}
        />,
      );
      await act(async () => { await Promise.resolve(); });

      const syncButton = screen.getByRole("button", { name: "Sincronizar ahora Atlas" });
      await user.click(syncButton);
      expect(screen.getByText("Sincronizando")).toBeInTheDocument();
      expect(syncButton).toBeDisabled();

      await act(async () => { jest.advanceTimersByTime(500); });

      expect(screen.getByText("Sincronizado")).toBeInTheDocument();
      expect(syncButton).toBeEnabled();
      expect(persistedPrdMarkdown(persistence)).toBe(expectedMarkdown);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      if (previousFetch) {
        Object.defineProperty(globalThis, "fetch", { configurable: true, value: previousFetch });
      } else {
        Reflect.deleteProperty(globalThis, "fetch");
      }
      jest.useRealTimers();
    }
  });

  it("recorre Unsynced → Syncing → Failed y permite el reintento determinista", async () => {
    jest.useFakeTimers();
    const previousFetch = globalThis.fetch;
    const fetchSpy = jest.fn().mockRejectedValue(new Error("sin red"));
    Object.defineProperty(globalThis, "fetch", { configurable: true, value: fetchSpy });
    try {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      const initial = configuredSyncWorkspace("unsynced");
      const expectedMarkdown = initial.projects[0].prds[0].document.markdown;
      const persistence = new MemoryWorkspacePersistence(encodeWorkspaceEnvelope(initial));
      render(
        <WorkspaceShell
          persistence={persistence}
          demoSync={createDemoSyncScenario("failed", 500)}
        />,
      );
      await act(async () => { await Promise.resolve(); });

      const syncButton = screen.getByRole("button", { name: "Sincronizar ahora Atlas" });
      await user.click(syncButton);
      await act(async () => { jest.advanceTimersByTime(500); });
      expect(screen.getByText("Error de sincronización")).toBeInTheDocument();
      expect(syncButton).toBeEnabled();

      await user.click(syncButton);
      expect(screen.getByText("Sincronizando")).toBeInTheDocument();
      await act(async () => { jest.advanceTimersByTime(500); });

      expect(screen.getByText("Error de sincronización")).toBeInTheDocument();
      expect(persistedPrdMarkdown(persistence)).toBe(expectedMarkdown);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      if (previousFetch) {
        Object.defineProperty(globalThis, "fetch", { configurable: true, value: previousFetch });
      } else {
        Reflect.deleteProperty(globalThis, "fetch");
      }
      jest.useRealTimers();
    }
  });

  it("renderiza Markdown flexible con GFM sin habilitar HTML crudo", async () => {
    const user = userEvent.setup();
    const persistence = new MemoryWorkspacePersistence(encodeWorkspaceEnvelope(markdownWorkspace()));
    render(<WorkspaceShell persistence={persistence} />);

    await user.click(await screen.findByRole("button", { name: "Abrir documentos" }));

    expect(screen.getByRole("heading", { name: "PRD flexible" })).toBeInTheDocument();
    expect(screen.getAllByText("TBD")).toHaveLength(2);
    expect(screen.getByText(/Warning: falta decidir/)).toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByText("const seguro = true")).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", expect.stringContaining("example.com"));
    expect(document.querySelector("script")).not.toBeInTheDocument();
    expect(screen.getByText(/<script>window\.unsafe = true<\/script>/)).toBeInTheDocument();
  });

  it("mantiene separado el borrador, previsualiza, descarta y guarda sólo por acción explícita", async () => {
    const user = userEvent.setup();
    const persistence = new MemoryWorkspacePersistence(encodeWorkspaceEnvelope(markdownWorkspace()));
    const view = render(<WorkspaceShell persistence={persistence} />);
    await user.click(await screen.findByRole("button", { name: "Abrir documentos" }));
    expect(screen.getByRole("tablist", { name: "Modo del documento" })).toBeInTheDocument();
    const previewTab = screen.getByRole("tab", { name: "Vista previa" });
    previewTab.focus();
    expect(previewTab).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Editar" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Editar" })).toHaveFocus();
    await user.keyboard("{Home}");
    expect(previewTab).toHaveAttribute("aria-selected", "true");
    expect(previewTab).toHaveFocus();
    await user.click(screen.getByRole("tab", { name: "Editar" }));
    expect(screen.getByRole("tab", { name: "Editar" })).toHaveAttribute("aria-selected", "true");
    const editor = screen.getByRole("textbox", { name: "Fuente Markdown" });
    await user.clear(editor);
    await user.type(editor, "# Borrador visible\n\nTBD sin guardar");

    expect(persistence.inspectRawValue()).toContain("# PRD flexible");
    expect(persistence.inspectRawValue()).not.toContain("Borrador visible");
    await user.click(screen.getByRole("tab", { name: "Vista previa" }));
    expect(screen.getByRole("heading", { name: "Borrador visible" })).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Editar" }));
    await user.click(screen.getByRole("button", { name: "Descartar cambios" }));
    expect(screen.getByRole("dialog", { name: "¿Descartar cambios sin guardar?" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Seguir editando" }));
    expect(editor).toHaveValue("# Borrador visible\n\nTBD sin guardar");
    expect(screen.getByRole("textbox", { name: "Fuente Markdown" })).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Descartar cambios" }));
    await user.click(within(screen.getByRole("dialog", { name: "¿Descartar cambios sin guardar?" })).getByRole("button", { name: "Descartar cambios" }));
    expect((screen.getByRole("textbox", { name: "Fuente Markdown" }) as HTMLTextAreaElement).value).toContain("# PRD flexible");

    const restoredEditor = screen.getByRole("textbox", { name: "Fuente Markdown" });
    await user.clear(restoredEditor);
    await user.type(restoredEditor, "# Fuente guardada por la persona");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(persistence.inspectRawValue()).toContain("Fuente guardada por la persona"));
    view.unmount();

    render(<WorkspaceShell persistence={persistence} />);
    await user.click(await screen.findByRole("button", { name: "Abrir documentos" }));
    expect(screen.getByRole("heading", { name: "Fuente guardada por la persona" })).toBeInTheDocument();
  });

  it("adopta Markdown aceptado o aplicado por fixture cuando el borrador sigue limpio", async () => {
    const user = userEvent.setup();
    const persistence = new MemoryWorkspacePersistence(encodeWorkspaceEnvelope(markdownWorkspace()));
    const fixtureUpdater = createRef<(() => void) | null>();
    render(
      <WorkspaceProvider persistence={persistence}>
        <WorkspaceSurface clipboard={{ writeText: jest.fn().mockResolvedValue(undefined) }} />
        <WorkspaceFixtureUpdater markdown="# Fuente aceptada por fixture" updaterRef={fixtureUpdater} />
      </WorkspaceProvider>,
    );
    await user.click(await screen.findByRole("button", { name: "Abrir documentos" }));

    act(() => fixtureUpdater.current?.());

    expect(await screen.findByRole("heading", { name: "Fuente aceptada por fixture" })).toBeInTheDocument();
    expect(screen.getByText("Guardado localmente")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeDisabled();
    await waitFor(() => expect(persistence.inspectRawValue()).toContain("Fuente aceptada por fixture"));
  });

  it("preserva un borrador real ante una fuente aceptada nueva y descarta hacia la autoridad nueva", async () => {
    const user = userEvent.setup();
    const persistence = new MemoryWorkspacePersistence(encodeWorkspaceEnvelope(markdownWorkspace()));
    const fixtureUpdater = createRef<(() => void) | null>();
    render(
      <WorkspaceProvider persistence={persistence}>
        <WorkspaceSurface clipboard={{ writeText: jest.fn().mockResolvedValue(undefined) }} />
        <WorkspaceFixtureUpdater markdown="# Fuente aceptada más reciente" updaterRef={fixtureUpdater} />
      </WorkspaceProvider>,
    );
    await user.click(await screen.findByRole("button", { name: "Abrir documentos" }));
    await user.click(screen.getByRole("tab", { name: "Editar" }));
    const editor = screen.getByRole("textbox", { name: "Fuente Markdown" });
    await user.clear(editor);
    await user.type(editor, "# Borrador local pendiente");

    act(() => fixtureUpdater.current?.());

    expect(editor).toHaveValue("# Borrador local pendiente");
    expect(screen.getByText("Cambios sin guardar")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Descartar cambios" }));
    await user.click(within(screen.getByRole("dialog", { name: "¿Descartar cambios sin guardar?" })).getByRole("button", { name: "Descartar cambios" }));
    expect(editor).toHaveValue("# Fuente aceptada más reciente");
    expect(persistence.inspectRawValue()).not.toContain("Borrador local pendiente");
  });

  it("preserva Markdown guardado ante un fixture obsoleto, navegación y recarga", async () => {
    const user = userEvent.setup();
    const persistence = new MemoryWorkspacePersistence(encodeWorkspaceEnvelope(markdownWorkspace()));
    const fixtureUpdater = createRef<(() => void) | null>();
    const view = render(
      <WorkspaceProvider persistence={persistence}>
        <WorkspaceSurface clipboard={{ writeText: jest.fn().mockResolvedValue(undefined) }} />
        <WorkspaceFixtureUpdater markdown="# Fixture obsoleto" updaterRef={fixtureUpdater} />
      </WorkspaceProvider>,
    );
    await user.click(await screen.findByRole("button", { name: "Abrir documentos" }));
    await user.click(screen.getByRole("tab", { name: "Editar" }));
    const editor = screen.getByRole("textbox", { name: "Fuente Markdown" });
    await user.clear(editor);
    await user.type(editor, "# Fuente guardada prevalece");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(persistence.inspectRawValue()).toContain("Fuente guardada prevalece"));

    act(() => fixtureUpdater.current?.());
    expect(persistence.inspectRawValue()).not.toContain("Fixture obsoleto");
    await user.click(screen.getByRole("button", { name: "Chat 2" }));
    await user.click(await screen.findByRole("button", { name: "Abrir documentos" }));
    expect(screen.getByRole("heading", { name: "Fuente guardada prevalece" })).toBeInTheDocument();

    view.unmount();
    render(<WorkspaceShell persistence={persistence} />);
    await user.click(await screen.findByRole("button", { name: "Abrir documentos" }));
    expect(screen.getByRole("heading", { name: "Fuente guardada prevalece" })).toBeInTheDocument();
  });

  it("usa un guard compartido al cerrar, cambiar documento o navegar entre Chat, PRD y Project", async () => {
    const user = userEvent.setup();
    const persistence = new MemoryWorkspacePersistence(encodeWorkspaceEnvelope(markdownWorkspace()));
    render(<WorkspaceShell persistence={persistence} />);
    await user.click(await screen.findByRole("button", { name: "Abrir documentos" }));
    await user.click(screen.getByRole("tab", { name: "Editar" }));
    const editor = screen.getByRole("textbox", { name: "Fuente Markdown" });
    await user.type(editor, "\nCambio pendiente");

    await user.selectOptions(screen.getByRole("combobox", { name: "Documento" }), "context");
    expect(screen.getByRole("dialog", { name: "¿Descartar cambios sin guardar?" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Seguir editando" }));
    expect(screen.getByRole("combobox", { name: "Documento" })).toHaveValue("prd");
    expect((screen.getByRole("textbox", { name: "Fuente Markdown" }) as HTMLTextAreaElement).value).toContain("Cambio pendiente");
    expect(screen.getByRole("textbox", { name: "Fuente Markdown" })).toHaveFocus();

    await user.click(screen.getByRole("button", { name: "Cerrar" }));
    await user.click(screen.getByRole("button", { name: "Seguir editando" }));
    expect(screen.getByRole("dialog", { name: "Documentos compartidos" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Chat 2" }));
    await user.click(screen.getByRole("button", { name: "Seguir editando" }));
    expect(screen.getByText("Atlas / PRD 001 / Chat 1")).toBeInTheDocument();
    expect(editor).toHaveFocus();

    const atlas = screen.getByRole("heading", { name: "Atlas" }).closest("section")!;
    await user.click(within(atlas).getByRole("button", { name: "Chat Atlas PRD 002" }));
    await user.click(screen.getByRole("button", { name: "Seguir editando" }));
    expect(screen.getByText("Atlas / PRD 001 / Chat 1")).toBeInTheDocument();
    expect((editor as HTMLTextAreaElement).value).toContain("Cambio pendiente");
    expect(editor).toHaveFocus();

    const boreal = screen.getByRole("heading", { name: "Boreal" }).closest("section")!;
    await user.click(within(boreal).getByRole("button", { name: "Chat Boreal" }));
    await user.click(screen.getByRole("button", { name: "Seguir editando" }));
    expect(screen.getByText("Atlas / PRD 001 / Chat 1")).toBeInTheDocument();
    expect((editor as HTMLTextAreaElement).value).toContain("Cambio pendiente");
    expect(editor).toHaveFocus();

    await user.click(screen.getByRole("button", { name: "Chat 2" }));
    await user.click(within(screen.getByRole("dialog", { name: "¿Descartar cambios sin guardar?" })).getByRole("button", { name: "Descartar cambios" }));
    expect(await screen.findByText("Atlas / PRD 001 / Chat 2")).toBeInTheDocument();
    expect(persistence.inspectRawValue()).not.toContain("Cambio pendiente");
  });

  it("protege el borrador al crear otro Project", async () => {
    const user = userEvent.setup();
    const persistence = new MemoryWorkspacePersistence(encodeWorkspaceEnvelope(markdownWorkspace()));
    render(<WorkspaceShell persistence={persistence} />);
    await user.click(await screen.findByRole("button", { name: "Abrir documentos" }));
    await user.click(screen.getByRole("tab", { name: "Editar" }));
    const editor = screen.getByRole("textbox", { name: "Fuente Markdown" });
    await user.type(editor, "\nBorrador protegido");

    await user.click(screen.getByRole("button", { name: "Nuevo Project" }));
    expect(screen.getByRole("dialog", { name: "¿Descartar cambios sin guardar?" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Seguir editando" }));
    expect(screen.queryByRole("heading", { name: "Celsius" })).not.toBeInTheDocument();
    expect((editor as HTMLTextAreaElement).value).toContain("Borrador protegido");
    expect(editor).toHaveFocus();

    await user.click(screen.getByRole("button", { name: "Nuevo Project" }));
    await user.click(within(screen.getByRole("dialog", { name: "¿Descartar cambios sin guardar?" })).getByRole("button", { name: "Descartar cambios" }));
    await user.type(screen.getByRole("textbox", { name: "Nombre del Project" }), "Celsius");
    await user.click(within(screen.getByRole("dialog", { name: "Crear Project" })).getByRole("button", { name: "Crear Project" }));
    expect(await screen.findByText("Celsius / PRD 001 / PRD")).toBeInTheDocument();
    expect(persistence.inspectRawValue()).not.toContain("Borrador protegido");
  });

  it("copia la fuente actual, conserva la edición ante rechazo y limita snapshots a lectura", async () => {
    const user = userEvent.setup();
    const writeText = jest.fn<Promise<void>, [string]>().mockResolvedValue(undefined);
    const persistence = new MemoryWorkspacePersistence(encodeWorkspaceEnvelope(markdownWorkspace()));
    render(<WorkspaceShell persistence={persistence} clipboard={{ writeText }} />);
    await user.click(await screen.findByRole("button", { name: "Abrir documentos" }));
    await user.click(screen.getByRole("tab", { name: "Editar" }));
    const editor = screen.getByRole("textbox", { name: "Fuente Markdown" });
    await user.clear(editor);
    await user.type(editor, "# Copia exacta\n\nBorrador completo");
    await user.click(screen.getByRole("button", { name: "Copiar" }));
    expect(writeText).toHaveBeenCalledWith("# Copia exacta\n\nBorrador completo");
    expect(await screen.findByText("Markdown copiado")).toBeInTheDocument();

    writeText.mockRejectedValueOnce(new Error("denegado"));
    await user.click(screen.getByRole("button", { name: "Copiar" }));
    expect(await screen.findByText("No se pudo copiar el Markdown")).toBeInTheDocument();
    expect(editor).toHaveValue("# Copia exacta\n\nBorrador completo");
    expect(screen.queryByRole("button", { name: /copiar manualmente|descargar/i })).not.toBeInTheDocument();

    await user.selectOptions(screen.getByRole("combobox", { name: "Documento" }), "snapshot:snapshot-1");
    await user.click(within(screen.getByRole("dialog", { name: "¿Descartar cambios sin guardar?" })).getByRole("button", { name: "Descartar cambios" }));
    expect(screen.getByText("Sólo lectura")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "PRD final" })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Editar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Guardar cambios" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Descartar cambios" })).not.toBeInTheDocument();
  });

  it("expone el catálogo completo en español y carga un estado observable", async () => {
    const user = userEvent.setup();
    const persistence = new MemoryWorkspacePersistence(encodeWorkspaceEnvelope(markdownWorkspace()));
    render(<WorkspaceShell persistence={persistence} />);

    expect(await screen.findByText("Usa un guion fijo. Los mensajes no se interpretan.")).toBeInTheDocument();
    const scenario = screen.getByRole("combobox", { name: "Escenario" });
    expect(within(scenario).getAllByRole("option").map((option) => option.textContent)).toEqual([
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

    await user.selectOptions(scenario, "pregunta-del-agente");
    await user.click(screen.getByRole("button", { name: "Cargar escenario" }));
    expect(await screen.findByText("¿Qué problema quieres resolver y para quién?")).toBeInTheDocument();
    expect(screen.getByText("Demo")).toBeInTheDocument();
  });

  it("envía con Enter, conserva una nueva línea con Shift+Enter y no avanza con espacios", async () => {
    const user = userEvent.setup();
    render(<WorkspaceShell persistence={new MemoryWorkspacePersistence(encodeWorkspaceEnvelope(markdownWorkspace()))} />);

    const composer = await screen.findByRole("textbox", { name: "Mensaje" });
    const send = screen.getByRole("button", { name: "Enviar" });
    expect(send).toBeDisabled();
    await user.type(composer, "   ");
    expect(send).toBeDisabled();
    expect(screen.queryByText("¿Qué problema quieres resolver y para quién?")).not.toBeInTheDocument();

    await user.clear(composer);
    await user.type(composer, "Primera línea");
    await user.keyboard("{Shift>}{Enter}{/Shift}");
    await user.type(composer, "Segunda línea");
    expect(composer).toHaveValue("Primera línea\nSegunda línea");
    expect(screen.queryByText("¿Qué problema quieres resolver y para quién?")).not.toBeInTheDocument();

    await user.keyboard("{Enter}");
    expect(composer).toHaveValue("");
    expect(await screen.findByText("¿Qué problema quieres resolver y para quién?")).toBeInTheDocument();
    expect(screen.getByText(/Primera línea\s+Segunda línea/)).toBeInTheDocument();
    expect(screen.queryByText(/pensando|interpretando/i)).not.toBeInTheDocument();
  });

  it("recorre una transición normal con cualquier acceso de red fallando", async () => {
    const previousFetch = globalThis.fetch;
    const fetchSpy = jest.fn().mockRejectedValue(new Error("sin red"));
    Object.defineProperty(globalThis, "fetch", { configurable: true, value: fetchSpy });
    try {
      const user = userEvent.setup();
      render(<WorkspaceShell persistence={new MemoryWorkspacePersistence(encodeWorkspaceEnvelope(markdownWorkspace()))} />);

      const composer = await screen.findByRole("textbox", { name: "Mensaje" });
      await user.type(composer, "Este contenido no se interpreta{Enter}");

      expect(await screen.findByText("¿Qué problema quieres resolver y para quién?")).toBeInTheDocument();
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      if (previousFetch) {
        Object.defineProperty(globalThis, "fetch", { configurable: true, value: previousFetch });
      } else {
        Reflect.deleteProperty(globalThis, "fetch");
      }
    }
  });

  it("pide confirmación antes de reemplazar estado confirmado y cancelar lo conserva", async () => {
    const user = userEvent.setup();
    const initial = markdownWorkspace();
    initial.projects[0].prds[0].chats[0].messages = [
      { id: "confirmed-1", role: "user", content: "Historial confirmado" },
    ];
    const persistence = new MemoryWorkspacePersistence(encodeWorkspaceEnvelope(initial));
    render(<WorkspaceShell persistence={persistence} />);

    await screen.findByText("Historial confirmado");
    await user.selectOptions(screen.getByRole("combobox", { name: "Escenario" }), "pregunta-del-agente");
    await user.click(screen.getByRole("button", { name: "Cargar escenario" }));
    const confirmation = screen.getByRole("dialog", { name: "¿Cargar este escenario?" });
    await user.click(within(confirmation).getByRole("button", { name: "Cancelar" }));

    expect(screen.getByText("Historial confirmado")).toBeInTheDocument();
    expect(persistedWorkspace(persistence).projects[0].prds[0].chats[0].messages)
      .toEqual(initial.projects[0].prds[0].chats[0].messages);

    await user.click(screen.getByRole("button", { name: "Cargar escenario" }));
    await user.click(within(screen.getByRole("dialog", { name: "¿Cargar este escenario?" })).getByRole("button", { name: "Cargar escenario" }));
    expect(await screen.findByText("¿Qué problema quieres resolver y para quién?")).toBeInTheDocument();
    expect(screen.queryByText("Historial confirmado")).not.toBeInTheDocument();
  });

  it("usa una sola confirmación atómica cuando un escenario reemplazaría borrador y estado confirmado", async () => {
    const user = userEvent.setup();
    const initial = markdownWorkspace();
    initial.projects[0].prds[0].chats[0].messages = [
      { id: "confirmed-1", role: "user", content: "Historial confirmado" },
    ];
    const persistence = new MemoryWorkspacePersistence(encodeWorkspaceEnvelope(initial));
    render(<WorkspaceShell persistence={persistence} />);

    await screen.findByText("Historial confirmado");
    await user.click(screen.getByRole("button", { name: "Abrir documentos" }));
    await user.click(screen.getByRole("tab", { name: "Editar" }));
    const editor = screen.getByRole("textbox", { name: "Fuente Markdown" });
    await user.clear(editor);
    await user.type(editor, "# Borrador que debe conservarse");
    await user.selectOptions(screen.getByRole("combobox", { name: "Escenario" }), "pregunta-del-agente");
    await user.click(screen.getByRole("button", { name: "Cargar escenario" }));

    const confirmation = screen.getByRole("dialog", { name: "¿Cargar este escenario?" });
    expect(confirmation).toHaveTextContent("el borrador sin guardar y el estado confirmado");
    expect(screen.queryByRole("dialog", { name: "¿Descartar cambios sin guardar?" })).not.toBeInTheDocument();
    await user.click(within(confirmation).getByRole("button", { name: "Cancelar" }));

    expect(editor).toHaveValue("# Borrador que debe conservarse");
    expect(screen.getByText("Historial confirmado")).toBeInTheDocument();
    expect(persistedPrdMarkdown(persistence)).toBe(initial.projects[0].prds[0].document.markdown);
    expect(persistedWorkspace(persistence).projects[0].prds[0].chats[0].messages)
      .toEqual(initial.projects[0].prds[0].chats[0].messages);
  });

  it("confirma antes de cambiar el estado de sincronización y cancelar lo conserva", async () => {
    const user = userEvent.setup();
    const initial = configuredSyncWorkspace("synced");
    const persistence = new MemoryWorkspacePersistence(encodeWorkspaceEnvelope(initial));
    render(<WorkspaceShell persistence={persistence} />);

    expect(await screen.findByText("Sincronizado")).toBeInTheDocument();
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Escenario" }),
      "estados-de-sincronizacion",
    );
    await user.click(screen.getByRole("button", { name: "Cargar escenario" }));
    const confirmation = screen.getByRole("dialog", { name: "¿Cargar este escenario?" });
    await user.click(within(confirmation).getByRole("button", { name: "Cancelar" }));

    expect(screen.getByText("Sincronizado")).toBeInTheDocument();
    expect(persistedWorkspace(persistence).syncState).toBe("synced");

    await user.click(screen.getByRole("button", { name: "Cargar escenario" }));
    await user.click(within(
      screen.getByRole("dialog", { name: "¿Cargar este escenario?" }),
    ).getByRole("button", { name: "Cargar escenario" }));

    expect(await screen.findByText("Cambios sin sincronizar")).toBeInTheDocument();
    await waitFor(() => expect(persistedWorkspace(persistence).syncState).toBe("unsynced"));
  });

  it.each(proposalCategories)(
    "acepta y persiste exactamente la propuesta sensible %s con foco y anuncio accesibles",
    async (category) => {
      const user = userEvent.setup();
      const initial = workspaceWithProposal(category);
      const originalPrd = initial.projects[0].prds[0].document.markdown;
      const originalContext = initial.projects[0].productContext.markdown;
      const proposedMarkdown = initial.projects[0].prds[0].proposals[0].proposedMarkdown;
      const persistence = new MemoryWorkspacePersistence(encodeWorkspaceEnvelope(initial));
      render(<WorkspaceShell persistence={persistence} />);

      const pendingStatus = await screen.findByRole("heading", { name: "Aprobación pendiente" });
      const proposal = pendingStatus.closest("section")!;
      expect(persistedPrdMarkdown(persistence)).toBe(originalPrd);
      expect(persistedWorkspace(persistence).projects[0].productContext.markdown).toBe(originalContext);
      await user.click(within(proposal).getByRole("button", { name: "Aceptar cambio" }));

      const acceptedStatus = await screen.findByRole("heading", { name: "Aceptada" });
      await waitFor(() => expect(acceptedStatus).toHaveFocus());
      expect(screen.getByText(new RegExp(`Cambio aceptado para ${category === "change-product-context" ? "Product Context" : "PRD actual"}`))).toBeInTheDocument();
      expect(within(proposal).queryByRole("button", { name: /cambio/i })).not.toBeInTheDocument();
      await waitFor(() => {
        const persisted = persistedWorkspace(persistence);
        expect(persisted.projects[0].prds[0].proposals[0].resolution).toBe("accepted");
        expect(persisted.projects[0].prds[0].document.markdown).toBe(
          category === "change-product-context" ? originalPrd : proposedMarkdown,
        );
        expect(persisted.projects[0].productContext.markdown).toBe(
          category === "change-product-context" ? proposedMarkdown : originalContext,
        );
      });
    },
  );

  it.each(proposalCategories)(
    "rechaza y persiste la propuesta sensible %s sin modificar documentos",
    async (category) => {
      const user = userEvent.setup();
      const initial = workspaceWithProposal(category);
      const originalPrd = initial.projects[0].prds[0].document.markdown;
      const originalContext = initial.projects[0].productContext.markdown;
      const persistence = new MemoryWorkspacePersistence(encodeWorkspaceEnvelope(initial));
      render(<WorkspaceShell persistence={persistence} />);

      const pendingStatus = await screen.findByRole("heading", { name: "Aprobación pendiente" });
      const proposal = pendingStatus.closest("section")!;
      await user.click(within(proposal).getByRole("button", { name: "Rechazar cambio" }));

      const rejectedStatus = await screen.findByRole("heading", { name: "Rechazada" });
      await waitFor(() => expect(rejectedStatus).toHaveFocus());
      expect(screen.getByText(new RegExp(`Cambio rechazado para ${category === "change-product-context" ? "Product Context" : "PRD actual"}`))).toBeInTheDocument();
      expect(within(proposal).queryByRole("button", { name: /cambio/i })).not.toBeInTheDocument();
      await waitFor(() => {
        const persisted = persistedWorkspace(persistence);
        expect(persisted.projects[0].prds[0].proposals[0].resolution).toBe("rejected");
        expect(persisted.projects[0].prds[0].document.markdown).toBe(originalPrd);
        expect(persisted.projects[0].productContext.markdown).toBe(originalContext);
      });
    },
  );

  it("aplica un cambio ordinario del guion sin mostrar aprobación sensible", async () => {
    const user = userEvent.setup();
    const initial = markdownWorkspace();
    const persistence = new MemoryWorkspacePersistence(encodeWorkspaceEnvelope(initial));
    render(<WorkspaceShell persistence={persistence} />);

    await screen.findByRole("textbox", { name: "Mensaje" });
    await user.selectOptions(screen.getByRole("combobox", { name: "Escenario" }), "prd-actualizado");
    await user.click(screen.getByRole("button", { name: "Cargar escenario" }));
    await user.click(within(screen.getByRole("dialog", { name: "¿Cargar este escenario?" })).getByRole("button", { name: "Cargar escenario" }));

    expect(screen.queryByRole("heading", { name: "Aprobación pendiente" })).not.toBeInTheDocument();
    await waitFor(() => expect(persistedPrdMarkdown(persistence)).toContain("Validar el flujo local de discovery."));
  });

  it("muestra sólo acciones válidas y permite editar o volver durante la revisión", async () => {
    const user = userEvent.setup();
    const initial = markdownWorkspace();
    initial.projects[0].prds[0].chats[0] = {
      ...initial.projects[0].prds[0].chats[0],
      kind: "guided",
      phase: "prd",
      progress: null,
    };
    initial.projects[0].prds[0].findings = [{
      id: "gap-1",
      kind: "gap",
      description: "Falta delimitar el alcance.",
      resolved: false,
    }];
    const persistence = new MemoryWorkspacePersistence(encodeWorkspaceEnvelope(initial));
    render(<WorkspaceShell persistence={persistence} />);

    expect(await screen.findByText("Estado del PRD: Borrador")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Abrir documentos" }));
    expect(screen.getByRole("button", { name: "Iniciar revisión" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Finalizar PRD" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Iniciar revisión" }));
    expect(await screen.findByText("PRD 001 · Versión 2 · En revisión")).toBeInTheDocument();
    expect(screen.getByText(/Falta delimitar el alcance\./)).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Editar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Volver a borrador" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Finalizar PRD" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Volver a borrador" }));
    expect(await screen.findByText("PRD 001 · Versión 2 · Borrador")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Finalizar PRD" })).not.toBeInTheDocument();
  });

  it("exige aceptar warnings, permite cancelar y finaliza en un snapshot inmutable", async () => {
    const user = userEvent.setup();
    const initial = markdownWorkspace();
    const original = initial.projects[0].prds[0].document.markdown;
    initial.projects[0].prds[0].lifecycle = "review";
    initial.projects[0].prds[0].findings = [{
      id: "warning-1",
      kind: "warning",
      description: "La métrica objetivo sigue abierta.",
      resolved: false,
    }];
    const persistence = new MemoryWorkspacePersistence(encodeWorkspaceEnvelope(initial));
    render(<WorkspaceShell persistence={persistence} />);

    await user.click(await screen.findByRole("button", { name: "Abrir documentos" }));
    await user.click(screen.getByRole("button", { name: "Finalizar PRD" }));
    let dialog = screen.getByRole("dialog", { name: "Finalizar PRD" });
    expect(within(dialog).getByText("La métrica objetivo sigue abierta.")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Finalizar PRD" })).toBeDisabled();
    await user.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    expect(screen.getByText("PRD 001 · Versión 2 · En revisión")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Finalizar PRD" }));
    dialog = screen.getByRole("dialog", { name: "Finalizar PRD" });
    await user.click(within(dialog).getByRole("checkbox", { name: "Acepto las advertencias restantes" }));
    await user.click(within(dialog).getByRole("button", { name: "Finalizar PRD" }));

    expect(await screen.findByText("PRD 001 · Versión 2 · Final")).toBeInTheDocument();
    expect(screen.getByText("Sólo lectura")).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Editar" })).not.toBeInTheDocument();
    await waitFor(() => {
      const prd = persistedWorkspace(persistence).projects[0].prds[0];
      expect(prd.document.markdown).toBe(original);
      expect(prd.snapshots.at(-1)).toMatchObject({ version: 2, markdown: original });
    });
  });

  it("finaliza sin aceptación cuando no hay warnings y bloquea mutaciones posteriores del escenario", async () => {
    const user = userEvent.setup();
    const initial = markdownWorkspace();
    initial.projects[0].prds[0].lifecycle = "review";
    initial.projects[0].prds[0].findings = [];
    const expected = initial.projects[0].prds[0].document.markdown;
    const persistence = new MemoryWorkspacePersistence(encodeWorkspaceEnvelope(initial));
    render(<WorkspaceShell persistence={persistence} />);

    await user.click(await screen.findByRole("button", { name: "Abrir documentos" }));
    await user.click(screen.getByRole("button", { name: "Finalizar PRD" }));
    const finalization = screen.getByRole("dialog", { name: "Finalizar PRD" });
    expect(within(finalization).queryByRole("checkbox")).not.toBeInTheDocument();
    await user.click(within(finalization).getByRole("button", { name: "Finalizar PRD" }));
    await user.click(screen.getByRole("button", { name: "Cerrar" }));

    await user.selectOptions(screen.getByRole("combobox", { name: "Escenario" }), "prd-actualizado");
    await user.click(screen.getByRole("button", { name: "Cargar escenario" }));
    const confirmation = screen.getByRole("dialog", { name: "¿Cargar este escenario?" });
    await user.click(within(confirmation).getByRole("button", { name: "Cargar escenario" }));

    await waitFor(() => {
      const finalPrd = persistedWorkspace(persistence).projects[0].prds[0];
      expect(finalPrd.lifecycle).toBe("final");
      expect(finalPrd.document.markdown).toBe(expected);
      expect(finalPrd.snapshots.at(-1)?.markdown).toBe(expected);
    });
  });

  it("una recomendación de continuación no crea entidades por sí sola", async () => {
    const user = userEvent.setup();
    const initial = markdownWorkspace();
    const persistence = new MemoryWorkspacePersistence(encodeWorkspaceEnvelope(initial));
    render(<WorkspaceShell persistence={persistence} />);

    await screen.findByRole("textbox", { name: "Mensaje" });
    await user.selectOptions(screen.getByRole("combobox", { name: "Escenario" }), "recomendacion-de-otro-prd");
    await user.click(screen.getByRole("button", { name: "Cargar escenario" }));
    const confirmation = screen.queryByRole("dialog", { name: "¿Cargar este escenario?" });
    if (confirmation) {
      await user.click(within(confirmation).getByRole("button", { name: "Cargar escenario" }));
    }

    expect(await screen.findByText("La demostración recomienda crear otro PRD, pero no lo hará sin confirmación.")).toBeInTheDocument();
    expect(persistedWorkspace(persistence).projects[0].prds).toHaveLength(2);
  });

  it.each([
    ["Crear una nueva versión de este PRD", "new-version"],
    ["Crear un PRD nuevo para una iniciativa diferente", "new-prd"],
  ] as const)("no continúa hasta confirmar la opción %s", async (option, expected) => {
    const user = userEvent.setup();
    const initial = markdownWorkspace();
    const prd = initial.projects[0].prds[0];
    prd.lifecycle = "final";
    prd.document.markdown = prd.snapshots[0].markdown;
    const persistence = new MemoryWorkspacePersistence(encodeWorkspaceEnvelope(initial));
    render(<WorkspaceShell persistence={persistence} />);

    await user.click(await screen.findByRole("button", { name: "Abrir documentos" }));
    await user.click(screen.getByRole("button", { name: "Continuar trabajo" }));
    const dialog = screen.getByRole("dialog", { name: "Continuar trabajo" });
    expect(within(dialog).getByRole("button", { name: "Confirmar" })).toBeDisabled();
    expect(persistedWorkspace(persistence).projects[0].prds).toHaveLength(2);

    await user.click(within(dialog).getByRole("radio", { name: option }));
    expect(persistedWorkspace(persistence).projects[0].prds).toHaveLength(2);
    await user.click(within(dialog).getByRole("button", { name: "Confirmar" }));

    await waitFor(() => {
      const persisted = persistedWorkspace(persistence);
      if (expected === "new-version") {
        const continued = persisted.projects[0].prds[0];
        expect(continued.lifecycle).toBe("draft");
        expect(continued.title).toBe("PRD 001");
        expect(continued.document.markdown).toBe(continued.snapshots[0].markdown);
        expect(continued.chats.at(-1)?.messages).toEqual([]);
      } else {
        expect(persisted.projects[0].prds.at(-1)).toMatchObject({
          title: "PRD 003",
          lifecycle: "draft",
        });
        expect(persisted.projects[0].prds.at(-1)?.chats).toHaveLength(6);
        expect(persisted.projects[0].prds.at(-1)?.chats[0]).toMatchObject({ title: "PRD", kind: "guided", phase: "prd", messages: [] });
        expect(persisted.projects[0].prds.at(-1)?.document.markdown).toContain("TBD");
      }
    });
  });

  it.each(DEMO_SCENARIOS.filter((scenario) => scenario.kind === "error"))(
    "recupera $name de forma repetible sin red ni cambios en el documento confirmado",
    async (scenario) => {
      const previousFetch = globalThis.fetch;
      const fetchSpy = jest.fn().mockRejectedValue(new Error("sin red"));
      Object.defineProperty(globalThis, "fetch", { configurable: true, value: fetchSpy });
      try {
        const runFromSameInitialState = async () => {
          const user = userEvent.setup();
          const initial = markdownWorkspace();
          initial.projects[0].prds[0].chats[0].messages = [
            { id: "confirmed-1", role: "user", content: "Historial confirmado" },
          ];
          const expectedMarkdown = initial.projects[0].prds[0].document.markdown;
          const expectedHistory = [...initial.projects[0].prds[0].chats[0].messages];
          const persistence = new MemoryWorkspacePersistence(encodeWorkspaceEnvelope(initial));
          const view = render(<WorkspaceShell persistence={persistence} />);

          await screen.findByText("Historial confirmado");
          await user.selectOptions(screen.getByRole("combobox", { name: "Escenario" }), scenario.id);
          await user.click(screen.getByRole("button", { name: "Cargar escenario" }));
          expect(screen.getByRole("alert")).toHaveTextContent(scenario.name);
          expect(screen.getByRole("alert")).toHaveTextContent(scenario.error.description);
          expect(persistedPrdMarkdown(persistence)).toBe(expectedMarkdown);
          expect(persistedWorkspace(persistence).projects[0].prds[0].chats[0].messages)
            .toEqual(expectedHistory);

          await user.click(screen.getByRole("button", { name: scenario.error.recoveryLabel }));
          expect(screen.queryByRole("alert")).not.toBeInTheDocument();
          expect(screen.getByRole("textbox", { name: "Mensaje" })).toBeEnabled();
          expect(persistedPrdMarkdown(persistence)).toBe(expectedMarkdown);
          if (scenario.error.recovery.kind === "append-message") {
            expect(await screen.findByText(scenario.error.recovery.content)).toBeInTheDocument();
          } else {
            expect(persistedWorkspace(persistence).projects[0].prds[0].chats[0].messages)
              .toEqual(expectedHistory);
          }
          const recovered = persistedWorkspace(persistence);
          view.unmount();
          return recovered;
        };

        expect(await runFromSameInitialState()).toEqual(await runFromSameInitialState());
        expect(fetchSpy).not.toHaveBeenCalled();
      } finally {
        if (previousFetch) {
          Object.defineProperty(globalThis, "fetch", { configurable: true, value: previousFetch });
        } else {
          Reflect.deleteProperty(globalThis, "fetch");
        }
      }
    },
  );
});
