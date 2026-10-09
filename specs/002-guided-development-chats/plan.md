# Chats guiados por fases de desarrollo — plan de implementación

**Spec:** `specs/002-guided-development-chats/spec.md` (`SPEC-002`)
**Status:** draft
**UI design required:** yes — hay que resolver la representación de progreso, el candado a la derecha, la explicación accesible del bloqueo, los controles de estado y el caso en que el Chat activo vuelve a bloquearse; `$ui-design` debe fijar esos estados antes de descomponer la implementación.
**Change profile:** UI, data/migration — se amplían el modelo de Chat, las reglas de navegación y el contrato persistido; la arquitectura existente se conserva y no se introducen API ni servicios nuevos.
**Full validation:** yes — el cambio atraviesa creación, lifecycle, navegación, mutaciones conversacionales, persistencia y accesibilidad; requiere pruebas focalizadas y luego `typecheck`, `lint`, `test` y `build`, además del smoke responsive y de teclado relevante.
**Context:** direct — las rutas afectadas están acotadas al dominio, store, persistencia, shell y sus pruebas; no se justifica `local-assisted`.

## Approach

Extender el `Chat` existente con metadata explícita que distinga `guided` de `additional`. Un Chat guiado tendrá un identificador de fase estable; las cinco fases posteriores a `PRD` tendrán además un progreso persistido (`pending`, `in-progress` o `ready`), y sólo las dos fases de diseño admitirán `not-applicable`. El Chat `PRD` no duplicará ese progreso: su estado visible seguirá derivándose del lifecycle `draft | review | final` del documento.

Centralizar la creación del recorrido en una fábrica de dominio fija que produzca, en orden, `PRD`, `Diseño de pantallas`, `Diseño de base de datos`, `Plan de implementación`, `Implementación` y `Pruebas y revisión`. `createProject` y la continuación `new-prd` reutilizarán esa fábrica y seleccionarán el Chat `PRD`. `createChat` seguirá creando un Chat adicional independiente. La continuación `new-version` conserva el único recorrido del PRD y sus historiales; el Chat vacío que ya crea ese flujo se clasificará como adicional, mientras el retorno del documento a `draft` volverá a bloquear las fases dependientes sin reiniciarlas.

Implementar la disponibilidad como una consulta pura sobre el PRD vigente, no como un booleano persistido. La consulta recorrerá únicamente las seis fases conocidas y devolverá para cada Chat si está disponible y qué prerrequisitos lo bloquean. Una fase sólo satisfará a la siguiente si ella misma está disponible y tiene un estado habilitante; así el retroceso de cualquier prerrequisito produce el bloqueo transitivo requerido sin almacenar ni sincronizar una segunda fuente de verdad. No se creará un grafo editable, DSL ni motor genérico de workflows.

Las transiciones de dominio serán responsables de cambiar el progreso y de rechazar combinaciones inválidas: `not-applicable` fuera de los dos diseños, cambios de progreso sobre un Chat adicional o `PRD`, y cambios sobre un Chat actualmente bloqueado. La misma consulta de disponibilidad protegerá selección, envío de mensajes y carga/avance de escenarios para que una selección obsoleta no permita usar un Chat que acaba de bloquearse. El diseño de UI determinará si ese caso muestra una superficie bloqueada o mueve el foco a un destino disponible; en ambos casos el dominio impedirá mutaciones y conservará los datos.

La navegación existente seguirá siendo un `nav` con grupos de Project y PRD. Cada fila de Chat incorporará su diferenciación, progreso y estado de bloqueo; un Chat bloqueado seguirá siendo alcanzable por teclado para poder explicar la causa, pero no cambiará la selección activa. El icono de candado será complementario a un nombre/estado accesible. El encabezado del Chat expondrá el progreso y, para una fase guiada disponible distinta de `PRD`, el control explícito que permita cambiarlo. Los Chats adicionales se identificarán como tales y no mostrarán controles del flujo. Se reutilizarán los mismos elementos dentro de la navegación persistente de desktop y de los sheets actuales en tablet/mobile.

La store React continuará componiendo transiciones puras y persistiendo el workspace completo; no necesita una nueva librería ni otra store. Los componentes seguirán sin acceder a `localStorage`, y la sincronización de demostración permanecerá separada. Cambiar progreso o lifecycle marcará el workspace como `unsynced` del mismo modo que las demás modificaciones locales confirmadas.

## Affected areas

| Area/component | Change | Requirements |
| --- | --- | --- |
| Modelo y creación de dominio | Incorporar tipo, fase y progreso de Chat; crear el conjunto fijo para cada PRD y clasificar los Chats adicionales. | FR-001–FR-002, FR-008–FR-009; AC-001–AC-002, AC-007–AC-008 |
| Consultas y transiciones de dominio | Calcular disponibilidad y bloqueadores, validar cambios de progreso y aplicar bloqueo transitivo sin borrar estado. | FR-003–FR-007, FR-011–FR-012; AC-002–AC-005, AC-011 |
| Lifecycle y continuaciones | Hacer que `review`/`final` habiliten diseños, que volver a `draft` los bloquee y que un PRD nuevo reciba su propio recorrido. | FR-001, FR-004, FR-011–FR-012; AC-001, AC-003, AC-011 |
| Navegación y Chat activo | Mostrar tipo/progreso, candado y causa; impedir entrada o uso bloqueado y ofrecer el cambio manual de progreso. | FR-002, FR-005–FR-008, FR-011; AC-002, AC-006–AC-007; NFR-003 |
| Demo Mode | Reutilizar los guards de disponibilidad sin inferir progreso del texto; permitir que los fixtures de lifecycle afecten únicamente la disponibilidad derivada. | FR-005–FR-007, FR-011–FR-012; AC-002–AC-005, AC-011 |
| Persistencia local | Versionar y validar la nueva forma de Chat, restaurar progreso e historiales y mantener el fallback en memoria/reset existente. | FR-009–FR-010; AC-008–AC-009; NFR-001 |
| Pruebas | Cubrir invariantes puras, flujos visibles, persistencia, aislamiento, teclado y regresión del comportamiento existente. | AC-001–AC-011; NFR-003 |
| Documentación técnica | Reflejar el flujo implementado y la nueva versión del envelope sin anticipar backend o API. | Definition of Done |

## Data and API changes

No se añade API de red ni contrato público. El contrato interno de Chat incorporará:

- una clase estable `guided | additional`;
- una fase estable para los Chats guiados;
- progreso sólo para las fases guiadas posteriores a `PRD`;
- los campos actuales de identidad, título, historial y Demo Mode sin cambiar su responsabilidad.

La disponibilidad y la lista de bloqueadores no se persistirán porque son derivables del lifecycle y del progreso confirmado. Los historiales y estados de progreso sí permanecerán dentro del workspace para sobrevivir recargas y ciclos de bloqueo/desbloqueo.

El envelope persistido debe avanzar de `v1` a `v2`, con un decoder estricto para la nueva metadata. La spec excluye migrar datos de implementaciones anteriores, por lo que no se implementará una conversión automática `v1 → v2`: un payload `v1` existente seguirá el recorrido actual de dato inválido, conservará sus bytes y requerirá `Reset local data` confirmado para comenzar con el nuevo modelo. El mismo `localStorage` key y los resultados `absent | valid | invalid | unavailable` se mantienen.

Los fixtures y constructores de prueba deberán crear Chats válidos de forma explícita. No se añadirá un schema library ni un framework de migraciones; los predicados y helpers actuales son suficientes para un segundo envelope pequeño.

## Architecture implications

El cambio permanece dentro de los límites implementados: dominio y transiciones puras, store React, adaptador de persistencia y componentes de presentación. La dirección de dependencias no cambia; la UI consume consultas y acciones del dominio, la store persiste el resultado y el dominio no conoce React ni `localStorage`.

La definición fija de fases y sus reglas pertenece al dominio de producto. Mantenerla junto a las demás transiciones evita duplicarla entre sidebar, Chat activo, Demo Mode y decoder. La UI no calculará dependencias por su cuenta.

No se requiere ADR. El flujo fijo, `localStorage`, el modelo `Project → PRD → Chat` y la ausencia de backend ya están decididos; añadir metadata de Chat y un selector derivado es una evolución local y reversible. Tras implementar, `docs/architecture.md` debe actualizar el flujo de creación, el contrato persistido y el estado técnico real.

## Testing strategy

| Claim/risk | Evidence planned |
| --- | --- |
| Cada Project y PRD nuevo recibe exactamente el recorrido independiente y selecciona `PRD`. | Tests puros de las fábricas/transiciones y un recorrido RTL de creación, incluyendo `new-prd`; AC-001 y AC-008. |
| Los estados permitidos no se confunden con disponibilidad ni con el lifecycle del PRD. | Tests de dominio parametrizados para combinaciones válidas e inválidas y RTL sobre las opciones visibles; AC-002–AC-005. |
| `review` y `final` habilitan ambos diseños y `draft` no. | Tests sobre transiciones existentes de lifecycle más observación en navegación; AC-003. |
| El bloqueo es transitivo, conserva datos y se revierte al restaurar el prerrequisito. | Test de dominio que avanza hasta Implementación, retrocede un diseño y el PRD, y compara mensajes/progreso antes y después; recorrido RTL equivalente para AC-011. |
| Un Chat bloqueado no cambia selección ni admite mutaciones, pero explica la causa con teclado. | RTL por roles/nombres para click, Enter, foco, anuncio/explicación y candado accesible; tests de dominio sobre selección, mensaje y Demo Mode; AC-006 y NFR-003. |
| Los Chats adicionales permanecen disponibles y no afectan el flujo. | Tests de creación, etiqueta visible, historial independiente y aislamiento entre PRDs/Projects; AC-007–AC-008. |
| El nuevo estado sobrevive recarga y storage fallido sigue degradando a memoria. | Round-trip del envelope `v2`, prueba de `v1` inválido preservado hasta reset, fallback en memoria y recorrido RTL de recarga; AC-009 y NFR-001. |
| No aparece configuración de fases o dependencias. | Revisión del alcance y aserciones RTL de ausencia de controles configurables; AC-010 y NFR-002. |
| La integración no rompe el MVP existente. | Ejecutar desde raíz `pnpm typecheck`, `pnpm lint`, `pnpm test` y `pnpm build`; mantener los recorridos de documentos, lifecycle, Demo Mode y sync existentes. |
| La representación funciona en los tres layouts. | Smoke en Chrome estable a 1440 px, 768 px y 390 px para navegación, explicación del bloqueo, cambio de progreso y restauración de foco; inspección de foco visible y contraste. |

La validación comienza con los tests de dominio y RTL afectados, continúa con la suite completa y termina con typecheck, lint y build. Los checks manuales se limitan a aspectos que jsdom no prueba de forma fiable: posición visual del candado, contraste, foco visible y comportamiento real de sheets.

## Migration, compatibility, and rollout

No hay despliegue remoto ni feature flag. En estado local vacío, la primera escritura usará `v2`. Con datos `v1`, la aplicación mostrará la recuperación ya existente y no escribirá sobre el payload hasta que el usuario confirme el reset; este coste es aceptado por el alcance que excluye migración y evita añadir ingeniería para datos de aprendizaje.

Volver temporalmente a una revisión anterior del frontend hará que ésta considere `v2` inválido, pero conservará el valor crudo bajo el contrato actual. El reset sigue siendo la única operación destructiva y debe permanecer explícito.

Crear una nueva versión del mismo PRD no crea otro conjunto guiado: conserva Chats y progreso, vuelve el documento a `draft`, bloquea en cascada y añade el Chat vacío adicional previsto por el MVP. Crear un PRD distinto sí inicia seis Chats nuevos e independientes.

## Risks and mitigations

| Risk | Likelihood/impact | Mitigation |
| --- | --- | --- |
| Lifecycle, progreso y disponibilidad se contradicen. | Media/alta | Persistir sólo lifecycle/progreso y derivar disponibilidad en una única consulta de dominio; no almacenar flags de bloqueo. |
| Un Chat activo queda bloqueado después de un retroceso y todavía acepta mensajes. | Media/alta | Aplicar el guard en todas las mutaciones y definir en UI design la presentación/foco del estado recién bloqueado. |
| El cambio a `v2` sorprende a quien tenga datos locales `v1`. | Media/media | Mantener bytes intactos, usar la recuperación confirmada existente y comunicar en UI design/validación que el reset inicia el modelo nuevo. |
| Los fixtures o tests crean Chats sin metadata válida. | Alta/media | Reutilizar constructores pequeños en dominio/tests y hacer que TypeScript y el decoder rechacen formas incompletas. |
| La sidebar se vuelve difícil de leer con título, progreso, diferenciación y candado. | Media/media | Resolver densidad y jerarquía en `ui.md`, reutilizar badges/texto breve y probar los tres viewports. |
| Se implementa accidentalmente un workflow configurable. | Baja/media | Mantener una tupla fija y una consulta explícita para seis fases; no exponer edición ni abstraer para consumidores inexistentes. |
| Demo Mode cambia progreso a partir del mensaje. | Baja/alta | Limitar los fixtures a lifecycle/documentos existentes y exigir una acción explícita separada para progreso. |

## Explicit non-changes

- No backend, API, base de datos, autenticación, colaboración ni sincronización remota.
- No IA, análisis del contenido, cálculo de completitud ni avance automático por mensajes.
- No editor de fases, dependencias, plantillas o estados.
- No motor genérico de workflow, grafo persistido, máquina de estados externa ni nueva librería de estado.
- No cambio a la propiedad `Project → PRD → Chat` ni al lifecycle documental existente.
- No segundo recorrido por `PRD version`; las versiones siguen perteneciendo al mismo PRD.
- No migración automática desde el envelope `v1`.
- No package compartido, nueva ruta, nueva infraestructura E2E ni dependencia de UI adicional.
- No cambios en GitHub mockeado, sync, Clipboard, renderer Markdown o aprobación sensible salvo adaptación mecánica al nuevo tipo de Chat.

## Related decisions

- `specs/002-guided-development-chats/spec.md`: fases, dependencias, estados, bloqueo y compatibilidad con `SPEC-001`.
- `docs/product.md`: Chats guiados/adicionales, flujo fijo y lifecycle como autoridad del Chat `PRD`.
- `docs/architecture.md`: dominio tipado, store React, envelope local y adaptador de persistencia existentes.
- `docs/conventions.md`: ownership `Project → PRD → Chat`, persistencia fuera de presentación y tests observables.
- `specs/001-mvp/ui.md`: navegación agrupada, responsive, foco, lifecycle y patrones accesibles que deben conservarse.

## Simplicity gate

- **Required now:** metadata mínima de Chat; fábrica fija; disponibilidad/bloqueadores derivados; transición explícita de progreso; guards sobre selección y mutaciones; representación accesible; envelope `v2`; pruebas y documentación afectadas.
- **Useful soon:** migración `v1 → v2`, nombres editables para Chats adicionales y automatización E2E podrían aportar valor si aparecen datos reales o más recorridos, pero no están requeridos en esta iniciativa.
- **Speculative:** workflows configurables, reglas cargadas desde servidor, editor de dependencias, historial de eventos, API, multiusuario, IA y optimizaciones de escala; se excluyen porque no tienen consumidores ni requisitos actuales.
