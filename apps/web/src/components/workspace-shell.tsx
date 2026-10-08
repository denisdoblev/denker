"use client";

import { Dialog } from "@base-ui/react/dialog";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode, type RefObject } from "react";

import { browserClipboard, type ClipboardPort } from "@/clipboard/clipboard";
import { InvalidWorkspaceRecovery } from "@/components/invalid-workspace-recovery";
import { Button } from "@/components/ui/button";
import {
  advanceDemoConversation,
  DEMO_SCENARIOS,
  DEFAULT_DEMO_SCENARIO_ID,
  demoScenarioWouldReplaceConfirmedState,
  getDemoScenario,
  isDemoErrorScenario,
  loadDemoScenario,
  recoverDemoError as applyDemoErrorRecovery,
  type DemoErrorScenarioId,
  type DemoScenarioId,
} from "@/domain/demo-scenarios";
import {
  beginDemoSync,
  completeDemoSync,
  continueFinalPrd,
  createChat,
  createProject,
  finalizePrd,
  returnPrdToDraft,
  saveRepositoryConfiguration,
  savePrdMarkdown,
  saveProductContextMarkdown,
  selectChat,
  startPrdReview,
  resolveSensitiveProposal,
  type PrdContinuation,
  type PrdLifecycle,
  type Project,
  type ProposalCategory,
  type ProposalResolution,
  type RepositoryConfigurationInput,
  type ReviewFinding,
  type SensitiveProposal,
} from "@/domain/workspace";
import { browserWorkspacePersistence, type WorkspacePersistence } from "@/persistence/workspace-persistence";
import { WorkspaceProvider, useWorkspace } from "@/store/workspace-store";
import { defaultDemoSyncScenario, type DemoSyncScenario } from "@/sync/demo-sync";

const fieldClass = "h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring";

const lifecycleLabels: Record<PrdLifecycle, string> = {
  draft: "Borrador",
  review: "En revisión",
  final: "Final",
};

const findingLabels: Record<ReviewFinding["kind"], string> = {
  gap: "Gap",
  contradiction: "Contradicción",
  ambiguity: "Ambigüedad",
  risk: "Riesgo",
  "pending-decision": "Decisión pendiente",
  "open-question": "Pregunta abierta",
  warning: "Advertencia",
};

type ViewportMode = "mobile" | "tablet" | "desktop";

function useViewportMode(): ViewportMode {
  const readViewport = useCallback((): ViewportMode => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return "desktop";
    if (window.matchMedia("(min-width: 1200px)").matches) return "desktop";
    if (window.matchMedia("(min-width: 640px)").matches) return "tablet";
    return "mobile";
  }, []);
  const [viewport, setViewport] = useState<ViewportMode>(readViewport);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const desktop = window.matchMedia("(min-width: 1200px)");
    const tablet = window.matchMedia("(min-width: 640px)");
    const update = () => setViewport(readViewport());
    desktop.addEventListener("change", update);
    tablet.addEventListener("change", update);
    update();
    return () => {
      desktop.removeEventListener("change", update);
      tablet.removeEventListener("change", update);
    };
  }, [readViewport]);

  return viewport;
}

interface DraftRegistration {
  dirty: boolean;
  discard: () => void;
  focus: RefObject<HTMLElement | null>;
}

interface NavigationGuardValue {
  registerDraft: (registration: DraftRegistration | null) => void;
  request: (action: () => void) => void;
  dirtyDraft: DraftRegistration | null;
  discardDraft: () => void;
}

const NavigationGuardContext = createContext<NavigationGuardValue | null>(null);

function useNavigationGuard() {
  const guard = useContext(NavigationGuardContext);
  if (!guard) throw new Error("useNavigationGuard must be used within NavigationGuardProvider");
  return guard;
}

function NavigationGuardProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<DraftRegistration | null>(null);
  const [pending, setPending] = useState<{ action: () => void } | null>(null);
  const keepEditingRef = useRef<HTMLButtonElement>(null);
  const request = useCallback((action: () => void) => {
    if (draft?.dirty) setPending({ action });
    else action();
  }, [draft]);
  const cancel = () => setPending(null);
  const confirm = () => {
    if (!pending) return;
    const action = pending.action;
    draft?.discard();
    setDraft(null);
    setPending(null);
    action();
  };
  const discardDraft = useCallback(() => {
    draft?.discard();
    setDraft(null);
  }, [draft]);

  return (
    <NavigationGuardContext.Provider value={{ registerDraft: setDraft, request, dirtyDraft: draft?.dirty ? draft : null, discardDraft }}>
      {children}
      {pending ? (
        <DialogFrame title="¿Descartar cambios sin guardar?" initialFocus={keepEditingRef} finalFocus={draft?.focus} onClose={cancel}>
          <p className="text-sm text-muted-foreground">El borrador no se ha guardado. Puedes seguir editando o descartarlo para continuar.</p>
          <div className="mt-5 flex justify-end gap-2">
            <Button ref={keepEditingRef} type="button" variant="outline" onClick={cancel}>Seguir editando</Button>
            <Button type="button" onClick={confirm}>Descartar cambios</Button>
          </div>
        </DialogFrame>
      ) : null}
    </NavigationGuardContext.Provider>
  );
}

function DialogFrame({ title, children, initialFocus, finalFocus, modal = true, disablePointerDismissal = false, surface = "dialog", onClose }: { title: string; children: ReactNode; initialFocus?: RefObject<HTMLElement | null>; finalFocus?: RefObject<HTMLElement | null>; modal?: boolean; disablePointerDismissal?: boolean; surface?: "dialog" | "left-sheet" | "right-sheet"; onClose: () => void }) {
  const sheet = surface !== "dialog";
  return (
    <Dialog.Root open modal={modal} disablePointerDismissal={disablePointerDismissal} onOpenChange={(open) => { if (!open) onClose(); }}>
      <Dialog.Portal>
        {modal ? <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/45" /> : null}
        <Dialog.Viewport className={`fixed inset-0 z-50 flex ${surface === "left-sheet" ? "justify-start" : surface === "right-sheet" ? "justify-end" : "items-center justify-center p-4"}${modal ? "" : " pointer-events-none"}`}>
          <Dialog.Popup initialFocus={initialFocus} finalFocus={finalFocus} className={`pointer-events-auto overflow-auto border bg-background p-6 shadow-xl outline-none ${sheet ? "h-full w-full sm:max-w-[35rem]" : "max-h-[90vh] w-full max-w-lg rounded-xl"}`}>
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
  const { request } = useNavigationGuard();
  const [name, setName] = useState("");
  const [includeRepository, setIncludeRepository] = useState(false);
  const [repository, setRepository] = useState<RepositoryConfigurationInput>({ branch: "main", documentationPath: "/docs" });
  const nameRef = useRef<HTMLInputElement>(null);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    request(() => {
      replaceWorkspace(createProject(workspace, name, includeRepository ? repository : undefined));
      onClose();
    });
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

type DocumentChoice = "prd" | "context" | `snapshot:${string}`;

function MarkdownPreview({ source }: { source: string }) {
  return (
    <div className="markdown-preview mt-4 rounded-lg border bg-background p-4">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{source}</ReactMarkdown>
    </div>
  );
}

interface EditorDraft {
  source: string;
  savedBaseline: string;
}

function DocumentsDialog({ project, prdId, clipboard, finalFocus, inline = false, modal = false, onClose }: { project: Project; prdId: string; clipboard: ClipboardPort; finalFocus: RefObject<HTMLElement | null>; inline?: boolean; modal?: boolean; onClose: () => void }) {
  const { replaceWorkspace, transitionWorkspace, workspace } = useWorkspace();
  const { registerDraft, request } = useNavigationGuard();
  const prd = project.prds.find(({ id }) => id === prdId)!;
  const [document, setDocument] = useState<DocumentChoice>("prd");
  const [mode, setMode] = useState<"preview" | "edit">("preview");
  const [draft, setDraft] = useState<EditorDraft>({ source: prd.document.markdown, savedBaseline: prd.document.markdown });
  const [copyStatus, setCopyStatus] = useState<"idle" | "success" | "error">("idle");
  const [finalizeOpen, setFinalizeOpen] = useState(false);
  const [acceptWarnings, setAcceptWarnings] = useState(false);
  const [continueOpen, setContinueOpen] = useState(false);
  const [continuation, setContinuation] = useState<PrdContinuation | null>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const documentSelectRef = useRef<HTMLSelectElement>(null);
  const previewTabRef = useRef<HTMLButtonElement>(null);
  const editTabRef = useRef<HTMLButtonElement>(null);
  const selectedSnapshot = document.startsWith("snapshot:")
    ? prd.snapshots.find(({ id }) => `snapshot:${id}` === document)
    : undefined;
  const savedSource = document === "prd"
    ? prd.document.markdown
    : document === "context"
      ? project.productContext.markdown
      : selectedSnapshot?.markdown ?? "";
  const readOnly = Boolean(selectedSnapshot) || (document === "prd" && prd.lifecycle === "final");
  const draftSource = draft.source === draft.savedBaseline ? savedSource : draft.source;
  const visibleSource = readOnly ? savedSource : draftSource;
  const dirty = !readOnly && draftSource !== savedSource;
  const remainingWarnings = prd.findings.filter(
    ({ kind, resolved }) => kind === "warning" && !resolved,
  );
  const currentVersion = Math.max(0, ...prd.snapshots.map(({ version }) => version))
    + (prd.lifecycle === "final" ? 0 : 1);

  useEffect(() => {
    registerDraft({ dirty, discard: () => setDraft({ source: savedSource, savedBaseline: savedSource }), focus: editorRef });
    return () => registerDraft(null);
  }, [dirty, registerDraft, savedSource]);

  useEffect(() => {
    if (inline) documentSelectRef.current?.focus();
  }, [inline]);

  const changeDocument = (next: DocumentChoice) => {
    request(() => {
      const snapshotId = next.startsWith("snapshot:") ? next.slice("snapshot:".length) : null;
      const nextSource = next === "prd"
        ? prd.document.markdown
        : next === "context"
          ? project.productContext.markdown
          : prd.snapshots.find(({ id }) => id === snapshotId)?.markdown ?? "";
      setDocument(next);
      setDraft({ source: nextSource, savedBaseline: nextSource });
      setMode("preview");
      setCopyStatus("idle");
    });
  };
  const save = () => {
    const next = document === "prd"
      ? savePrdMarkdown(workspace, project.id, prd.id, draftSource)
      : saveProductContextMarkdown(workspace, project.id, draftSource);
    setDraft({ source: draftSource, savedBaseline: draftSource });
    replaceWorkspace(next);
  };
  const copy = async () => {
    try {
      await clipboard.writeText(visibleSource);
      setCopyStatus("success");
    } catch {
      setCopyStatus("error");
    }
  };
  const transitionLifecycle = (action: "review" | "draft") => {
    request(() => transitionWorkspace((current) => action === "review"
      ? startPrdReview(current, project.id, prd.id)
      : returnPrdToDraft(current, project.id, prd.id)));
  };
  const openFinalization = () => request(() => {
    setAcceptWarnings(false);
    setFinalizeOpen(true);
  });
  const confirmFinalization = () => {
    transitionWorkspace((current) => finalizePrd(
      current,
      project.id,
      prd.id,
      acceptWarnings,
    ));
    setFinalizeOpen(false);
  };
  const confirmContinuation = () => {
    if (!continuation || !workspace.activeSelection) return;
    transitionWorkspace((current) => continueFinalPrd(
      current,
      workspace.activeSelection!,
      continuation,
    ));
    setContinueOpen(false);
  };
  const handleTabKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (readOnly || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const nextMode = event.key === "Home"
      ? "preview"
      : event.key === "End"
        ? "edit"
        : event.key === "ArrowRight"
          ? mode === "preview" ? "edit" : "preview"
          : mode === "edit" ? "preview" : "edit";
    setMode(nextMode);
    queueMicrotask(() => {
      (nextMode === "preview" ? previewTabRef : editTabRef).current?.focus();
    });
  };

  const content = (
    <>
      <label className="block space-y-1 text-sm">
        <span>Documento</span>
        <select ref={documentSelectRef} className={fieldClass} value={document} onChange={(event) => changeDocument(event.target.value as DocumentChoice)}>
          <option value="prd">PRD actual</option>
          <option value="context">Product Context</option>
          {prd.snapshots.map((snapshot) => <option key={snapshot.id} value={`snapshot:${snapshot.id}`}>Versión final {snapshot.version}</option>)}
        </select>
      </label>
      {document === "prd" ? (
        <section className="mt-4 rounded-lg border bg-muted/30 p-3" aria-label="Ciclo de vida del PRD">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-medium">{prd.title} · Versión {currentVersion} · {lifecycleLabels[prd.lifecycle]}</p>
            <div className="flex flex-wrap gap-2">
              {prd.lifecycle === "draft" ? (
                <Button type="button" size="sm" onClick={() => transitionLifecycle("review")}>Iniciar revisión</Button>
              ) : null}
              {prd.lifecycle === "review" ? (
                <>
                  <Button type="button" size="sm" variant="outline" onClick={() => transitionLifecycle("draft")}>Volver a borrador</Button>
                  <Button type="button" size="sm" onClick={openFinalization}>Finalizar PRD</Button>
                </>
              ) : null}
              {prd.lifecycle === "final" ? (
                <Button type="button" size="sm" onClick={() => {
                  setContinuation(null);
                  setContinueOpen(true);
                }}>Continuar trabajo</Button>
              ) : null}
            </div>
          </div>
          {prd.lifecycle === "review" ? (
            <div className="mt-3" aria-labelledby="review-findings-title">
              <h3 id="review-findings-title" className="font-medium">Hallazgos de revisión ({prd.findings.length})</h3>
              {prd.findings.length > 0 ? (
                <ul className="mt-2 space-y-2">
                  {prd.findings.map((finding) => (
                    <li key={finding.id} className="rounded-md border bg-background p-2 text-sm">
                      <span className="font-medium">{findingLabels[finding.kind]}</span>: {finding.description}
                    </li>
                  ))}
                </ul>
              ) : <p className="mt-1 text-sm text-muted-foreground">No hay hallazgos pendientes.</p>}
            </div>
          ) : null}
        </section>
      ) : null}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Modo del documento" className="flex gap-2" onKeyDown={handleTabKeyDown}>
          <Button ref={previewTabRef} id="document-preview-tab" role="tab" aria-selected={mode === "preview"} aria-controls="document-preview-panel" tabIndex={mode === "preview" ? 0 : -1} type="button" size="sm" variant={mode === "preview" ? "default" : "outline"} onClick={() => setMode("preview")}>Vista previa</Button>
          {!readOnly ? <Button ref={editTabRef} id="document-edit-tab" role="tab" aria-selected={mode === "edit"} aria-controls="document-edit-panel" tabIndex={mode === "edit" ? 0 : -1} type="button" size="sm" variant={mode === "edit" ? "default" : "outline"} onClick={() => { setMode("edit"); queueMicrotask(() => editorRef.current?.focus()); }}>Editar</Button> : null}
        </div>
        <Button type="button" size="sm" variant="outline" onClick={() => void copy()}>Copiar</Button>
        {readOnly ? <span className="text-sm font-medium">Sólo lectura</span> : null}
        {dirty ? <span className="text-sm font-medium">Cambios sin guardar</span> : <span className="text-sm text-muted-foreground">Guardado localmente</span>}
      </div>
      {mode === "edit" && !readOnly ? (
        <div id="document-edit-panel" role="tabpanel" aria-labelledby="document-edit-tab">
          <label className="mt-4 block space-y-1 text-sm">
            <span>Fuente Markdown</span>
            <textarea ref={editorRef} className="min-h-72 w-full resize-y rounded-md border bg-background p-3 font-mono text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" value={draftSource} onChange={(event) => setDraft({ source: event.target.value, savedBaseline: savedSource })} />
          </label>
        </div>
      ) : <div id="document-preview-panel" role="tabpanel" aria-labelledby="document-preview-tab"><MarkdownPreview source={visibleSource} /></div>}
      {!readOnly ? (
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" disabled={!dirty} onClick={() => request(() => setDraft({ source: savedSource, savedBaseline: savedSource }))}>Descartar cambios</Button>
          <Button type="button" disabled={!dirty} onClick={save}>Guardar cambios</Button>
        </div>
      ) : null}
      <div aria-live="polite" className={copyStatus === "error" ? "mt-3 text-sm text-destructive" : "mt-3 text-sm text-muted-foreground"}>
        {copyStatus === "success" ? "Markdown copiado" : copyStatus === "error" ? "No se pudo copiar el Markdown" : null}
      </div>
      {finalizeOpen ? (
        <DialogFrame title="Finalizar PRD" onClose={() => setFinalizeOpen(false)}>
          {remainingWarnings.length > 0 ? (
            <>
              <p className="text-sm">Quedan estas advertencias:</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                {remainingWarnings.map((warning) => <li key={warning.id}>{warning.description}</li>)}
              </ul>
              <label className="mt-4 flex items-start gap-2 text-sm">
                <input type="checkbox" checked={acceptWarnings} onChange={(event) => setAcceptWarnings(event.target.checked)} />
                <span>Acepto las advertencias restantes</span>
              </label>
            </>
          ) : <p className="text-sm">Se creará un snapshot inmutable de esta versión.</p>}
          <div className="mt-5 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setFinalizeOpen(false)}>Cancelar</Button>
            <Button type="button" disabled={remainingWarnings.length > 0 && !acceptWarnings} onClick={confirmFinalization}>Finalizar PRD</Button>
          </div>
        </DialogFrame>
      ) : null}
      {continueOpen ? (
        <DialogFrame title="Continuar trabajo" onClose={() => setContinueOpen(false)}>
          <fieldset className="space-y-3">
            <legend className="text-sm">Elige cómo continuar. No se creará nada hasta confirmar.</legend>
            <label className="flex items-start gap-2 rounded-md border p-3 text-sm">
              <input type="radio" name="continuation" checked={continuation === "new-version"} onChange={() => setContinuation("new-version")} />
              <span>Crear una nueva versión de este PRD</span>
            </label>
            <label className="flex items-start gap-2 rounded-md border p-3 text-sm">
              <input type="radio" name="continuation" checked={continuation === "new-prd"} onChange={() => setContinuation("new-prd")} />
              <span>Crear un PRD nuevo para una iniciativa diferente</span>
            </label>
          </fieldset>
          <div className="mt-5 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setContinueOpen(false)}>Cancelar</Button>
            <Button type="button" disabled={!continuation} onClick={confirmContinuation}>Confirmar</Button>
          </div>
        </DialogFrame>
      ) : null}
    </>
  );

  if (inline) {
    return (
      <aside aria-label="Documentos compartidos" className="h-screen w-[clamp(27.5rem,34vw,32.5rem)] shrink-0 overflow-auto border-l bg-background p-6">
        <div className="mb-5 flex items-start justify-between gap-4">
          <h2 tabIndex={-1} className="text-xl font-semibold">Documentos compartidos</h2>
          <Button type="button" variant="ghost" aria-label="Cerrar" onClick={() => request(onClose)}>Cerrar</Button>
        </div>
        {content}
      </aside>
    );
  }

  return (
    <DialogFrame title="Documentos compartidos" initialFocus={documentSelectRef} finalFocus={finalFocus} modal={modal} surface="right-sheet" disablePointerDismissal onClose={() => request(onClose)}>
      {content}
    </DialogFrame>
  );
}

const syncLabels = {
  synced: "Sincronizado",
  unsynced: "Cambios sin sincronizar",
  syncing: "Sincronizando",
  failed: "Error de sincronización",
} as const;

const proposalDetails: Record<ProposalCategory, { category: string; document: string; effect: string }> = {
  "remove-requirement": {
    category: "Eliminar requisitos",
    document: "PRD actual",
    effect: "Reemplaza el PRD por una versión que elimina un requisito.",
  },
  "change-decision": {
    category: "Modificar decisiones consolidadas",
    document: "PRD actual",
    effect: "Reemplaza el PRD por una versión que modifica una decisión consolidada.",
  },
  "change-scope": {
    category: "Cambiar materialmente el alcance",
    document: "PRD actual",
    effect: "Reemplaza el PRD por una versión con un alcance materialmente distinto.",
  },
  "change-product-context": {
    category: "Alterar Product Context",
    document: "Product Context",
    effect: "Reemplaza el Product Context vigente por el contenido propuesto.",
  },
  destructive: {
    category: "Cambio potencialmente destructivo",
    document: "PRD actual",
    effect: "Reemplaza el PRD y puede descartar información existente.",
  },
};

function SensitiveProposalCard({
  proposal,
  onResolve,
}: {
  proposal: SensitiveProposal;
  onResolve: (resolution: ProposalResolution) => void;
}) {
  const statusRef = useRef<HTMLHeadingElement>(null);
  const previousResolution = useRef(proposal.resolution);
  const details = proposalDetails[proposal.category];

  useEffect(() => {
    if (previousResolution.current === "pending" && proposal.resolution !== "pending") {
      statusRef.current?.focus();
    }
    previousResolution.current = proposal.resolution;
  }, [proposal.resolution]);

  const status = proposal.resolution === "pending"
    ? "Aprobación pendiente"
    : proposal.resolution === "accepted"
      ? "Aceptada"
      : "Rechazada";

  return (
    <section className="rounded-lg border border-amber-500/50 bg-amber-500/5 p-4" aria-labelledby={`${proposal.id}-status`}>
      <h2 ref={statusRef} id={`${proposal.id}-status`} tabIndex={proposal.resolution === "pending" ? undefined : -1} className="font-semibold">{status}</h2>
      <dl className="mt-2 grid gap-1 text-sm">
        <div><dt className="inline font-medium">Categoría: </dt><dd className="inline">{details.category}</dd></div>
        <div><dt className="inline font-medium">Documento afectado: </dt><dd className="inline">{details.document}</dd></div>
        <div><dt className="inline font-medium">Efecto: </dt><dd className="inline">{details.effect}</dd></div>
      </dl>
      <p className="mt-3 text-sm font-medium">Contenido propuesto</p>
      <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded-md border bg-background p-3 text-xs">{proposal.proposedMarkdown}</pre>
      {proposal.resolution === "pending" ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" size="sm" onClick={() => onResolve("accepted")}>Aceptar cambio</Button>
          <Button type="button" size="sm" variant="outline" onClick={() => onResolve("rejected")}>Rechazar cambio</Button>
        </div>
      ) : null}
    </section>
  );
}

function WorkspaceNavigation({ demoSync, newProjectTriggerRef, embedded = false, onNewProject, onNavigate }: { demoSync: DemoSyncScenario; newProjectTriggerRef: RefObject<HTMLButtonElement | null>; embedded?: boolean; onNewProject: () => void; onNavigate?: (focus: "heading" | "composer") => void }) {
  const { replaceWorkspace, transitionWorkspace, workspace } = useWorkspace();
  const { request } = useNavigationGuard();
  const [collapsedProjects, setCollapsedProjects] = useState<Set<string>>(() => new Set());
  const [collapsedPrds, setCollapsedPrds] = useState<Set<string>>(() => new Set());
  const [repositoryTarget, setRepositoryTarget] = useState<{ projectId: string; trigger: HTMLButtonElement } | null>(null);
  const cancelPendingSyncRef = useRef<(() => void) | null>(null);

  useEffect(() => () => cancelPendingSyncRef.current?.(), []);

  const runDemoSync = (project: Project) => {
    if (!project.repository || workspace.syncState === "syncing") return;
    cancelPendingSyncRef.current?.();
    transitionWorkspace((current) => beginDemoSync(current, project.id));
    cancelPendingSyncRef.current = demoSync.schedule(() => {
      transitionWorkspace((current) => completeDemoSync(current, demoSync.result));
      cancelPendingSyncRef.current = null;
    });
  };

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
    <aside aria-label="Navegación del espacio de trabajo" className={embedded ? "w-full bg-[var(--sidebar)]" : "h-screen w-[17rem] shrink-0 overflow-auto border-r bg-[var(--sidebar)] p-4"}>
      <div className="mb-5 flex items-center justify-between gap-3">
        <strong className="text-lg">Denker</strong>
        <Button ref={newProjectTriggerRef} type="button" size="sm" onClick={() => request(onNewProject)}>Nuevo Project</Button>
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
                    <>
                      <p><strong>Configuración de demostración:</strong> {project.repository.provider || "Proveedor TBD"} · {project.repository.ownerOrOrganization || "Propietario TBD"}/{project.repository.repository || "Repositorio TBD"} · {project.repository.branch} · {project.repository.documentationPath}</p>
                      <div className="mt-2 border-t pt-2">
                        <p><strong>Sincronización de demostración:</strong> <span aria-live="polite">{syncLabels[workspace.syncState]}</span></p>
                        <Button
                          type="button"
                          size="xs"
                          variant="outline"
                          className="mt-1"
                          disabled={workspace.syncState === "syncing"}
                          aria-label={`Sincronizar ahora ${project.name}`}
                          onClick={() => runDemoSync(project)}
                        >
                          Sincronizar ahora
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p><strong>Repositorio no conectado.</strong> Puedes continuar localmente.</p>
                      <p className="mt-1 text-muted-foreground">Sincronización de demostración no disponible.</p>
                    </>
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
                      <p className="text-sm font-medium">{prd.title} · {lifecycleLabels[prd.lifecycle]}</p>
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
                        <Button type="button" size="xs" variant="ghost" onClick={() => request(() => {
                          replaceWorkspace(createChat(workspace, project.id, prd.id));
                          onNavigate?.("composer");
                        })} aria-label={`Nuevo Chat en ${prd.title} de ${project.name}`}>Nuevo Chat</Button>
                        <ul className="mt-1 space-y-1">
                          {prd.chats.map((chat) => {
                            const active = workspace.activeSelection?.chatId === chat.id;
                            return (
                              <li key={chat.id}>
                                <button type="button" aria-current={active ? "page" : undefined} title={chat.title} className="w-full truncate rounded-md px-2 py-1.5 text-left text-sm outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground" onClick={() => request(() => {
                                  replaceWorkspace(selectChat(workspace, { projectId: project.id, prdId: prd.id, chatId: chat.id }));
                                  onNavigate?.("heading");
                                })}>
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

function ActiveChat({ viewport, focusTarget, navigationOpen, documentsOpen, navigationTriggerRef, documentsTriggerRef, onOpenNavigation, onOpenDocuments }: { viewport: ViewportMode; focusTarget: "heading" | "composer"; navigationOpen: boolean; documentsOpen: boolean; navigationTriggerRef: RefObject<HTMLButtonElement | null>; documentsTriggerRef: RefObject<HTMLButtonElement | null>; onOpenNavigation: () => void; onOpenDocuments: () => void }) {
  const { replaceWorkspace, transitionWorkspace, workspace } = useWorkspace();
  const { dirtyDraft, discardDraft } = useNavigationGuard();
  const [composer, setComposer] = useState("");
  const [selectedScenarioId, setSelectedScenarioId] = useState<DemoScenarioId>(DEFAULT_DEMO_SCENARIO_ID);
  const [pendingScenario, setPendingScenario] = useState<{
    id: DemoScenarioId;
    replacesDraft: boolean;
    replacesConfirmed: boolean;
  } | null>(null);
  const [demoError, setDemoError] = useState<DemoErrorScenarioId | null>(null);
  const [proposalAnnouncement, setProposalAnnouncement] = useState("");
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const chatTitleRef = useRef<HTMLHeadingElement>(null);
  const loadScenarioRef = useRef<HTMLButtonElement>(null);
  const cancelScenarioLoadRef = useRef<HTMLButtonElement>(null);
  const selection = workspace.activeSelection;
  const active = useMemo(() => {
    const project = workspace.projects.find(({ id }) => id === selection?.projectId);
    const prd = project?.prds.find(({ id }) => id === selection?.prdId);
    const chat = prd?.chats.find(({ id }) => id === selection?.chatId);
    return project && prd && chat ? { project, prd, chat } : null;
  }, [selection, workspace.projects]);
  useEffect(() => {
    if (focusTarget === "heading") chatTitleRef.current?.focus();
    else composerRef.current?.focus();
  }, [active?.chat.id, focusTarget]);
  if (!active || !selection) return null;
  const send = () => {
    if (!composer.trim()) return;
    replaceWorkspace(advanceDemoConversation(workspace, selection, composer));
    setComposer("");
    composerRef.current?.focus();
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    send();
  };
  const performScenarioLoad = (scenarioId: DemoScenarioId) => {
    replaceWorkspace(loadDemoScenario(workspace, selection, scenarioId));
    setDemoError(null);
    setPendingScenario(null);
    queueMicrotask(() => composerRef.current?.focus());
  };
  const requestScenarioLoad = () => {
    if (isDemoErrorScenario(selectedScenarioId)) {
      setDemoError(selectedScenarioId);
      return;
    }
    const replacesDraft = Boolean(dirtyDraft);
    const replacesConfirmed = demoScenarioWouldReplaceConfirmedState(
      workspace,
      selection,
      selectedScenarioId,
    );
    if (replacesDraft || replacesConfirmed) {
      setPendingScenario({ id: selectedScenarioId, replacesDraft, replacesConfirmed });
    } else {
      performScenarioLoad(selectedScenarioId);
    }
  };
  const recoverDemoError = () => {
    if (!demoError) return;
    replaceWorkspace(applyDemoErrorRecovery(workspace, selection, demoError));
    setDemoError(null);
    queueMicrotask(() => composerRef.current?.focus());
  };
  const resolveProposal = (proposal: SensitiveProposal, resolution: ProposalResolution) => {
    transitionWorkspace((current) => resolveSensitiveProposal(
      current,
      selection,
      proposal.id,
      resolution,
    ));
    setProposalAnnouncement(
      resolution === "accepted"
        ? `Cambio aceptado para ${proposalDetails[proposal.category].document}.`
        : `Cambio rechazado para ${proposalDetails[proposal.category].document}.`,
    );
  };
  const activeError = demoError ? getDemoScenario(demoError) : null;
  return (
    <section className="flex h-screen min-h-0 min-w-0 flex-1 flex-col xl:min-w-[30rem]" aria-labelledby="chat-title">
      <header className="border-b p-4">
        <p className="line-clamp-2 text-sm text-muted-foreground">{active.project.name} / {active.prd.title} / {active.chat.title}</p>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 ref={chatTitleRef} id="chat-title" tabIndex={-1} className="text-xl font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring">{active.chat.title}</h1>
            <p className="text-sm font-medium">Estado del PRD: {lifecycleLabels[active.prd.lifecycle]}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {viewport === "mobile" ? <Button ref={navigationTriggerRef} type="button" variant="outline" aria-haspopup="dialog" aria-expanded={navigationOpen} onClick={onOpenNavigation}>Abrir navegación</Button> : null}
            <Button ref={documentsTriggerRef} type="button" variant="outline" aria-haspopup={viewport === "desktop" ? undefined : "dialog"} aria-expanded={documentsOpen} onClick={onOpenDocuments}>Abrir documentos</Button>
          </div>
        </div>
      </header>
      <div className="border-b bg-muted/40 p-4" aria-label="Modo de demostración">
        <p className="text-sm font-semibold">Modo de demostración</p>
        <p className="mt-1 text-sm text-muted-foreground">Usa un guion fijo. Los mensajes no se interpretan.</p>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="min-w-64 flex-1 space-y-1 text-sm">
            <span>Escenario</span>
            <select
              className={fieldClass}
              value={selectedScenarioId}
              onChange={(event) => setSelectedScenarioId(event.target.value as DemoScenarioId)}
            >
              {DEMO_SCENARIOS.map((scenario) => (
                <option key={scenario.id} value={scenario.id}>{scenario.name}</option>
              ))}
            </select>
          </label>
          <Button ref={loadScenarioRef} type="button" variant="outline" onClick={requestScenarioLoad}>Cargar escenario</Button>
        </div>
      </div>
      <div className="flex-1 space-y-3 overflow-auto p-4" role="log" aria-live="polite" aria-label="Historial del Chat">
        {activeError?.kind === "error" ? (
          <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-4">
            <p className="font-semibold">{activeError.name}</p>
            <p className="mt-1 text-sm">{activeError.error.description}</p>
            <Button className="mt-3" type="button" size="sm" onClick={recoverDemoError}>{activeError.error.recoveryLabel}</Button>
          </div>
        ) : null}
        {active.chat.messages.length === 0 ? (
          <div className="grid min-h-52 place-items-center text-center"><div><h2 className="font-semibold">Describe tu idea</h2><p className="mt-1 text-sm text-muted-foreground">Cuéntanos qué quieres descubrir o documentar en este Chat.</p></div></div>
        ) : active.chat.messages.map((message) => (
          <article className={`${message.role === "user" ? "ml-auto bg-muted" : "mr-auto border bg-background"} max-w-2xl rounded-lg p-3`} key={message.id}><p className="text-xs font-semibold">{message.role === "user" ? "Tú" : "Demo"}</p><p className="mt-1 whitespace-pre-wrap [overflow-wrap:anywhere]">{message.content}</p></article>
        ))}
        {active.prd.proposals.map((proposal) => (
          <SensitiveProposalCard key={proposal.id} proposal={proposal} onResolve={(resolution) => resolveProposal(proposal, resolution)} />
        ))}
      </div>
      <p className="sr-only" aria-live="polite">{proposalAnnouncement}</p>
      <form className="border-t p-4 pb-[max(1rem,env(safe-area-inset-bottom))]" onSubmit={submit}>
        <label className="block text-sm font-medium" htmlFor="composer">Mensaje</label>
        <div className="mt-1 flex items-end gap-2">
          <textarea
            id="composer"
            ref={composerRef}
            rows={2}
            className="max-h-36 min-h-16 flex-1 resize-y overflow-y-auto rounded-md border bg-background p-3 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={composer}
            onChange={(event) => setComposer(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                send();
              }
            }}
          />
          <Button type="submit" disabled={!composer.trim()}>Enviar</Button>
        </div>
      </form>
      {pendingScenario ? (
        <DialogFrame title="¿Cargar este escenario?" initialFocus={cancelScenarioLoadRef} finalFocus={loadScenarioRef} onClose={() => setPendingScenario(null)}>
          <p className="text-sm text-muted-foreground">
            Cargar “{getDemoScenario(pendingScenario.id).name}” reemplazará
            {pendingScenario.replacesDraft && pendingScenario.replacesConfirmed
              ? " el borrador sin guardar y el estado confirmado de esta demostración."
              : pendingScenario.replacesDraft
                ? " el borrador sin guardar."
                : " el estado confirmado de esta demostración."}
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <Button ref={cancelScenarioLoadRef} type="button" variant="outline" onClick={() => setPendingScenario(null)}>Cancelar</Button>
            <Button type="button" onClick={() => {
              discardDraft();
              performScenarioLoad(pendingScenario.id);
            }}>Cargar escenario</Button>
          </div>
        </DialogFrame>
      ) : null}
    </section>
  );
}

function ReadyWorkspace({ clipboard, demoSync }: { clipboard: ClipboardPort; demoSync: DemoSyncScenario }) {
  const { workspace } = useWorkspace();
  const { request } = useNavigationGuard();
  const viewport = useViewportMode();
  const supportsResponsiveViewport = typeof window !== "undefined" && typeof window.matchMedia === "function";
  const [createOpen, setCreateOpen] = useState(false);
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [documentsOpen, setDocumentsOpen] = useState(false);
  const [chatFocusTarget, setChatFocusTarget] = useState<"heading" | "composer">("composer");
  const createTriggerRef = useRef<HTMLButtonElement>(null);
  const navigationTriggerRef = useRef<HTMLButtonElement>(null);
  const documentsTriggerRef = useRef<HTMLButtonElement>(null);
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
  const selection = workspace.activeSelection;
  const activeProject = workspace.projects.find(({ id }) => id === selection?.projectId);
  const activePrd = activeProject?.prds.find(({ id }) => id === selection?.prdId);
  const openNavigation = () => request(() => {
    setDocumentsOpen(false);
    setNavigationOpen(true);
  });
  const openDocuments = () => {
    setNavigationOpen(false);
    setDocumentsOpen(true);
  };
  const navigation = (
    <WorkspaceNavigation
      demoSync={demoSync}
      newProjectTriggerRef={createTriggerRef}
      embedded={viewport !== "desktop"}
      onNewProject={() => {
        setChatFocusTarget("composer");
        setNavigationOpen(false);
        setCreateOpen(true);
      }}
      onNavigate={(focus) => {
        setChatFocusTarget(focus);
        setNavigationOpen(false);
        setDocumentsOpen(false);
      }}
    />
  );
  return (
      <main className="flex h-screen min-h-0 overflow-hidden">
        {viewport === "desktop" ? navigation : null}
        {viewport === "tablet" ? (
          <aside aria-label="Navegación contraída" className="flex h-screen w-14 shrink-0 flex-col items-center border-r bg-[var(--sidebar)] py-3">
            <Button ref={navigationTriggerRef} className="h-auto py-2 [writing-mode:vertical-rl]" type="button" size="sm" variant="ghost" aria-haspopup="dialog" aria-expanded={navigationOpen} onClick={openNavigation}>Abrir navegación</Button>
          </aside>
        ) : null}
        <ActiveChat
          viewport={viewport}
          focusTarget={chatFocusTarget}
          navigationOpen={navigationOpen}
          documentsOpen={documentsOpen}
          navigationTriggerRef={navigationTriggerRef}
          documentsTriggerRef={documentsTriggerRef}
          onOpenNavigation={openNavigation}
          onOpenDocuments={openDocuments}
          key={workspace.activeSelection
            ? `${workspace.activeSelection.projectId}:${workspace.activeSelection.prdId}:${workspace.activeSelection.chatId}:${createOpen ? "creating" : "active"}`
            : "sin-chat"}
        />
        {documentsOpen && activeProject && activePrd ? (
          <DocumentsDialog
            project={activeProject}
            prdId={activePrd.id}
            clipboard={clipboard}
            finalFocus={documentsTriggerRef}
            inline={viewport === "desktop" && supportsResponsiveViewport}
            modal={supportsResponsiveViewport && viewport !== "desktop"}
            onClose={() => setDocumentsOpen(false)}
          />
        ) : null}
        {navigationOpen && viewport !== "desktop" ? (
          <DialogFrame title="Navegación" finalFocus={navigationTriggerRef} surface="left-sheet" onClose={() => setNavigationOpen(false)}>
            {navigation}
          </DialogFrame>
        ) : null}
        {createOpen ? <CreateProjectDialog finalFocus={createTriggerRef} onClose={() => setCreateOpen(false)} /> : null}
      </main>
  );
}

export function WorkspaceSurface({ clipboard, demoSync = defaultDemoSyncScenario }: { clipboard: ClipboardPort; demoSync?: DemoSyncScenario }) {
  const { hydrationStatus } = useWorkspace();
  if (hydrationStatus === "loading") return <main className="grid min-h-screen place-items-center p-6"><p role="status" className="text-sm text-muted-foreground">Cargando espacio de trabajo local</p></main>;
  if (hydrationStatus === "invalid") return <InvalidWorkspaceRecovery />;
  return <NavigationGuardProvider><ReadyWorkspace clipboard={clipboard} demoSync={demoSync} /></NavigationGuardProvider>;
}

export interface WorkspaceShellProps { persistence?: WorkspacePersistence; clipboard?: ClipboardPort; demoSync?: DemoSyncScenario }

export function WorkspaceShell({ persistence = browserWorkspacePersistence, clipboard = browserClipboard, demoSync = defaultDemoSyncScenario }: WorkspaceShellProps) {
  return <WorkspaceProvider persistence={persistence}><WorkspaceSurface clipboard={clipboard} demoSync={demoSync} /></WorkspaceProvider>;
}
