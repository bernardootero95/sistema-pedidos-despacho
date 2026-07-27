import React, { useState } from "react";
import { DEMO_DATA } from "../../../mock/demoData";
import { useAuth } from "../../../context/AuthContext";
import {
  ShoppingCart,
  Plus,
  Trash2,
  CheckCircle2,
  Clock,
  AlertCircle,
  Search,
  User,
  Package,
} from "lucide-react";

export const OrdersPage = () => {
  const { user } = useAuth();

  // Estado local para simular interactividad en la demo
  const [pedidos, setPedidos] = useState(DEMO_DATA.pedidos);
  const [activeTab, setActiveTab] = useState("list"); // 'list' o 'new'

  // Formulario de Nueva Orden
  const [clienteId, setClienteId] = useState("");
  const [cart, setCart] = useState([]);
  const [productoId, setProductoId] = useState("");
  const [cantidad, setCantidad] = useState(1);

  // Validaciones y errores instantáneos
  const [formErrors, setFormErrors] = useState({});
  const [itemError, setItemError] = useState("");

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Validación inmediata para agregar al carrito
  const handleAddToCart = () => {
    setItemError("");
    if (!productoId) {
      setItemError("Selecciona un producto del catálogo.");
      return;
    }
    if (cantidad <= 0) {
      setItemError("La cantidad debe ser mayor a 0.");
      return;
    }

    const producto = DEMO_DATA.productos.find((p) => p.id === productoId);
    if (!producto) return;

    if (cantidad > producto.stock) {
      setItemError(
        `Stock insuficiente. Solo hay ${producto.stock} unidades disponibles.`,
      );
      return;
    }

    // Verificar si ya está en el carrito
    const existingIndex = cart.findIndex(
      (item) => item.producto_id === productoId,
    );
    if (existingIndex > -1) {
      const updatedCart = [...cart];
      const newQty = updatedCart[existingIndex].cantidad + Number(cantidad);
      if (newQty > producto.stock) {
        setItemError(
          `El total en carrito superaría el stock disponible (${producto.stock} unds).`,
        );
        return;
      }
      updatedCart[existingIndex].cantidad = newQty;
      updatedCart[existingIndex].subtotal = newQty * producto.precio;
      setCart(updatedCart);
    } else {
      setCart([
        ...cart,
        {
          producto_id: producto.id,
          nombre: producto.nombre,
          cantidad: Number(cantidad),
          precio_unitario: producto.precio,
          subtotal: Number(cantidad) * producto.precio,
        },
      ]);
    }

    // Limpiar selección de ítem
    setProductoId("");
    setCantidad(1);
  };

  const handleRemoveFromCart = (prodId) => {
    setCart(cart.filter((item) => item.producto_id !== prodId));
  };

  const totalCart = cart.reduce((acc, item) => acc + item.subtotal, 0);

  // Validación y envío general de la orden
  const handleSubmitOrder = (e) => {
    e.preventDefault();
    const errors = {};
    if (!clienteId)
      errors.cliente = "Debes seleccionar un cliente para el pedido.";
    if (cart.length === 0)
      errors.cart = "Agrega al menos un producto a la orden.";

    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const clienteSelected = DEMO_DATA.clientes.find((c) => c.id === clienteId);
    const newOrder = {
      id: `PED-${1000 + pedidos.length + 1}`,
      cliente_id: clienteSelected.id,
      cliente_nombre: clienteSelected.nombre,
      vendedor_nombre: user?.nombre_completo || "Vendedor Demo",
      fecha: new Date().toISOString().split("T")[0],
      estado: "pendiente",
      total: totalCart,
      items: cart,
    };

    // Actualizar estado local y DEMO_DATA para persistencia en sesión
    const updatedPedidos = [newOrder, ...pedidos];
    setPedidos(updatedPedidos);
    DEMO_DATA.pedidos.unshift(newOrder);

    // Reiniciar y volver a la lista
    setClienteId("");
    setCart([]);
    setFormErrors({});
    setActiveTab("list");
    alert(`¡Pedido ${newOrder.id} generado exitosamente en modo demostración!`);
  };

  return (
    <div className="space-y-6">
      {/* CABECERA Y CONMUTADOR DE VISTAS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <ShoppingCart className="w-6 h-6 text-primary" />
            Módulo de Toma de Pedidos
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Gestión comercial para toma de requerimientos, validación de
            inventario y generación de órdenes.
          </p>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
          <button
            onClick={() => setActiveTab("list")}
            className={`px-4 py-2 rounded-md text-xs font-bold transition-all ${
              activeTab === "list"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Historial ({pedidos.length})
          </button>
          <button
            onClick={() => setActiveTab("new")}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-bold transition-all ${
              activeTab === "new"
                ? "bg-primary text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Plus className="w-4 h-4" /> Nuevo Pedido
          </button>
        </div>
      </div>

      {/* VISTA 1: HISTORIAL DE PEDIDOS */}
      {activeTab === "list" && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-6">ID Pedido</th>
                  <th className="py-3.5 px-6">Cliente</th>
                  <th className="py-3.5 px-6">Vendedor</th>
                  <th className="py-3.5 px-6">Fecha</th>
                  <th className="py-3.5 px-6">Ítems</th>
                  <th className="py-3.5 px-6">Total</th>
                  <th className="py-3.5 px-6">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {pedidos.map((ped) => (
                  <tr
                    key={ped.id}
                    className="hover:bg-slate-50/80 transition-colors"
                  >
                    <td className="py-4 px-6 font-black text-slate-900">
                      {ped.id}
                    </td>
                    <td className="py-4 px-6 font-bold text-slate-800">
                      {ped.cliente_nombre}
                    </td>
                    <td className="py-4 px-6 text-slate-500 text-xs">
                      {ped.vendedor_nombre}
                    </td>
                    <td className="py-4 px-6 text-slate-500 font-mono text-xs">
                      {ped.fecha}
                    </td>
                    <td className="py-4 px-6 text-slate-600 font-medium">
                      <span className="px-2 py-0.5 bg-slate-100 rounded text-xs font-bold text-slate-700">
                        {ped.items.length} prod(s)
                      </span>
                    </td>
                    <td className="py-4 px-6 font-black text-slate-900">
                      {formatCurrency(ped.total)}
                    </td>
                    <td className="py-4 px-6">
                      {ped.estado === "pendiente" && (
                        <span className="px-2.5 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-semibold inline-flex items-center gap-1">
                          <Clock className="w-3 h-3" /> Pendiente
                        </span>
                      )}
                      {ped.estado === "despachado" && (
                        <span className="px-2.5 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Despachado
                        </span>
                      )}
                      {ped.estado === "entregado" && (
                        <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-semibold inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Entregado
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VISTA 2: FORMULARIO DE NUEVO PEDIDO (Validación en tiempo real) */}
      {activeTab === "new" && (
        <form
          onSubmit={handleSubmitOrder}
          className="grid grid-cols-1 lg:grid-cols-3 gap-6"
          noValidate
        >
          {/* COLUMNA IZQUIERDA: CLIENTE Y SELECCIÓN DE PRODUCTOS */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2 border-b border-slate-100 pb-3">
                <User className="w-5 h-5 text-primary" /> 1. Seleccionar Cliente
              </h3>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Cliente de Despacho
                </label>
                <select
                  value={clienteId}
                  onChange={(e) => {
                    setClienteId(e.target.value);
                    setFormErrors((prev) => ({ ...prev, cliente: "" }));
                  }}
                  className={`w-full p-3 bg-slate-50 border rounded-lg text-sm text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all ${
                    formErrors.cliente
                      ? "border-red-400 bg-red-50/20"
                      : "border-slate-300"
                  }`}
                >
                  <option value="">
                    -- Selecciona un cliente del directorio --
                  </option>
                  {DEMO_DATA.clientes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre} ({c.ciudad} - {c.direccion})
                    </option>
                  ))}
                </select>
                {formErrors.cliente && (
                  <p className="mt-1 text-xs font-semibold text-red-600">
                    {formErrors.cliente}
                  </p>
                )}
              </div>
            </div>

            {/* SELECCIÓN DE PRODUCTOS AL CARRITO */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2 border-b border-slate-100 pb-3">
                <Package className="w-5 h-5 text-primary" /> 2. Agregar
                Productos
              </h3>

              {itemError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-500" />{" "}
                  {itemError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                <div className="sm:col-span-7">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Producto / Existencias
                  </label>
                  <select
                    value={productoId}
                    onChange={(e) => setProductoId(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="">-- Selecciona producto --</option>
                    {DEMO_DATA.productos.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.sku} - {p.nombre} (${p.precio} | Disp: {p.stock})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-3">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Cantidad
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={cantidad}
                    onChange={(e) => setCantidad(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div className="sm:col-span-2">
                  <button
                    type="button"
                    onClick={handleAddToCart}
                    className="w-full p-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-bold text-sm flex items-center justify-center transition-all"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* COLUMNA DERECHA: RESUMEN DE LA ORDEN Y CARRITO */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between h-fit">
            <div className="space-y-4">
              <h3 className="font-bold text-slate-900 text-base border-b border-slate-100 pb-3">
                Resumen del Pedido
              </h3>

              {formErrors.cart && (
                <p className="text-xs font-semibold text-red-600 p-2 bg-red-50 rounded border border-red-200">
                  {formErrors.cart}
                </p>
              )}

              {cart.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs font-medium border-2 border-dashed border-slate-100 rounded-lg">
                  El carrito está vacío. Agrega productos desde el panel
                  izquierdo.
                </div>
              ) : (
                <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                  {cart.map((item) => (
                    <div
                      key={item.producto_id}
                      className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-xs"
                    >
                      <div className="overflow-hidden pr-2">
                        <p className="font-bold text-slate-800 truncate">
                          {item.nombre}
                        </p>
                        <p className="text-slate-500">
                          {item.cantidad} x{" "}
                          {formatCurrency(item.precio_unitario)}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="font-black text-slate-900">
                          {formatCurrency(item.subtotal)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveFromCart(item.producto_id)}
                          className="text-slate-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-slate-200 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-600">
                  Total a Cobrar:
                </span>
                <span className="text-2xl font-black text-primary">
                  {formatCurrency(totalCart)}
                </span>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-primary hover:bg-primary-hover text-white font-bold text-sm rounded-lg shadow-md transition-all flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-5 h-5" /> Confirmar y Emitir Pedido
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
};
