# Arquitectura

- **Alcance:** sistema global
- **Estado:** estado actual y restricciones aprobadas al 2026-10-09

## Estado actual

El repositorio contiene el monorepo mínimo de Turborepo y un único workspace de producto en `apps/web`. Ese workspace implementa un shell de Next.js con App Router y TypeScript, la base local de shadcn/ui y pruebas Jest/React Testing Library. El shell entrega HTML neutral con `Cargando espacio de trabajo local` antes de que el cliente resuelva la hidratación. Ya existen el modelo de dominio tipado, una store React, persistencia local recuperable, los recorridos locales para crear y navegar Projects, PRDs y Chats, la edición explícita de sus documentos Markdown, la resolución persistente de propuestas sensibles, la sincronización de demostración mediante un scheduler local inyectable, Demo Mode conversacional mediante fixtures y transiciones deterministas, y el lifecycle completo con review, snapshots inmutables y continuación explícita. Cada PRD posee un recorrido fijo de seis Chats guiados y un grupo separado de Chats adicionales. El shell adapta navegación y documentos como regiones simultáneas en desktop, rail y sheets en tablet, y sheets mutuamente excluyentes alrededor del Chat en mobile. La aceptación funcional manual se limita a Chrome estable vigente; versiones antiguas y otros navegadores quedan fuera del contrato del MVP.

La raíz fija pnpm mediante `packageManager`, conserva un lockfile único y expone `dev`, `typecheck`, `lint`, `test` y `build`. El build genera la ruta `/` de forma estática, sin fuentes remotas, secretos ni servicios externos.

## Contexto del sistema

Denker será una aplicación frontend local y single-user para convertir conversaciones de discovery en Product Context y PRDs Markdown. Durante la primera versión no se comunica con un backend, un LLM ni GitHub.

## Límites aprobados para la primera implementación

| Área | Responsabilidad | Debe poseer | No debe poseer todavía |
| --- | --- | --- | --- |
| Frontend web | Experiencia de Projects, PRDs, Chats y documentos | UI y comportamiento local observable | Backend, autenticación, colaboración o IA real |
| Persistencia local | Guardar y recuperar el estado local | Acceso encapsulado a `localStorage` | IndexedDB, base de datos o persistencia remota |
| Demo Mode | Hacer recorrible y verificable la experiencia | Fixtures y transiciones deterministas | Interpretación de lenguaje o motor de Product Management |
| Documentos | Representar Product Context, PRD vigente y snapshots | Markdown editable y estados del ciclo de vida | WYSIWYG o edición colaborativa |
| Estado de repositorio | Representar conexión y sync en la UI | Estados visuales/mockeados | GitHub API, OAuth, credenciales, commits o sync real |

## Topología y dependencias

- La topología implementada es un monorepo Turborepo con un único workspace de producto, `apps/web`; no existen packages compartidos.
- `apps/web` usa Next.js, App Router y TypeScript. shadcn/ui vive dentro de la aplicación mediante `components.json`, tokens CSS, `src/lib/utils.ts` y primitives bajo `src/components/ui`.
- Los componentes de presentación no acceden a `localStorage`. Una store React compone el dominio con un puerto sustituible de persistencia y el adaptador de navegador posee ese acceso.
- El Markdown guardado vive en el envelope persistido; el borrador, el modo del editor y el feedback de Clipboard son estado transitorio. La copia usa un puerto sustituible y el preview usa `react-markdown` con GFM sin HTML crudo.
- La persistencia local y la sincronización de demostración son responsabilidades separadas; el scheduler de sync sólo cambia metadata local y no conoce red ni providers.
- Demo Mode depende de fixtures deterministas y no se convierte en una capa de inteligencia de agente.
- La disponibilidad de los Chats guiados se deriva del lifecycle del PRD y del progreso explícito de las fases; no se persiste. Las transiciones de dominio impiden seleccionar o mutar una fase bloqueada, incluso si la UI conserva una selección que acaba de volver a bloquearse para mostrar su historial como sólo lectura.
- Los límites futuros para LLM, GitHub o backend se introducirán sólo cuando un PRD activo los requiera.

## Comandos implementados

Todos se ejecutan desde la raíz:

- `pnpm dev`: inicia los procesos de desarrollo declarados por los workspaces.
- `pnpm typecheck`: ejecuta el chequeo TypeScript.
- `pnpm lint`: ejecuta ESLint.
- `pnpm test`: ejecuta Jest y React Testing Library.
- `pnpm build`: produce el build de Next.js coordinado por Turborepo.

## Propiedad y flujo de datos

La propiedad sigue `Project → PRD → Chat`:

- un Project posee Product Context y PRDs;
- un PRD posee exactamente un recorrido fijo con los Chats guiados `PRD`, `Diseño de pantallas`, `Diseño de base de datos`, `Plan de implementación`, `Implementación` y `Pruebas y revisión`, además de cero o más Chats adicionales;
- cada Chat posee su propio historial;
- una versión finalizada del PRD es inmutable.

El workspace confirmado se guarda bajo la clave existente `denker.workspace` como un único envelope estricto `v2`. El decoder valida la clase, fase y progreso de cada Chat; un payload `v1`, desconocido o inconsistente se considera inválido sin conversión automática. La hidratación separa además dato ausente y storage no disponible. Una selección persistida que ya no existe se resuelve al primer Chat disponible siguiendo el orden del workspace. Si `localStorage` falla, el adaptador conserva los cambios en memoria durante la sesión. Un payload inválido permanece intacto y suspende las escrituras hasta que el usuario confirme `Reset local data`.

Flujos relevantes de la primera versión:

1. Crear un Project inicializa Product Context, `PRD 001`, sus seis Chats guiados y navega a `PRD`; crear un PRD posterior repite el recorrido sin compartir estado.
2. `review` o `final` habilitan ambos diseños; sus progresos habilitantes desbloquean el plan, y luego `Implementación` y `Pruebas y revisión`. Un retroceso bloquea dependientes sin borrar progreso ni historial.
3. Los Chats adicionales permanecen siempre disponibles y fuera de las dependencias del recorrido.
4. El usuario recorre un escenario determinista; los cambios ordinarios actualizan el draft local y los sensibles esperan aprobación.
5. El sheet documental lee o edita Markdown según el tipo y estado del documento.
6. Al finalizar, la versión se conserva como snapshot read-only; una evolución crea otra versión o iniciativa.

## Integraciones externas

| Integración | Estado inicial | Límite actual |
| --- | --- | --- |
| GitHub | No implementada | Sólo configuración conceptual y estados visuales/mockeados |
| LLM / agente | No implementado | Sólo guiones deterministas de Demo Mode |
| Backend / almacenamiento remoto | No implementado | Estado persistido localmente en el navegador |

## Compromisos aceptados

- `localStorage` prioriza velocidad y simplicidad para una experiencia local; no cubre escala, concurrencia ni sincronización.
- Demo Mode permite probar el frontend de extremo a extremo sin validar la futura calidad del agente.
- El alcance frontend-only evita anticipar contratos de backend o integraciones cuya forma aún no está decidida.
