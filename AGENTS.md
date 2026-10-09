# Denker repository guidance

Este repositorio contiene el producto Denker y el framework SDD usado para desarrollarlo. En este momento está en fase de documentación previa a la implementación: el monorepo, la aplicación y sus comandos aún no existen.

El SDD se mantiene como un núcleo compartido con adaptadores del host:

- Fuente de verdad compartida: `AGENTS.md`, `sdd/`, `docs/` y `.agents/skills/`.
- Adaptación específica del host: sintaxis de invocación, metadata del agente y configuración sólo cuando la plataforma lo requiere.
- No duplicar el framework como una versión separada de Codex o Copilot.
- No romper un host para soportar al otro; preservar compatibilidad y ajustar sólo la capa del host.

## Context router

- `docs/constitution.md`: principios estables y límites de autoridad; consultar ante decisiones sustantivas o disputadas.
- `docs/product.md`: contexto de producto aceptado, alcance, modelo de dominio y experiencia esperada; consultar cuando cambie comportamiento o alcance.
- `docs/architecture.md`: estado técnico actual y límites ya acordados para la primera implementación; consultar para componentes, dependencias, persistencia o integraciones.
- `docs/conventions.md`: reglas de implementación respaldadas por decisiones actuales; consultar antes de modificar código, configuración o tests.
- `docs/glossary.md`: vocabulario opcional; consultar sólo si se crea porque los términos de dominio ya no caben claramente en `docs/product.md`.
- `docs/adr/`: decisiones técnicas duraderas; consultar sólo los ADR relevantes cuando existan.
- `specs/<feature>/`: especificación, plan, diseño de UI y tareas de una iniciativa activa; leer sólo los artefactos de la etapa actual.
- `sdd/POLICIES.md`: políticas canónicas de contexto, herramientas, validación y memoria; leer sólo la sección pertinente.
- `sdd/README.md`: modelo y flujo del framework; consultar únicamente al cambiar el workflow, los artefactos o la estructura SDD.
- `sdd/UPSTREAM.md`: fuentes y compatibilidad upstream; consultar sólo al cambiar comportamiento atribuido a upstream o supuestos del formato de Skills.
- `sdd/templates/`: contratos de artefactos del framework; leer sólo la plantilla afectada al cambiar uno.
- `.agents/skills/<name>/SKILL.md`: instrucciones de cada Skill; leer sólo el Skill afectado y su referencia únicamente para el modo que documenta.

La documentación más cercana a un workspace podrá complementar o restringir estas reglas cuando ese workspace exista. No puede contradecir la constitución. No leer todos los documentos por defecto.

## Product authority

- El agente recomienda; el usuario decide.
- La última versión de Markdown aceptada o editada por el usuario es la fuente de verdad.
- No inventar información para cerrar gaps: usar `TBD`, preguntas abiertas, warnings o secciones incompletas.
- Solicitar aprobación explícita antes de eliminar requisitos, cambiar decisiones consolidadas, alterar materialmente el alcance o modificar el Product Context de forma importante.

## Working principles

- Evidencia sobre supuestos; requisitos explícitos sobre requisitos inferidos.
- Reutilizar patrones existentes y capacidades de la plataforma antes de añadir abstracciones, dependencias o infraestructura.
- Las specs definen qué y por qué; los planes definen cómo; las tareas definen resultados ejecutables.
- La arquitectura documenta el estado actual; los ADR registran sólo decisiones duraderas, consecuenciales y con alternativas reales.
- Mantener los cambios dentro del alcance. Exponer desviaciones materiales en lugar de improvisarlas silenciosamente.
- Aplicar SDD en proporción al riesgo, impacto, incertidumbre, reversibilidad y alcance del cambio.
- Toda implementación gestionada por SDD continúa por defecto con revisión y validación; los fallos reparables vuelven a implementación y repiten el ciclo hasta pasar o requerir una decisión humana.
- No usar Ollama ni `local-assisted` salvo pedido explícito del usuario; el contexto directo es siempre el valor por defecto.
- Distinguir siempre el estado implementado de la arquitectura o comportamiento aprobado pero todavía pendiente.
- No diseñar anticipadamente backend, IA, GitHub ni colaboración mientras sigan fuera del alcance activo.
- No copiar comportamiento upstream sin comprobar la fuente oficial actual y su licencia.
- No añadir Skills, artefactos, abstracciones o workflows sin una necesidad recurrente demostrada.
- Detener la recolección de contexto cuando la evidencia sea suficiente; elegir herramientas y validación mediante `sdd/POLICIES.md`.

## Definition of Done

Cuando corresponda:

- Los requisitos y criterios de aceptación de la spec están satisfechos y trazados a evidencia actual.
- Los tests focalizados y las comprobaciones de comportamiento relevantes tienen resultados recientes y exitosos.
- Los comandos reales de typecheck, lint y build del repositorio pasan cuando respaldan las afirmaciones realizadas.
- La documentación refleja los cambios de comportamiento, arquitectura, convenciones o decisiones duraderas.
- No quedan cambios injustificados fuera de alcance ni hallazgos críticos de revisión sin resolver.
- No se declara éxito con evidencia obsoleta, incompleta o no relacionada.

Descubrir los comandos de verificación desde la configuración del repositorio; no asumir package manager ni toolchain.
