import {
  LogIn,
  Workflow,
  LayoutDashboard,
  ShoppingCart,
  Truck,
  MapPin,
  Package,
  ShoppingBag,
  FileText,
  Contact,
  FileBarChart,
  Settings,
  ClipboardCheck,
} from "lucide-react";
import { ROLES_MODULO } from "../../../config/roles";

const TODOS_LOS_ROLES = ROLES_MODULO.AYUDA;

/**
 * Contenido del instructivo. Cada sección se muestra solo a los roles que
 * tienen acceso al módulo que explica (mismas listas de ROLES_MODULO que el
 * menú y el RoleGuard, para que el instructivo nunca describa una pantalla
 * que el usuario no puede abrir).
 *
 * Cada bloque admite dos filtros opcionales:
 * - `roles`: restringe el bloque a un subconjunto de los roles de la sección
 *   (acciones puntuales, ej. anular cualquier pedido).
 * - `opcion`: clave de useSettings que debe estar encendida (ej. abonos), para
 *   no explicar funciones que la empresa no usa.
 *
 * `ruta` (opcional) habilita el enlace "Ir al módulo".
 */
export const SECCIONES_AYUDA = [
  {
    id: "primeros-pasos",
    titulo: "Primeros pasos",
    icono: LogIn,
    roles: TODOS_LOS_ROLES,
    resumen: "Ingreso al sistema, contraseña y navegación por el menú.",
    bloques: [
      {
        titulo: "Ingresar al sistema",
        pasos: [
          "Escribe tu nombre de usuario (solo el usuario, sin el @dominio) y tu contraseña.",
          "Completa la verificación de seguridad y presiona «Ingresar al Sistema».",
        ],
      },
      {
        titulo: "Olvidé mi contraseña",
        pasos: [
          "En la pantalla de ingreso, presiona «¿Olvidaste tu contraseña?» e indica tu usuario.",
          "Te llegará un enlace a tu correo de recuperación (revisa también la carpeta de spam).",
          "Abre el enlace, escribe la nueva contraseña dos veces y guarda.",
        ],
        notas: [
          "Si tu cuenta no tiene correo de recuperación, pide a gerencia que te restablezca la contraseña.",
        ],
      },
      {
        titulo: "Cambiar mi contraseña",
        pasos: [
          "Abre el menú de perfil (arriba a la derecha) y elige «Cambiar mi contraseña».",
        ],
      },
      {
        titulo: "Navegación",
        notas: [
          "El menú lateral solo muestra los módulos que tu rol puede usar. En el celular se abre con el botón ☰.",
          "Este instructivo también se adapta a tu rol: solo explica lo que puedes hacer.",
        ],
      },
    ],
  },
  {
    id: "flujo-general",
    titulo: "Cómo funciona el sistema",
    icono: Workflow,
    roles: TODOS_LOS_ROLES,
    resumen: "El recorrido de un pedido desde que se toma hasta que se entrega.",
    bloques: [
      {
        titulo: "Recorrido de un pedido",
        pasos: [
          "Se toma el pedido: queda «Pendiente» y su mercancía queda reservada del inventario.",
          "Despacho agrupa pedidos pendientes en una orden de despacho con vehículo y repartidor: el pedido pasa a «Despachado».",
          "El repartidor marca cada pedido como entregado o rechazado desde su celular.",
          "Un pedido entregado queda «Entregado» (y se cobra el saldo, si aplica); uno rechazado queda «Devuelto».",
        ],
      },
      {
        titulo: "Estados del pedido",
        notas: [
          "Pendiente: tomado, esperando despacho. Es el único estado en que se puede editar.",
          "Despachado: asignado a una ruta.",
          "Entregado: recibido por el cliente.",
          "Devuelto: el cliente lo rechazó en la entrega.",
          "Anulado: cancelado con un motivo; libera la mercancía reservada.",
        ],
      },
      {
        titulo: "Estados del despacho",
        roles: ROLES_MODULO.DESPACHOS,
        notas: [
          "Creado → En ruta → Completado. Desde Creado o En ruta también se puede anular.",
          "Al anular un despacho, sus pedidos que no se habían entregado vuelven a «Pendiente» para asignarse a otra ruta.",
        ],
      },
    ],
  },
  {
    id: "panel-principal",
    titulo: "Panel Principal",
    icono: LayoutDashboard,
    ruta: "/dashboard",
    roles: ROLES_MODULO.DASHBOARD,
    resumen: "Indicadores del día y ventas de los últimos 30 días.",
    bloques: [
      {
        titulo: "Qué muestra",
        notas: [
          "Tarjetas con las cifras clave (pedidos por despachar, rutas activas, ventas) y una gráfica de ventas por día de los últimos 30 días.",
          "Debajo, los pedidos más recientes con su estado.",
        ],
      },
      {
        titulo: "Tu información",
        roles: ["vendedor", "cajera"],
        notas: ["Solo ves tus propios pedidos y ventas."],
      },
    ],
  },
  {
    id: "pedidos",
    titulo: "Toma de Pedidos",
    icono: ShoppingCart,
    ruta: "/pedidos",
    roles: ROLES_MODULO.PEDIDOS,
    resumen: "Crear, buscar, editar, anular e imprimir pedidos.",
    bloques: [
      {
        titulo: "Crear un pedido",
        pasos: [
          "En Toma de Pedidos presiona «Nuevo Pedido».",
          "Selecciona el cliente. Si no existe, usa «Cliente nuevo» para registrarlo sin salir del pedido.",
          "En «Agregar Productos» busca por código o nombre. La lista muestra el stock disponible y marca los agotados.",
          "Ajusta la cantidad de cada producto en el carrito y, si aplica, el tipo de precio de la línea.",
          "Agrega notas de entrega si hacen falta y presiona «Guardar Pedido».",
        ],
        notas: [
          "El sistema no deja vender más de lo disponible: el stock se valida al guardar.",
        ],
      },
      {
        titulo: "Venta directa en caja",
        roles: ["cajera"],
        notas: [
          "Tus pedidos nacen ya entregados y se cobran al crearlos: antes de guardar se te pide cómo paga el cliente (si la empresa usa métodos de pago).",
        ],
      },
      {
        titulo: "Tipos de precio",
        notas: [
          "Cada línea del carrito usa el precio «Normal» por defecto.",
          "Puedes elegir otros tipos de precio solo si tu rol tiene permiso para usarlos (los configura gerencia).",
        ],
      },
      {
        titulo: "Cambiar el precio al vender",
        opcion: "precioManualActivo",
        pasos: [
          "Si tu perfil tiene el permiso, verás un lápiz junto al precio de cada línea del carrito.",
          "Presiónalo, escribe el nuevo precio unitario y confirma con Enter o con el ✓ (Escape cancela).",
        ],
        notas: [
          "La línea queda marcada como «Precio manual» y muestra el precio de lista. Para volver al precio del catálogo elige «Normal» en esa línea.",
          "El precio manual no cambia al variar la cantidad, y se conserva al editar el pedido aunque tu perfil no tenga el permiso.",
        ],
      },
      {
        titulo: "Buscar y filtrar",
        pasos: [
          "Busca por número de pedido o filtra por estado, vendedor y rango de fechas (de pedido o de entrega).",
          "Abre un pedido con el ícono del ojo. Dentro del detalle, las flechas ← → recorren los pedidos del mismo filtro.",
        ],
      },
      {
        titulo: "Editar un pedido",
        notas: [
          "Solo se puede editar mientras está «Pendiente». El cliente no se puede cambiar: si es otro cliente, anula y crea uno nuevo.",
          "Si el nuevo total queda por debajo de lo ya abonado, el sistema pide confirmar la devolución de la diferencia.",
        ],
      },
      {
        titulo: "Anular un pedido",
        pasos: [
          "En el listado, usa el botón «Anular Pedido» de la fila.",
          "Escribe el motivo de la anulación y confirma.",
        ],
        notas: [
          "Si el pedido tenía pagos registrados, se avisa antes y queda registrada la devolución del dinero al cliente.",
        ],
      },
      {
        titulo: "Quién puede anular",
        roles: ["vendedor"],
        notas: ["Puedes anular tus propios pedidos mientras sigan «Pendiente»."],
      },
      {
        titulo: "Quién puede anular",
        roles: ["soporte", "gerencia", "despachador"],
        notas: ["Puedes anular cualquier pedido que no esté ya anulado."],
      },
      {
        titulo: "Imprimir",
        notas: [
          "«Imprimir Tiquete» genera el PDF del pedido en el formato configurado por la empresa (tirilla o carta).",
        ],
      },
      {
        titulo: "Entregar sin despacho",
        roles: ["soporte", "gerencia", "despachador"],
        pasos: [
          "Para un cliente que recoge en bodega, abre el pedido pendiente y presiona «Marcar entregado».",
          "Si tiene saldo por cobrar, registra el pago en el diálogo; si no, presiona «Confirmar entrega».",
        ],
        notas: ["Esta acción no se puede deshacer desde el pedido."],
      },
      {
        titulo: "Pagos y abonos",
        roles: ["soporte", "gerencia"],
        opcion: "abonosPedidosActivo",
        notas: [
          "En el detalle de un pedido pendiente puedes registrar abonos. El resto se cobra al entregarlo.",
        ],
      },
      {
        titulo: "Fecha de entrega e historial",
        roles: ["soporte", "gerencia"],
        notas: [
          "En el detalle puedes corregir la fecha de entrega con el ícono de lápiz.",
          "Al final del detalle está el historial de cambios de estado del pedido.",
        ],
      },
      {
        titulo: "Factura electrónica",
        roles: ["soporte", "gerencia"],
        notas: [
          "La factura se habilita cuando el pedido está entregado. Si la facturación automática está apagada, o si un envío falló, usa «Enviar Factura» / «Reintentar factura» y confirma con un segundo clic.",
          "Al anular o devolver un pedido facturado, la factura se anula con una nota crédito.",
          "Emitir o anular una factura ante la DIAN no se puede deshacer.",
        ],
      },
    ],
  },
  {
    id: "despachos",
    titulo: "Órdenes de Despacho",
    icono: Truck,
    ruta: "/despachos",
    roles: ROLES_MODULO.DESPACHOS,
    resumen: "Armar rutas, seguirlas y cerrarlas.",
    bloques: [
      {
        titulo: "Crear una orden de despacho",
        pasos: [
          "En Órdenes de Despacho presiona «Nuevo Despacho» y elige el vehículo, el repartidor y la fecha.",
          "En la columna de pedidos disponibles busca por cliente o número y agrega los pedidos a la ruta. Usa «Quitar de la ruta» para sacar uno.",
          "Presiona «Crear Despacho». Los pedidos pasan a «Despachado» y el repartidor ve la ruta en su celular.",
        ],
      },
      {
        titulo: "Cambiar el estado del despacho",
        pasos: [
          "Al salir el vehículo, presiona «Marcar en ruta».",
          "Al terminar, presiona «Marcar completado». Si quedan pedidos con saldo, se abre un único diálogo para cobrarlos todos.",
        ],
        notas: [
          "«Anular despacho» pide un segundo clic de confirmación y devuelve a «Pendiente» los pedidos no entregados.",
        ],
      },
      {
        titulo: "Corregir la entrega de un pedido",
        notas: [
          "En el detalle del despacho puedes marcar cada pedido como pendiente, entregado o rechazado, aunque la ruta ya esté completada.",
          "La pantalla se actualiza sola cuando el repartidor marca entregas desde su celular.",
        ],
      },
      {
        titulo: "Imprimir",
        notas: [
          "«Imprimir Tiquete + Facturas» genera la hoja de ruta junto con los comprobantes de cada pedido.",
        ],
      },
    ],
  },
  {
    id: "mi-ruta",
    titulo: "Mi Ruta de Hoy",
    icono: MapPin,
    ruta: "/despachos/mi-ruta",
    roles: ROLES_MODULO.MI_RUTA,
    resumen: "Ver tu ruta y marcar las entregas desde el celular.",
    bloques: [
      {
        titulo: "Ver tu ruta",
        notas: [
          "Arriba ves el código del despacho, la fecha, el vehículo y cuántos pedidos llevas entregados.",
          "Cada tarjeta muestra el número de pedido, el cliente, la dirección y el valor a cobrar.",
          "Si no tienes ruta asignada, la pantalla lo indica. Cuando te asignen una, aparece sola.",
        ],
      },
      {
        titulo: "Marcar una entrega",
        pasos: [
          "Al entregar, toca «Entregado». Si hay saldo por cobrar, registra cómo pagó el cliente y confirma.",
          "Si el cliente no recibe el pedido, toca «Rechazado»: el pedido queda como devuelto.",
        ],
        notas: [
          "Si te equivocas, avisa al despachador: él puede corregir la entrega desde la oficina.",
        ],
      },
    ],
  },
  {
    id: "productos",
    titulo: "Catálogo de Productos",
    icono: Package,
    ruta: "/productos",
    roles: ROLES_MODULO.PRODUCTOS,
    resumen: "Productos, precios, inventario e importación desde Excel.",
    bloques: [
      {
        titulo: "Crear un producto",
        roles: ["soporte", "gerencia"],
        pasos: [
          "Presiona «Nuevo Producto», completa código, nombre, categoría, condición fiscal (gravado, exento o excluido) y precio.",
          "Presiona «Guardar Ficha».",
        ],
        notas: [
          "Tipo, departamento, línea y categoría se eligen de la lista de los ya usados en otros productos. Si no está el que necesitas, escríbelo y elige «Crear» para agregarlo: queda disponible para los siguientes productos.",
          "Si escribes uno que ya existe (aunque cambie mayúsculas o tildes), el sistema usa el existente para no duplicarlo. Los cuatro campos son opcionales.",
        ],
      },
      {
        titulo: "Editar un producto",
        roles: ["soporte", "gerencia"],
        notas: [
          "El ícono de editar de cada fila abre la ficha completa (datos, impuestos, stock y precios diferenciados).",
        ],
      },
      {
        titulo: "Editar precios",
        roles: ["despachador"],
        pasos: [
          "En la fila del producto usa el ícono «Editar precios».",
          "Ajusta el precio de venta y, si aplica, los precios diferenciados. Presiona «Guardar Precios».",
        ],
      },
      {
        titulo: "Importar desde Excel",
        roles: ["soporte"],
        notas: [
          "«Cargar Excel» importa o actualiza productos en bloque desde el reporte del ERP.",
        ],
      },
      {
        titulo: "Historial de compras",
        notas: [
          "«Ver historial de compras» muestra a qué costo se compró el producto en cada compra.",
        ],
      },
    ],
  },
  {
    id: "cotizaciones",
    titulo: "Cotizaciones",
    icono: FileText,
    ruta: "/cotizaciones",
    roles: ROLES_MODULO.COTIZACIONES,
    resumen: "Ofrecer precios a un cliente, imprimirlos y convertirlos en pedido.",
    bloques: [
      {
        titulo: "Crear una cotización",
        pasos: [
          "En Cotizaciones presiona «Nueva Cotización» y elige el cliente (o crea uno con «Cliente nuevo»).",
          "Indica hasta qué fecha es válida; por defecto son 15 días.",
          "Agrega los productos con su cantidad y, si aplica, el tipo de precio (normal, mayorista u otro).",
          "Presiona «Guardar Cotización». No descuenta inventario.",
        ],
      },
      {
        titulo: "Cambiar el precio al cotizar",
        opcion: "precioManualActivo",
        notas: [
          "Si tu perfil tiene el permiso, usa el lápiz junto al precio de la línea para ofrecer un precio distinto al del catálogo (funciona igual que en Toma de Pedidos).",
          "Al convertir la cotización en pedido, ese precio se conserva tal como lo cotizaste.",
        ],
      },
      {
        titulo: "Imprimir o enviar al cliente",
        notas: [
          "En el detalle usa «Imprimir PDF»: se genera en tamaño carta con los datos de la empresa y la fecha de validez.",
        ],
      },
      {
        titulo: "Convertir en pedido",
        pasos: [
          "Cuando el cliente acepte, abre la cotización y presiona «Convertir en pedido» y confirma.",
          "El sistema crea el pedido con los precios vigentes del catálogo y descuenta el stock.",
        ],
        notas: [
          "Si algún precio del catálogo cambió desde que cotizaste, el total del pedido puede diferir; el sistema te lo avisa. Los precios que cambiaste a mano se mantienen.",
          "Una cotización vencida o anulada no se puede convertir: crea una nueva.",
        ],
      },
      {
        titulo: "Estados y anulación",
        notas: [
          "Vigente, Vencida (pasó la fecha de validez), Convertida (ya tiene pedido) y Anulada.",
          "Para anular una cotización vigente usa «Anular», escribe el motivo y confirma.",
        ],
      },
    ],
  },
  {
    id: "compras",
    titulo: "Compras y Proveedores",
    icono: ShoppingBag,
    ruta: "/compras",
    roles: ROLES_MODULO.COMPRAS,
    resumen: "Registrar compras a proveedores, que suman al inventario.",
    bloques: [
      {
        titulo: "Registrar una compra",
        pasos: [
          "En Compras presiona «Nueva Compra» y selecciona el proveedor.",
          "Agrega cada producto con su cantidad y costo unitario.",
          "Registra el pago de la compra y presiona «Registrar compra». El inventario aumenta en ese momento.",
        ],
      },
      {
        titulo: "Pagos parciales al proveedor",
        opcion: "abonosComprasActivo",
        notas: [
          "Puedes registrar solo lo que pagas hoy: el resto queda como saldo por pagar y se abona después desde el detalle de la compra.",
        ],
      },
      {
        titulo: "Anular una compra",
        notas: [
          "En el detalle de la compra usa «Anular Compra», escribe el motivo y confirma. La mercancía se descuenta del inventario.",
        ],
      },
      {
        titulo: "Proveedores",
        notas: [
          "En Terceros → Proveedores registras y editas los proveedores con su identificación y contacto.",
        ],
      },
    ],
  },
  {
    id: "clientes",
    titulo: "Clientes",
    icono: Contact,
    ruta: "/clientes",
    roles: ROLES_MODULO.CLIENTES,
    resumen: "Directorio de clientes.",
    bloques: [
      {
        titulo: "Registrar un cliente",
        pasos: [
          "En Terceros → Clientes presiona «Nuevo Cliente».",
          "Elige si es persona natural o jurídica, completa identificación, nombre o razón social y datos de contacto.",
          "Selecciona la ciudad de la lista sugerida y presiona «Guardar Cliente».",
        ],
        notas: [
          "El dígito de verificación del NIT se calcula automáticamente.",
          "Los datos del cliente se usan en la factura electrónica: revisa que estén completos.",
        ],
      },
    ],
  },
  {
    id: "informes",
    titulo: "Informes",
    icono: FileBarChart,
    ruta: "/informes/ventas",
    roles: ROLES_MODULO.INFORMES,
    resumen: "Ventas, cierre de mes, utilidad y productos vendidos.",
    bloques: [
      {
        titulo: "Ventas y Cierre",
        pasos: [
          "Elige «Venta diaria» o «Cierre de mes» y el periodo, y presiona «Generar informe».",
          "El informe separa ventas (entregados), anulados, devueltos y pedidos pendientes.",
          "Expórtalo a Excel o PDF carta con los botones de exportación.",
        ],
      },
      {
        titulo: "Utilidad del Mes",
        notas: [
          "Muestra ventas menos el costo de lo vendido, con el margen por producto. El costo es el de compra vigente al momento del pedido.",
        ],
      },
      {
        titulo: "Productos por Pedido",
        notas: [
          "Lista los productos vendidos filtrando por fechas, estado, vendedor o cliente. Se puede exportar a Excel o PDF.",
        ],
      },
    ],
  },
  {
    id: "bodega",
    titulo: "Bodega",
    icono: ClipboardCheck,
    ruta: "/bodega/inventario",
    roles: ROLES_MODULO.TOMA_FISICA,
    resumen: "En el menú Bodega: Inv. por Rango, Inv. Actual y Toma Física (informes de inventario y ajuste del stock).",
    bloques: [
      {
        titulo: "Inventario por Rango",
        pasos: [
          "Entra a Bodega → Inv. por Rango.",
          "Elige las fechas «Desde» y «Hasta» y presiona «Generar informe».",
          "Verás por producto el inventario inicial, las compras, las ventas (pedidos entregados), la preventa (pedidos por entregar) y lo disponible al cierre.",
          "Con el selector «Precio de costo / Precio de venta» cambias la valoración del inventario. Expórtalo a Excel.",
        ],
        notas: [
          "El inicial se calcula hacia atrás desde el inventario actual. Los cambios manuales de stock (carga de Excel o edición del producto) no quedan registrados y pueden desajustarlo; las tomas físicas sí cuentan.",
          "El costo es el último costo conocido de cada producto, no el de la fecha.",
        ],
      },
      {
        titulo: "Inventario Actual",
        notas: [
          "Está en Bodega → Inv. Actual.",
          "Muestra lo que hay físicamente hoy: mercancía disponible más la pendiente por entregar, con su valor a costo, a venta y la ganancia posible.",
          "Los productos marcados con ⚠ no tienen costo registrado y no entran en la ganancia posible.",
          "Si hay productos sin costo, el aviso amarillo (en este informe y en Inv. por Rango) tiene el botón «Asignar costos»: digita el costo de los que quieras y guárdalos juntos. Los que dejes vacíos no cambian, y la próxima compra actualiza el costo.",
        ],
      },
      {
        titulo: "Hacer una toma física",
        pasos: [
          "Entra a Bodega → Toma Física y presiona «Nueva toma física»: se guarda una foto de lo que dice el sistema (disponible más pendiente por entregar).",
          "Cuenta la bodega. Digita la cantidad contada de cada producto, o descarga la «Hoja de conteo», llénala y cárgala con «Importar conteo» (columnas codigo y contado).",
          "Presiona «Guardar conteo». Puedes salir y continuar después; solo hay una toma en curso a la vez.",
          "Revisa los faltantes y sobrantes, valorados a costo, y presiona «Aplicar toma» para confirmar.",
        ],
        notas: [
          "Cuenta todo lo que hay en la bodega, incluso lo reservado para pedidos pendientes.",
          "Los productos sin contar no se modifican. Aplicar la toma no se puede deshacer, y queda registrado quién la hizo y cuándo.",
          "Si el conteo de un producto es menor que lo ya comprometido en pedidos pendientes, el sistema no deja aplicar: revisa el conteo o los pedidos.",
        ],
      },
    ],
  },
  {
    id: "configuracion",
    titulo: "Configuración",
    icono: Settings,
    ruta: "/datos-empresa",
    roles: ROLES_MODULO.DATOS_EMPRESA,
    resumen: "Empresa, personal, vehículos, tipos de precio, pagos y facturación.",
    bloques: [
      {
        titulo: "Datos Empresa",
        notas: [
          "Razón social, datos del emisor y logo que salen en pedidos y facturas.",
          "Tamaño de impresión: «Tirilla POS 80 mm» para impresora térmica u «Hoja carta» para impresora convencional.",
        ],
      },
      {
        titulo: "Gestión de Personal",
        pasos: [
          "Presiona «Nuevo Usuario», escribe el nombre, el usuario, la contraseña y asigna el rol.",
          "Agrega un correo de recuperación para que la persona pueda restablecer su contraseña sola.",
        ],
        notas: [
          "«Suspender Acceso» bloquea el ingreso sin borrar el historial; «Reactivar Acceso» lo devuelve.",
          "«Restablecer contraseña» asigna una nueva contraseña a quien la olvidó.",
        ],
      },
      {
        titulo: "Flota de Vehículos",
        notas: [
          "Registra cada vehículo con su placa, marca, capacidades y el repartidor asignado como conductor.",
        ],
      },
      {
        titulo: "Tipos de Precio",
        notas: [
          "Crea precios diferenciados (ej. distribuidor, crédito) y marca qué roles pueden usarlos al tomar pedidos. Luego asigna el valor de cada uno en «Editar precios» del producto.",
        ],
      },
      {
        titulo: "Pagos y Facturación",
        notas: [
          "Métodos de pago: pide cómo se paga (efectivo, transferencia, etc.) y permite dividir un pago. Apagado, todo se registra en efectivo.",
          "Abonos a pedidos y abonos a compras: permiten pagos parciales.",
          "Cambiar el precio al vender: permite modificar a mano el precio de una línea al tomar o editar un pedido. Al activarla eliges qué perfiles pueden hacerlo (por defecto soporte y gerencia).",
          "Facturación electrónica automática: emite la factura ante la DIAN en cuanto un pedido queda entregado.",
        ],
      },
    ],
  },
];
