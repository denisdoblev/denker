# Denker — Product Context

- **Estado:** contexto inicial aceptado
- **Última actualización:** 2026-10-08

Este documento consolida las decisiones de producto transversales. No sustituye a los PRDs de iniciativas concretas. La última versión aceptada o editada por el usuario es la fuente de verdad.

## Visión

Denker asiste el desarrollo de software desde la definición de una idea hasta su implementación y revisión. Organiza ese recorrido mediante conversaciones guiadas que ayudan a producir y mantener la documentación necesaria en cada fase.

El usuario describe su idea, responde preguntas, analiza recomendaciones y toma decisiones. Mientras avanza desde el discovery hacia el diseño, la planificación, la implementación y las pruebas, Denker mantiene Markdown vivo con el conocimiento consolidado del producto y de cada iniciativa.

Principio rector: **el agente recomienda; el usuario decide**.

## Modelo de dominio

- **Project:** representa un producto durante toda su vida y puede contener múltiples PRDs.
- **Product Context:** documento Markdown transversal del Project. Consolida visión, problema, usuarios, principios, restricciones, decisiones, capacidades, términos e iniciativas relevantes sin convertirse en un PRD gigante.
- **PRD:** representa una iniciativa con alcance definido. No debe crecer indefinidamente para abarcar toda la vida del producto.
- **PRD version:** snapshot de una versión del PRD. Una versión final es inmutable; una evolución de la misma iniciativa crea otra versión.
- **Chat:** conversación con historial propio, siempre perteneciente a un PRD. No existen chats globales sueltos.
- **Chat guiado:** Chat creado automáticamente como una fase del recorrido de desarrollo de un PRD. Puede estar disponible o bloqueado por sus dependencias.
- **Chat adicional:** Chat creado por el usuario para preguntas o aclaraciones. No participa en las dependencias del recorrido guiado.

La jerarquía es `Project → PRD → Chat`. Ante un cambio, el agente puede recomendar incorporarlo al PRD actual, crear una versión o abrir un PRD nuevo; la elección corresponde al usuario.

## Experiencia principal

La organización espacial se inspira en ChatGPT, sin copiar sus colores ni su identidad visual.

La interfaz y todo el contenido visible para el usuario se presentan en español. Los términos técnicos o identificadores conservados en inglés en la documentación no obligan a mostrar copy en inglés.

En desktop:

```text
[ Sidebar ] [ Chat principal ] [ Sheet documental opcional ]
```

La sidebar presenta Projects, sus PRDs y los Chats de cada PRD. La experiencia es desktop-first, pero debe seguir siendo funcional:

- en tablet, la sidebar es colapsable y el sheet documental sigue disponible;
- en mobile, sidebar y documentación se muestran como overlays o sheets, sin intentar mantener visibles las tres regiones a la vez.

## Creación y navegación

Crear un Project produce automáticamente un Product Context inicial, `PRD 001` y los Chats guiados de ese PRD. El usuario entra directamente al Chat `PRD`; no debe completar manualmente cada nivel. Cada PRD posterior recibe un recorrido independiente con los mismos Chats guiados.

Un Project puede conectarse a un repositorio durante su creación o más adelante. No tener repositorio nunca bloquea el discovery. La configuración conceptual contempla provider, owner u organization, repository, branch y documentation path, con defaults `main` y `/docs`.

GitHub es el primer provider previsto, pero la versión inicial no realiza conexión, credenciales ni operaciones reales. La UI puede mostrar `Repository not connected`.

## Flujo de desarrollo guiado

Cada PRD contiene este flujo fijo de Chats:

```text
PRD ─┬─> Diseño de pantallas ────────┐
     └─> Diseño de base de datos ────┴─> Plan de implementación
                                               ↓
                                        Implementación
                                               ↓
                                      Pruebas y revisión
```

`PRD` es la única fase disponible inicialmente. Cuando su documento alcanza `review` o `final`, quedan disponibles ambos Chats de diseño. `Plan de implementación` requiere que los dos diseños estén `Listo para avanzar` o `No aplica`; las fases restantes se habilitan sucesivamente cuando su predecesora está `Listo para avanzar`.

El usuario decide los estados de avance; Denker no los infiere del contenido. Si una dependencia deja de cumplirse, las fases posteriores se bloquean otra vez en cascada sin perder sus mensajes ni estados y recuperan el acceso cuando la dependencia se restablece. Los Chats bloqueados muestran un candado a la derecha y explican qué dependencia impide usarlos.

Los Chats adicionales están siempre disponibles, sirven para aclaraciones y no habilitan ni bloquean fases.

## Discovery asistido

La visión futura incluye un agente especializado en Product Management/Product Ownership. Su discovery debe ser adaptativo: reutilizar información existente, evitar preguntas redundantes, detectar gaps, contradicciones, ambigüedades, riesgos y oportunidades, y priorizar una o pocas preguntas relacionadas que desbloqueen decisiones.

El usuario puede saltar temas, pedir recomendaciones, ordenar una actualización documental, cambiar de sección o comenzar la revisión final. Puede existir un checklist interno, pero la conversación no debe sentirse como un formulario rígido.

La inteligencia real del agente, prompt engineering, tool calling, RAG y orquestación no forman parte del frontend inicial.

## Contexto conversacional y documental

Cada Chat conserva su propio historial. Un Chat nuevo no recibe automáticamente todo el historial de los Chats anteriores. Su contexto consolidado debe provenir principalmente de:

```text
Product Context
+ PRD activo
+ decisiones consolidadas
+ preguntas abiertas relevantes
```

El Product Context conceptual vive en `/docs/product.md`. La documentación de PRDs prevista es:

```text
/docs
├── product.md
└── prds
    └── 001-mvp
        ├── PRD.md
        └── versions
            └── v1.md
```

`PRD.md` es el documento de trabajo vigente; las versiones finalizadas son snapshots inmutables.

## PRD vivo y ciclo de vida

La estructura del PRD es flexible. Según el producto puede contener visión, problema, objetivos, no objetivos, usuarios, casos de uso, requisitos, flujos, reglas de negocio, restricciones, métricas, riesgos, supuestos, preguntas abiertas y decisiones. Las secciones irrelevantes no son obligatorias.

Estados iniciales:

```text
draft → review → final
```

- **Draft:** activo y editable. Cambios normales no destructivos pueden incorporarse durante discovery; el usuario también puede ordenar una actualización o editar el Markdown directamente.
- **Review:** revisión de gaps, contradicciones, ambigüedades, riesgos, decisiones pendientes y preguntas abiertas. El usuario puede corregir, volver a draft o finalizar aceptando warnings.
- **Final:** versión cerrada e inmutable.

Cambios sensibles requieren aprobación explícita, especialmente al eliminar requisitos, modificar decisiones consolidadas, cambiar significativamente el alcance o alterar Product Context.

## Sheet documental

Desde un Chat se puede abrir o cerrar un sheet derecho. Al abrirlo muestra por defecto el PRD correspondiente y permite alternar entre el PRD actual, Product Context y versiones finalizadas del PRD.

Los documentos editables ofrecen `Preview | Edit`; `Copy` copia el Markdown fuente completo. Los PRDs finalizados son read-only. No se incluye editor WYSIWYG.

## Persistencia y sincronización

La primera versión es single-user, sin autenticación y local. Usa `localStorage`; su acceso no debe quedar disperso por componentes de UI y debe poder sustituirse razonablemente en el futuro. No se necesita IndexedDB ni base de datos.

Persistencia local y sincronización con repositorio son conceptos separados. La UI representa de forma visual o mockeada `Synced`, `Unsynced changes`, `Syncing`, `Sync failed` y `Sync now`, sin sincronización remota real en esta etapa.

## Demo Mode

El frontend debe poder recorrerse sin backend ni LLM mediante fixtures o escenarios deterministas. Debe cubrir, cuando sea útil para desarrollo, tests o demo:

- conversación vacía, pregunta del agente y respuesta del usuario;
- PRD actualizado y cambio pendiente de aprobación;
- propuesta de cambio de Product Context;
- review con warnings y PRD finalizado;
- nueva versión y recomendación de crear otro PRD;
- errores y distintos estados de sync.

Estos escenarios no interpretan conversaciones ni implementan inteligencia mediante reglas.

## Alcance de la primera versión

La primera etapa se limita al frontend con Next.js, TypeScript, shadcn/ui, Jest y React Testing Library dentro de un monorepo con Turborepo. El diseño debe desacoplar razonablemente integraciones futuras sin implementarlas ni sobrearquitectarlas.

Quedan fuera de alcance: backend dedicado, base de datos, autenticación, multiusuario, roles y permisos, colaboración, LLM o proveedor de IA real, prompt engineering, agent orchestration, tool calling, RAG, memoria del agente, GitHub API, OAuth, credenciales o commits reales, sincronización remota, infraestructura cloud, deployment, WYSIWYG y edición colaborativa.

## Calidad

Los tests de frontend usan Jest y React Testing Library y priorizan comportamiento observable sobre detalles internos de implementación.
