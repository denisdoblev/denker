# MVP frontend local de Denker

**ID:** SPEC-001

**Estado:** clarified

## Contexto y problema

Quienes exploran una idea de producto necesitan convertir conversaciones incompletas y decisiones dispersas en documentación estructurada sin perder control sobre el resultado. Denker busca ofrecer esa experiencia mediante un Product Manager/Product Owner asistido por IA, pero la primera iniciativa debe validar la experiencia de producto exclusivamente desde el frontend, antes de incorporar inteligencia o integraciones reales.

El MVP debe permitir recorrer de forma local y determinista la relación entre Projects, PRDs, Chats y documentos Markdown; hacer visibles las propuestas, aprobaciones, incertidumbres y estados del ciclo de vida; y demostrar que la ausencia de backend, LLM o repositorio conectado no bloquea el discovery.

El actor de esta iniciativa es una única persona que crea y documenta sus propios productos desde el navegador.

## Objetivos

- Permitir que una persona inicie un Project y llegue directamente a un primer Chat con el contexto documental mínimo ya creado.
- Hacer recorrible la experiencia principal de discovery y documentación mediante escenarios deterministas, sin simular inteligencia real.
- Mantener Product Context, PRD vigente, versiones finalizadas e historiales de Chat con su autoridad y ciclo de vida claramente diferenciados.
- Dar al usuario control explícito sobre cambios sensibles, finalización y evolución de un PRD.
- Conservar localmente el trabajo y representar, sin ejecutarla, la futura conexión y sincronización con un repositorio.
- Ofrecer una experiencia desktop-first que siga siendo funcional en tablet y mobile.

## No objetivos

- Validar la calidad de un agente de Product Management/Product Ownership real.
- Implementar backend, base de datos, autenticación, multiusuario, permisos o colaboración.
- Integrar un LLM, proveedor de IA, prompts, orquestación, tool calling, RAG o memoria de agente.
- Conectarse realmente con GitHub, administrar credenciales, crear commits o sincronizar archivos remotos.
- Proporcionar un editor WYSIWYG, edición colaborativa, infraestructura cloud o deployment.
- Ofrecer un CRUD completo de las entidades: renombrar, archivar, duplicar y eliminar Projects, PRDs, versiones o Chats queda fuera del MVP.

## Requisitos funcionales

| ID | Requisito |
| --- | --- |
| FR-001 | Para crear un Project, el único dato obligatorio debe ser su nombre. Al crearlo, el producto debe generar automáticamente un Product Context inicial y `PRD 001` en estado `draft`, ambos con encabezados básicos y `TBD` donde falte información, además de un primer Chat sin mensajes que invite al usuario a describir su idea; finalmente debe llevarlo directamente a ese Chat. |
| FR-002 | El producto debe mantener la jerarquía `Project → PRD → Chat`: todo PRD pertenece a un Project, todo Chat pertenece a un PRD y no existen Chats globales. |
| FR-003 | El usuario debe poder crear Projects y crear Chats dentro de un PRD. La navegación debe representar múltiples Projects, los PRDs de cada Project y los Chats de cada PRD sin mezclar elementos pertenecientes a ramas distintas. |
| FR-004 | Cada Chat debe conservar un historial propio. Crear o abrir otro Chat no debe incorporar automáticamente el historial de Chats anteriores; Product Context, PRD activo, decisiones consolidadas y preguntas abiertas relevantes constituyen el contexto documental compartido. |
| FR-005 | El Product Context debe pertenecer al Project y conservar conocimiento transversal sin sustituir a los PRDs de iniciativas concretas. |
| FR-006 | El usuario debe poder iniciar un Project sin repositorio y continuar toda la experiencia de discovery. La configuración conceptual de repositorio debe poder proporcionarse al crear el Project o posteriormente. |
| FR-007 | La configuración conceptual de repositorio debe contemplar provider, owner u organization, repository, branch y documentation path; cuando no se indiquen, branch y documentation path deben usar `main` y `/docs`. |
| FR-008 | La interfaz debe comunicar cuando no existe un repositorio conectado y representar de manera local o mockeada la configuración elegida, sin solicitar credenciales ni realizar operaciones remotas. |
| FR-009 | Demo Mode debe comenzar en el primer Chat vacío y avanzar por un guion predefinido cuando el usuario envía un mensaje no vacío. Además, debe ofrecer un selector de escenarios para cargar directamente: conversación vacía; pregunta del agente; respuesta del usuario; PRD actualizado; cambio pendiente de aprobación; propuesta de cambio de Product Context; review con warnings; PRD finalizado; nueva versión; recomendación de crear otro PRD; errores; y estados de sincronización. |
| FR-010 | Demo Mode debe indicar explícitamente que las respuestas no interpretan el contenido enviado. Los escenarios no deben interpretar lenguaje ni inferir decisiones a partir de una conversación; sus respuestas y transiciones deben corresponder al guion, al escenario seleccionado o a acciones predefinidas y visibles para el usuario. Un mensaje vacío no debe avanzar el guion. |
| FR-011 | El PRD vigente debe representarse como Markdown vivo y flexible: no debe exigir secciones irrelevantes y debe admitir `TBD`, preguntas abiertas, warnings o secciones incompletas. |
| FR-012 | Mientras un PRD está en `draft`, los cambios ordinarios no destructivos del escenario pueden incorporarse al documento; el usuario también debe poder ordenar una actualización y editar directamente su Markdown. Una edición directa debe permanecer como borrador hasta que el usuario elija `Save changes`; `Discard changes` debe restaurar el último contenido guardado. |
| FR-013 | La última edición de Markdown guardada o aceptada por el usuario debe prevalecer sobre historiales, propuestas y contenido anterior del escenario. Si el usuario intenta cerrar el editor o navegar a otro contenido con cambios sin guardar, la interfaz debe pedir confirmación antes de descartarlos. |
| FR-014 | Una propuesta que elimine requisitos, modifique decisiones consolidadas, cambie materialmente el alcance, altere Product Context o sea potencialmente destructiva no debe aplicarse sin aprobación explícita del usuario. Esta lista es exhaustiva para el MVP: los fixtures deben identificar expresamente las propuestas sensibles y los demás cambios del guion se consideran ordinarios. El usuario debe poder aceptar o rechazar cada propuesta sensible. |
| FR-015 | Un PRD debe recorrer los estados `draft → review → final`; el producto debe mostrar el estado vigente y sólo ofrecer acciones compatibles con él. |
| FR-016 | En `review`, el usuario debe poder inspeccionar los gaps, contradicciones, ambigüedades, riesgos, decisiones pendientes, preguntas abiertas y warnings que el escenario contenga; debe poder corregirlos, volver a `draft` o finalizar aceptando expresamente los warnings restantes. |
| FR-017 | Finalizar un PRD debe conservar un snapshot inmutable y de sólo lectura de esa versión. Una versión final no puede ser modificada por edición directa ni por acciones de un escenario. |
| FR-018 | Para continuar una iniciativa finalizada, el usuario debe poder crear una nueva versión del mismo PRD; para una iniciativa distinta, debe poder crear un PRD nuevo. Una recomendación del escenario no debe ejecutar ninguna de las dos opciones sin decisión explícita del usuario. |
| FR-019 | Desde un Chat, el usuario debe poder abrir y cerrar un sheet documental que muestre por defecto el PRD correspondiente y permita alternar entre el PRD vigente, Product Context y las versiones finalizadas de ese PRD. |
| FR-020 | Los documentos editables deben ofrecer `Preview`, `Edit`, `Save changes` y `Discard changes`; `Preview` debe mostrar el borrador actual y `Copy` debe copiar su fuente Markdown completa. Si el navegador impide copiar, el producto debe mostrar un error no bloqueante y mantener el Markdown visible y editable, sin ofrecer otro mecanismo de copia. Las versiones finalizadas deben mostrarse en modo de sólo lectura y sin capacidad de edición. |
| FR-021 | El estado de Projects, PRDs, versiones, Chats, documentos, aprobaciones y configuración mockeada debe conservarse localmente y recuperarse tras recargar la aplicación. |
| FR-022 | La persistencia local y la sincronización de repositorio deben comportarse como conceptos distintos: guardar localmente no debe implicar sincronización. |
| FR-023 | La interfaz debe poder representar `Synced`, `Unsynced changes`, `Syncing` y `Sync failed`, además de una acción `Sync now`; en este MVP la acción sólo debe producir la transición determinista correspondiente y nunca una sincronización remota. |
| FR-024 | En desktop, la experiencia principal debe disponer sidebar, Chat y sheet documental opcional; en tablet la sidebar debe poder colapsarse y el sheet seguir disponible; en mobile, sidebar y documentación deben abrirse como overlays o sheets sin exigir que las tres regiones estén visibles a la vez. Los anchos de referencia para validar estos comportamientos son 1440 px, 768 px y 390 px respectivamente. |
| FR-025 | Los escenarios de error incluidos en Demo Mode deben mostrar el fallo al usuario y mantener disponible una salida o acción de recuperación prevista por el propio escenario. |
| FR-026 | Si `localStorage` no está disponible, el producto debe seguir siendo utilizable durante la sesión actual con estado temporal; el MVP no está obligado a advertir que ese estado no persistirá. Si los datos almacenados son inválidos, no debe eliminarlos automáticamente y debe ofrecer `Reset local data`, sujeto a confirmación explícita, para iniciar un estado nuevo. |

## Requisitos no funcionales

| ID | Requisito |
| --- | --- |
| NFR-001 | La iniciativa debe entregarse como frontend en un monorepo con Turborepo, usando Next.js, TypeScript y shadcn/ui. |
| NFR-002 | Todos los recorridos del MVP deben funcionar sin backend, red, servicio de IA, cuenta de GitHub ni credenciales. |
| NFR-003 | El estado local debe persistirse mediante `localStorage`, cuyo acceso debe quedar fuera de los componentes de presentación y poder sustituirse razonablemente en una iniciativa futura. No se usará IndexedDB ni base de datos. |
| NFR-004 | Los comportamientos observables deben poder verificarse con Jest y React Testing Library sin depender de detalles internos de implementación. |
| NFR-005 | La experiencia debe ser single-user y no debe exponer flujos de autenticación, roles o permisos. |
| NFR-006 | La experiencia debe ser compatible con las versiones estables vigentes de Chrome, Firefox, Safari y Edge, y cumplir WCAG 2.2 nivel AA, incluyendo navegación por teclado, foco visible, nombres accesibles y contraste. |

## Criterios de aceptación

| ID | Cubre | Criterio verificable |
| --- | --- | --- |
| AC-001 | FR-001, FR-002 | Dado un inicio sin datos, el formulario sólo exige el nombre del Project. Al confirmarlo sin repositorio ni otros datos, existen un Product Context y `PRD 001` en `draft` con encabezados básicos y `TBD`, además de un primer Chat correctamente vinculado, sin mensajes y con una invitación a describir la idea; la vista activa es ese Chat. |
| AC-002 | FR-002, FR-003, FR-005 | Después de crear un segundo Project y Chats adicionales, la sidebar muestra cada elemento en su rama correcta; seleccionar cada nodo abre únicamente su contenido y ningún Chat aparece fuera de un PRD. |
| AC-003 | FR-003, FR-004 | Después de crear dos Chats del mismo PRD con mensajes diferentes, alternar entre ellos conserva historiales independientes mientras ambos permiten acceder al mismo PRD y Product Context consolidados. |
| AC-004 | FR-006, FR-008 | Crear un Project omitiendo la configuración de repositorio completa el flujo y permite usar Chat y documentos; la UI muestra que el repositorio no está conectado y permite acceder posteriormente a su configuración mockeada. |
| AC-005 | FR-007, FR-008 | Al representar una configuración sin branch ni documentation path, la UI conserva y muestra `main` y `/docs`; no solicita credenciales ni genera tráfico u operaciones hacia GitHub. |
| AC-006 | FR-009 | Tras crear un Project, Demo Mode comienza en el Chat vacío; enviar cualquier mensaje no vacío avanza el siguiente paso del guion. El selector puede cargar cada estado enumerado y, al repetir el mismo escenario y las mismas acciones desde el mismo estado inicial, se obtiene el mismo resultado observable. |
| AC-007 | FR-010, NFR-002 | La UI advierte que Demo Mode no interpreta el contenido. Dos mensajes no vacíos diferentes enviados en el mismo paso producen la misma transición predefinida; un mensaje vacío no la produce, y ninguna transición requiere un servicio de IA o de red. |
| AC-008 | FR-011 | Un PRD puede guardarse y visualizarse con una combinación libre de secciones, incluyendo `TBD`, preguntas abiertas y warnings, sin que la UI obligue a completar una plantilla fija. |
| AC-009 | FR-012, FR-013 | En un PRD `draft`, una edición directa no cambia el contenido guardado hasta ejecutar `Save changes`; guardar la convierte en el contenido vigente y `Discard changes` restaura la última versión guardada. Intentar cerrar o navegar con cambios pendientes exige confirmar su descarte. Después de navegar o recargar, la última edición guardada o aceptada sigue vigente y no es reemplazada silenciosamente por un fixture o propuesta anterior. |
| AC-010 | FR-014 | Para cada categoría sensible enumerada, el fixture identifica la categoría, deja visible el contenido vigente sin modificar y ofrece aceptar o rechazar; aceptar aplica exactamente la propuesta y rechazar conserva el documento anterior. Un cambio del guion no identificado como sensible puede aplicarse como ordinario sin pedir aprobación. |
| AC-011 | FR-015, FR-016 | Desde `draft` el usuario puede entrar en `review`; allí ve los hallazgos del escenario, puede corregirlos o volver a `draft`, y el estado mostrado coincide con la acción elegida. |
| AC-012 | FR-016, FR-017 | Si quedan warnings al finalizar, se requiere una aceptación explícita; tras ella se crea un snapshot `final` cuyo contenido permanece sin cambios y cuyos controles no permiten editarlo. |
| AC-013 | FR-018 | Ante un PRD finalizado, el usuario puede elegir entre crear una nueva versión del mismo PRD o un PRD distinto; ninguna recomendación crea la entidad antes de su confirmación explícita. |
| AC-014 | FR-019 | Al abrir el sheet desde un Chat se muestra su PRD; el usuario puede cerrarlo, reabrirlo y alternar entre PRD vigente, Product Context y versiones finalizadas disponibles sin abandonar el Chat. |
| AC-015 | FR-020 | En un documento editable, `Preview` renderiza el borrador actual, `Edit` permite modificar la fuente, `Save changes` la confirma, `Discard changes` la revierte y `Copy` entrega la fuente Markdown completa mostrada. Si el portapapeles rechaza la operación, aparece un error no bloqueante, el Markdown permanece disponible y no se ofrece un mecanismo alternativo; en un snapshot final no existe una acción efectiva de edición. |
| AC-016 | FR-021, NFR-003 | Después de modificar entidades, documentos, aprobaciones y configuración mockeada, una recarga recupera el mismo estado desde `localStorage`; los componentes de presentación pueden verificarse sin acceder directamente a esa API. |
| AC-017 | FR-022, FR-023 | Guardar un cambio local puede dejar el estado `Unsynced changes`; ejecutar `Sync now` recorre el resultado determinista configurado (`Syncing` seguido de `Synced` o `Sync failed`) sin modificar la disponibilidad del dato local ni contactar un repositorio. |
| AC-018 | FR-024 | A 1440 px, desktop puede mostrar sidebar y Chat junto al sheet opcional; a 768 px, tablet permite colapsar la sidebar; a 390 px, mobile abre navegación y documentos como superficies superpuestas y mantiene utilizable el Chat. |
| AC-019 | FR-025 | Al activar cada escenario de error, la UI identifica el fallo y ofrece la recuperación definida; utilizarla devuelve el recorrido a un estado utilizable sin perder el último contenido local confirmado. |
| AC-020 | NFR-001 | La configuración del repositorio identifica un monorepo Turborepo con una aplicación Next.js escrita en TypeScript y usando componentes shadcn/ui, y sus comandos reales de instalación y build completan correctamente. |
| AC-021 | NFR-004 | Los flujos críticos de UI cubiertos por AC-001 a AC-019 y AC-023 cuentan con pruebas relevantes en Jest y React Testing Library que ejercitan resultados visibles o accesibles para el usuario. |
| AC-022 | NFR-002, NFR-005 | Todos los recorridos anteriores completan en un entorno sin servicios externos ni sesión de usuario y no presentan controles de autenticación, roles o permisos. |
| AC-023 | FR-026 | Con `localStorage` inaccesible, el usuario puede recorrer la sesión actual con estado temporal aunque no se muestre una advertencia. Con datos locales inválidos, la aplicación no los borra al detectarlos: ofrece `Reset local data`, cancelar conserva los datos y confirmar inicia el estado nuevo. |
| AC-024 | NFR-006 | Los recorridos críticos son utilizables en las versiones estables vigentes de Chrome, Firefox, Safari y Edge; todas sus acciones pueden completarse mediante teclado, el foco es visible, los controles tienen nombres accesibles y texto y controles cumplen el contraste de WCAG 2.2 AA. |

## Casos límite

- Un Project creado sin repositorio debe quedar plenamente utilizable y permitir configurar uno más adelante.
- Un PRD con información incompleta puede entrar en `review`; si se finaliza con warnings, éstos requieren aceptación explícita y quedan reflejados en el snapshot.
- Rechazar una propuesta sensible no debe alterar el documento ni impedir continuar el Chat.
- Una edición manual guardada después de una propuesta debe convertirse en la fuente vigente y no ser sobrescrita al cambiar de Chat, documento o escenario; una edición descartada no debe alterarla.
- Abrir el primer Chat sin mensajes debe mostrar la invitación a describir la idea, sin afectar el historial de otros Chats ni impedir acceder al PRD.
- Un fallo mockeado de sincronización no debe eliminar ni revertir cambios guardados localmente.
- Una versión final debe seguir siendo inmutable aunque exista una versión posterior editable del mismo PRD.
- En mobile, abrir navegación o documentación no debe exigir renderizar simultáneamente las tres regiones de desktop.
- La creación de una entidad no debe ofrecer ni implicar renombrado, archivado, duplicación o eliminación posterior dentro del MVP.
- La falta de `localStorage` no debe impedir usar la sesión actual; recargar puede perder ese estado temporal sin que el MVP tenga que mostrar un aviso previo.
- Un fallo de portapapeles no debe alterar el documento ni bloquear su edición.

## Supuestos

- “Primera versión”, “frontend inicial” y “MVP” se refieren a la misma iniciativa descrita en esta especificación.
- Demo Mode usa un guion y datos de ejemplo, además de un selector explícito para cargar escenarios; no pretende evaluar una conversación real.
- La configuración de repositorio y todos los estados de sincronización se guardan sólo como datos locales de demostración.
- Los hallazgos de `review` provienen de fixtures y no de análisis automático.
- Los documentos se representan como texto Markdown; el aspecto concreto de su preview se decidirá durante diseño y planificación.

## Dependencias

- Aprobación de esta especificación.
- Definición posterior del diseño de interfaz para los recorridos y estados aquí especificados.
- Plan de implementación que concrete la estructura del monorepo y los límites internos sin ampliar el alcance.

## Fuera de alcance

- Evaluar si las recomendaciones, preguntas o diagnósticos de los fixtures son adecuados para un producto real.
- Definir contratos futuros de backend, IA o GitHub.
- Diseñar anticipadamente mecanismos de escala, concurrencia, sincronización o colaboración.
- Renombrar, archivar, duplicar o eliminar Projects, PRDs, versiones o Chats.
- Advertir sobre la falta de persistencia cuando `localStorage` no está disponible.
- Publicar o alojar la aplicación.
