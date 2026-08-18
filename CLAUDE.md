# Reglas de Trabajo — Sistema de Pedidos y Despacho

Este archivo define cómo debes trabajar en este proyecto. Aplica estas reglas
en toda sesión, sin que se te tengan que repetir.

## Rol

Actúa como desarrollador senior full stack experimentado. Las decisiones de
arquitectura, nombres, estructura de archivos y trade-offs deben reflejar ese
nivel de criterio, no la opción más obvia o rápida.

## Stack del proyecto

- **Frontend:** React 19, Vite, JavaScript (ES6+), Tailwind CSS v4 (config
  nativa vía `@tailwindcss/vite` y variables `@theme`).
- **Iconos:** lucide-react.
- **Backend/BaaS:** Supabase (PostgreSQL), con RLS granular por rol
  (`vendedor`, `despachador`, `repartidor`, `gerencia`, `soporte`, resueltos
  vía `obtener_rol_actual()`).
- **Routing:** react-router-dom v7, con `React.lazy` + `Suspense` para code
  splitting por página.
- **PDF:** html2pdf.js.
- **Modelo:** SaaS multi-tenant / white-label (variables `.env` +
  `tenant.js`).

Comandos:
```
npm run dev       # servidor de desarrollo
npm run build     # build de producción
npm run lint      # ESLint
npm run preview   # preview del build
```

## Principios de código (no negociables)

1. **SOLID siempre.** En particular SRP: separa presentación (`pages`,
   `components`) de lógica de negocio (`services`) y de reglas de validación
   (`validations`/`utils`). Un componente no debe conocer detalles de
   Supabase directamente.
2. **No sobrecargar componentes ni páginas.** Si un componente empieza a
   mezclar más de una responsabilidad (ej. formulario + lista + lógica de
   negocio), divídelo. Preferir composición de componentes pequeños sobre un
   archivo gigante.
3. **Formularios con validación inmediata.** Todo formulario nuevo debe
   validar por campo (on blur/on change ya tocado) y también el formulario
   completo antes de enviar, siguiendo el patrón ya usado en
   `clientValidations.js` / `dispatchValidations.js` (diccionario de
   validadores por campo, con acceso al estado completo para reglas
   condicionales).
4. **Dividir tareas complejas cuando sea posible sin afectar el
   rendimiento.** Preferir varios componentes/funciones pequeños y bien
   definidos sobre uno monolítico, siempre que no implique renders o
   llamadas de red innecesarias.
5. **Prioridad del proyecto: escalable, funcional y rápido.** Ante empates
   de estilo, elige lo que escale mejor a más tenants/roles/volumen de
   datos.
6. **Operaciones críticas van al servidor.** Cambios de estado con reglas de
   negocio (crear pedido, crear despacho, cambiar estado, actualizar
   entrega) deben ir por funciones RPC transaccionales en Supabase
   (`SECURITY DEFINER`, con bloqueo de filas si aplica), no resueltas solo
   en el frontend. El frontend puede replicar la validación para dar
   feedback inmediato, pero la fuente de verdad vive en el backend.
7. **Soft delete y auditoría.** Las tablas existentes usan `estado`,
   `creado`, `actualizado`, `eliminado` (soft delete) y triggers de
   auditoría. Sigue ese patrón en tablas nuevas en vez de introducir uno
   distinto.
8. **Acciones destructivas piden confirmación explícita** (ver
   `DispatchStatusControl.jsx` como referencia: segundo click para
   confirmar anular).

## Convenciones ya establecidas en el proyecto

- Nombres de tablas, columnas y variables de dominio en **español**
  (`pedidos_cabecera`, `despachos_pedidos`, `estado_entrega`, etc.) — sigue
  ese idioma para lo nuevo, no mezclar con inglés.
- Estructura modular por feature: `src/modules/<modulo>/{pages,components,
  services,utils}`.
- Listas con paginación server-side + búsqueda con debounce (500ms) — ver
  `DispatchesPage.jsx` como referencia de patrón estándar.
- Componentes de estado con dos variantes según contexto (`badge` en tabla,
  `buttons` en detalle) en vez de duplicar el componente — ver
  `DispatchStatusControl.jsx`.
- Derivar listas relacionadas (ej. disponibles/seleccionados) desde una
  única fuente de verdad (array de IDs + `useMemo`), no mantener arrays
  paralelos sincronizados a mano — ver `DispatchCreatePage.jsx`.
- Tras una mutación que puede tener efectos en cascada en el servidor,
  recargar el recurso en vez de adivinar el resultado en el cliente — ver
  `DispatchDetailsPage.jsx`.

## Flujo de trabajo y Git

- Después de cada respuesta que implique modificación de código, creación
  de un componente, cierre de una capa/funcionalidad, o corrección de un
  bug: **haz commit** de ese cambio antes de continuar con lo siguiente.
- Formato de mensaje de commit sugerido (Conventional Commits):
  `tipo(alcance): descripción breve en español`
  Tipos: `feat`, `fix`, `refactor`, `chore`, `docs`, `style`, `test`.
  Ejemplo: `feat(despachos): conectar DispatchDetailsPage con estado de entrega`
- Commits pequeños y enfocados en un solo cambio lógico, no mezclar features
  distintas en un mismo commit.
- No hagas commit de código que no compile o que rompa el `lint`.

## Qué evitar

- No dejar código muerto o componentes huérfanos sin usar (revisar
  referencias antes de dar por terminada una tarea).
- No introducir dependencias nuevas sin justificarlo — el stack ya está
  definido arriba.
- No poner lógica de Supabase directamente en un componente `.jsx`; siempre
  pasa por la capa `services`.
- No dejar placeholders tipo `alert("Próximamente...")` en código que se
  entrega como terminado.
