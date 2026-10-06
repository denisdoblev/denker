"use client";

import { AlertDialog } from "@base-ui/react/alert-dialog";
import { useRef } from "react";

import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/store/workspace-store";

export function InvalidWorkspaceRecovery() {
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const { resetWorkspace } = useWorkspace();

  return (
    <main className="grid min-h-screen place-items-center p-6">
      <section
        aria-labelledby="recovery-title"
        className="max-w-md rounded-xl border bg-card p-6 text-card-foreground shadow-sm"
      >
        <p className="text-sm font-medium text-destructive">Error en los datos locales</p>
        <h1 id="recovery-title" className="mt-2 text-2xl font-semibold">
          Denker no pudo cargar este espacio de trabajo
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Los datos guardados no son válidos. Denker no los ha modificado para
          que puedas cancelar de forma segura o reemplazarlos expresamente por
          un espacio de trabajo vacío.
        </p>

        <AlertDialog.Root>
          <AlertDialog.Trigger
            className="mt-5 inline-flex h-8 items-center justify-center rounded-lg bg-destructive/10 px-2.5 text-sm font-medium text-destructive outline-none hover:bg-destructive/20 focus-visible:ring-3 focus-visible:ring-destructive/20"
          >
            Restablecer datos locales
          </AlertDialog.Trigger>
          <AlertDialog.Portal>
            <AlertDialog.Backdrop className="fixed inset-0 bg-black/40" />
            <AlertDialog.Viewport className="fixed inset-0 grid place-items-center p-6">
              <AlertDialog.Popup
                initialFocus={cancelButtonRef}
                className="w-full max-w-md rounded-xl border bg-background p-6 text-foreground shadow-xl outline-none"
              >
                <AlertDialog.Title className="text-lg font-semibold">
                  ¿Restablecer los datos locales?
                </AlertDialog.Title>
                <AlertDialog.Description className="mt-2 text-sm text-muted-foreground">
                  Los datos guardados se reemplazarán por un espacio de trabajo
                  vacío y no podrán recuperarse desde Denker.
                </AlertDialog.Description>
                <div className="mt-6 flex justify-end gap-2">
                  <AlertDialog.Close
                    ref={cancelButtonRef}
                    render={<Button variant="outline" />}
                  >
                    Cancelar
                  </AlertDialog.Close>
                  <AlertDialog.Close
                    render={<Button variant="destructive" />}
                    onClick={() => void resetWorkspace()}
                  >
                    Restablecer datos locales
                  </AlertDialog.Close>
                </div>
              </AlertDialog.Popup>
            </AlertDialog.Viewport>
          </AlertDialog.Portal>
        </AlertDialog.Root>
      </section>
    </main>
  );
}
