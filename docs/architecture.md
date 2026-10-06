# Arquitectura

- **Alcance:** sistema global
- **Estado:** estado actual y restricciones aprobadas al 2026-10-05

## Estado actual

El repositorio contiene el monorepo mínimo de Turborepo y un único workspace de producto en `apps/web`. Ese workspace implementa un shell de Next.js con App Router y TypeScript, la base local de shadcn/ui y pruebas Jest/React Testing Library. El shell entrega HTML neutral con `Cargando espacio de trabajo local` antes de que el cliente resuelva la hidratación. Ya existen el modelo de dominio tipado, una store React, persistencia local recuperable y los recorridos locales para crear y navegar Projects, PRDs y Chats, consultar sus documentos iniciales y guardar la configuración conceptual de repositorio. Demo Mode, edición documental y lifecycle todavía no están implementados.

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
- La persistencia local y la futura sincronización con repositorio son responsabilidades separadas.
- Demo Mode depende de fixtures deterministas y no se convierte en una capa de inteligencia de agente.
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
- un PRD posee sus Chats, documento vigente y versiones;
- cada Chat posee su propio historial;
- una versión finalizada del PRD es inmutable.

El workspace confirmado se guarda como un único envelope `v1`. El decoder distingue payload válido e inválido, y la hidratación separa además dato ausente y storage no disponible. Una selección persistida que ya no existe se resuelve al primer Chat disponible siguiendo el orden del workspace. Si `localStorage` falla, el adaptador conserva los cambios en memoria durante la sesión. Un payload inválido permanece intacto y suspende las escrituras hasta que el usuario confirme `Reset local data`.

Flujos relevantes de la primera versión:

1. Crear Project inicializa Product Context, `PRD 001` y el primer Chat y navega a ese Chat.
2. El usuario recorre un escenario determinista; los cambios ordinarios actualizan el draft local y los sensibles esperan aprobación.
3. El sheet documental lee o edita Markdown según el tipo y estado del documento.
4. Al finalizar, la versión se conserva como snapshot read-only; una evolución crea otra versión o iniciativa.

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
