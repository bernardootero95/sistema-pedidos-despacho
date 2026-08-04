# Memoria Técnica del Proyecto: Sistema de Pedidos y Despacho

Esta documentación centraliza la arquitectura, diseño y esquema del proyecto para ser utilizada como fuente de contexto o memoria del desarrollo.

## 1. Definición Técnica (Stack Tecnológico)

El sistema está construido priorizando la escalabilidad, funcionalidad y velocidad, aplicando principios SOLID y Clean Architecture.

- **Frontend:** React, Vite, JavaScript.
- **Estilizado y UI:** Tailwind CSS v4 (configuración nativa mediante el plugin `@tailwindcss/vite` y variables CSS con `@theme`).
- **Base de Datos y Backend as a Service (BaaS):** Supabase (PostgreSQL), empleando RLS (Row Level Security) para aislamiento de datos.
- **Arquitectura General:** Arquitectura Modular basada en características (Feature-Driven Architecture).
- **Modelo de Despliegue (SaaS):** Marca Blanca (White-Label) / Multi-Empresa. Cada cliente cuenta con su propio entorno y base de datos, personalizando colores, logo y variables mediante archivos `.env`.
- **Calidad de Código:** Linter estándar de la industria (ESLint), validación modular de datos y separación de responsabilidades (SRP).

## 2. Descripción del Proyecto

Es un **Sistema de Toma de Pedidos y Despacho (Order Management System - OMS)** desacoplado, diseñado para facilitar las labores logísticas y comerciales de distintas compañías. Su funcionamiento se basa en interactuar de forma asíncrona con un sistema ERP maestro.

- **Flujo Principal:** Los vendedores toman pedidos en el sistema -> Pasan a preparación -> Son organizados en "Órdenes de Despacho" por el despachador -> Se asignan a un vehículo/repartidor -> Se entregan al cliente.
- **Integración Fiscal:** Una vez entregado el pedido, el sistema permite que el ERP principal consuma los datos para generar la facturación electrónica (normativa DIAN en Colombia).
- **Sincronización:** Los productos, inventarios (stocks) y categorías se sincronizan en diferido desde el ERP hacia la aplicación cada día, evitando cuellos de botella en tiempo real. Los clientes, por otro lado, nacen en este sistema y se envían hacia el ERP.
- **Roles Dinámicos y Seguridad:** Accesos delimitados para Soporte (todo), Gerencia (todo), Vendedor (ventas), Despachador (logística) y Repartidor (rutas).

## 3. Estructura de Carpetas

Diseñada para que el proyecto no se convierta en un monolito inmanejable. La lógica de negocio (`services`), las reglas (`utils`), las vistas (`pages`) y los componentes visuales (`components`) están aislados por módulo:

```text
src/
├── components/          # Componentes compartidos reutilizables
│   └── layout/          # Layout principal (MainLayout.jsx) con Sidebar dinámico por rol
├── config/              # Configuraciones de integración
│   ├── supabase.js      # Conexión principal
│   └── tenant.js        # Lógica de Marca Blanca (.env)
├── context/             # Manejadores de Estado Global
│   └── AuthContext.jsx  # Control de sesión y perfiles
├── mock/                # Entorno de pruebas (demoData.js) para prototipos interactivos
├── modules/             # [Núcleo] Módulos de la aplicación
│   ├── auth/            # Autenticación y configuración SQL
│   ├── clients/         # Módulo de Directorio de Clientes (UI, validations, services)
│   ├── dashboard/       # Panel principal y KPIs
│   ├── products/        # Inventario y catálogo sincronizado
│   └── vehicles/        # Flota logística
└── routes/              # Sistema de navegación
    └── AppRouter.jsx    # Protección y declaración de rutas
```

## 4. Estructura de la Base de Datos

```texto
Utilizamos PostgreSQL con esquemas fuertemente tipados, soft deletes e historial de auditoría autónomo.

Control y Auditoría Obligatoria: Todas las tablas incluyen los campos estado (boolean), creado (timestamp), actualizado (timestamp) y eliminado (timestamp - para Soft Delete). Además, cuentan con triggers conectados a registrar_auditoria() para logs automáticos.

Módulo Auth:

roles: Define las posiciones y sus accesos (gerencia, ventas, soporte).

perfiles: Extiende a los usuarios nativos de Supabase para manejar el inicio de sesión limpio sin correos obligatorios (usuario transformado en backend a usuario@empresa.com).

Catálogos: \* Tablas municipios y tipos_identificacion para poblar el frontend de forma dinámica.

Módulo Clientes (clientes): \* Distingue entre Persona Natural (nombres, apellidos) y Jurídica (Razón social), además de cálculo automático del Dígito de Verificación (DV).

Módulo Productos (productos): \* Soporta datos de facturación electrónica DIAN: precio, iva, inc, y clasificacion (gravado, exento, excluido).

Datos de jerarquía como texto libre (tipo, departamento, linea, categoria) para facilitar la importación desde sistemas de terceros sin problemas de llaves foráneas.

Control de disponible (stock).
```

## 5. Esquema de los Archivos (Archivos Clave)

```texto
   vite.config.js / src/index.css: Alojan la configuración del ecosistema Tailwind CSS v4, sin dependencias extrañas. Integran las variables @theme manipuladas por la configuración de Inquilino.

src/config/tenant.js: Lee las variables de entorno de la empresa (ej. VITE_TENANT_PRIMARY_COLOR) y actualiza el DOM instantáneamente al abrir la web (Marca Blanca).

src/modules/auth/schema.sql: Script fundamental que inicializa las funciones de auditoría en la BD, RLS, tablas de usuarios y triggers.

Archivos \*Validations.js (ej. clientValidations.js): Archivos puros de JavaScript (utilities) que actúan como esquemas de validación de negocio. Separan los condicionales (If-Else) de la UI para mantener limpios los formularios y cumplir el Principio de Responsabilidad Única.

Componentes de Formulario (ClientForm.jsx, ProductForm.jsx): Modales adaptativos, se transforman en tiempo real según el contexto (si seleccionas Persona Natural se ocultan los campos corporativos). Ejecutan las validaciones importadas al cambiar (onChange) o desenfocar (onBlur).

Capa de Servicios (clientService.js, productService.js): Contienen todo el código SQL/Supabase. Proveen funciones encapsuladas para crear, actualizar, listar y aplicar la paginación del lado del servidor (server-side pagination), fundamental para el manejo eficiente de grandes volúmenes de datos.

```

¡Guarda este archivo! Te servirá como referencia perfecta y contexto para nuestro trabajo futuro. ¿Podemos continuar ahora con la definición de la base de datos para el módulo de **Pedidos**?

```

```
