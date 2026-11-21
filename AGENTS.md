# AGENTS.md — moneyflow-frontend

Guía operativa obligatoria para agentes de desarrollo en `moneyflow-frontend` (Frontend web de finanzas personales MoneyFlow).

## 1. Stack y estándares de interfaz
- **Framework:** Next.js (App Router) + React + TypeScript estricto (`strict: true`).
- **Estilos y componentes:** Tailwind CSS + componentes accesibles base tipo **shadcn/ui** + iconografía unificada con **Lucide Icons** (`lucide-react`).
- **Gestión de estado y formularios:** React Hook Form + validación de esquemas con **Zod** alineados estrictamente a los DTOs de `api-gateway`.
- **Cliente HTTP:** Fetch nativo tipado o Axios centralizado con interceptores para envío automático de credenciales (cookies `HttpOnly`) y manejo estandarizado de errores HTTP (`400`, `401`, `403`, `409`, `422`, `500`).

## 2. Invariantes técnicas obligatorias

1. **El Frontend NO es fuente de verdad ni realiza cálculos financieros:**
   - El frontend **nunca realiza cálculos financieros, agregaciones de saldos ni determinaciones contables**. La fuente única de verdad es `apps/core-service` en el backend.
   - Todo monto monetario se recibe del backend y se envía al backend exclusivamente como **`string` exacto** (ej. `"1250.00"`, `"0.50"`).
   - **Terminantemente prohibido** convertir montos a `number` de JavaScript (prohibido `Number(val)`, `parseFloat(val)`, `+val`) para realizar operaciones aritméticas (sumas, restas, multiplicaciones de saldos o cuotas).
   - Para visualización y entrada del usuario: usar formateadores de presentación visual sin alterar la precisión del string subyacente.

2. **Zona horaria y fechas (`America/Lima`):**
   - Prohibido usar `new Date().setHours(...)`, `getUTCDay()` o `new Date().toISOString().slice(0, 10)` para determinar "hoy" o manipular fechas de negocio.
   - Separar estrictamente los formateadores:
     - **Fechas calendario de negocio (`DATE` local):** Tratadas como strings `"YYYY-MM-DD"`, formateadas visualmente fijando la zona `America/Lima` sin desplazar días por desfase UTC.
     - **Instantes técnicos de auditoría (`TIMESTAMPTZ`):** Formateados como fecha y hora con zona `America/Lima`.

3. **Seguridad y limpieza:**
   - Prohibido solicitar o almacenar PIN, CVV o datos confidenciales de tarjetas.
   - Prohibido persistir tokens sensibles en `localStorage` o `sessionStorage` si la arquitectura estipula cookies de sesión `HttpOnly`.
   - Cero `console.log`, cero `TODO`, cero `as any`, cero `@ts-ignore`.

## 3. Flujo de trabajo en 2 fases y ahorro de créditos
- **Fase 1 (`/plan`, solo lectura):** Inspeccionar componentes existentes, contratos DTO/API y presentar matriz de riesgos. Prohibido crear o modificar archivos en el workspace.
- **Fase 2 (`Proceed`):** Ejecutar exclusivamente el plan aprobado. En el Walkthrough, incluir el contenido íntegro de todo archivo `[NEW]` de código productivo para auditoría línea por línea.
- **Transparencia de archivos `[NEW]`:** Obligatoriedad de auditar cada archivo nuevo en su totalidad.
- **Escala de modelos:** Priorizar modelos eficientes (`Gemini 3.8 Flash Medium`, `Hydrogen Medium`, `Argon Medium`), reservando modelos pesados (`Neon` / `Pro`) únicamente para casos críticos.
- **Git:** Prohibido ejecutar `git commit`, `git push` o `git reset` sin autorización explícita del usuario.

## 4. Quality Gate obligatorio (antes de reportar cierre)
```powershell
npx tsc --noEmit
npx vitest run --reporter=dot
npm run lint
npm run build
```
