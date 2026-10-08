# MVP frontend local de Denker — evidencia de validación

**Fecha de ejecución:** 2026-10-07  
**Estado del repositorio:** worktree actual  
**Suite:** 4 suites, 116 tests aprobados, 0 snapshots

## Trazabilidad de aceptación

Los nombres entre comillas corresponden a tests ejecutados en la corrida completa de `pnpm test`.

| Criterio | Evidencia observable actual | Resultado |
| --- | --- | --- |
| AC-001 | `workspace-shell.test.tsx`: “crea sólo con nombre, inicializa documentos con TBD y lleva el foco al composer”; `workspace.test.ts`: “creates the owned initial branch and explicit TBD documents” | Aprobado |
| AC-002 | `workspace-shell.test.tsx`: “aísla ramas e historiales al crear varios Projects y Chats”; “expande y contrae ramas de Project y PRD de forma independiente” | Aprobado |
| AC-003 | `workspace-shell.test.tsx`: “aísla ramas e historiales al crear varios Projects y Chats”; `workspace.test.ts`: “keeps Chat creation and messages inside their owning PRD” | Aprobado |
| AC-004 | `workspace-shell.test.tsx`: “crea sólo con nombre…”; “configura después un repositorio local con defaults y sin controles de identidad” | Aprobado |
| AC-005 | `workspace-shell.test.tsx`: “mantiene el resumen y la configuración de repositorio en el Project propietario”; “configura después un repositorio local con defaults y sin controles de identidad” | Aprobado |
| AC-006 | `demo-scenarios.test.ts`: catálogo completo, estados esperados y repetibilidad parametrizada; `workspace-shell.test.tsx`: carga observable de escenarios | Aprobado |
| AC-007 | `demo-scenarios.test.ts`: “uses message presence, not message meaning…”; `workspace-shell.test.tsx`: Enter/Shift+Enter/espacios y transición con `fetch` fallando | Aprobado |
| AC-008 | `workspace-shell.test.tsx`: “renderiza Markdown flexible con GFM sin habilitar HTML crudo” | Aprobado |
| AC-009 | `workspace-shell.test.tsx`: edición/preview/save/discard, guard compartido, precedencia ante fixtures y recarga | Aprobado |
| AC-010 | `workspace-shell.test.tsx`: aceptación y rechazo parametrizados para las cinco categorías sensibles, más cambio ordinario sin aprobación; `workspace.test.ts`: invariantes puras equivalentes | Aprobado |
| AC-011 | `workspace-shell.test.tsx`: “muestra sólo acciones válidas y permite editar o volver durante la revisión” | Aprobado |
| AC-012 | `workspace-shell.test.tsx`: finalización con y sin warnings, cancelación, snapshot read-only y bloqueo de mutaciones posteriores | Aprobado |
| AC-013 | `workspace-shell.test.tsx`: recomendación sin creación y ambas continuaciones sólo tras confirmar; `workspace.test.ts`: propiedad y copia exacta | Aprobado |
| AC-014 | `workspace-shell.test.tsx`: navegación entre PRD, Product Context y snapshots desde documentos compartidos | Aprobado |
| AC-015 | `workspace-shell.test.tsx`: “copia la fuente actual, conserva la edición ante rechazo y limita snapshots a lectura” | Aprobado |
| AC-016 | `workspace-shell.test.tsx`: recarga simulada sin acceso de presentación a `localStorage`; `workspace-persistence.test.ts`: round trip y clave dedicada | Aprobado |
| AC-017 | `workspace-shell.test.tsx`: estados de sync, éxito, fallo y retry con fake timers, sin red ni mutación documental; `workspace.test.ts`: invariantes de sync | Aprobado |
| AC-018 | `workspace-shell.test.tsx`: recorridos específicos a 1440, 768 y 390 px; T9 aceptada explícitamente por el usuario el 2026-10-07 | Aprobado |
| AC-019 | `workspace-shell.test.tsx` y `demo-scenarios.test.ts`: recuperaciones parametrizadas de los dos errores aprobados, repetibles y sin pérdida de contenido | Aprobado |
| AC-020 | Instalación aislada desde `pnpm-lock.yaml` con pnpm 11.22.0 y `pnpm run build`; ruta `/` prerenderizada estáticamente | Aprobado |
| AC-021 | Corrida completa: 4 suites y 116 tests Jest/RTL aprobados | Aprobado |
| AC-022 | Tests con `fetch` fallando y búsquedas de código sin cliente HTTP, autenticación, roles, permisos, OAuth ni credenciales | Aprobado |
| AC-023 | `workspace-shell.test.tsx`: sesión usable sin storage y reset confirmado preservando bytes al cancelar; `workspace-persistence.test.ts`: fallback e inválidos | Aprobado |
| AC-024 | T9 aceptada explícitamente por el usuario; RTL cubre teclado, foco, roles, nombres, overlays y viewports, y el contrato se limita a Chrome estable vigente. | Aprobado |

## Gates del repositorio

| Comando | Resultado actual |
| --- | --- |
| Instalación aislada: `pnpm install --frozen-lockfile` | Aprobada con pnpm 11.22.0; 899 paquetes, scripts nativos completados |
| `pnpm typecheck` | Aprobado |
| `pnpm run lint` | Aprobado |
| `pnpm test` | Aprobado: 4 suites, 116 tests |
| `pnpm run build` | Aprobado: compilación, TypeScript y prerender estático de `/` |

El primer intento aislado con `--offline` no se consideró éxito: falló porque el store no contenía el tarball de `react-markdown`. La repetición normal desde el mismo lockfile descargó los artefactos faltantes y aprobó.

## Viewports y navegador objetivo

| Evidencia | Chrome estable vigente |
| --- | --- |
| Aceptación funcional de T9 | Aceptada por el usuario |
| Viewports cubiertos | 1440, 768 y 390 px |

Los viewports de 1440, 768 y 390 px tienen cobertura RTL actual y fueron aceptados por el usuario al cerrar T9. El usuario limitó explícitamente el contrato del MVP a Chrome estable vigente y excluyó versiones antiguas; Firefox, Safari y Edge tampoco forman parte de esta matriz. No se requiere una versión numérica concreta, que quedaría obsoleta con el siguiente release estable.

## Límites comprobados

- Un único workspace de producto en `apps/web`; no se añadieron packages compartidos.
- No existen backend, endpoints de negocio, base de datos, autenticación, colaboración, IA real, cliente GitHub ni sincronización remota.
- `localStorage` y Clipboard permanecen detrás de adaptadores sustituibles.
- Demo Mode y sync son deterministas y locales; los tests relevantes fallan cualquier acceso inesperado a red.
- No se añadió ADR, framework de migraciones, despliegue ni infraestructura E2E.
