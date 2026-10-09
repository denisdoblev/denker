# Chats guiados por fases de desarrollo

**ID:** SPEC-002

**Estado:** clarified

## Contexto y problema

Denker debe evolucionar de una experiencia centrada únicamente en discovery y PRD a un asistente para el desarrollo de software. Al comenzar una iniciativa dentro de un Project, una persona que desarrolla un proyecto de aprendizaje o hobby necesita encontrar un recorrido inicial sencillo que le indique qué conversaciones abordar y en qué orden, sin tener que diseñar su propio proceso.

Actualmente, la creación prevista de un Project genera un solo Chat vacío. Ese comportamiento no comunica las fases posteriores del desarrollo ni evita comenzar decisiones dependientes —por ejemplo, diseño de pantallas o de base de datos— antes de contar con una definición de producto suficientemente avanzada.

La iniciativa propone crear una colección mínima de Chats guiados, mostrar sus dependencias y permitir conversaciones adicionales para aclaraciones. El recorrido debe seguir siendo local, manual y deliberadamente simple: el usuario decide cuándo una fase permite avanzar y Denker no intenta deducirlo mediante IA.

## Objetivos

- Dar a cada PRD un recorrido de desarrollo reconocible desde su creación.
- Evitar el uso prematuro de Chats que dependen de decisiones aún no preparadas.
- Permitir que el usuario habilite el avance de manera explícita, incluso cuando una fase no aplique.
- Diferenciar los Chats guiados de los Chats adicionales creados para aclaraciones.
- Mantener la experiencia adecuada a un proyecto de aprendizaje y hobby, sin backend ni automatización innecesaria.

## No objetivos

- Crear un motor configurable de workflows, plantillas o dependencias.
- Evaluar automáticamente la calidad o completitud del contenido de un Chat.
- Implementar un agente de IA, backend, API, base de datos o sincronización remota.
- Generar código, esquemas de base de datos, diseños visuales o pruebas como parte de esta iniciativa.
- Definir un proceso profesional exhaustivo para todos los tipos de software.

## Fases de desarrollo

Esta es la secuencia de Chats guiados creados con cada PRD. Al crear un Project, el flujo aparece inicialmente dentro de `PRD 001`.

| Orden | Chat guiado | Propósito | Requisito para usarlo |
| --- | --- | --- | --- |
| 1 | PRD | Definir el problema, alcance y requisitos del producto. | Ninguno. |
| 2 | Diseño de pantallas | Aclarar flujos, pantallas y estados visibles. | PRD en `review` o `final`. |
| 3 | Diseño de base de datos | Aclarar datos, relaciones y persistencia necesaria. | PRD en `review` o `final`. |
| 4 | Plan de implementación | Ordenar el trabajo a partir de la definición y los diseños aplicables. | Diseño de pantallas y Diseño de base de datos listos para avanzar o marcados como no aplicables. |
| 5 | Implementación | Acompañar la construcción siguiendo el plan acordado. | Plan de implementación listo para avanzar. |
| 6 | Pruebas y revisión | Verificar el resultado y registrar ajustes pendientes. | Implementación lista para avanzar. |

## Requisitos funcionales

| ID | Requisito |
| --- | --- |
| FR-001 | Al crear un PRD, el producto debe crear automáticamente, una sola vez y en el orden definido, los Chats guiados `PRD`, `Diseño de pantallas`, `Diseño de base de datos`, `Plan de implementación`, `Implementación` y `Pruebas y revisión`; el usuario debe entrar directamente al Chat `PRD`. Al crear un Project, este comportamiento debe aplicarse al `PRD 001` generado automáticamente. |
| FR-002 | Cada Chat guiado posterior a `PRD` debe mostrar su estado de progreso independientemente de su disponibilidad. Sus estados deben ser `Pendiente`, `En curso` y `Listo para avanzar`; `Diseño de pantallas` y `Diseño de base de datos` también deben admitir `No aplica`. |
| FR-003 | La disponibilidad de los Chats guiados debe respetar las dependencias declaradas en la tabla de fases. Inicialmente sólo `PRD` debe estar disponible y los demás deben estar bloqueados. |
| FR-004 | Para los Chats posteriores a `PRD`, `Listo para avanzar` debe satisfacer una dependencia y `Pendiente` o `En curso` no deben satisfacerla. En las dos fases de diseño, `No aplica` también debe satisfacerla. La dependencia del Chat `PRD` debe quedar satisfecha cuando el documento PRD alcance `review` o `final`, pero no mientras permanezca en `draft`. |
| FR-005 | El usuario debe decidir explícitamente el estado de cada Chat guiado disponible posterior a `PRD`. El producto no debe inferir el estado a partir de mensajes, documentos ni contenido conversacional. |
| FR-006 | Un Chat bloqueado no debe poder usarse. En la navegación debe mostrar un icono de candado a la derecha y, al intentar abrirlo, debe informar qué fases previas impiden el acceso sin abandonar el Chat actual. |
| FR-007 | Cuando todas las dependencias de un Chat queden satisfechas, éste debe quedar disponible inmediatamente sin perder su historial ni alterar el estado de otros Chats. |
| FR-008 | El usuario debe poder crear Chats adicionales para preguntas o aclaraciones dentro del PRD vigente. Estos Chats deben estar disponibles desde su creación, distinguirse de los Chats guiados y no participar en las dependencias ni habilitar fases por sí mismos. |
| FR-009 | Los Chats guiados, los Chats adicionales, sus historiales, estados y disponibilidad deben permanecer aislados entre PRDs y Projects. |
| FR-010 | Los Chats, estados y avance del flujo deben conservarse localmente y recuperarse después de recargar la aplicación. |
| FR-011 | El Chat `PRD` debe mostrar el mismo estado `draft`, `review` o `final` que su documento PRD y no debe ofrecer un estado de progreso adicional. Las transiciones del documento deben seguir las reglas existentes de su ciclo de vida. |
| FR-012 | Si una fase deja de satisfacer una dependencia, todos sus Chats dependientes directos e indirectos deben volver a bloquearse. El bloqueo debe conservar sus historiales y estados de progreso; cuando las dependencias vuelvan a satisfacerse, los Chats deben recuperar el acceso y contenido anteriores. Los Chats adicionales no deben verse afectados. |

## Requisitos no funcionales

| ID | Requisito |
| --- | --- |
| NFR-001 | Esta iniciativa debe funcionar por completo con `localStorage`, sin API, backend, base de datos, red ni servicio de IA. |
| NFR-002 | La solución debe limitarse al flujo fijo definido y evitar infraestructura para editar fases, dependencias o plantillas. |
| NFR-003 | El bloqueo no debe comunicarse sólo mediante el icono: el estado y el motivo deben tener nombres accesibles, ser perceptibles por teclado y conservar el contraste exigido por WCAG 2.2 AA. |

## Criterios de aceptación

| ID | Cubre | Criterio verificable |
| --- | --- | --- |
| AC-001 | FR-001, FR-003 | Dado un inicio sin datos, al crear un Project, su `PRD 001` contiene exactamente los seis Chats guiados en el orden definido, `PRD` queda seleccionado y disponible, y los otros cinco quedan bloqueados. Al crear después otro PRD en el mismo Project, éste recibe un conjunto nuevo e independiente con el mismo estado inicial. |
| AC-002 | FR-002, FR-004, FR-005 | En cada Chat guiado disponible posterior a `PRD`, el usuario puede elegir explícitamente `Pendiente`, `En curso` o `Listo para avanzar`; los dos Chats de diseño también ofrecen `No aplica`, mientras las demás fases no lo ofrecen. Ningún mensaje ni cambio documental modifica automáticamente ese estado. |
| AC-003 | FR-003, FR-004, FR-007, FR-011 | Mientras el documento PRD está en `draft`, ambos Chats de diseño permanecen bloqueados y el Chat `PRD` muestra `draft`. Al llevar el documento a `review`, el Chat muestra `review` y quedan disponibles `Diseño de pantallas` y `Diseño de base de datos`, mientras las fases posteriores siguen bloqueadas. Finalizar el documento cambia el estado mostrado a `final` y mantiene disponibles ambos diseños. |
| AC-004 | FR-003, FR-004, FR-007 | Con `Diseño de pantallas` en `Listo para avanzar` y `Diseño de base de datos` en `No aplica`, queda disponible `Plan de implementación`; `Implementación` y `Pruebas y revisión` continúan bloqueados. |
| AC-005 | FR-003, FR-004, FR-007 | Al marcar `Plan de implementación` como `Listo para avanzar`, queda disponible `Implementación`; al marcar luego `Implementación` como `Listo para avanzar`, queda disponible `Pruebas y revisión`. |
| AC-006 | FR-006, NFR-003 | Cada Chat bloqueado muestra un candado a su derecha con nombre accesible. Intentar abrirlo mediante puntero o teclado mantiene el Chat actual e identifica las fases que todavía no habilitan el acceso. |
| AC-007 | FR-008 | Desde cualquier fase, crear un Chat adicional lo deja disponible de inmediato y visualmente diferenciado; usarlo o cambiar su contenido no modifica el estado ni la disponibilidad de los Chats guiados. |
| AC-008 | FR-009 | Crear o avanzar Chats en un PRD no crea, desbloquea ni modifica Chats de otro PRD del mismo Project ni de otro Project. |
| AC-009 | FR-010, NFR-001 | Después de crear Chats adicionales, cambiar estados, desbloquear fases y añadir mensajes, una recarga recupera el mismo recorrido desde `localStorage` sin realizar solicitudes de red. |
| AC-010 | NFR-002 | La experiencia no ofrece controles para agregar, quitar, renombrar, reordenar o configurar fases y dependencias del flujo guiado. |
| AC-011 | FR-003, FR-004, FR-007, FR-012 | Dado un flujo avanzado hasta `Implementación`, hacer que una fase de diseño deje `Listo para avanzar` o `No aplica` vuelve a bloquear `Plan de implementación`, `Implementación` y `Pruebas y revisión`. Sus historiales y estados permanecen intactos, los Chats adicionales siguen disponibles y, al restaurar el estado habilitante, las fases recuperan su acceso y contenido anteriores. El mismo comportamiento se observa en los diseños si el documento PRD vuelve de `review` a `draft`. |

## Casos límite

- Un Project sin mensajes conserva el flujo inicial y sólo permite usar `PRD` y Chats adicionales creados por el usuario.
- Marcar una fase de diseño como `No aplica` satisface su dependencia sin crear contenido ficticio.
- Crear varios Chats adicionales con nombres similares no debe confundirlos con los Chats guiados ni incorporarlos al flujo.
- Un Chat que pasa a estar disponible conserva cualquier dato local asociado y no altera su estado de progreso hasta que el usuario lo cambie.
- Un retroceso de estado puede bloquear varias fases en cascada, pero nunca elimina sus mensajes ni reinicia el progreso que mostraban.
- Un icono de candado que no pueda cargarse visualmente no debe ocultar el estado bloqueado ni su explicación accesible.

## Supuestos

- Para los Chats posteriores a `PRD`, `Listo para avanzar` significa que el usuario considera suficiente el resultado para continuar; no equivale a un documento final o inmutable.
- `No aplica` representa la salida simple para Projects que no requieren interfaz o base de datos.
- La iniciativa prioriza un único flujo fijo adecuado al objetivo de aprendizaje y hobby.
- La iniciativa amplía la visión de producto consolidada en `docs/product.md`.

## Preguntas sin resolver

- Ninguna.

## Decisiones clarificadas

- **OQ-001 — Alcance del flujo:** cada PRD posee su propio conjunto independiente de Chats guiados y adicionales. Crear un Project crea `PRD 001` con ese flujo; crear un PRD posterior vuelve a iniciar el mismo recorrido sin modificar los anteriores.
- **OQ-002 — Composición del flujo:** cada PRD contiene las seis fases definidas, sin agregar otras: `PRD`, `Diseño de pantallas`, `Diseño de base de datos`, `Plan de implementación`, `Implementación` y `Pruebas y revisión`. Las fases de diseño pueden marcarse `No aplica` cuando no correspondan.
- **OQ-003 — Retroceso de una fase:** la disponibilidad se calcula dinámicamente. Cuando una dependencia deja de estar satisfecha, las fases posteriores vuelven a bloquearse en cascada sin perder información y recuperan el acceso anterior cuando la dependencia se restablece.
- **OQ-004 — Estado del PRD:** el Chat `PRD` refleja el ciclo `draft → review → final` de su documento y no posee otro estado de progreso. `Review` y `final` satisfacen la dependencia de las fases de diseño; `draft` no la satisface.

## Compatibilidad con SPEC-001

- Esta especificación reemplaza únicamente el comportamiento de `SPEC-001` que crea un solo primer Chat al crear un Project: `PRD 001` debe contener en su lugar los seis Chats guiados definidos aquí.
- Se conservan la creación automática de Product Context y `PRD 001`, la jerarquía `Project → PRD → Chat`, el ciclo `draft → review → final` y los demás requisitos de `SPEC-001` que no contradigan este flujo.

## Dependencias

- Diseño de interfaz posterior para los estados, controles y explicación del bloqueo.

## Fuera de alcance

- Migrar datos de implementaciones anteriores; el repositorio todavía se encuentra en documentación previa a la implementación.
- Personalizar el flujo por Project o por tipo de aplicación.
- Asignar personas, fechas, estimaciones, prioridades o permisos a las fases.
- Conectar el desbloqueo con validaciones automáticas, análisis del contenido o artefactos generados.
- Definir ahora los contratos de la futura API o persistencia remota.
