"""# Datos y Memoria Técnica del Proyecto: Sistema de Pedidos y Despacho

Esta documentación centraliza la arquitectura, diseño, esquema de base de datos y estructura del proyecto. Sirve como fuente de la verdad para el contexto del desarrollo, asegurando el cumplimiento de los principios SOLID y la escalabilidad del sistema.

---

## 1. Definición Técnica (Stack Tecnológico)

El sistema está construido priorizando la escalabilidad, mantenibilidad, velocidad y experiencia de usuario (UI/UX), aplicando estrictamente principios **SOLID** y **Clean Architecture**.

- **Frontend:** React, Vite, JavaScript (ES6+).
- **Estilizado y UI:** Tailwind CSS v4 (configuración nativa mediante `@tailwindcss/vite` e inyección de variables dinámicas `@theme`).
- **Iconografía:** Lucide React.
- **Base de Datos y Backend as a Service (BaaS):** Supabase (PostgreSQL), empleando **Row Level Security (RLS)** y funciones con triggers autónomos para auditoría.
- **Arquitectura General:** Arquitectura Modular Basada en Características (_Feature-Driven Architecture_).
- **Optimización de Rendimiento:** Implementación de _Code Splitting_ mediante `React.lazy` y `Suspense` en el enrutador para reducir el tamaño del bundle inicial.
- **Modelo de Despliegue (SaaS):** Marca Blanca (_White-Label_) / Multi-Empresa. Cada cliente cuenta con su propio entorno y base de datos, personalizando colores, logo y variables mediante archivos `.env` e inyección en el DOM (`tenantConfig.js`).
- **Calidad y Patrones de Código:** Linter estándar (ESLint), validación modular desacoplada de la UI (SRP), paginación del lado del servidor (_Server-Side Pagination_) y transacciones atómicas para datos complejos.

---

## 2. Descripción General y Flujos Operativos

Es un **Sistema de Toma de Pedidos y Despacho (Order Management System - OMS)** desacoplado, diseñado para facilitar y automatizar las labores logísticas y comerciales de distintas compañías, interactuando de forma asíncrona con un sistema ERP maestro.

### Flujo Principal de Trabajo:

1. **Toma de Pedido (Vendedor):** El vendedor selecciona el cliente, busca productos en el catálogo y genera un pedido. En este punto se ejecuta el **congelamiento de precios e impuestos** (IVA e INC) para garantizar la inmutabilidad histórica requerida por normativas fiscales (DIAN en Colombia). El pedido nace en estado `pendiente`.
2. **Preparación y Logística:** Los pedidos pendientes pasan a revisión.
3. **Órdenes de Despacho (Despachador):** El despachador agrupa múltiples pedidos pendientes en una **Orden de Despacho**, asignándoles un vehículo de la flota y un conductor/repartidor registrado (usuarios con rol específico, e.g., `rol_id = 5`).
4. **Ruta y Entrega (Repartidor):** El repartidor ejecuta la entrega en ruta y actualiza los estados en tiempo real (móvil/responsivo).
5. **Sincronización con ERP / Facturación:** Una vez entregado el pedido, los datos están disponibles para ser consumidos por el ERP principal y generar la facturación electrónica correspondiente.

---

## 3. Estructura de Carpetas del Proyecto

Diseñada bajo un enfoque modular por características (_Feature-Driven_) para prevenir el crecimiento monolítico:

```text
src/
├── components/          # Componentes globales y reutilizables (Footer, Modales, etc.)
│   └── layout/          # MainLayout.jsx (Sidebar dinámico por rol, barra superior responsive)
├── config/              # Configuraciones de integración
│   ├── supabase.js      # Conexión cliente a Supabase
│   └── tenant.js        # Lógica de Marca Blanca (Variables VITE_TENANT_*)
├── context/             # Estado Global
│   └── AuthContext.jsx  # Control de sesión, perfiles de usuario y permisos por rol
├── mock/                # Entorno de datos de prueba para prototipado
├── modules/             # [NÚCLEO] Módulos de negocio desacoplados
│   ├── auth/            # Autenticación, gestión de personal y scripts SQL base
│   ├── clients/         # Directorio de Clientes (UI, ClientForm, validations, clientService)
│   ├── dashboard/       # Panel principal y visualización de KPIs
│   ├── products/        # Inventario y catálogo sincronizado (productService)
│   ├── vehicles/        # Flota logística (vehicleService, formularios y listado)
│   ├── orders/          # Módulo de Toma de Pedidos (orderService, OrdersPage, OrderForm)
│   └── dispatches/      # Módulo de Despachos (dispatchService, DispatchesPage, DispatchForm)
├── routes/              # Sistema de navegación protegida
│   └── AppRouter.jsx    # Enrutador central optimizado con React.lazy + Suspense
└── utils/               # Utilidades globales y reglas de validación
    ├── clientValidations.js
    ├── productValidations.js
    ├── calculateDV.js   # Algoritmo de cálculo de Dígito de Verificación (NIT)
    └── printUtils.js    # Generación y exportación de comprobantes en PDF directo
```

## 4. Estructura y Esquema de la Base de Datos

PostgreSQL alojado en Supabase con esquemas fuertemente tipados, borrado lógico (Soft Delete) e historial de auditoría autónomo.

Control y Auditoría Obligatoria
Todas las tablas principales incluyen los siguientes campos y triggers:

estado (boolean, por defecto true)

creado (timestamp with time zone, por defecto now())

actualizado (timestamp with time zone, por defecto now())

eliminado (timestamp with time zone, para Soft Delete)

Triggers conectados a la función registrar_auditoria().

Módulos de Base de Datos Base
Usuarios y Auth: Tablas roles y perfiles (extienden auth nativo de Supabase).

Catálogos: municipios y tipos_identificacion.

Clientes: Manejo de Persona Natural (nombres) vs. Jurídica (Razón Social), cálculo de DV.

Productos: Propiedades fiscales DIAN (precio_venta, iva, inc, clasificacion), jerarquía libre.

Vehículos: Registro de flota, capacidad, asignación de repartidor_id.

Módulo Transaccional: Pedidos y Despachos
pedidos_cabecera: Cliente, vendedor, fechas, estado (pendiente, despachado, etc.), y totales (subtotal, total_iva, total_inc, total).

pedidos_detalle (ON DELETE CASCADE): Relación pedido-producto. Congela precios e impuestos al momento de la venta para inmutabilidad.

despachos: Cabecera de la orden de despacho (Vehículo, conductor, fecha, estado).

despachos_detalle: Vincula despachos con pedidos_cabecera. Aplica restricción única combinada para no duplicar pedidos en un mismo viaje.

## 5. Archivos Clave del Repositorio

vite.config.js / src/index.css: Configuración del motor Tailwind CSS v4 y variables de tema @theme.

src/config/tenant.js: Motor de Marca Blanca que lee .env y aplica identidad corporativa al DOM.

src/routes/AppRouter.jsx: Enrutador protegido con Lazy Loading y PageLoader.

src/layouts/MainLayout.jsx y src/components/layout/Footer.jsx: Contenedores visuales principales responsivos.

src/modules/*/services/*Service.js: Capa de persistencia (SQL/Supabase) que aísla la lógica de base de datos de los componentes visuales.

src/modules/*/utils/*Validations.js: Lógica pura y estricta para validación de datos antes de peticiones al backend.
"""
