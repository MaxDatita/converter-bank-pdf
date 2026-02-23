# CLAUDE.md

Este archivo provee guía a Claude Code (claude.ai/code) para trabajar con el código de este repositorio.

## Resumen del Proyecto

Conversor de resúmenes bancarios argentinos de PDF a Excel. Los usuarios suben PDFs de resúmenes bancarios, una IA (OpenAI) extrae las transacciones con salida estructurada, se clasifican automáticamente como débito/crédito usando patrones regex, y se puede descargar el resultado como Excel. Incluye un chat con IA para analizar las transacciones extraídas.

La app está en español argentino. Todo el texto visible al usuario, mensajes de error de API y campos de transacciones (fecha, concepto, referencia, importe) usan español.

## Comandos

- `pnpm dev` — Servidor de desarrollo
- `pnpm build` — Build de producción
- `pnpm lint` — ESLint
- `pnpm start` — Servidor de producción

## Stack Tecnológico

- **Framework:** Next.js 15 (App Router) con React 19
- **Estilos:** Tailwind CSS 3 + shadcn/ui (primitivas Radix en `components/ui/`)
- **Backend:** Supabase (auth, base de datos, tracking de uso)
- **IA:** Vercel AI SDK (`ai` + `@ai-sdk/openai`) — GPT-5-nano para extracción de PDF, GPT-4o-mini para chat
- **PDF:** `pdf-lib` para extracción de páginas, conteo de páginas a nivel de bytes en `lib/pdf-utils.ts`
- **Excel:** librería `xlsx` para generación de workbooks
- **Email:** Resend + React Email

## Arquitectura

### Flujo Principal

1. **Subida** → `app/page.tsx` (single-page app, toda la UI en un gran componente cliente)
2. **Procesamiento** → `POST /api/process-statement` — envía el PDF como imagen base64 a OpenAI `generateObject()` con schema Zod (`BankStatementSchema`), retorna datos estructurados de transacciones
3. **Clasificación** → `TransactionClassifier` (`lib/transaction-classifier.ts`) aplica patrones regex de `data/transaction-patterns.json` para marcar cada transacción como débito (-) o crédito (+)
4. **Exportación** → `POST /api/generate-excel` — genera workbook Excel con estilos usando `xlsx`, soporta archivo único (free/pro) y múltiples hojas (premium)
5. **Chat** → `POST /api/chat-ai` — GPT-4o-mini analiza las transacciones extraídas respondiendo preguntas del usuario sobre sus datos bancarios

### Autenticación y Límites de Uso

- Supabase Auth con OTP (email) y Google OAuth (`lib/auth.ts`, `hooks/use-auth.tsx`)
- Tres niveles: anónimo (1 página/día por IP), free (3 páginas/día), pro (120 páginas/30 días), premium (300 páginas/30 días + multi-archivo + chat IA)
- Límites definidos en `lib/supabase.ts` (`PLAN_LIMITS`, `ANONYMOUS_LIMITS`)
- Verificación de uso via `GET /api/check-usage-limit` (ventana rolling de 24h para free/anónimo, 30 días rolling para pro/premium)
- Tracking anónimo por IP en tabla `anonymous_usage`; autenticados en `daily_usage` y `monthly_usage`

### Sistema de Patrones de Transacciones

- `data/transaction-patterns.json` — patrones regex para clasificar transacciones bancarias argentinas como débitos o créditos
- `POST /api/add-pattern` — endpoint para agregar nuevos patrones en runtime (lee/escribe el archivo JSON directamente)
- `TransactionClassifier` también genera una sección de prompt que se inyecta en la llamada de extracción de IA para guiar la clasificación

### Base de Datos

Tablas en Supabase (migraciones en `scripts/001-*.sql` a `008-*.sql`):
- `user_profiles` — plan, estado de onboarding
- `daily_usage`, `monthly_usage` — tracking de uso por usuario
- `anonymous_usage` — tracking por IP para usuarios no autenticados
- `conversion_history` — registro de todas las conversiones

### Variables de Entorno

Requeridas en `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — cliente Supabase
- `SUPABASE_SERVICE_ROLE_KEY` — admin Supabase (solo server-side)
- `OPENAI_API_KEY` — OpenAI para AI SDK
- `RESEND_API_KEY` — envío de emails

### Patrones Clave del Código

- `lib/supabase.ts` exporta tanto `supabase` (singleton con anon key) como funciones factory `createSupabaseClient()` / `createSupabaseAdminClient()` — las API routes usan el admin client para operaciones server-side
- Las API routes autentican leyendo el header `Authorization: Bearer <token>` y llamando a `supabaseAdmin.auth.getUser(token)`
- El componente principal (`app/page.tsx`) es un gran componente cliente monolítico (~1500+ líneas) que maneja todo el estado de la UI
