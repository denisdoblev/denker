# Convenciones

**Alcance:** repositorio Denker

Estas reglas corresponden a decisiones ya tomadas. Se ampliarán sólo cuando exista implementación que aporte evidencia adicional.

## Estructura y propiedad

- El repositorio es un monorepo Turborepo con un único workspace de producto en `apps/web`. Mantener UI, utilidades y configuración dentro de ese workspace hasta que exista un segundo consumidor real.
- Mantener la constitución y la arquitectura de sistema en `docs/`. Añadir documentación e instrucciones dentro de un workspace sólo cuando sus reglas difieran realmente.
- Organizar `specs/` por resultados o iniciativas de usuario, no por package técnico.
- Mantener el acceso a persistencia fuera de los componentes de presentación y detrás de un límite sustituible.
- Mantener separados persistencia local, sincronización con repositorio y comportamiento del agente.

## Lenguaje de dominio

- Usar `Project`, `Product Context`, `PRD`, `PRD version` y `Chat` con los significados definidos en `docs/product.md`.
- No llamar Project a un PRD ni tratar un Chat como entidad global.
- Distinguir el `PRD.md` de trabajo de los snapshots finalizados.
- Distinguir un comportamiento implementado de un estado visual o mockeado de Demo Mode.

## Interfaces y datos

- La fuente de verdad es el Markdown aceptado o editado por el usuario.
- Representar información desconocida explícitamente; no rellenarla con valores inventados.
- Tratar los documentos finalizados como read-only.
- Los cambios sensibles esperan aprobación explícita; los cambios ordinarios no destructivos pueden aplicarse al draft.
- Los fixtures de Demo Mode deben ser deterministas y describir estados observables, no inferir intención a partir de conversación libre.
- Mantener la configuración conceptual de repositorio separada de cualquier futura credencial o cliente de provider.

## UI

- La aplicación es desktop-first y debe degradar funcionalmente en tablet y mobile según `docs/product.md`.
- En mobile no se exige mostrar sidebar, chat y documentación simultáneamente.
- Los documentos editables usan Markdown con modos Preview y Edit; no introducir WYSIWYG en el alcance inicial.
- Los estados de repositorio y sincronización de la primera versión son visuales/mockeados y deben identificarse como tales en la implementación.

## Testing

- Usar Jest y React Testing Library para el frontend una vez exista el workspace correspondiente.
- Priorizar comportamiento observable y flujos de usuario sobre detalles internos de componentes.
- Usar fixtures deterministas para estados de Demo Mode, errores, aprobación, lifecycle y sync.
- Ajustar la cobertura al riesgo del cambio; no exigir una técnica universal sin una razón específica.

## Tooling

- Stack aprobado: Next.js, TypeScript, shadcn/ui, Jest, React Testing Library y Turborepo.
- Usar la versión de pnpm fijada en `packageManager` y el lockfile raíz. Los comandos ejecutables de raíz son `dev`, `typecheck`, `lint`, `test` y `build`.
- Mantener un único lockfile en la raíz y no crear manifiestos o packages compartidos sin un consumidor adicional demostrado.
- No instalar ni activar herramientas opcionales como parte de la inicialización SDD.
