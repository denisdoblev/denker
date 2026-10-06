# MVP frontend local de Denker — plan de implementación

**Spec:** `specs/001-mvp/spec.md` (`SPEC-001`)
**Status:** accepted
**UI design required:** yes — la experiencia combina navegación jerárquica, Chat, edición documental, confirmaciones, estados de lifecycle y variantes responsive sustantivas; `$ui-design` debe fijar los flujos y estados visuales antes de descomponer la implementación.
**Change profile:** UI, architecture, data/migration — se crea la primera aplicación, sus límites internos y un contrato persistido local; no se introducen backend, API remota ni migraciones desde datos anteriores.
**Full validation:** yes — es una implementación fundacional y transversal que debe probar flujos de estado, persistencia y recuperación, build, accesibilidad, responsive y compatibilidad de navegador; no existe una baseline ejecutable previa en la que apoyar afirmaciones parciales.

## Approach

Crear el monorepo mínimo con `pnpm` y Turborepo, conservando en la raíz la documentación y el framework SDD actuales y añadiendo un único workspace `apps/web` para la aplicación Next.js con TypeScript. El campo `packageManager` y el lockfile fijarán la versión real elegida durante el scaffold. La configuración raíz orquestará los scripts que existan en el workspace (`dev`, `build`, `typecheck`, `lint` y `test`) mediante tareas de Turborepo. No se crearán packages compartidos: shadcn/ui, estilos, utilidades y componentes permanecerán en la aplicación hasta que haya un segundo consumidor real.

La aplicación usará App Router como shell frontend y concentrará la experiencia en una sola superficie navegable, sin requerir URLs públicas por entidad. La selección de Project, PRD, Chat y documento será estado de la aplicación. El shell cliente será responsable de hidratar el estado local antes de mostrar datos dependientes del navegador, evitando leer `localStorage` durante el render de servidor.

El modelo de dominio TypeScript representará explícitamente la propiedad `Project → PRD → Chat`, Product Context a nivel Project, documento vigente y snapshots finalizados a nivel PRD, historiales por Chat, propuestas sensibles, hallazgos de review, configuración conceptual de repositorio y estado mockeado de sincronización. Identificadores estables y colecciones normalizadas o indexadas impedirán mezclar ramas; las funciones de consulta resolverán siempre las relaciones desde sus propietarios.

Las mutaciones se expresarán como acciones de dominio y transiciones puras, consumidas desde una única store React basada en capacidades nativas (`Context` más reducer) o una composición equivalente sin librería externa de estado. Las invariantes críticas quedarán en esas transiciones: un Chat sólo se crea bajo un PRD; una propuesta sensible no modifica documentos antes de ser aceptada; un snapshot `final` no admite mutaciones; y una recomendación no crea versiones o PRDs sin una acción explícita. Los componentes de presentación recibirán estado y callbacks y no conocerán `localStorage` ni implementarán reglas de lifecycle.

Demo Mode se modelará como un catálogo estático de fixtures y una máquina de pasos determinista. Cada fixture declarará el estado observable, sus mensajes y documentos, las propuestas sensibles con una de las categorías exhaustivas de `FR-014`, los hallazgos de review, errores, recuperaciones y el resultado mockeado de sync. Enviar cualquier texto no vacío registrará ese mensaje y ejecutará la transición predefinida del paso actual; el contenido escrito no se analizará. Seleccionar el mismo escenario restablecerá siempre el mismo punto de partida.

El documento guardado o aceptado será la única fuente persistida vigente. El texto aún no guardado vivirá como estado del editor y alimentará tanto `Edit` como `Preview`, pero no sustituirá el documento vigente hasta `Save changes`; `Discard changes` recuperará la última fuente guardada. Un guard común interceptará el cierre del sheet y la selección de otro contenido cuando haya cambios sin guardar y exigirá confirmación antes de descartarlos. La previsualización usará un renderer Markdown mantenido, sin habilitar HTML crudo; no se construirá un parser propio ni un editor WYSIWYG. `Copy` usará Clipboard API y convertirá el rechazo en feedback no bloqueante.

El acceso a persistencia se limitará a un puerto pequeño (`load`, `save`, `reset`) y un adaptador de navegador. La carga distinguirá `absent`, `valid`, `invalid` y `unavailable`: en los dos primeros casos iniciará o restaurará la store; si la API falla continuará con una store sólo en memoria; y si el payload no puede decodificarse conservará intacto el valor original y bloqueará su sobrescritura automática mientras ofrece `Reset local data` con confirmación. Un envelope con versión de esquema y un decoder explícito bastan para la primera versión; no se añadirá un framework de migraciones sin formatos anteriores que migrar.

Persistir estado local y simular sync serán flujos distintos. Toda modificación confirmada se guardará localmente y podrá marcar `Unsynced changes`; `Sync now` sólo recorrerá `Syncing` y el resultado determinista configurado (`Synced` o `Sync failed`). Ningún módulo contendrá clientes HTTP, credenciales, OAuth ni llamadas a providers.

La UI compondrá sidebar jerárquica, Chat principal y sheet documental. Los mismos controles y contenido se reutilizarán en los tres tamaños: disposición simultánea en desktop, sidebar colapsable en tablet y navegación/documentación como superficies superpuestas en mobile. El diseño posterior fijará jerarquía visual, foco inicial y transiciones de overlays sin alterar este límite funcional. Todos los controles tendrán nombres accesibles, orden de teclado coherente, foco visible y estados anunciables cuando corresponda.

## Affected areas

| Area/component | Change | Requirements |
| --- | --- | --- |
| Monorepo y toolchain | Inicializar la raíz Turborepo y el único workspace Next.js; exponer comandos reales de desarrollo y validación. | NFR-001, AC-020 |
| Shell y navegación | Representar la jerarquía, selección activa, creación inicial y variantes desktop/tablet/mobile. | FR-001–FR-003, FR-024; AC-001–AC-003, AC-018 |
| Modelo y store de dominio | Poseer entidades, documentos, lifecycle, propuestas, estado de UI y transiciones con invariantes explícitas. | FR-002–FR-005, FR-011–FR-018; AC-002–AC-003, AC-008–AC-013 |
| Demo Mode | Proveer catálogo de escenarios, pasos y recuperaciones deterministas sin interpretar mensajes. | FR-009–FR-010, FR-025; AC-006–AC-007, AC-019 |
| Chat | Mantener historiales independientes por Chat, composer y acceso al contexto documental compartido. | FR-001, FR-004, FR-019; AC-001, AC-003, AC-014 |
| Experiencia documental | Mostrar Product Context, PRD vigente y snapshots; editar, previsualizar, guardar, descartar, copiar y proteger cambios pendientes. | FR-011–FR-013, FR-017, FR-019–FR-020; AC-008–AC-009, AC-012, AC-014–AC-015 |
| Aprobaciones y lifecycle | Aplicar/rechazar propuestas sensibles, revisar hallazgos, aceptar warnings y crear snapshots/versiones/PRDs sólo tras decisión explícita. | FR-014–FR-018; AC-010–AC-013 |
| Persistencia local | Encapsular carga, validación, guardado, fallback en memoria y reset confirmado sin borrar automáticamente datos inválidos. | FR-021, FR-026, NFR-003; AC-016, AC-023 |
| Repositorio y sync mockeados | Guardar configuración conceptual con defaults y representar estados/transiciones sin integración externa. | FR-006–FR-008, FR-022–FR-023; AC-004–AC-005, AC-017 |
| Accesibilidad y compatibilidad | Aplicar comportamiento responsive, teclado, foco, nombres accesibles y contraste; verificar navegadores objetivo. | NFR-006; AC-018, AC-024 |
| Suite de pruebas | Verificar resultados visibles y accesibles con fixtures deterministas y dobles de APIs del navegador. | NFR-004; AC-021–AC-024 |
| Documentación técnica | Actualizar arquitectura y convenciones para distinguir la topología y comandos implementados de los límites antes sólo aprobados. | Definition of Done, AC-020 |

## Data and API changes

No habrá API de red ni contrato público. El contrato interno persistido será un único envelope versionado en una clave propia de `localStorage`. Contendrá, como mínimo:

- versión del esquema y estado navegable confirmado;
- Projects con Product Context, configuración conceptual de repositorio y PRDs;
- PRDs con documento vigente, estado `draft | review | final`, Chats, snapshots y hallazgos aplicables;
- Chats con historiales independientes y posición del escenario determinista;
- propuestas sensibles con categoría, contenido propuesto y resolución;
- estado local de sincronización mockeada.

El borrador no guardado del editor, el estado abierto/cerrado de overlays y los errores transitorios de Clipboard API no se persistirán. La selección activa sí se guardará para restaurar la sesión; al cargar se validará contra las entidades recuperadas y, si ya no existe, se resolverá de forma determinista hacia el primer Chat disponible.

La configuración conceptual usa `provider`, `ownerOrOrganization`, `repository`, `branch` y `documentationPath`; `branch` y `documentationPath` se materializan como `main` y `/docs` al crear o guardar una configuración que los omite. No habrá campos de credenciales.

No existen datos previos que migrar. Un payload ausente inicia estado vacío; uno de versión o forma desconocida se trata como inválido y se conserva hasta que el usuario confirme el reset. Las migraciones entre versiones quedan fuera hasta que exista un segundo esquema real.

## Architecture implications

La primera implementación convierte los límites aprobados en `docs/architecture.md` en componentes reales, sin ampliarlos: UI web, dominio/transiciones, fixtures de Demo Mode y adaptador de persistencia local. Las dependencias apuntarán desde la composición React hacia dominio y puertos; el adaptador de navegador implementará persistencia en el borde. Demo Mode podrá emitir acciones de dominio, pero el dominio no dependerá de componentes ni de detalles del fixture.

La raíz tendrá un solo workspace de producto, por lo que no se justifica extraer librerías de UI, dominio, configuración o testing. Turborepo coordinará scripts declarados en los workspaces y cacheará sólo salidas reproducibles; `dev` y otros procesos persistentes no se cachearán. Se propone `pnpm` por su soporte directo de workspaces y su ajuste al monorepo mínimo; la decisión es reversible antes de publicar paquetes y quedará concretada por el lockfile y `packageManager`.

No se requiere ADR. Next.js, TypeScript, shadcn/ui, Jest, React Testing Library, Turborepo, frontend-only y `localStorage` ya son decisiones aceptadas; la topología de una sola app, el reducer y el envelope inicial son elecciones locales y reversibles. Sí se actualizará `docs/architecture.md` después del scaffold para reflejar estado implementado y comandos reales sin presentarlos anticipadamente como existentes.

## Testing strategy

| Claim/risk | Evidence planned |
| --- | --- |
| El scaffold satisface el stack y es reproducible. | Instalación limpia desde lockfile y ejecución reciente de los comandos raíz reales de `typecheck`, `lint`, `test` y `build`; comprobar que el build no requiere red ni variables secretas. |
| La propiedad `Project → PRD → Chat` no mezcla ramas y la creación aterriza en el primer Chat. | Tests Jest/RTL de creación y navegación con múltiples Projects, PRDs y Chats, cubriendo AC-001–AC-003. |
| El flujo sin repositorio y sus defaults no activan integraciones. | Tests de formulario/configuración y navegación cubriendo AC-004–AC-005; revisar que no exista cliente o request externo en el recorrido. |
| Demo Mode no interpreta contenido y todos sus escenarios son repetibles. | Tests parametrizados sobre el catálogo: mensajes distintos no vacíos producen el mismo paso, vacío no avanza, selección reinicia el fixture y cada error tiene recuperación; AC-006–AC-007 y AC-019. |
| La autoridad del Markdown y los cambios sin guardar se preservan. | Tests de Edit/Preview/Save/Discard, confirmación al cerrar o navegar, recarga desde dato guardado y precedencia frente a fixtures/propuestas; AC-008–AC-010 y AC-014–AC-015. Mock de Clipboard API para éxito y rechazo. |
| Lifecycle, warnings y snapshots respetan decisiones explícitas e inmutabilidad. | Tests de acciones permitidas por estado, vuelta a draft, finalización con aceptación de warnings, snapshot read-only y creación explícita de versión o PRD; AC-011–AC-013. |
| Persistencia y sync son independientes y toleran fallos. | Tests del puerto con almacenamiento en memoria/controlado y tests RTL de recarga, `Unsynced changes`, timers deterministas de sync, fallo sin pérdida de datos, storage inaccesible y payload inválido conservado hasta reset confirmado; AC-016–AC-017 y AC-023. |
| Todos los recorridos funcionan offline y sin identidad. | Ejecutar la suite con cualquier acceso de red fallando explícitamente, comprobar que los fixtures cubren el recorrido completo y verificar que no se renderizan controles de login, roles o permisos; AC-022. |
| La experiencia responsive conserva controles y contexto. | Tests RTL de comportamiento de overlays/colapso y comprobación en browser a 1440 px, 768 px y 390 px con los recorridos de AC-018. El diseño de UI definirá los estados visuales concretos que se inspeccionarán. |
| Los recorridos son accesibles y compatibles. | Tests RTL por rol/nombre, navegación completa por teclado y gestión/restauración de foco; inspección de foco visible y contraste; smoke manual de recorridos críticos en versiones estables vigentes de Chrome, Firefox, Safari y Edge para AC-024. Registrar navegador y versión usados. |
| La suite cubre resultados observables, no detalles del reducer. | Matriz final que trace AC-001–AC-019 y AC-023 a tests Jest/RTL; tests puros sólo para invariantes o decoders cuyo fallo no pueda observarse de forma aislada con igual claridad. |

La validación avanzará de tests focalizados a la suite completa, y terminará con typecheck, lint y build. Al no existir baseline ejecutable, cualquier fallo introducido durante el scaffold es de esta iniciativa; fallos de entorno o de compatibilidad de navegador se registrarán por separado y no se convertirán silenciosamente en éxito.

## Migration, compatibility, and rollout

No hay rollout remoto ni despliegue en esta iniciativa. La aplicación debe ejecutarse localmente y sin servicios externos. La primera escritura crea el esquema `v1`; volver a una revisión anterior del código no debe borrar automáticamente la clave local. Si una revisión no entiende el payload, presentará el estado inválido y permitirá reset confirmado según el mismo contrato de recuperación.

La compatibilidad se valida contra las versiones estables vigentes de Chrome, Firefox, Safari y Edge. Se evitarán APIs experimentales; `localStorage` y Clipboard API estarán detrás de manejo explícito de excepciones. La falta de Clipboard API sólo afecta `Copy`, y la falta de `localStorage` degrada a estado de sesión en memoria.

## Risks and mitigations

| Risk | Likelihood/impact | Mitigation |
| --- | --- | --- |
| Una store amplia acopla UI, persistencia y guiones. | Media/alta | Mantener transiciones de dominio puras, puertos estrechos y fixtures como entradas declarativas; no extraer packages sin consumidores. |
| Un fixture sobrescribe una edición aceptada o aplica un cambio sensible antes de aprobación. | Media/alta | Hacer que toda transición documental compare y modifique la revisión vigente mediante acciones explícitas; cubrir precedencia, aceptar y rechazar con tests. |
| Hidratación inconsistente al acceder a APIs sólo disponibles en navegador. | Media/media | Cargar el adaptador después del montaje y mostrar un estado inicial neutro hasta resolver `load`; no leer storage desde componentes presentacionales. |
| Datos corruptos provocan un bucle de errores o se pierden por una escritura automática. | Media/alta | Decoder versionado, resultado `invalid` separado, suspensión del autosave y reset confirmado que sea la única operación destructiva. |
| HTML o enlaces inseguros llegan desde Markdown editable. | Baja/alta | Renderer que no habilite HTML crudo, política segura de enlaces y pruebas con contenido representativo; no usar `dangerouslySetInnerHTML`. |
| Confirmaciones y overlays pierden foco o bloquean teclado en mobile. | Media/alta | Resolver patrón en UI design, usar primitives accesibles de shadcn/ui y probar apertura, escape, confirmación y restauración de foco. |
| Timers mockeados de sync vuelven frágiles los tests o mutan datos locales. | Media/media | Inyectar/encapsular el scheduler, usar fake timers y limitar la transición a metadatos de sync. |
| La amplitud de AC-001–AC-019 produce una suite lenta o duplicada. | Media/media | Agrupar recorridos por riesgo, parametrizar fixtures y reservar tests puros para invariantes; mantener una matriz de trazabilidad sin repetir todos los flujos end-to-end. |
| Las diferencias reales entre motores quedan ocultas por jsdom. | Media/alta | Completar RTL con smoke tests en los cuatro navegadores objetivo y los tres viewports; registrar cualquier excepción antes de aceptar el plan como implementado. |

## Explicit non-changes

- No backend, endpoints, server actions de negocio, base de datos, autenticación, roles, colaboración ni multiusuario.
- No LLM, prompts, RAG, tool calling, memoria de agente ni heurísticas que interpreten texto libre.
- No GitHub API, OAuth, credenciales, commits, polling ni sincronización remota.
- No IndexedDB, service worker, persistencia cloud ni sincronización entre pestañas o dispositivos.
- No CRUD completo: no renombrar, archivar, duplicar ni eliminar entidades; sólo el reset local explícitamente requerido puede reemplazar el conjunto inválido.
- No editor WYSIWYG, colaboración documental, historial general de revisiones ni diff visual.
- No URLs compartibles por entidad ni navegación server-side mientras ningún criterio lo requiera.
- No packages reutilizables, design system separado, librería externa de estado, motor genérico de workflows ni framework de migraciones.
- No CI/CD, hosting, analytics, telemetría, feature flags ni infraestructura cloud.
- No Playwright ni nueva infraestructura E2E de entrada: Jest/RTL más la matriz manual cubren el contrato actual; se reconsiderará sólo si el diseño demuestra comportamientos de browser que no puedan verificarse de forma fiable así.

## Related decisions

- `docs/constitution.md`: autoridad del usuario y del Markdown, incertidumbre visible, aprobación sensible, snapshots inmutables y simplicidad.
- `docs/product.md`: modelo `Project → PRD → Chat`, experiencia espacial, lifecycle, Demo Mode y límites del MVP.
- `docs/architecture.md`: frontend local, persistencia encapsulada, responsabilidades separadas y ausencia de integraciones externas.
- `docs/conventions.md`: stack aprobado, vocabulario, reglas de UI y tests observables.
- Documentación actual de Turborepo (`/vercel/turborepo`): las tareas raíz se corresponden con scripts de los workspaces; las tareas persistentes no se cachean y las salidas de build/test se declaran cuando existen.

## Simplicity gate

- **Required now:** un workspace web; modelo de dominio tipado; store y transiciones deterministas; fixtures explícitos; adapter de `localStorage` con fallback/estado inválido; renderer Markdown; lifecycle y aprobación; sync mockeado; responsive y accesibilidad; Jest/RTL; comandos raíz de validación.
- **Useful soon:** automatización E2E en navegadores, migraciones entre versiones válidas del esquema, packages compartidos y rutas estables por entidad podrían aportar valor cuando aparezcan más consumidores, formatos o recorridos, pero no tienen evidencia suficiente en esta iniciativa.
- **Speculative:** backend, API de IA, GitHub real, autenticación, colaboración, persistencia remota, motor genérico de agentes/workflows, abstracción multi-provider operativa, design system independiente y optimizaciones de escala. Se excluyen porque preparan futuros hipotéticos y contradicen el alcance frontend local.
