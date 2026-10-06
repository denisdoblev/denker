# MVP frontend local de Denker — contrato de UI

**Spec:** `specs/001-mvp/spec.md` (`SPEC-001`)
**Plan:** `specs/001-mvp/plan.md`
**Estado:** accepted
**Superficies:** creación de Project, navegación jerárquica, Chat, Demo Mode, documentos Markdown, lifecycle de PRD, configuración conceptual de repositorio y sync mockeado

## Propósito y límites

Este artefacto define la experiencia observable necesaria para implementar el MVP. La persona usuaria debe poder pasar de una idea a un Chat y mantener el contexto documental bajo su control, aun sin backend, IA ni repositorio conectado.

No existe todavía una interfaz, un design system ni tokens implementados. La primera aplicación reutilizará la base aprobada de shadcn/ui dentro de `apps/web` cuando se cree, pero este contrato no presupone que sus componentes, estilos o comandos ya existan. Tampoco define una identidad visual definitiva.

Principios de la experiencia:

1. El Chat es la superficie de trabajo principal; la navegación y los documentos lo acompañan sin competir con él.
2. La jerarquía `Project → PRD → Chat` siempre debe ser visible o recuperable desde un único control.
3. El Markdown guardado es la fuente vigente. Una propuesta, un fixture o un borrador no lo reemplaza silenciosamente.
4. Estado local y sync de demostración se comunican como conceptos distintos.
5. La incertidumbre se muestra como `TBD`, preguntas abiertas, warnings o contenido incompleto; no se maquilla como completitud.
6. Las acciones sensibles explican su efecto y esperan una decisión explícita.

## Persona, objetivo y acciones

La superficie sirve a una única persona que crea y documenta sus propios productos desde el navegador.

**Objetivo principal:** avanzar el discovery desde un Chat mientras consulta y consolida Product Context y PRD.

**Acciones primarias:**

- crear un Project y entrar en su primer Chat;
- enviar un mensaje en Demo Mode;
- abrir el documento relacionado;
- editar, previsualizar y guardar Markdown;
- aceptar o rechazar un cambio sensible;
- revisar y finalizar un PRD.

**Acciones secundarias:**

- cambiar de Project, PRD o Chat;
- crear otro Chat;
- copiar Markdown;
- configurar conceptualmente un repositorio;
- ejecutar la transición mockeada `Sync now`;
- cargar un escenario de Demo Mode;
- continuar un PRD finalizado mediante una nueva versión o iniciar otro PRD.

No se presentan controles de autenticación, colaboración, roles, permisos ni CRUD fuera de alcance.

## Arquitectura de información

### Regiones del shell

```text
┌────────────────┬─────────────────────────────┬──────────────────────────┐
│ Navegación     │ Chat                        │ Documentación (opcional) │
│ Projects       │ contexto + Demo Mode        │ selector de documento    │
│  PRDs          │ historial                   │ lifecycle + acciones     │
│   Chats        │ composer                    │ Preview / Edit            │
└────────────────┴─────────────────────────────┴──────────────────────────┘
```

1. **Navegación:** árbol comprensible de Projects, PRDs y Chats, más las entradas para crear Project, crear Chat y abrir configuración de repositorio.
2. **Chat:** encabezado contextual, aviso y selector de Demo Mode, historial independiente y composer.
3. **Documentación:** superficie opcional para PRD vigente, Product Context o snapshots finalizados, sin abandonar el Chat.

No se añade home analítica, dashboard de métricas ni navegación global ajena a estas tres regiones.

### Jerarquía dentro de cada región

**Navegación**

1. Nombre del producto `Denker` y acción `New Project`.
2. Lista de Projects.
3. Dentro del Project expandido: PRDs con estado y Chats pertenecientes a cada PRD. Product Context se accede desde el selector documental del Chat.
4. Acción `New Chat` en el PRD seleccionado.
5. Resumen de repositorio del Project: `Repository not connected` o configuración conceptual marcada como `Demo configuration`.

La lista se implementa como navegación con grupos colapsables, no como un widget ARIA `tree`: cada botón de expansión tiene nombre propio y cada Chat es un destino navegable. El Chat activo usa `aria-current="page"`. La sangría, el texto y el estado expandido comunican la propiedad sin depender sólo de líneas o iconos.

**Chat**

1. Barra compacta con breadcrumb `Project / PRD / Chat`, nombre del Chat, estado del PRD y acciones `Open navigation` cuando corresponda y `Open documents`.
2. Franja de Demo Mode con la explicación `Uses a fixed script. Messages are not interpreted.`, selector `Scenario` y acción `Load scenario`.
3. Historial del Chat, incluidos mensajes, propuestas, errores y resoluciones del escenario.
4. Composer anclado al final de la región.

**Documentación**

1. Encabezado con selector `Document`, título, estado y `Close documents`.
2. Acciones de lifecycle aplicables al PRD actual.
3. Hallazgos de review cuando el PRD está en `review`.
4. Controles `Preview` y `Edit`, acción `Copy` y estado guardado/no guardado.
5. Contenido Markdown renderizado o editor de fuente.
6. Barra de acciones de edición: `Save changes` y `Discard changes`.

El selector `Document` agrupa `Current PRD`, `Product Context` y `Final versions`. Evita dedicar una pestaña a cada snapshot y conserva un único punto accesible de cambio de documento.

## Layout y comportamiento responsive

Los breakpoints describen representaciones funcionales; los valores exactos pueden alinearse con la configuración de estilos durante el scaffold siempre que los tres viewports de aceptación conserven este comportamiento.

### Desktop ancho — referencia 1440 px

- A partir de 1200 px, la navegación permanece visible con un ancho objetivo de 272 px.
- El Chat ocupa el espacio flexible restante y nunca baja de un ancho útil de 480 px.
- Al abrir documentación, aparece como región complementaria no modal a la derecha, con ancho objetivo entre 440 y 520 px. No cubre el Chat ni atrapa el foco.
- Cerrar documentación devuelve todo el espacio disponible al Chat.
- Navegación y documentación tienen scroll independiente; el composer permanece visible en la región central.

### Tablet — referencia 768 px

- Entre 640 y 1199 px, la navegación inicia colapsada como rail de 56 px con un control textual accesible `Open navigation`.
- Al expandirse, la navegación aparece sobre el borde izquierdo; no comprime el Chat por debajo de su ancho utilizable.
- La documentación se abre como sheet modal desde la derecha, con un ancho máximo de 560 px y sin exigir que navegación, Chat y documento sean visibles a la vez.
- Abrir navegación cierra documentación y viceversa. El contenido no pierde selección ni estado por ese cierre; si existe un borrador, se aplica el guard de cambios sin guardar.

### Mobile — referencia 390 px

- Por debajo de 640 px, el Chat es la única región persistente.
- Una barra superior contiene `Open navigation`, el contexto abreviado y `Open documents`.
- Navegación y documentación son sheets modales de altura completa, mutuamente excluyentes. Documentación usa todo el ancho disponible para que el Markdown y sus acciones sigan siendo utilizables.
- Las acciones del documento pueden envolver en dos filas; no se convierten en controles sólo con icono.
- El composer respeta el safe area inferior, crece hasta seis líneas y luego hace scroll interno.
- El contenido Markdown permite scroll horizontal sólo en bloques de código o tablas que no puedan refluír; el resto del texto se adapta al ancho.

### Contenido largo

- Los nombres extensos de Project, PRD y Chat se truncan sólo en navegación. El nombre completo permanece en el nombre accesible y se ofrece al foco o hover mediante el patrón de tooltip disponible.
- El encabezado del Chat puede ocupar dos líneas antes de truncar.
- Mensajes, hallazgos y propuestas admiten párrafos y listas largas sin altura máxima arbitraria.
- La preview usa una medida de lectura cómoda dentro del ancho disponible; no centra una columna tan estrecha que desperdicie el sheet.
- URLs y texto sin espacios deben quebrar sin ensanchar el layout.

## Flujos e interacciones

### 1. Inicio y creación de Project

Cuando no existen datos válidos, la región principal muestra un estado inicial con propósito breve y la acción `Create Project`. No se muestra un dashboard vacío.

El mismo diálogo modal se usa desde `Create Project` y `New Project`:

1. Foco inicial en `Project name`, único campo obligatorio.
2. Una sección opcional `Repository configuration` permite activar la configuración conceptual.
3. Si se activa, muestra `Provider`, `Owner or organization`, `Repository`, `Branch` y `Documentation path`. `Branch` y `Documentation path` aparecen inicialmente como `main` y `/docs`.
4. El texto de ayuda aclara: `Demo configuration only. No credentials or remote connection.`
5. `Create Project` permanece deshabilitado mientras el nombre contenga sólo espacios.
6. Al confirmar se crean Product Context, `PRD 001` en `draft` y el primer Chat; el modal se cierra, la rama nueva queda seleccionada y el foco pasa al composer.

El Chat vacío muestra la invitación a describir la idea y mantiene disponible `Open documents`. No se solicitan repositorio, credenciales ni información adicional para continuar.

### 2. Navegación y creación de Chat

- Expandir un Project revela únicamente sus PRDs; expandir un PRD revela únicamente sus Chats.
- Seleccionar un Chat cambia el historial y el PRD/documentos relacionados en conjunto.
- `New Chat` pertenece al PRD seleccionado. Al confirmarlo, crea un historial vacío bajo ese PRD, lo selecciona y lleva el foco al composer.
- Cambiar de Chat no copia ni resume visualmente historiales anteriores.
- Si el documento abierto pertenece al contexto anterior, la navegación intenta cambiarlo al `Current PRD` del Chat destino. Un borrador sin guardar detiene primero la navegación mediante el guard correspondiente.

No existen acciones para renombrar, duplicar, archivar o eliminar entidades.

### 3. Demo Mode y conversación

La franja de Demo Mode permanece visible encima del historial, sin adoptar apariencia de mensaje del agente. Incluye siempre la advertencia de que el texto no se interpreta.

El selector ofrece estos escenarios, con los nombres finales de contenido por confirmar durante la carga de fixtures pero con categorías estables:

- empty conversation;
- agent question;
- user response;
- PRD updated;
- change pending approval;
- Product Context change proposal;
- review with warnings;
- PRD finalized;
- new version;
- recommendation to create another PRD;
- errors;
- sync states.

Seleccionar una opción no la carga por sí sola: `Load scenario` realiza la acción explícita. Si la carga reemplazará estado confirmado del escenario o existe un borrador, se presenta `Load this scenario?` con una descripción breve de lo afectado y las acciones `Cancel` y `Load scenario`. Esto hace explícito cualquier reset y evita que un fixture reemplace Markdown silenciosamente.

En el composer:

- el campo se llama `Message`;
- `Send message` está deshabilitado para texto vacío o compuesto sólo por espacios;
- `Enter` envía y `Shift+Enter` inserta una nueva línea;
- un envío válido añade el mensaje al historial y ejecuta inmediatamente el siguiente paso determinista;
- no se muestra indicador de “pensando”, typing animation ni lenguaje que sugiera interpretación por IA;
- al aparecer una respuesta, el foco permanece en el composer y el nuevo contenido se anuncia sin releer todo el historial.

### 4. Abrir, cambiar y copiar documentos

`Open documents` abre por defecto el PRD correspondiente al Chat activo. Dentro de la superficie:

- `Document` cambia entre PRD actual, Product Context y snapshots disponibles;
- `Preview` renderiza el borrador actual, no sólo el último contenido guardado;
- `Edit` muestra la fuente Markdown en un textarea/editor de texto plano;
- `Copy` copia exactamente la fuente completa visible en el estado actual, incluido un borrador aún no guardado;
- un snapshot final sólo muestra `Preview`, `Copy` y el indicador `Read only`.

Tras una copia correcta, un estado breve `Markdown copied` se anuncia de forma no intrusiva. Si Clipboard API falla, se muestra `Could not copy Markdown` como error no bloqueante junto al control o mediante el sistema de toast accesible de la aplicación. El documento queda visible y editable y no aparece un mecanismo alternativo.

### 5. Editar, guardar y descartar Markdown

- Entrar en `Edit` no crea una nueva revisión ni altera el contenido guardado.
- Al primer cambio, aparece el estado textual `Unsaved changes`; `Save changes` y `Discard changes` se habilitan.
- `Preview` conserva el borrador y permite comprobarlo antes de guardar.
- `Save changes` confirma el borrador como fuente vigente, muestra `Saved locally`, marca sync como `Unsynced changes` cuando corresponda y deshabilita las acciones de borrador hasta el siguiente cambio.
- `Discard changes` abre `Discard unsaved changes?`. `Keep editing` es la acción segura y `Discard changes` restaura la última fuente guardada.
- Cerrar documentación, cambiar documento, Chat, PRD, Project o escenario con un borrador abre la misma confirmación. Confirmar completa la navegación pendiente; cancelar conserva contenido, selección y foco de edición.
- `Escape` en un sheet con cambios sin guardar no los elimina: activa el mismo guard.

No hay autosave del borrador, historial general de revisiones, diff visual ni editor WYSIWYG.

### 6. Propuestas sensibles

Una propuesta sensible aparece en el punto correspondiente del historial como una sección `Pending approval`, visualmente distinta de un mensaje ordinario. Debe mostrar:

- categoría declarada por el fixture;
- documento afectado;
- explicación del efecto;
- contenido propuesto suficiente para decidir, sin afirmar que ya fue aplicado;
- acciones `Accept change` y `Reject change`.

Las categorías admitidas son: eliminar requisitos, modificar decisiones consolidadas, cambiar materialmente el alcance, alterar Product Context o cambio potencialmente destructivo. El documento vigente permanece sin cambios mientras la propuesta está pendiente.

Aceptar o rechazar constituye la decisión explícita y no necesita una segunda confirmación genérica. Al resolver:

- la sección permanece en el historial con estado `Accepted` o `Rejected` y sin acciones activas;
- `Accepted` actualiza exactamente el documento objetivo y deja el cambio guardado localmente;
- `Rejected` conserva el documento previo;
- la resolución se anuncia y el foco permanece en el botón accionado o pasa al encabezado de estado reemplazante si el botón desaparece.

### 7. Lifecycle, review y finalización

El estado `Draft`, `In review` o `Final` aparece junto al nombre del PRD y no depende sólo de color.

**Draft**

- El documento actual permite `Preview`, `Edit`, `Save changes` y `Discard changes`.
- La acción de lifecycle es `Start review`.

**In review**

- La parte superior del documento muestra `Review findings` con recuento y lista de gaps, contradicciones, ambigüedades, riesgos, decisiones pendientes, preguntas abiertas y warnings presentes en el fixture.
- Cada hallazgo presenta tipo, descripción y referencia textual disponible. No se le atribuye análisis en tiempo real.
- `Edit document` lleva al modo Edit para corregir; guardar no elimina un hallazgo salvo que la transición determinista del escenario así lo defina.
- Las acciones de lifecycle son `Back to draft` y `Finalize PRD`.

**Finalización con warnings**

- `Finalize PRD` abre un diálogo que enumera los warnings restantes.
- Cuando existen warnings, la confirmación `Finalize PRD` permanece deshabilitada hasta marcar `I accept the remaining warnings`.
- `Cancel` conserva el estado `In review`.
- Confirmar crea el snapshot y muestra el PRD como `Final` y `Read only`.

**Final**

- No se renderizan controles efectivos de edición ni se aceptan cambios de escenarios sobre el snapshot.
- `Continue work` abre una decisión con dos opciones explícitas: `Create a new version of this PRD` y `Create a new PRD for a different initiative`.
- La recomendación del escenario puede preseleccionar visualmente una opción, pero no crea nada hasta `Confirm`.

La convención de nombre y el contenido inicial de PRDs posteriores o nuevas versiones no está definida por la spec; queda como pregunta abierta y no se infiere en este contrato.

### 8. Repositorio conceptual y sync mockeado

La entrada de repositorio del Project abre `Repository configuration`. La configuración usa los mismos campos que la creación y siempre muestra `Demo configuration only. No credentials or remote connection.`

- Sin configuración: se muestra `Repository not connected`; el discovery permanece completamente operativo y `Sync now` no está disponible.
- Con configuración guardada: se muestra provider, owner/repository, branch y documentation path junto a `Demo configuration`.
- Guardar configuración nunca presenta OAuth, prueba de conexión ni éxito remoto.

El control de sync se identifica como `Demo sync` y representa:

| Estado | Presentación y acción |
| --- | --- |
| `Synced` | Texto de estado; `Sync now` disponible si el escenario lo permite. |
| `Unsynced changes` | Texto de estado y acción secundaria `Sync now`. El dato ya está guardado localmente. |
| `Syncing` | Estado anunciado; `Sync now` deshabilitado y sin bloquear Chat o documentos. |
| `Sync failed` | Mensaje de error no destructivo y `Sync now` como reintento determinista. El último dato local confirmado permanece visible. |

El color o icono apoya, pero nunca sustituye, estos textos.

## Catálogo de estados

| Superficie | Estado | Contrato observable |
| --- | --- | --- |
| Aplicación | Hydrating | Shell neutro con `Loading local workspace`; no muestra fixtures ni datos dependientes del navegador antes de resolver la carga. |
| Aplicación | Sin Projects | Propósito breve y `Create Project`; no hay dashboard ni datos de ejemplo silenciosos. |
| Aplicación | Storage unavailable | Continúa en memoria durante la sesión sin advertencia, según el alcance aceptado. |
| Aplicación | Storage invalid | Superficie bloqueante de recuperación; explica que no puede cargar el dato, no lo borra y ofrece sólo `Reset local data`. |
| Chat | Vacío | Invitación a describir la idea, acceso a documentos y composer listo. |
| Chat | Con historial | Mensajes del usuario y respuestas de demo identificados por autor, en orden estable. |
| Chat | Error de escenario | Alert inline con fallo y la recuperación definida por el fixture; no elimina el contenido confirmado. |
| Composer | Vacío | `Send message` deshabilitado. |
| Documento | Preview limpio | Markdown renderizado; `Saved locally`; acciones de edición según tipo/estado. |
| Documento | Edit limpio | Fuente editable; Save/Discard deshabilitados hasta modificar. |
| Documento | Borrador | `Unsaved changes`; Save/Discard habilitados; Preview refleja el borrador. |
| Documento | Incompleto | Renderiza `TBD`, preguntas abiertas, warnings y secciones ausentes sin exigir una plantilla completa. |
| Documento | Snapshot | `Final` y `Read only`; no hay Edit, Save ni Discard. |
| Copy | Éxito | Feedback breve `Markdown copied`. |
| Copy | Error | Feedback no bloqueante; documento intacto y sin fallback alternativo. |
| Propuesta | Pending | Documento sin modificar; Accept/Reject disponibles. |
| Propuesta | Accepted/Rejected | Resolución persistente y controles inactivos. |
| Review | Sin warnings | Finalización disponible sin checkbox de aceptación. |
| Review | Con warnings | Diálogo enumera warnings y exige aceptación antes de finalizar. |
| Repositorio | No configurado | `Repository not connected`; configuración disponible y discovery operativo. |
| Sync | Synced/Unsynced/Syncing/Failed | Texto, comportamiento y recuperación según la tabla anterior. |

### Reset de datos inválidos

`Reset local data` abre una confirmación destructiva con el texto de que el valor almacenado será reemplazado y no puede recuperarse desde Denker. Las acciones son `Cancel` y `Reset local data`; el foco inicial permanece en `Cancel`. Cancelar conserva el payload y vuelve a la misma superficie de recuperación. Confirmar inicia un estado vacío. Ninguna carga automática ni cierre del diálogo borra el valor.

## Componentes y patrones

La implementación debe preferir primitives equivalentes de shadcn/ui disponibles en el scaffold, sin crear un package de design system:

| Necesidad | Patrón a reutilizar |
| --- | --- |
| Creación, finalización, continuación y reset | Dialog / Alert Dialog |
| Navegación y documentación superpuestas | Sheet |
| Grupos de Project y PRD | Collapsible dentro de `nav` |
| Selector de escenario y documento | Select |
| Preview / Edit | Tabs con semántica de tablist |
| Estados y errores persistentes | Alert y texto de estado |
| Feedback breve de Copy | Toast accesible si forma parte de la base elegida; de lo contrario, estado inline |
| Editor y composer | Textarea nativo estilizado |
| Acciones y estados | Button, Badge y separadores simples |

`Pending approval` y `Review findings` son las dos composiciones nuevas justificadas por el dominio. Se construyen con primitives existentes; no requieren componentes genéricos de workflow, diff o rules engine.

## Accesibilidad

Este contrato apunta a los criterios de WCAG 2.2 AA exigidos por la spec; la conformidad sólo puede afirmarse después de implementar y verificar.

### Teclado y foco

- Todo el flujo puede completarse con teclado y conserva un indicador de foco visible con contraste suficiente.
- El orden sigue navegación → encabezado/contexto → Demo Mode → historial/acciones → composer → documentación cuando es no modal.
- Los sheets y diálogos modales atrapan el foco, hacen inerte el fondo y restauran el foco al disparador al cerrar.
- Al crear un Project o Chat, el foco pasa al composer. Al cambiar de Chat, pasa al encabezado del Chat para anunciar el nuevo contexto, salvo que la acción de creación indique el composer.
- Al abrir documentación en desktop, el foco pasa a su encabezado o selector; al cerrar vuelve a `Open documents`.
- `Escape` cierra superficies modales sólo cuando no descartaría silenciosamente un borrador.
- No se crean atajos de una sola tecla.

### Semántica y nombres

- Las regiones principales usan `nav`, `main` y `aside` o su equivalente dialog/modal según viewport.
- El historial usa semántica de log con actualización `polite`; cada entrada identifica autor y no depende de alineación o color.
- Cada control sólo con icono que resulte inevitable tiene nombre accesible; en mobile las acciones críticas mantienen texto visible.
- Expanders exponen `aria-expanded` y el grupo controlado.
- Tabs, Select, Dialog, Alert Dialog y Sheet conservan la semántica y relaciones de sus primitives, sin reimplementaciones visuales con `div` clicables.
- Textareas tienen etiquetas persistentes `Message` o `Markdown source`; placeholder no sustituye label.
- Los estados `Unsaved changes`, `Read only`, lifecycle y sync son texto disponible para tecnologías asistivas.

### Anuncios y errores

- Nuevas respuestas, resolución de propuestas, guardado, Copy y transiciones de sync se anuncian con una live region `polite` dedicada, sin duplicar cada actualización.
- Errores recién ocurridos pueden usar `role="alert"`; errores persistentes no se reanuncian en cada render.
- La validación del formulario asocia el error al campo y mueve el foco al primer campo inválido al enviar.
- Los mensajes de error describen recuperación, no sólo el fallo.

### Contraste, color y movimiento

- Texto normal, texto grande, controles, foco y límites interactivos deben verificarse contra los contrastes de WCAG 2.2 AA.
- Draft, review, final, proposal y sync usan texto y, si aporta, forma/icono además de color.
- Las transiciones de sheet o dialog son breves y se eliminan o reducen con `prefers-reduced-motion`.
- No hay typing animation, parallax ni movimiento ornamental.

## Dirección visual

La dirección es una mesa de trabajo documental, no un dashboard genérico:

- densidad media-alta en navegación y encabezados; mayor espacio vertical sólo para lectura y conversación;
- tipografía sans-serif del sistema para UI y una fuente monoespaciada del sistema para fuente Markdown y código;
- canvas, paneles y bordes discretos como base; un único rol accent para selección y acciones primarias;
- roles semánticos separados para success, warning y destructive, siempre acompañados de texto;
- bordes y divisores para explicar estructura; sombras sólo para separar overlays del fondo;
- radios moderados consistentes con la base elegida, sin convertir cada bloque en card;
- sin gradientes, hero, ilustración ornamental ni avatares decorativos en el MVP.

Los mensajes no necesitan burbujas grandes: una etiqueta de autor, un ancho legible y separación vertical bastan. Propuestas, warnings y errores sí usan contenedores delimitados porque su estado y acciones deben distinguirse de la conversación.

No se fijan paleta, familia tipográfica de marca, escala de espacios ni set de iconos antes del scaffold. La implementación debe materializarlos como tokens coherentes y demostrar contraste, pero no añadir una dependencia sólo para cumplir una preferencia estética.

## Trazabilidad

| Decisión de UI | Requisitos y criterios |
| --- | --- |
| Creación progresiva con sólo nombre obligatorio y aterrizaje en composer | FR-001, FR-006–FR-008; AC-001, AC-004–AC-005 |
| Navegación agrupada Project → PRD → Chat e historiales independientes | FR-002–FR-005; AC-002–AC-003 |
| Franja visible de Demo Mode, selector explícito y composer determinista | FR-009–FR-010; AC-006–AC-007 |
| Selector documental, sheet y modos Preview/Edit | FR-011–FR-013, FR-019–FR-020; AC-008–AC-009, AC-014–AC-015 |
| Guard común de borrador y prioridad del Markdown guardado | FR-012–FR-013; AC-009 |
| Pending approval con resolución persistente | FR-014; AC-010 |
| Acciones por estado, review findings y aceptación de warnings | FR-015–FR-017; AC-011–AC-012 |
| Continuación explícita después de Final | FR-018; AC-013 |
| Distinción `Saved locally` / `Demo sync` y cuatro estados de sync | FR-021–FR-023; AC-016–AC-017 |
| Tres representaciones responsive | FR-024; AC-018 |
| Errores con acción de recuperación y conservación del estado confirmado | FR-025; AC-019 |
| Fallback en memoria y reset confirmado de datos inválidos | FR-026; AC-023 |
| Teclado, foco, nombres, anuncios y contraste verificables | NFR-006; AC-024 |
| Experiencia local, single-user y sin controles de identidad | NFR-002, NFR-005; AC-022 |

## Omisiones deliberadas

- No hay dashboard, búsqueda, command palette, activity feed ni métricas.
- No hay pantalla separada de Projects ni rutas compartibles por entidad.
- No hay diff visual, autosave, historial general de revisiones ni WYSIWYG.
- No hay estados de presencia, identidad, permisos o colaboración.
- No hay proveedor real, credenciales, prueba de conexión ni promesa de sync remoto.
- No hay animación de agente ni lenguaje que simule inteligencia inexistente.
- No se diseña un sistema de componentes independiente antes de tener un segundo consumidor.

## Preguntas abiertas y restricciones no resueltas

La interfaz y todo el contenido visible para el usuario se implementan en español. Los labels y estados normativos escritos en inglés en este contrato se conservan únicamente para trazabilidad y deben traducirse en la UI; no se introduce infraestructura de i18n en el MVP.

1. **Nombres y contenido inicial posterior a Final:** la spec no define cómo numerar una nueva versión ni qué contenido y primer Chat recibe un PRD nuevo creado desde `Continue work`. Debe aclararse antes de implementar AC-013; no corresponde inventarlo en UI design.
2. **Catálogo final de errores:** cada fixture debe aportar texto y recuperación concretos. Este contrato define el patrón, pero no crea fallos de dominio ausentes en la spec.
3. **Tokens visuales:** no existe identidad ni base ejecutable. Paleta, tipografía exacta, espacios e iconos se concretarán al crear la app, respetando la dirección y las verificaciones de contraste aquí definidas.
