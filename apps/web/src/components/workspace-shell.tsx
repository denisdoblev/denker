"use client";

import { Dialog } from "@base-ui/react/dialog";
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode, type RefObject } from "react";

import { InvalidWorkspaceRecovery } from "@/components/invalid-workspace-recovery";
import { Button } from "@/components/ui/button";
import {
  addUserMessage,
  createChat,
  createProject,
  saveRepositoryConfiguration,
  selectChat,
  type Project,
  type RepositoryConfigurationInput,
} from "@/domain/workspace";
import { browserWorkspacePersistence, type WorkspacePersistence } from "@/persistence/workspace-persistence";
import { WorkspaceProvider, useWorkspace } from "@/store/workspace-store";

const fieldClass = "h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

function DialogFrame({ title, children, initialFocus, finalFocus, onClose }: { title: string; children: ReactNode; initialFocus?: RefObject<HTMLElement | null>; finalFocus?: RefObject<HTMLElement | null>; onClose: () => void }) {
  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/45" />
        <Dialog.Viewport className="fixed inset-0 z-50 grid place-items-center p-4">
          <Dialog.Popup initialFocus={initialFocus} finalFocus={finalFocus} className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-xl border bg-background p-6 shadow-xl outline-none">
            <div className="mb-5 flex items-start justify-between gap-4">
              <Dialog.Title className="text-xl font-semibold">{title}</Dialog.Title>
              <Dialog.Close render={<Button type="button" variant="ghost" aria-label="Cerrar" autoFocus={!initialFocus} />}>Cerrar</Dialog.Close>
            </div>
            {children}
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function RepositoryFields({ values, onChange }: { values: RepositoryConfigurationInput; onChange: (values: RepositoryConfigurationInput) => void }) {
  const fields: Array<[keyof RepositoryConfigurationInput, string]> = [
    ["provider", "Proveedor"],
    ["ownerOrOrganization", "Propietario u organización"],
    ["repository", "Repositorio"],
    ["branch", "Rama"],
    ["documentationPath", "Ruta de documentación"],
  ];
  return (
    <fieldset className="space-y-3 rounded-lg border p-4">
      <legend className="px-1 text-sm font-semibold">Configuración del repositorio</legend>
      <p className="text-sm text-muted-foreground">Sólo configuración de demostración. Sin credenciales ni conexión remota.</p>
      {fields.map(([key, label]) => (
        <label className="block space-y-1 text-sm" key={key}>
          <span>{label}</span>
          <input className={fieldClass} value={values[key] ?? ""} onChange={(event) => onChange({ ...values, [key]: event.target.value })} />
        </label>
      ))}
    </fieldset>
  );
}

function CreateProjectDialog({ finalFocus, onClose }: { finalFocus: RefObject<HTMLElement | null>; onClose: () => void }) {
  const { replaceWorkspace, workspace } = useWorkspace();
  const [name, setName] = useState("");
  const [includeRepository, setIncludeRepository] = useState(false);
  const [repository, setRepository] = useState<RepositoryConfigurationInput>({ branch: "main", documentationPath: "/docs" });
  const nameRef = useRef<HTMLInputElement>(null);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    replaceWorkspace(createProject(workspace, name, includeRepository ? repository : undefined));
    onClose();
  };
  return (
    <DialogFrame title="Crear Project" initialFocus={nameRef} finalFocus={finalFocus} onClose={onClose}>
      <form className="space-y-5" onSubmit={submit}>
        <label className="block space-y-1 text-sm">
          <span>Nombre del Project</span>
          <input ref={nameRef} autoFocus className={fieldClass} value={name} onChange={(event) => setName(event.target.value)} required />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={includeRepository} onChange={(event) => setIncludeRepository(event.target.checked)} />
          Configurar un repositorio opcional
        </label>
        {includeRepository ? <RepositoryFields values={repository} onChange={setRepository} /> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={!name.trim()}>Crear Project</Button>
        </div>
      </form>
    </DialogFrame>
  );
}

function RepositoryDialog({ project, finalFocus, onClose }: { project: Project; finalFocus: RefObject<HTMLElement | null>; onClose: () => void }) {
  const { replaceWorkspace, workspace } = useWorkspace();
  const [repository, setRepository] = useState<RepositoryConfigurationInput>(project.repository ?? { branch: "main", documentationPath: "/docs" });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    replaceWorkspace(saveRepositoryConfiguration(workspace, project.id, repository));
    onClose();
  };
  return (
    <DialogFrame title="Configuración del repositorio" finalFocus={finalFocus} onClose={onClose}>
      <form className="space-y-5" onSubmit={submit}>
        <RepositoryFields values={repository} onChange={setRepository} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit">Guardar configuración</Button>
        </div>
      </form>
    </DialogFrame>
  );
}

function DocumentsDialog({ project, prdMarkdown, finalFocus, onClose }: { project: Project; prdMarkdown: string; finalFocus: RefObject<HTMLElement | null>; onClose: () => void }) {
  const [document, setDocument] = useState<"prd" | "context">("prd");
  return (
    <DialogFrame title="Documentos compartidos" finalFocus={finalFocus} onClose={onClose}>
      <label className="block space-y-1 text-sm">
        <span>Documento</span>
        <select className={fieldClass} value={document} onChange={(event) => setDocument(event.target.value as "prd" | "context")}>
          <option value="prd">PRD actual</option>
          <option value="context">Product Context</option>
        </select>
      </label>
      <pre className="mt-4 whitespace-pre-wrap rounded-lg bg-muted p-4 text-sm">{document === "prd" ? prdMarkdown : project.productContext.markdown}</pre>
    </DialogFrame>
  );
}

function WorkspaceNavigation({ newProjectTriggerRef, onNewProject }: { newProjectTriggerRef: RefObject<HTMLButtonElement | null>; onNewProject: () => void }) {
  const { replaceWorkspace, workspace } = useWorkspace();
  const [collapsedProjects, setCollapsedProjects] = useState<Set<string>>(() => new Set());
  const [collapsedPrds, setCollapsedPrds] = useState<Set<string>>(() => new Set());
  const [repositoryTarget, setRepositoryTarget] = useState<{ projectId: string; trigger: HTMLButtonElement } | null>(null);

  const toggleCollapsed = (id: string, setter: typeof setCollapsedProjects) => {
    setter((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const repositoryProject = workspace.projects.find(({ id }) => id === repositoryTarget?.projectId);
  return (
    <aside className="w-full border-b bg-[var(--sidebar)] p-4 md:w-72 md:border-b-0 md:border-r">
      <div className="mb-5 flex items-center justify-between gap-3">
        <strong className="text-lg">Denker</strong>
        <Button ref={newProjectTriggerRef} type="button" size="sm" onClick={onNewProject}>Nuevo Project</Button>
      </div>
      <nav aria-label="Projects, PRDs y Chats" className="space-y-5">
        {workspace.projects.map((project) => (
          <section key={project.id} aria-labelledby={`${project.id}-name`}>
            <div className="flex items-center justify-between gap-2">
              <h2 id={`${project.id}-name`} className="min-w-0 truncate font-semibold" title={project.name}>{project.name}</h2>
              <Button
                type="button"
                size="xs"
                variant="ghost"
                aria-label={`${collapsedProjects.has(project.id) ? "Expandir" : "Contraer"} Project ${project.name}`}
                aria-expanded={!collapsedProjects.has(project.id)}
                aria-controls={`${project.id}-content`}
                onClick={() => toggleCollapsed(project.id, setCollapsedProjects)}
              >
                {collapsedProjects.has(project.id) ? "Expandir" : "Contraer"}
              </Button>
            </div>
            <div id={`${project.id}-content`} hidden={collapsedProjects.has(project.id)} className="mt-2 space-y-3 border-l pl-3">
                <div className="rounded-md bg-muted p-2 text-xs">
                  {project.repository ? (
                    <p><strong>Configuración de demostración:</strong> {project.repository.provider || "Proveedor TBD"} · {project.repository.ownerOrOrganization || "Propietario TBD"}/{project.repository.repository || "Repositorio TBD"} · {project.repository.branch} · {project.repository.documentationPath}</p>
                  ) : (
                    <p><strong>Repositorio no conectado.</strong> Puedes continuar localmente.</p>
                  )}
                  <Button
                    type="button"
                    size="xs"
                    variant="ghost"
                    className="mt-1"
                    aria-label={`Configurar repositorio de ${project.name}`}
                    onClick={(event) => setRepositoryTarget({ projectId: project.id, trigger: event.currentTarget })}
                  >
                    Configurar repositorio
                  </Button>
                </div>
                {project.prds.map((prd) => (
                  <div key={prd.id}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">{prd.title} · Borrador</p>
                      <Button
                        type="button"
                        size="xs"
                        variant="ghost"
                        aria-label={`${collapsedPrds.has(prd.id) ? "Expandir" : "Contraer"} ${prd.title} de ${project.name}`}
                        aria-expanded={!collapsedPrds.has(prd.id)}
                        aria-controls={`${prd.id}-content`}
                        onClick={() => toggleCollapsed(prd.id, setCollapsedPrds)}
                      >
                        {collapsedPrds.has(prd.id) ? "Expandir" : "Contraer"}
                      </Button>
                    </div>
                    <div id={`${prd.id}-content`} hidden={collapsedPrds.has(prd.id)} className="mt-1 pl-3">
                        <Button type="button" size="xs" variant="ghost" onClick={() => replaceWorkspace(createChat(workspace, project.id, prd.id))} aria-label={`Nuevo Chat en ${prd.title} de ${project.name}`}>Nuevo Chat</Button>
                        <ul className="mt-1 space-y-1">
                          {prd.chats.map((chat) => {
                            const active = workspace.activeSelection?.chatId === chat.id;
                            return (
                              <li key={chat.id}>
                                <button type="button" aria-current={active ? "page" : undefined} className="w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground" onClick={() => replaceWorkspace(selectChat(workspace, { projectId: project.id, prdId: prd.id, chatId: chat.id }))}>
                                  {chat.title}
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                    </div>
                  </div>
                ))}
              </div>
          </section>
        ))}
      </nav>
      {repositoryTarget && repositoryProject ? (
        <RepositoryDialog
          project={repositoryProject}
          finalFocus={{ current: repositoryTarget.trigger }}
          onClose={() => setRepositoryTarget(null)}
        />
      ) : null}
    </aside>
  );
}

function ActiveChat() {
  const { replaceWorkspace, workspace } = useWorkspace();
  const [composer, setComposer] = useState("");
  const [documentsOpen, setDocumentsOpen] = useState(false);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const documentsTriggerRef = useRef<HTMLButtonElement>(null);
  const selection = workspace.activeSelection;
  const active = useMemo(() => {
    const project = workspace.projects.find(({ id }) => id === selection?.projectId);
    const prd = project?.prds.find(({ id }) => id === selection?.prdId);
    const chat = prd?.chats.find(({ id }) => id === selection?.chatId);
    return project && prd && chat ? { project, prd, chat } : null;
  }, [selection, workspace.projects]);
  useEffect(() => { composerRef.current?.focus(); }, [active?.chat.id]);
  if (!active || !selection) return null;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!composer.trim()) return;
    replaceWorkspace(addUserMessage(workspace, selection, composer));
    setComposer("");
    composerRef.current?.focus();
  };
  return (
    <section className="flex min-h-[70vh] min-w-0 flex-1 flex-col" aria-labelledby="chat-title">
      <header className="border-b p-4">
        <p className="text-sm text-muted-foreground">{active.project.name} / {active.prd.title} / {active.chat.title}</p>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <h1 id="chat-title" tabIndex={-1} className="text-xl font-semibold">{active.chat.title}</h1>
          <div className="flex gap-2">
            <Button ref={documentsTriggerRef} type="button" variant="outline" onClick={() => setDocumentsOpen(true)}>Abrir documentos</Button>
          </div>
        </div>
      </header>
      <div className="flex-1 space-y-3 overflow-auto p-4" aria-label="Historial del Chat">
        {active.chat.messages.length === 0 ? (
          <div className="grid min-h-52 place-items-center text-center"><div><h2 className="font-semibold">Describe tu idea</h2><p className="mt-1 text-sm text-muted-foreground">Cuéntanos qué quieres descubrir o documentar en este Chat.</p></div></div>
        ) : active.chat.messages.map((message) => (
          <article className="ml-auto max-w-2xl rounded-lg bg-muted p-3" key={message.id}><p className="text-xs font-semibold">Tú</p><p className="mt-1 whitespace-pre-wrap">{message.content}</p></article>
        ))}
      </div>
      <form className="border-t p-4" onSubmit={submit}>
        <label className="block text-sm font-medium" htmlFor="composer">Mensaje</label>
        <div className="mt-1 flex items-end gap-2">
          <textarea id="composer" ref={composerRef} rows={2} className="min-h-16 flex-1 resize-y rounded-md border bg-background p-3 outline-none focus-visible:ring-2 focus-visible:ring-ring" value={composer} onChange={(event) => setComposer(event.target.value)} />
          <Button type="submit" disabled={!composer.trim()}>Enviar</Button>
        </div>
      </form>
      {documentsOpen ? <DocumentsDialog project={active.project} prdMarkdown={active.prd.document.markdown} finalFocus={documentsTriggerRef} onClose={() => setDocumentsOpen(false)} /> : null}
    </section>
  );
}

function ReadyWorkspace() {
  const { workspace } = useWorkspace();
  const [createOpen, setCreateOpen] = useState(false);
  const createTriggerRef = useRef<HTMLButtonElement>(null);
  if (workspace.projects.length === 0) {
    return (
      <main className="grid min-h-screen place-items-center p-6">
        <section className="max-w-md text-center" aria-labelledby="workspace-title">
          <p className="text-sm font-medium text-muted-foreground">Denker</p>
          <h1 id="workspace-title" className="mt-2 text-2xl font-semibold">Convierte una idea en contexto claro</h1>
          <p className="mt-3 text-muted-foreground">Crea tu primer Project para iniciar un Chat local.</p>
          <Button ref={createTriggerRef} className="mt-6" type="button" onClick={() => setCreateOpen(true)}>Crear Project</Button>
        </section>
        {createOpen ? <CreateProjectDialog finalFocus={createTriggerRef} onClose={() => setCreateOpen(false)} /> : null}
      </main>
    );
  }
  return (
    <main className="min-h-screen md:flex">
      <WorkspaceNavigation newProjectTriggerRef={createTriggerRef} onNewProject={() => setCreateOpen(true)} />
      <ActiveChat
        key={workspace.activeSelection
          ? `${workspace.activeSelection.projectId}:${workspace.activeSelection.prdId}:${workspace.activeSelection.chatId}`
          : "sin-chat"}
      />
      {createOpen ? <CreateProjectDialog finalFocus={createTriggerRef} onClose={() => setCreateOpen(false)} /> : null}
    </main>
  );
}

function WorkspaceSurface() {
  const { hydrationStatus } = useWorkspace();
  if (hydrationStatus === "loading") return <main className="grid min-h-screen place-items-center p-6"><p role="status" className="text-sm text-muted-foreground">Cargando espacio de trabajo local</p></main>;
  if (hydrationStatus === "invalid") return <InvalidWorkspaceRecovery />;
  return <ReadyWorkspace />;
}

export interface WorkspaceShellProps { persistence?: WorkspacePersistence }

export function WorkspaceShell({ persistence = browserWorkspacePersistence }: WorkspaceShellProps) {
  return <WorkspaceProvider persistence={persistence}><WorkspaceSurface /></WorkspaceProvider>;
}
