# Protocolo de Auditoría y Calidad — MoneyFlow Frontend

Marco normativo de control de cambios, auditoría en dos fases y control de calidad para agentes de desarrollo en `moneyflow-frontend`.

## 1. Protocolo de Dos Fases

### Fase 1: Planificación y Análisis (`/plan`) — SOLO LECTURA
- **Restricción absoluta:** Prohibido crear, editar o eliminar archivos en el workspace. Prohibido ejecutar comandos git de escritura.
- **Inspección requerida:**
  - Inspección del estado actual del repositorio (`git status`, `git branch -a`).
  - Verificación del contrato con el Backend (`DTO <-> Payload HTTP <-> Formularios Zod`).
  - Identificación de impacto en componentes de UI, accesibilidad y experiencia de usuario.
- **Entrega obligatoria:** Artefacto de Implementation Plan con `RequestFeedback: true` solicitando aprobación explícita.

### Fase 2: Ejecución y Verificación (`Proceed`)
- **Restricción:** Ceñirse rigurosamente al plan aprobado.
- **Transparencia total de archivos `[NEW]`:** Todo archivo de código productivo o configuración creado debe ser exhibido íntegramente en el Walkthrough final para posibilitar auditoría línea por línea.
- **Quality Gate:** Ejecución obligatoria de la suite completa antes de dar por cerrada cualquier tarjeta:
  ```powershell
  npx tsc --noEmit
  npx vitest run --reporter=dot
  npm run lint
  npm run build
  ```

## 2. Política de Git y Control de Versiones
- **Prohibición de commits/push automáticos:** El agente tiene **terminantemente prohibido** ejecutar `git commit`, `git push` o `git reset` sin la autorización previa y explícita del usuario en el chat.
- **Rama de trabajo:** Todas las tareas se desarrollan sobre la rama `dev`.

## 3. Escala de Modelos y Ahorro de Créditos
Para maximizar la eficiencia y optimizar el consumo de tokens/créditos:
- **Tareas ordinarias y documentación:** Usar modelos rápidos e intermedios (`Gemini 3.8 Flash Medium`, `Hydrogen Medium`, `Argon Medium`).
- **Modelos pesados (`Neon` / `Pro`):** Reservados exclusivamente para excepciones críticas de alta complejidad algorítmica o refactorización integral del árbol de componentes.

## 4. Invariantes Técnicas de Auditoría Frontend
1. **Cero cálculos financieros:** El frontend nunca calcula saldos ni efectúa operaciones aritméticas monetarias.
2. **Precisión monetaria:** Montos recibidos y enviados siempre como `string` exacto (`"1250.00"`). Prohibido `number` o `parseFloat`.
3. **Zona horaria:** Formateo visual anclado a `America/Lima`, diferenciando fecha calendario (`YYYY-MM-DD`) de instantes técnicos (`TIMESTAMPTZ`).
4. **Calidad de código:** Cero `console.log`, cero `as any`, cero `@ts-ignore`, cero `TODO`.
