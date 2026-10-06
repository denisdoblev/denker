import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";

import { createEmptyWorkspace, type WorkspaceState } from "@/domain/workspace";
import {
  BrowserWorkspacePersistence,
  MemoryWorkspacePersistence,
} from "@/persistence/workspace-persistence";
import { WorkspaceProvider, useWorkspace } from "@/store/workspace-store";

import { WorkspaceShell } from "./workspace-shell";

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
    expect(persistence.inspectRawValue()).toContain('"version":1');
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

    expect(await screen.findByText("Describe tu idea")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Mensaje" })).toHaveFocus();
    expect(screen.getByText(/Repositorio no conectado/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Chat 1" })).toHaveAttribute("aria-current", "page");

    await user.click(screen.getByRole("button", { name: "Abrir documentos" }));
    expect(screen.getByText(/# PRD 001/)).toHaveTextContent("TBD");
    await user.selectOptions(screen.getByRole("combobox", { name: "Documento" }), "context");
    expect(screen.getByText(/# Contexto del producto: Atlas/)).toHaveTextContent("TBD");
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
    await user.click(screen.getByRole("button", { name: "Nuevo Chat en PRD 001 de Atlas" }));
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
    const atlasChats = within(atlasBranch).getAllByRole("button", { name: /^Chat \d+$/ });
    await user.click(atlasChats[0]);
    expect(screen.getByRole("textbox", { name: "Mensaje" })).toHaveValue("");
    expect(screen.queryByDisplayValue("Borrador sin enviar de Boreal")).not.toBeInTheDocument();
    expect(await screen.findByText("Historia Atlas uno")).toBeInTheDocument();
    expect(screen.queryByText("Historia Atlas dos")).not.toBeInTheDocument();
    expect(atlasChats[0]).toHaveAttribute("aria-current", "page");
    await user.click(screen.getByRole("button", { name: "Abrir documentos" }));
    expect(screen.getByText(/# PRD 001/)).toBeInTheDocument();
    await user.selectOptions(screen.getByRole("combobox", { name: "Documento" }), "context");
    expect(screen.getByText(/# Contexto del producto: Atlas/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(screen.getByRole("button", { name: "Abrir documentos" })).toHaveFocus();

    await user.click(atlasChats[1]);
    expect(await screen.findByText("Historia Atlas dos")).toBeInTheDocument();
    expect(screen.queryByText("Historia Atlas uno")).not.toBeInTheDocument();
    expect(atlasChats[1]).toHaveAttribute("aria-current", "page");
    await user.click(screen.getByRole("button", { name: "Abrir documentos" }));
    expect(screen.getByText(/# PRD 001/)).toBeInTheDocument();
    await user.selectOptions(screen.getByRole("combobox", { name: "Documento" }), "context");
    expect(screen.getByText(/# Contexto del producto: Atlas/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cerrar" }));

    const borealBranch = screen.getByRole("heading", { name: "Boreal" }).closest("section")!;
    await user.click(within(borealBranch).getByRole("button", { name: "Chat 1" }));
    await user.click(screen.getByRole("button", { name: "Abrir documentos" }));
    expect(screen.getByText(/# PRD 001/)).toBeInTheDocument();
    await user.selectOptions(screen.getByRole("combobox", { name: "Documento" }), "context");
    expect(screen.getByText(/# Contexto del producto: Boreal/)).toBeInTheDocument();
    expect(screen.queryByText(/# Contexto del producto: Atlas/)).not.toBeInTheDocument();
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
    expect(within(boreal).getByRole("button", { name: "Chat 1" })).toBeInTheDocument();

    const borealPrdToggle = within(boreal).getByRole("button", { name: "Contraer PRD 001 de Boreal" });
    expect(borealPrdToggle).toHaveAttribute("aria-controls");
    await user.click(borealPrdToggle);
    expect(within(boreal).queryByRole("button", { name: "Chat 1" })).not.toBeInTheDocument();
    expect(within(atlas).queryByRole("button", { name: "Chat 1" })).not.toBeInTheDocument();

    await user.click(within(atlas).getByRole("button", { name: "Expandir Project Atlas" }));
    expect(within(atlas).getByRole("button", { name: "Chat 1" })).toBeInTheDocument();
    expect(within(boreal).queryByRole("button", { name: "Chat 1" })).not.toBeInTheDocument();
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
    expect(screen.getByText("Boreal / PRD 001 / Chat 1")).toBeInTheDocument();
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
});
