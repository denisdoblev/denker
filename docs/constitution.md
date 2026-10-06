# Constitución de Denker

Estos principios estables gobiernan el producto y su desarrollo.

## Principios obligatorios

1. **El agente recomienda; el usuario decide.** Las decisiones relevantes pertenecen al usuario, aunque el agente detecte problemas o proponga una opción.
2. **El Markdown aceptado es la fuente de verdad.** La última versión aceptada o editada manualmente por el usuario prevalece sobre el historial conversacional y sobre propuestas anteriores del agente.
3. **La incertidumbre se hace visible.** Nunca se inventa información para completar un documento; se representa con `TBD`, preguntas abiertas, warnings o secciones incompletas.
4. **Los cambios sensibles requieren aprobación explícita.** Esto incluye eliminar requisitos, modificar decisiones consolidadas, cambiar materialmente el alcance, alterar Product Context o ejecutar un cambio potencialmente destructivo.
5. **La documentación consolida el contexto.** El contexto de trabajo se construye principalmente a partir de Product Context, el PRD activo, las decisiones consolidadas y las preguntas abiertas relevantes, no acumulando indefinidamente historiales de chats.
6. **Los documentos finales son inmutables.** Un PRD finalizado se conserva como snapshot; los cambios posteriores se expresan mediante una nueva versión o un nuevo PRD.
7. **La ausencia de repositorio no bloquea el discovery.** Conectar o sincronizar un repositorio es una capacidad separada y opcional.
8. **Se implementa sólo la inteligencia que el alcance exige.** Los escenarios deterministas de demo no deben transformarse en una pseudoimplementación del Product Manager ni en reglas de IA dentro del frontend.
9. **La solución más simple para el alcance actual tiene prioridad.** Las integraciones futuras deben ser reemplazables de forma razonable, sin diseñarlas antes de que exista una necesidad concreta.

## Guías de diseño

- Mantener límites explícitos y dependencias direccionales.
- Favorecer comportamientos verificables mediante interfaces estables.
- Elegir alternativas reversibles cuando aporten un valor equivalente.
- Ajustar documentación, pruebas y proceso a la incertidumbre, impacto y coste de fallo reales.
