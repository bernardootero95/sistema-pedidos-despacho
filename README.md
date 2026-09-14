# Sistema de Pedidos y Despacho

Aplicación web para gestionar el ciclo completo de **pedidos → despacho →
entrega** de una operación logística: toma de pedidos, asignación a
vehículos y repartidores, control de estado de despacho/entrega, y
catálogos de clientes, productos, vehículos y personal.

Diseñado como **SaaS multi-tenant / white-label**: cada despliegue se
personaliza (nombre, logo, colores) vía variables de entorno, sin tocar
código.

## Stack

- **Frontend:** React 19 + Vite, JavaScript (ES6+), Tailwind CSS v4 (config
  nativa vía `@tailwindcss/vite` y variables `@theme`).
- **Iconos:** lucide-react.
- **Backend/BaaS:** Supabase (PostgreSQL) — RLS granular por rol
  (`vendedor`, `despachador`, `repartidor`, `gerencia`, `soporte`), lógica
  crítica en funciones RPC transaccionales (`SECURITY DEFINER`).
- **Routing:** react-router-dom v7, con `React.lazy` + `Suspense` para code
  splitting por página.
- **PDF:** html2pdf.js (import dinámico).
- **Excel:** read-excel-file / write-excel-file (carga de stock y
  exportación de reportes).
- **Observabilidad:** Sentry (`@sentry/react`), opcional por tenant.
- **Antibot:** Cloudflare Turnstile (`@marsidev/react-turnstile`), opcional
  en login/recuperación de contraseña.
- **Facturación electrónica:** integración con IngeFact vía Edge Function.
- **Tests:** Vitest + Testing Library.

## Estructura de carpetas

```
src/
├── modules/                  # Un módulo por dominio de negocio
│   ├── auth/                  # Login, recuperación de contraseña y sesión
│   ├── users/                  # Gestión de personal
│   ├── clients/                 # Catálogo de clientes
│   ├── products/                # Catálogo de productos
│   ├── vehicles/                 # Flota de vehículos
│   ├── suppliers/                # Catálogo de proveedores
│   ├── purchases/                # Compras a proveedores (carga de stock)
│   ├── orders/                   # Toma de pedidos y facturación (IngeFact)
│   ├── dispatches/                # Órdenes de despacho y entrega
│   ├── reports/                   # Reportes y exportación a Excel
│   └── dashboard/                 # Panel principal (KPIs)
│       └── <modulo>/
│           ├── pages/               # Componentes de página (rutas)
│           ├── components/          # Componentes de presentación
│           ├── services/            # Acceso a Supabase (única capa que lo toca)
│           ├── utils/                # Validaciones y helpers puros
│           └── hooks/                # Hooks propios del módulo (cuando aplica)
├── components/                 # Layout y UI compartida (Toast, etc.)
├── context/                    # AuthContext/Provider, ToastContext/Provider
├── config/                     # Cliente Supabase y config de tenant (white-label)
├── hooks/                      # Hooks compartidos (paginación server-side, realtime)
├── routes/                     # AppRouter (rutas + lazy loading)
└── test/                       # Setup y fixtures de Vitest

supabase/
├── migrations/                 # Migraciones SQL (esquema, RPCs, RLS)
├── functions/                  # Edge Functions (create-user, reset-user-password, enviar-factura-ingefact)
└── config.toml                  # Configuración del proyecto Supabase
```

Cada módulo separa presentación (`pages`/`components`) de lógica de negocio
(`services`) y validaciones (`utils`), siguiendo SRP. Ningún componente
`.jsx` accede a Supabase directamente.

## Requisitos previos

- Node.js 18+ y npm
- Una cuenta y proyecto en [Supabase](https://supabase.com)
- [Supabase CLI](https://supabase.com/docs/guides/cli) para aplicar
  migraciones y desplegar Edge Functions

## Puesta en marcha local

1. Instalar dependencias:

   ```bash
   npm install
   ```

2. Copiar el archivo de variables de entorno y completarlo con los datos
   de tu proyecto Supabase:

   ```bash
   cp .env.example .env
   ```

   Variables necesarias en `.env`:

   | Variable | Descripción |
   |---|---|
   | `VITE_SUPABASE_URL` | URL del proyecto Supabase |
   | `VITE_SUPABASE_ANON_KEY` | Clave anónima (pública) del proyecto |
   | `VITE_COMPANY_NAME` | Nombre de la empresa mostrado en la UI (white-label) |
   | `VITE_COMPANY_LOGO` | Ruta/URL del logo |
   | `VITE_COLOR_PRIMARY` / `VITE_COLOR_PRIMARY_HOVER` / `VITE_COLOR_PRIMARY_LIGHT` | Paleta de color primario |
   | `VITE_COLOR_SECONDARY` / `VITE_COLOR_SECONDARY_HOVER` | Paleta de color secundario |
   | `VITE_COMPANY_DOMAIN` | Dominio de la empresa (referencia/branding) |
   | `VITE_SENTRY_DSN` | (Opcional) DSN de Sentry para observabilidad de errores en producción. Vacío = Sentry no se inicializa |
   | `VITE_TURNSTILE_SITE_KEY` | (Opcional) Sitekey de Cloudflare Turnstile para el CAPTCHA de login/recuperación de contraseña. Vacío = no se muestra CAPTCHA |

3. Levantar el servidor de desarrollo:

   ```bash
   npm run dev
   ```

### Otros comandos

```bash
npm run build       # build de producción
npm run lint        # ESLint
npm run preview     # preview del build de producción
npm run test        # tests unitarios (Vitest)
npm run test:watch  # tests en modo watch
```

## Base de datos: migraciones de Supabase

El esquema, las funciones RPC transaccionales y las políticas RLS viven en
`supabase/migrations/`. Para aplicarlas contra tu proyecto:

1. Vincular el proyecto local con tu proyecto de Supabase (una sola vez):

   ```bash
   supabase login
   supabase link --project-ref <tu-project-ref>
   ```

2. Aplicar las migraciones pendientes:

   ```bash
   supabase db push
   ```

3. Desplegar las Edge Functions:

   ```bash
   supabase functions deploy create-user               # alta de usuarios con privilegios administrativos
   supabase functions deploy reset-user-password        # restablecimiento de contraseña de personal
   supabase functions deploy enviar-factura-ingefact     # facturación electrónica de pedidos vía IngeFact
   ```

> Para desarrollo 100% local con Supabase corriendo en Docker, usar
> `supabase start` y `supabase db reset` en su lugar — ver la
> [documentación oficial del CLI](https://supabase.com/docs/guides/cli/local-development).

## Módulos principales

- **Auth** — login, recuperación de contraseña (con CAPTCHA opcional vía
  Turnstile) y manejo de sesión contra Supabase Auth.
- **Usuarios** — alta/edición/activación de personal interno, con roles
  (`vendedor`, `despachador`, `repartidor`, `gerencia`, `soporte`).
- **Clientes** — catálogo de clientes con validación de dígito verificador.
- **Productos** — catálogo de productos para la toma de pedidos, con
  sugerencia de código consecutivo al crear uno nuevo.
- **Vehículos** — flota disponible para asignar a despachos.
- **Proveedores** — catálogo de proveedores usado en el módulo de Compras.
- **Compras** — registro de compras a proveedores, con carga de stock por
  Excel y alta rápida de producto nuevo desde el propio formulario.
- **Pedidos** — toma de pedidos con carrito, búsqueda de productos y
  exportación a PDF; la creación se resuelve vía RPC transaccional en el
  servidor. Incluye envío de factura electrónica a IngeFact (rol
  `soporte`).
- **Despachos** — asignación de pedidos a un vehículo/repartidor, control
  de estado del despacho y del estado de entrega por pedido individual,
  también resuelto vía RPC transaccional.
- **Reportes** — reportes operativos con exportación a Excel.
- **Dashboard** — indicadores generales (ventas, pedidos pendientes, rutas
  activas) conectados a datos reales vía `dashboardService`.

El acceso a cada módulo está filtrado por rol tanto en la navegación
(sidebar) como en las políticas RLS del backend.
