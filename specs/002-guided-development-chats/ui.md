# Chats guiados por fases de desarrollo — contrato de UI

**Spec:** `specs/002-guided-development-chats/spec.md` (`SPEC-002`)
**Plan:** `specs/002-guided-development-chats/plan.md`
**Estado:** draft
**Superficies:** navegación `Project → PRD → Chat`, encabezado y contenido del Chat, control de progreso, explicación de bloqueos y comportamiento responsive

## Propósito y límites

Este artefacto define cómo incorporar el recorrido fijo de desarrollo a la interfaz existente de Denker. La persona usuaria debe poder reconocer qué fase está usando, decidir cuándo permite avanzar, entender por qué otra fase está bloqueada y crear conversaciones auxiliares sin confundirlas con el recorrido guiado.

El diseño no añade un dashboard, una vista de workflow separada ni configuración de fases. El Chat continúa siendo la superficie principal; el recorrido se representa dentro de la navegación y del encabezado ya existentes. La disponibilidad se comunica como una consecuencia de las dependencias, nunca como una evaluación automática del contenido.

Principios de esta ampliación:

1. El orden del recorrido debe entenderse al recorrer la navegación, sin convertirla en un diagrama interactivo.
2. Progreso y disponibilidad son datos distintos: un Chat puede conservar `Listo para avanzar` y, aun así, estar bloqueado porque volvió a fallar una dependencia anterior.
3. Una acción sobre un Chat bloqueado explica el siguiente paso sin cambiar la selección activa.
4. Un retroceso nunca oculta que el historial y el progreso se conservaron.
5. Los Chats adicionales se reconocen por agrupación y texto, no sólo por color o icono.

## Sistema existente que se reutiliza

La implementación actual ya ofrece el shell y las convenciones visuales necesarias:

- sidebar de 17 rem en desktop, rail en tablet y sheet de navegación en tablet/mobile;
- jerarquía colapsable `Project → PRD → Chat` dentro de un `nav`;
- encabezado de Chat con breadcrumb, título, estado del PRD y acceso a documentos;
- región de Demo Mode, historial con semántica de `log` y composer persistente;
- panel documental inline en desktop y modal en tablet/mobile;
- `Button` de la base shadcn/ui/Base UI, diálogos existentes, `select` nativo estilizado, alerts inline, tokens CSS neutros, foco visible y soporte para `prefers-reduced-motion`;
- dirección de mesa de trabajo documental, densidad media-alta, tipografía del sistema, bordes discretos y ausencia de ornamentación, definida en `specs/001-mvp/ui.md`.

No existe actualmente un primitive `Badge`, un componente de workflow ni una dependencia de iconos que justifique ampliar el sistema. Los estados se pueden componer con texto y estilos existentes. El candado puede ser un SVG local de 16 px o el recurso equivalente ya disponible al implementar; no se añade una librería sólo para ese icono.

## Objetivo y acciones

**Objetivo principal:** recorrer las fases de un PRD en un orden comprensible y habilitar explícitamente el trabajo posterior cuando la definición sea suficiente.

**Acciones primarias:**

- entrar en un Chat guiado disponible;
- cambiar el progreso de una fase disponible;
- identificar y resolver las dependencias de una fase bloqueada;
- continuar la conversación de la fase activa.

**Acciones secundarias:**

- crear y usar un Chat adicional;
- consultar el documento PRD y cambiar su lifecycle mediante los controles existentes;
- volver a una fase anterior sin perder el trabajo de las posteriores;
- abrir navegación o documentos según el viewport.

No hay acciones para agregar, eliminar, renombrar, reordenar o configurar las seis fases.

## Arquitectura de información

### Navegación de un PRD

Cada PRD expandido separa las conversaciones en dos grupos. La acción de creación pertenece al segundo grupo para no sugerir que añade una fase:

```text
PRD 001 · Borrador

  Recorrido guiado
  ┌─────────────────────────────────┐
  │ PRD                             │
  │ Borrador                        │
  ├─────────────────────────────────┤
  │ Diseño de pantallas          🔒 │
  │ Pendiente · Bloqueado           │
  ├─────────────────────────────────┤
  │ Diseño de base de datos      🔒 │
  │ Pendiente · Bloqueado           │
  ├─────────────────────────────────┤
  │ Plan de implementación       🔒 │
  │ Pendiente · Bloqueado           │
  ├─────────────────────────────────┤
  │ Implementación               🔒 │
  │ Pendiente · Bloqueado           │
  ├─────────────────────────────────┤
  │ Pruebas y revisión           🔒 │
  │ Pendiente · Bloqueado           │
  └─────────────────────────────────┘

  Chats adicionales     [Nuevo Chat adicional]
  Chat adicional 1
    Adicional
```

`Recorrido guiado` y `Chats adicionales` son encabezados de grupo, no ramas colapsables nuevas. El colapso continúa ocurriendo sólo en Project y PRD. Esto mantiene predecible el teclado y evita ocultar por separado fases necesarias para entender el bloqueo.

Si todavía no hay Chats adicionales, se muestra el encabezado y la acción, sin una tarjeta vacía ni el texto ornamental “No hay Chats”.

### Anatomía de una fila guiada

Cada fila usa dos líneas y un extremo derecho reservado:

1. título completo de la fase, truncable visualmente en navegación;
2. lifecycle en `PRD` o progreso en las otras cinco fases;
3. texto `Bloqueado` en la segunda línea cuando corresponda;
4. candado alineado a la derecha sólo cuando la fase no está disponible.

El nombre completo y todos los estados forman parte del nombre accesible aunque el título visual se trunque. La fila activa conserva el tratamiento actual de selección y `aria-current="page"`. Si esa fila vuelve a bloquearse, selección y bloqueo se muestran simultáneamente porque la superficie central todavía representa ese Chat en modo sólo lectura.

Una fila disponible actúa como destino de navegación. Una fila bloqueada actúa como disclosure para su explicación: sigue siendo un `button`, no usa el atributo nativo `disabled`, y su nombre termina en `Bloqueado. Mostrar requisitos`. Al activarla no cambia `aria-current`, el documento abierto ni el Chat central.

### Anatomía de una fila adicional

La primera línea contiene el título y la segunda el texto `Adicional`. No muestra progreso, lifecycle ni candado. La separación de grupo y el texto visible permiten distinguirla aun con nombres similares a los de las fases.

### Encabezado del Chat

El encabezado conserva el breadcrumb y las acciones responsive existentes. Debajo del título cambia la metadata según el tipo:

| Tipo de Chat | Metadata y control |
| --- | --- |
| `PRD` guiado | `Estado del PRD: Borrador`, `En revisión` o `Final`. No hay selector de progreso. |
| Fase guiada disponible | Label persistente `Progreso de la fase` y selector con el valor actual. |
| Fase guiada activa que volvió a bloquearse | Progreso actual como texto y estado `Bloqueado`; no hay selector editable. |
| Chat adicional | Texto `Chat adicional`; no hay estado de progreso. |

El control de progreso comparte la fila de acciones en desktop cuando cabe. En anchos menores se ubica debajo del título, antes de `Abrir navegación` y `Abrir documentos`, y puede ocupar todo el ancho útil.

## Estados y vocabulario

Todo el copy visible permanece en español. Los valores internos del plan no se exponen.

| Concepto | Texto visible |
| --- | --- |
| Lifecycle `draft` | `Borrador` |
| Lifecycle `review` | `En revisión` |
| Lifecycle `final` | `Final` |
| Progreso `pending` | `Pendiente` |
| Progreso `in-progress` | `En curso` |
| Progreso `ready` | `Listo para avanzar` |
| Progreso `not-applicable` | `No aplica` |
| Disponibilidad negativa | `Bloqueado` |
| Clase `additional` | `Chat adicional` / `Adicional` según contexto |

`Diseño de pantallas` y `Diseño de base de datos` ofrecen los cuatro estados de progreso. `Plan de implementación`, `Implementación` y `Pruebas y revisión` ofrecen sólo los tres primeros. El orden del selector es `Pendiente`, `En curso`, `Listo para avanzar` y, cuando corresponde, `No aplica`; no se preselecciona un estado habilitante.

`Listo para avanzar` significa una decisión de la persona usuaria, no una validación, porcentaje de completitud ni estado inmutable. `No aplica` tiene tratamiento neutral: no se presenta como éxito, error o contenido faltante.

## Flujos e interacciones

### 1. Creación del recorrido

Crear un Project o un PRD produce las seis filas guiadas en el orden normativo y selecciona `PRD`. Las otras cinco nacen con progreso `Pendiente` y estado `Bloqueado`. El foco llega al composer del Chat `PRD`, igual que en la creación actual.

No se agrega un tour, stepper introductorio ni modal explicativo. La agrupación, el orden, los estados visibles y los disclosures de bloqueo contienen la orientación necesaria.

### 2. Navegar a una fase disponible

Activar una fila disponible:

- cambia el Chat, historial y documentos relacionados como en la navegación actual;
- cierra el sheet de navegación en tablet/mobile;
- lleva el foco al título del Chat;
- conserva los guards de borradores documentales existentes.

El estado vacío del historial adapta el mensaje al tipo de Chat:

| Chat | Título del estado vacío | Apoyo |
| --- | --- | --- |
| PRD | `Define esta iniciativa` | `Aclara el problema, el alcance y los requisitos del producto.` |
| Diseño de pantallas | `Diseña la experiencia visible` | `Aclara flujos, pantallas y estados de la interfaz.` |
| Diseño de base de datos | `Diseña los datos necesarios` | `Aclara datos, relaciones y persistencia.` |
| Plan de implementación | `Ordena el trabajo` | `Convierte la definición y los diseños aplicables en un plan.` |
| Implementación | `Construye siguiendo el plan` | `Usa este Chat para acompañar la implementación acordada.` |
| Pruebas y revisión | `Verifica el resultado` | `Registra comprobaciones, hallazgos y ajustes pendientes.` |
| Adicional | `Aclara una pregunta` | `Este Chat no cambia el avance del recorrido guiado.` |

Estos textos describen el propósito fijado por la spec; no prometen que Demo Mode comprenda o genere esos artefactos.

### 3. Intentar abrir una fase bloqueada

La activación por puntero, `Enter` o `Space` expande debajo de la fila un bloque compacto con título `Chat bloqueado` y las causas actuales. El foco permanece en la fila; el bloque se asocia mediante `aria-controls` y `aria-expanded` y se anuncia en una live region. Sólo una explicación de bloqueo permanece abierta por PRD para no alargar indefinidamente la sidebar.

La explicación enumera todas las causas accionables en el orden del recorrido, no sólo el nombre de un predecesor que también esté bloqueado. Formatos de copy:

- diseños: `El PRD debe estar En revisión o Final. Estado actual: Borrador.`;
- plan: `Diseño de pantallas está En curso. Cámbialo a Listo para avanzar o No aplica.` y la causa equivalente de base de datos cuando también corresponda;
- implementación: `Plan de implementación debe tener el estado Listo para avanzar. Estado actual: Pendiente.`;
- pruebas: `Implementación debe tener el estado Listo para avanzar. Estado actual: En curso.`

Si el predecesor conserva un progreso habilitante pero está bloqueado por una regresión anterior, la explicación lo hace explícito: `Plan de implementación conserva Listo para avanzar, pero está bloqueado. Falta resolver: …`. Así la UI no contradice el progreso persistido.

El disclosure no incluye una acción genérica `Desbloquear`: el usuario debe navegar a la fase indicada y tomar la decisión correspondiente. Si la fase requerida está disponible, su nombre puede ser un botón de navegación dentro de la explicación. En mobile, abrir la explicación no cierra el sheet.

### 4. Cambiar progreso

El selector `Progreso de la fase` actualiza el estado al elegir una opción; no requiere un segundo botón ni confirmación porque la opción elegida ya es una decisión explícita y no elimina información.

Después de un cambio:

- el selector conserva el foco;
- navegación y disponibilidad se actualizan inmediatamente;
- una live region anuncia el nuevo progreso y, si cambió disponibilidad, las fases afectadas: `Progreso: Listo para avanzar. Implementación ya está disponible.`;
- si el cambio vuelve a bloquear fases posteriores: `Progreso: En curso. Implementación y Pruebas y revisión volvieron a bloquearse; sus historiales se conservaron.`;
- el cambio se refleja como modificación local mediante el estado de sync existente.

Los mensajes, el contenido documental y los escenarios de Demo Mode nunca cambian este selector. No se muestra porcentaje, check automático ni recomendación que parezca una decisión ya tomada.

### 5. Lifecycle de PRD

El Chat `PRD` y su fila reflejan el mismo lifecycle del documento. Los controles siguen viviendo en el panel documental; no se duplica `Iniciar revisión`, `Volver a borrador` ni `Finalizar PRD` en el encabezado del Chat.

Al pasar a `En revisión` o `Final`, ambos diseños quedan disponibles y el anuncio identifica las dos fases. Volver a `Borrador` vuelve a bloquearlas y propaga el bloqueo sin cambiar sus progresos ni historiales.

### 6. Chat activo que vuelve a bloquearse

No se navega automáticamente a otro Chat. La fase conserva `aria-current`, su título y su historial, pero se transforma en una superficie de consulta:

```text
Diseño de pantallas
En curso · Bloqueado

┌ Esta fase volvió a bloquearse ──────────────────────┐
│ El PRD volvió a Borrador. Debe estar En revisión    │
│ o Final para continuar. El historial se conservó.   │
│ [Ir a PRD]                                          │
└──────────────────────────────────────────────────────┘

[ historial visible, sólo lectura ]

Chat bloqueado. No puedes enviar mensajes ni cargar
escenarios hasta que se cumplan las dependencias.
```

Mientras esté bloqueado:

- el selector de progreso se reemplaza por texto no editable;
- no se renderizan el selector ni la acción de carga de Demo Mode;
- el historial permanece visible y se identifica como `Historial del Chat, sólo lectura`;
- el composer se reemplaza por la explicación persistente de indisponibilidad;
- `Abrir navegación` y `Abrir documentos` siguen disponibles;
- `Ir a …` lleva a la primera fase accionable disponible, no necesariamente al predecesor inmediato bloqueado.

La aparición del bloqueo se anuncia una sola vez con `role="alert"`, porque retira capacidad de interacción. Si el cambio se inició en el panel documental, el foco permanece en el control de lifecycle y no salta detrás del panel; al cerrar un sheet documental vuelve a su disparador habitual. Restaurar las dependencias devuelve la superficie interactiva y el contenido anterior sin mensajes de éxito ornamentales.

### 7. Crear un Chat adicional

La acción se llama `Nuevo Chat adicional`. Mantiene el comportamiento simple actual: crea una conversación vacía, la ubica al final del grupo `Chats adicionales`, la selecciona y lleva el foco al composer. El título incremental visible puede ser `Chat adicional 1`, `Chat adicional 2`, etc.; no se abre un diálogo de nombre porque la spec no requiere renombrado.

Un Chat adicional está disponible incluso si todas las fases guiadas están bloqueadas. No presenta selector de progreso ni texto de disponibilidad y sus mensajes no producen anuncios sobre el recorrido.

## Cobertura de estados

| Estado | Representación y comportamiento |
| --- | --- |
| Recorrido inicial | `PRD` activo; cinco fases `Pendiente · Bloqueado`; grupo adicional vacío. |
| Fase guiada disponible | Fila navegable; progreso visible; selector en el encabezado al activarla. |
| Fase guiada bloqueada | Progreso conservado, texto `Bloqueado`, candado derecho y disclosure accionable. |
| Fase recién habilitada | Desaparecen candado y texto `Bloqueado`; anuncio `… ya está disponible`; no se selecciona sola. |
| Fase re-bloqueada no activa | Recupera candado y explicación; progreso e historial no cambian. |
| Fase re-bloqueada activa | Superficie central sólo lectura descrita arriba; selección estable. |
| `No aplica` | Estado visible neutral; satisface la dependencia sólo en las dos fases de diseño. |
| Chat adicional | Grupo y texto `Adicional`; siempre navegable; sin progreso. |
| Historial vacío | Copy específico de fase; composer disponible sólo si el Chat está disponible. |
| Historial largo | Scroll de la región existente; re-bloqueo no cambia posición ni contenido. |
| Nombre largo | Truncado sólo visual en navegación; nombre completo en el nombre accesible y tooltip/foco. |
| Recarga local | Recupera selección, progreso e historiales; si la selección recuperada está bloqueada muestra la superficie sólo lectura. |
| Error de persistencia | Reutiliza el fallback y la recuperación global existentes; no inventa un error específico de workflow. |
| Icono no renderizado | `Bloqueado` y su explicación siguen visibles y accesibles. |

No existe estado de permiso: la primera versión es single-user y no tiene roles. Tampoco hay loading de red para desbloqueos; el cambio es local e inmediato.

## Responsive

### Desktop, desde 1200 px

- Se conserva la sidebar fija de 17 rem y su scroll independiente.
- Las filas de dos líneas aumentan altura, no ancho; título, estado y candado caben sin ensanchar la navegación.
- El disclosure de bloqueo aparece dentro de la sidebar y puede envolver texto.
- El selector de progreso se mantiene en el encabezado central y el panel documental continúa inline.
- No se añade un panel permanente para el recorrido: competiría con Chat y documentación.

### Tablet, entre 640 y 1199 px

- El rail sigue mostrando sólo `Abrir navegación`; no intenta resumir seis fases mediante iconos sin texto.
- El recorrido completo aparece en el sheet izquierdo existente.
- Activar una fase disponible cierra el sheet; activar una bloqueada lo mantiene abierto y despliega la causa.
- El selector de progreso ocupa una línea propia en el encabezado cuando las acciones no caben.
- Navegación y documentación siguen siendo overlays mutuamente excluyentes.

### Mobile, debajo de 640 px

- El Chat sigue siendo la única región persistente.
- La navegación usa el sheet de ancho completo y conserva títulos, estado textual y candado; no reduce las filas a una lista de iconos.
- Las acciones `Abrir navegación` y `Abrir documentos` permanecen textuales.
- El selector de progreso usa todo el ancho útil y un target mínimo consistente con los controles existentes.
- El estado de Chat activo bloqueado prioriza alerta, acción de recuperación e historial; nunca deja visible un composer deshabilitado debajo del fold.

En todos los viewports, las filas y controles mantienen como mínimo el target de 24 × 24 CSS px exigido para verificar WCAG 2.2 AA; la implementación debe comprobarlo, no inferir conformidad de este documento.

## Accesibilidad

Este contrato define intención y evidencia esperada; no afirma conformidad antes de implementar y verificar.

### Teclado y foco

- Todas las filas se alcanzan en el orden visual del recorrido; no se implementa navegación de `tree` ni teclas de flecha nuevas.
- `Enter` y `Space` navegan en una fila disponible o muestran requisitos en una bloqueada.
- Una fila bloqueada no usa `disabled`, porque debe permanecer perceptible y operable para explicar su estado.
- El selector de progreso usa comportamiento nativo de teclado.
- Cambiar progreso conserva el foco; navegar conserva la política existente de foco al título o composer.
- La apertura y cierre de sheets mantiene captura y restauración de foco existentes.
- No hay atajos de una sola tecla ni movimiento asociado a desbloqueos.

### Semántica y nombres

- Los dos grupos usan encabezados y listas dentro del `nav`; no usan roles de `tablist`, `menu` ni `tree`.
- Una fila disponible expone título, estado y disponibilidad en su nombre accesible; la activa añade `aria-current="page"`.
- Una fila bloqueada expone título, progreso, `Bloqueado` y la acción `Mostrar requisitos`; su candado visual es redundante y puede tener `aria-hidden="true"` porque el texto oculto/visible ya nombra el estado.
- El disclosure usa `aria-expanded` y `aria-controls`; sus causas son una lista cuando hay más de una.
- El selector tiene label persistente `Progreso de la fase`; el valor visible no depende de placeholder.
- La superficie re-bloqueada identifica el historial como sólo lectura y no deja controles que aparenten estar disponibles.

### Anuncios

- Un intento de abrir una fase bloqueada anuncia la causa mediante una región `polite` sin releer toda la navegación.
- Un cambio de progreso anuncia el valor y sólo las disponibilidades que realmente cambiaron.
- El re-bloqueo del Chat activo usa un alert persistente que no se vuelve a anunciar en cada render.
- Desbloquear una fase no mueve el foco ni abre el Chat automáticamente.

### Contraste y percepción

- Progreso, clase y bloqueo siempre tienen texto; color, peso o icono sólo los refuerzan.
- El candado, los límites del selector, el foco y el texto secundario deben verificarse contra los contrastes aplicables de WCAG 2.2 AA sobre fondos normal, seleccionado y muted.
- Una fila bloqueada puede atenuarse, pero su texto no usa opacidad de control deshabilitado si eso reduce legibilidad.
- La actualización de filas no anima posiciones; los sheets conservan la reducción de movimiento existente.

## Dirección visual

La ampliación mantiene la dirección monocroma y documental implementada. El recorrido se apoya en sangría, encabezados, texto secundario, selección, divisores y un único candado; no introduce una paleta por estado.

- `Pendiente` y `En curso` usan texto normal/secundario, no colores de severidad.
- `Listo para avanzar` puede usar mayor peso o un contenedor sutil existente, siempre con texto.
- `No aplica` usa tratamiento neutral.
- `Bloqueado` usa texto secundario legible, candado y explicación; no un overlay oscuro ni una fila con opacidad global.
- La alerta de re-bloqueo reutiliza el patrón de alert delimitado existente y reserva destructive para fallos, no para una dependencia normal.

No se dibujan conectores, flechas, porcentajes, círculos numerados ni checkmarks que impliquen una secuencia lineal estricta: las dos fases de diseño son paralelas y un check podría confundirse con validación automática. El orden de lista y las explicaciones aportan la jerarquía necesaria con menor complejidad.

## Componentes y patrones

| Necesidad | Reutilización |
| --- | --- |
| Grupos del recorrido | `nav`, encabezados y listas existentes dentro del PRD |
| Filas disponibles | Botón de navegación actual con segunda línea de metadata |
| Filas bloqueadas | Mismo botón como disclosure + bloque inline asociado |
| Progreso | `select` nativo con el estilo de campos existente |
| Candado | SVG local pequeño o recurso ya disponible; sin dependencia nueva |
| Re-bloqueo activo | Alert inline, historial existente en sólo lectura y Button para recuperación |
| Feedback de disponibilidad | Live region compartida de estado |
| Responsive | Sidebar, rail y Dialog/Sheet existentes |

Los patrones nuevos justificados son la **fila de fase con progreso y disponibilidad**, su **explicación inline de dependencias** y la **superficie de Chat activo re-bloqueado**. Son composiciones locales del sistema existente, no primitives genéricos ni un motor visual de workflow.

## Trazabilidad

| Decisión de UI | Requisitos y criterios |
| --- | --- |
| Seis filas fijas, ordenadas y seleccionando `PRD` al crear | FR-001, FR-003; AC-001 |
| Progreso visible separado de disponibilidad y selector manual | FR-002, FR-004–FR-005; AC-002–AC-005 |
| Lifecycle del documento reflejado en `PRD`, sin segundo progreso | FR-011; AC-003 |
| Candado derecho, texto `Bloqueado` y disclosure sin navegación | FR-006; NFR-003; AC-006 |
| Actualización inmediata y anuncios de desbloqueo | FR-007; AC-003–AC-005 |
| Grupo y creación explícita de Chats adicionales | FR-008; AC-007 |
| Navegación y estados contenidos dentro de cada PRD | FR-009; AC-008 |
| Recuperación visual después de recargar | FR-010; AC-009 |
| Sin controles para configurar fases | NFR-002; AC-010 |
| Re-bloqueo activo sólo lectura, sin pérdida ni navegación automática | FR-012; AC-011 |
| Representaciones desktop, tablet y mobile existentes | `docs/product.md`, `docs/conventions.md` |

## Omisiones deliberadas

- No hay vista global de progreso, dashboard, roadmap ni porcentaje completado.
- No hay stepper horizontal: no representa bien las dos fases de diseño paralelas y compite con el ancho del Chat.
- No hay drag and drop, menú contextual, edición de dependencias ni plantillas.
- No hay autoavance al desbloquear, al cambiar progreso ni al finalizar el PRD.
- No hay confirmación al cambiar progreso porque el cambio es reversible y conserva datos.
- No hay selector de progreso en `PRD` ni Chats adicionales.
- No hay inferencia desde mensajes, documentos, fixtures o actividad.
- No hay nueva paleta, tipografía, paquete de iconos ni componente compartido fuera de `apps/web`.

## Restricciones resueltas

- **Chat activo re-bloqueado:** conserva selección e historial en modo sólo lectura; no se redirige automáticamente.
- **Explicación de bloqueo:** disclosure inline asociado a la fila, disponible por teclado y sin abandonar el Chat actual.
- **Progreso:** selector explícito en el encabezado; cambio inmediato, reversible y sin confirmación.
- **Diferenciación:** grupos `Recorrido guiado` y `Chats adicionales`, más texto de clase en cada fila adicional.
- **Icono:** recurso local o existente, siempre redundante respecto del texto; no justifica una dependencia.

No quedan decisiones de producto abiertas para descomponer la implementación. La elección concreta de SVG y los ajustes de wrapping dentro de los estilos actuales son detalles reversibles de implementación que deben validarse en 1440, 768 y 390 px.
