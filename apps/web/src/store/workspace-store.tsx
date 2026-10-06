"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from "react";

import {
  createEmptyWorkspace,
  type WorkspaceState,
} from "@/domain/workspace";
import type { WorkspacePersistence } from "@/persistence/workspace-persistence";

type HydrationStatus = "loading" | "ready" | "invalid";

interface RuntimeState {
  hydrationStatus: HydrationStatus;
  workspace: WorkspaceState;
}

type RuntimeAction =
  | { type: "hydrate"; workspace: WorkspaceState }
  | { type: "invalid" }
  | { type: "replace"; workspace: WorkspaceState }
  | { type: "reset" };

const initialRuntimeState: RuntimeState = {
  hydrationStatus: "loading",
  workspace: createEmptyWorkspace(),
};

function runtimeReducer(
  state: RuntimeState,
  action: RuntimeAction,
): RuntimeState {
  switch (action.type) {
    case "hydrate":
      return { hydrationStatus: "ready", workspace: action.workspace };
    case "invalid":
      return { ...state, hydrationStatus: "invalid" };
    case "replace":
      return { hydrationStatus: "ready", workspace: action.workspace };
    case "reset":
      return { hydrationStatus: "ready", workspace: createEmptyWorkspace() };
  }
}

interface WorkspaceContextValue extends RuntimeState {
  replaceWorkspace: (workspace: WorkspaceState) => void;
  resetWorkspace: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export interface WorkspaceProviderProps {
  children: ReactNode;
  persistence: WorkspacePersistence;
}

export function WorkspaceProvider({
  children,
  persistence,
}: WorkspaceProviderProps) {
  const [runtime, dispatch] = useReducer(runtimeReducer, initialRuntimeState);

  useEffect(() => {
    let active = true;

    void persistence.load().then((result) => {
      if (!active) return;

      if (result.status === "invalid") {
        dispatch({ type: "invalid" });
        return;
      }

      dispatch({
        type: "hydrate",
        workspace:
          result.status === "valid"
            ? result.workspace
            : createEmptyWorkspace(),
      });
    });

    return () => {
      active = false;
    };
  }, [persistence]);

  useEffect(() => {
    if (runtime.hydrationStatus !== "ready") return;
    void persistence.save(runtime.workspace).catch(() => undefined);
  }, [persistence, runtime.hydrationStatus, runtime.workspace]);

  const replaceWorkspace = useCallback((workspace: WorkspaceState) => {
    dispatch({ type: "replace", workspace });
  }, []);

  const resetWorkspace = useCallback(async () => {
    const emptyWorkspace = createEmptyWorkspace();
    try {
      await persistence.reset(emptyWorkspace);
    } catch {
      // A failed storage write must not prevent the in-memory session fallback.
    } finally {
      dispatch({ type: "reset" });
    }
  }, [persistence]);

  const value = useMemo(
    () => ({ ...runtime, replaceWorkspace, resetWorkspace }),
    [replaceWorkspace, resetWorkspace, runtime],
  );

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace(): WorkspaceContextValue {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspace must be used within WorkspaceProvider");
  }
  return context;
}
