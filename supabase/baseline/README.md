# Baseline para empresas nuevas

Estado del esquema `public` del proyecto demo al **2026-09-21** (con todas las
migraciones de `supabase/migrations` aplicadas), listo para cargar sobre un
proyecto Supabase **vacío**.

Existe porque `supabase/schema_dump.sql` (agosto) no sirve como base: no incluye
triggers, compras, tipos de precio ni pagos, y reproducir las migraciones una
por una desde cero no está garantizado.

## Uso

Aplicar en orden, cada archivo como una migración:

1. `01_esquema.sql` — endurece los privilegios por defecto de `anon`, crea
   secuencias, tablas, restricciones e índices.
2. `02_funciones.sql` — las 36 funciones (RPC transaccionales, helpers, hook).
3. `03_seguridad.sql` — triggers, RLS, 41 políticas, permisos y realtime.
4. `04_datos.sql` — datos de referencia: roles, tipos de identificación,
   1.123 municipios, método Efectivo y la fila de configuración.

Solo datos de referencia: **no** incluye clientes, productos, pedidos, usuarios
ni tipos de precio (el catálogo de tipos de precio arranca vacío).

Este baseline reemplaza a las migraciones **hasta 20260921120000**. Las
migraciones posteriores a esa fecha sí se aplican sobre él.

## Pendientes manuales tras cargarlo (no viven en SQL)

- **Primer usuario:** crear un usuario en Authentication y su fila en
  `perfiles` con `rol_id = 1` (soporte). La Edge Function `create-user` exige
  un soporte ya existente, por eso el primero es manual.
- **Edge Functions:** desplegar `create-user`, `reset-user-password` y
  `enviar-factura-ingefact` (con sus secretos `INGEFACT_*`).
- **Auth (dashboard):** activar el Password Verification Hook
  (`public.hook_password_verification_attempt`), CAPTCHA/Turnstile si aplica,
  URL del sitio y redirecciones para recuperación de contraseña.
- **Vercel:** variables `VITE_*` de la empresa (ver `.env.example`).

## Diferencias deliberadas con el demo

- Las 4 secuencias no le otorgan permisos a `anon` (en el demo sí, por haberse
  creado antes del endurecimiento de `20260812162649`; ninguna función ni
  política los necesita).
- No se copia el bucket de Storage `assets` (sin políticas y sin uso en el
  código).
- Los ids de `municipios` se reasignan (1..1123): ninguna tabla los referencia
  (los clientes guardan nombre y código DIVIPOLA).

## Cifras del demo para verificar la copia

| Objeto | Cantidad |
| --- | --- |
| Tablas (public) | 22 |
| Funciones | 36 |
| Políticas RLS | 41 |
| Triggers (public) | 16 |
| Índices | 45 |
| Restricciones | 80 |
| Secuencias | 4 |
| Tablas en `supabase_realtime` | 3 (`pedidos_cabecera`, `despachos`, `despachos_pedidos`) |
| Municipios | 1123 (MD5 por código: `9214d0f2ac7e8646d505e4b14377c098`) |

MD5 del cuerpo de cada función (`md5(replace(prosrc, E'\r', ''))`):

```
actualizar_estado_despacho_transaccional=d668c38fc5f10bdb4b6cdeda1266397d
actualizar_estado_entrega_pedido_transaccional=7323d5e25165bffb86f9075565a0ae6d
actualizar_fecha_entrega_pedido=ab384e5b7bcc4e74b401344f68f5c1bd
actualizar_precios_producto=2cd6adfb5a74d54550dfd54307924fd5
actualizar_rol_usuario=9f94075ebf4ef9cc37daa7f03e488ea6
actualizar_timestamp=7641bc4c9c47bb02716de8d53f6f5d3a
anular_compra_transaccional=efb4caca2f526f5b532df3c3e8f9d962
anular_pedido_transaccional=087a96606f27a9312f877623ffeb63d3
bloquear_autoescalada_privilegios=d1c3b2a6bb04a6469fd0cec8f84ecb68
bloquear_edicion_directa_despacho=8c4274de49d2744649d66148b3e4b7ea
bloquear_edicion_directa_pedido=f936d50a521529327f0cb5adcbcabdc8
cobrar_saldo_pedido=738a7792de63881165617dc0b5e4c76b
crear_compra_transaccional=9a51b5e16cdb512950e5d5c6ab406ce4
crear_despacho_transaccional=2d3c4c1f81b0b8ec7c4423e3d5d5a6f6
crear_pedido_transaccional=dbed44f91cb84a09ebb614e0ece972fa
despacho_incluye_pedido_de_vendedor=11e50b86a10301f5ad35fce0c8c6fa15
devolver_pagos=79ff1115e03b310bbffdd671a8cd473c
editar_pedido_transaccional=2d419e30a1b82226f7b25cdbc07dfb6f
hook_password_verification_attempt=a914f5108b1e1c68ffd092113e56ccaa
importar_productos_excel=791838503c023e74a1c8a2af27f4aebd
obtener_informe_productos_pedidos=fa7a7b06742f6c69e9bf7c826ce8b6b1
obtener_resumen_dashboard=d65322cef3f99eae53845cadf6b33988
obtener_rol_actual=3551f81322423d55cb8482d83580aaa8
obtener_siguiente_codigo_producto=604a70c281ec8ac9f88beaba02925194
obtener_ventas_diarias=abbd7d75f169042ef99a562e46bd8b1f
proteger_metodo_efectivo=bebee4d0363b8de9c1e3b74cc0c42003
registrar_abono_compra=b75be52ff9910b6ce5ead374d2154c0c
registrar_abono_pedido=617f30aa7b06d2fec4e0afcb748110fe
registrar_auditoria=5246dbb1a9bdd827fd2a0f4c2553284e
registrar_pagos=834cda7b1335840767e7942a7850ce5d
resolver_precio_pedido=aa7787fcf50180b577bb0d0bc7f0c55f
sincronizar_total_pagado=9f0fdb17fd209d18f6811decf21ab919
tiene_correo_recuperacion=78d102ec4e9725b1b27d1c81fa4af0ed
toggle_user_status=a5daefef6b4b2b5898f81e156f8bf54d
update_vehiculos_modtime=e7fae01ac4376b2c20e9b3b66068587a
vendedor_es_dueno_del_pedido=a0da019656ae825a8919aace30a65b1e
```

Verificación de la definición completa (`md5(replace(pg_get_functiondef(oid), E'\r', ''))`,
incluye cabecera, `SECURITY DEFINER` y `search_path`):

```
actualizar_estado_despacho_transaccional=e555fec653a98dab4dae647489ac4879
actualizar_estado_entrega_pedido_transaccional=cbc35ff01a0cb3f06d0decd300288f18
actualizar_fecha_entrega_pedido=6b01f15cb71365fc30f9cb1645f3c4d4
actualizar_precios_producto=5501d5c37927409e9f11dcdeb687a69b
actualizar_rol_usuario=1351e904b5d0178ebc865eef0371bfff
actualizar_timestamp=5eff3021625cb90e2317b8bacf055070
anular_compra_transaccional=96a3f345f3c3aced8aa7fd43b8fd407f
anular_pedido_transaccional=8e5628a562df9326ae9d45211357f10c
bloquear_autoescalada_privilegios=4f57374b809a60026e767aecab77ada0
bloquear_edicion_directa_despacho=067679894803ce1fe40de9998ff29a01
bloquear_edicion_directa_pedido=3264820c3041854865857e41255f0de4
cobrar_saldo_pedido=86be6986f9ea0aeaa4f78a1d6589d4e0
crear_compra_transaccional=034ab7ca3d0d33e7e06d8c6bb2ed360a
crear_despacho_transaccional=92a2a9594c384a9d0a0c03b83e59da8b
crear_pedido_transaccional=a3852e032a13aff9d1f3877238feeade
despacho_incluye_pedido_de_vendedor=c57da8dd40882abd559da6d6e3b3b00e
devolver_pagos=a5a10151889ff6249b3440740ff8944f
editar_pedido_transaccional=0f1beb58769127d1e832929acfe92001
hook_password_verification_attempt=ba301ab52ac4263d6ca79ace8932897a
importar_productos_excel=32b599255bb91a1cd3d2dca2e1af48c9
obtener_informe_productos_pedidos=a36280eb0cb074e4d8bd9e7ef36ac461
obtener_resumen_dashboard=eb3c76085fec7d3c5c4d5680054b0543
obtener_rol_actual=b75fc644e58417f153234f803c739efb
obtener_siguiente_codigo_producto=c0e491b054327f190c454f22e14320c8
obtener_ventas_diarias=638b3d50a0b51ef1fc668709ddb9ded8
proteger_metodo_efectivo=7876c692dae1b023ad20d2505a75bcd8
registrar_abono_compra=3aafd0eff93b9554d3305a76c34f6afa
registrar_abono_pedido=df13c9e101a8d11c31cb3a89e4caedcd
registrar_auditoria=f9b74bbeceee3378c153e3acd1552682
registrar_pagos=403cb666a1e8462d3c3d33bff234eabb
resolver_precio_pedido=6f4af68f9c3b06586ed020336bc95c3c
sincronizar_total_pagado=62f41095e27ff8c4eca92701a98b9faf
tiene_correo_recuperacion=b99e1bc49f2a2217653df3ebc85bbff1
toggle_user_status=1f60869ef9b1b7baa9914d995e06dac9
update_vehiculos_modtime=51302e943dd93aeab7c9c80679e2ec98
vendedor_es_dueno_del_pedido=316659ca35aa4587047e0f795a4b0c23
```
