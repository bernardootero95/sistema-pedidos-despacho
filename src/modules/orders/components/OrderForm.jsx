import React, { useState, useEffect } from "react";
import {
  X,
  Search,
  Plus,
  Trash2,
  Save,
  Loader2,
  AlertCircle,
  UserCheck,
} from "lucide-react";
import { supabase } from "../../../config/supabase";
import { orderService } from "../services/orderService";
import { validateOrderForm } from "../utils/orderValidations";

export const OrderForm = ({ onClose, onOrderCreated }) => {
  // --- ESTADOS DE DATOS EXTERNOS ---
  const [clientes, setClientes] = useState([]);
  const [productos, setProductos] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  // --- ESTADOS DEL FORMULARIO ---
  const [clienteId, setClienteId] = useState("");
  const [vendedorId, setVendedorId] = useState("");
  const [vendedorNombre, setVendedorNombre] = useState("");
  const [notas, setNotas] = useState("");
  const [carrito, setCarrito] = useState([]);
  const [productoSeleccionado, setProductoSeleccionado] = useState("");

  // --- ESTADOS DE CONTROL ---
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Cargar datos iniciales (Usuario actual, Clientes y Productos Activos)
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoadingData(true);

        // 1. Obtener el usuario autenticado actual
        const { data: authData, error: authError } =
          await supabase.auth.getUser();

        if (authData?.user) {
          setVendedorId(authData.user.id);
          const { data: perfil } = await supabase
            .from("perfiles")
            .select("nombre_completo")
            .eq("id", authData.user.id)
            .single();

          if (perfil) setVendedorNombre(perfil.nombre_completo);
        } else if (authError) {
          console.error("Error obteniendo sesión:", authError);
        }

        // 2. Traer Clientes y Productos Activos
        const [resClientes, resProductos] = await Promise.all([
          supabase
            .from("clientes")
            .select(
              "id, razon_social, primer_nombre, primer_apellido, numero_identificacion",
            )
            .is("eliminado", null),

          supabase
            .from("productos")
            .select("id, nombre, codigo, precio_venta, iva, inc")
            .is("eliminado", null),
        ]);

        if (resClientes.error)
          console.error("Error clientes:", resClientes.error);
        if (resProductos.error)
          console.error("Error productos:", resProductos.error);

        if (resClientes.data) setClientes(resClientes.data);
        if (resProductos.data) setProductos(resProductos.data);
      } catch (error) {
        console.error("Error cargando datos base:", error);
      } finally {
        setLoadingData(false);
      }
    };

    fetchData();
  }, []);

  // --- LÓGICA DEL CARRITO ---
  const agregarAlCarrito = () => {
    if (!productoSeleccionado) return;

    const producto = productos.find((p) => p.id === productoSeleccionado);
    if (!producto) return;

    // Verificar si ya existe en el carrito para sumar cantidad
    const existeIndex = carrito.findIndex(
      (item) => item.producto_id === producto.id,
    );

    if (existeIndex >= 0) {
      const nuevoCarrito = [...carrito];
      nuevoCarrito[existeIndex].cantidad += 1;
      nuevoCarrito[existeIndex].subtotal_linea =
        nuevoCarrito[existeIndex].cantidad *
        nuevoCarrito[existeIndex].precio_unitario;
      setCarrito(nuevoCarrito);
    } else {
      setCarrito([
        ...carrito,
        {
          producto_id: producto.id,
          nombre_producto: producto.nombre, // Guardamos para mostrar en UI
          codigo_producto: producto.codigo, // Guardamos para mostrar en UI
          cantidad: 1,
          precio_unitario: producto.precio_venta,
          iva_porcentaje: producto.iva || 0,
          inc_porcentaje: producto.inc || 0,
          subtotal_linea: producto.precio_venta * 1,
        },
      ]);
    }

    setErrors((prev) => ({ ...prev, carrito: "" }));
    setProductoSeleccionado("");
  };

  const actualizarCantidad = (index, nuevaCantidad) => {
    const cantidadStr = nuevaCantidad.toString().replace(/\D/g, "");
    const cantidad = cantidadStr === "" ? "" : Number(cantidadStr);

    const nuevoCarrito = [...carrito];
    nuevoCarrito[index].cantidad = cantidad;
    nuevoCarrito[index].subtotal_linea =
      (cantidad || 0) * nuevoCarrito[index].precio_unitario;

    setCarrito(nuevoCarrito);
  };

  const eliminarDelCarrito = (index) => {
    const nuevoCarrito = carrito.filter((_, i) => i !== index);
    setCarrito(nuevoCarrito);
  };

  // --- CÁLCULOS EN TIEMPO REAL ---
  const totalPedido = carrito.reduce(
    (acc, item) => acc + (item.subtotal_linea || 0),
    0,
  );

  // --- ENVÍO DEL FORMULARIO ---
  const handleSubmit = async (e) => {
    e.preventDefault();

    const cabeceraData = {
      cliente_id: clienteId,
      vendedor_id: vendedorId,
      notas,
      total: totalPedido,
      numero_pedido: `PED-${Date.now().toString().slice(-6)}`,
    };

    const validationErrors = validateOrderForm(cabeceraData, carrito);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    // Limpiamos los campos visuales de UI (nombre_producto, codigo_producto)
    // antes de enviarlo a Supabase para que coincida exactamente con la tabla pedidos_detalle
    const detallesParaGuardar = carrito.map(
      ({ nombre_producto, codigo_producto, ...rest }) => rest,
    );

    try {
      setIsSubmitting(true);
      await orderService.crearPedido(cabeceraData, detallesParaGuardar);
      onOrderCreated();
      onClose();
    } catch (error) {
      console.error(error);
      setErrors({
        global: "Ocurrió un error al guardar el pedido. Intenta nuevamente.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- UTILIDADES ---
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const obtenerNombreCliente = (c) =>
    c.razon_social || `${c.primer_nombre} ${c.primer_apellido}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* HEADER DEL MODAL */}
        <div className="flex justify-between items-center p-6 border-b border-slate-200 bg-slate-50">
          <div>
            <h2 className="text-xl font-bold text-slate-800">
              Crear Nuevo Pedido
            </h2>
            {vendedorNombre && (
              <p className="text-sm text-slate-500 mt-1 flex items-center gap-1">
                <UserCheck className="h-4 w-4 text-emerald-500" />
                Facturando como:{" "}
                <span className="font-medium text-slate-700">
                  {vendedorNombre}
                </span>
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:bg-slate-200 hover:text-slate-700 p-2 rounded-full transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {loadingData ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-slate-500 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <p>Cargando datos maestros y sesión...</p>
          </div>
        ) : (
          /* CUERPO DEL MODAL */
          <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
            {errors.global && (
              <div className="bg-red-50 text-red-700 p-4 rounded-lg flex items-center gap-3 text-sm">
                <AlertCircle className="h-5 w-5" />
                {errors.global}
              </div>
            )}

            {/* SECCIÓN 1: CLIENTE */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Cliente *
              </label>
              <select
                value={clienteId}
                onChange={(e) => {
                  setClienteId(e.target.value);
                  setErrors((p) => ({ ...p, cliente_id: "" }));
                }}
                className={`w-full p-2.5 border rounded-lg outline-none transition-all ${errors.cliente_id ? "border-red-500 focus:ring-red-200" : "border-slate-300 focus:ring-2 focus:ring-blue-100 focus:border-blue-500"}`}
              >
                <option value="">-- Seleccionar Cliente --</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.numero_identificacion} - {obtenerNombreCliente(c)}
                  </option>
                ))}
              </select>
              {errors.cliente_id && (
                <p className="text-red-500 text-xs mt-1">{errors.cliente_id}</p>
              )}
            </div>

            {/* SECCIÓN 2: BUSCADOR DE PRODUCTOS */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Agregar Productos al Pedido
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <select
                    value={productoSeleccionado}
                    onChange={(e) => setProductoSeleccionado(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none bg-white"
                  >
                    <option value="">
                      -- Buscar producto por código o nombre --
                    </option>
                    {productos.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.codigo} - {p.nombre} (
                        {formatCurrency(p.precio_venta)})
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={agregarAlCarrito}
                  disabled={!productoSeleccionado}
                  className="bg-slate-800 text-white px-4 py-2.5 rounded-lg flex items-center gap-2 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Plus className="h-5 w-5" />
                  <span className="hidden sm:inline">Agregar</span>
                </button>
              </div>
              {errors.carrito && (
                <p className="text-red-500 text-sm mt-2 font-medium">
                  {errors.carrito}
                </p>
              )}
            </div>

            {/* SECCIÓN 3: TABLA DEL CARRITO */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-100 border-b border-slate-200 text-slate-700">
                  <tr>
                    <th className="p-3 w-20">Cant.</th>
                    <th className="p-3">Producto</th>
                    <th className="p-3 text-right">V. Unitario</th>
                    <th className="p-3 text-right">Subtotal</th>
                    <th className="p-3 text-center w-16">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {carrito.length === 0 ? (
                    <tr>
                      <td
                        colSpan="5"
                        className="p-8 text-center text-slate-500"
                      >
                        El carrito está vacío. Agrega productos arriba.
                      </td>
                    </tr>
                  ) : (
                    carrito.map((item, index) => (
                      <tr key={index} className="hover:bg-slate-50">
                        <td className="p-2">
                          <input
                            type="text"
                            value={item.cantidad}
                            onChange={(e) =>
                              actualizarCantidad(index, e.target.value)
                            }
                            className="w-16 p-1.5 text-center border border-slate-300 rounded focus:border-blue-500 outline-none"
                          />
                        </td>
                        <td className="p-3 font-medium text-slate-700">
                          {item.codigo_producto} - {item.nombre_producto}
                        </td>
                        <td className="p-3 text-right text-slate-600">
                          {formatCurrency(item.precio_unitario)}
                        </td>
                        <td className="p-3 text-right font-semibold text-slate-800">
                          {formatCurrency(item.subtotal_linea)}
                        </td>
                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={() => eliminarDelCarrito(index)}
                            className="text-slate-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* SECCIÓN 4: NOTAS Y TOTALES */}
            <div className="flex flex-col md:flex-row gap-6 mt-2">
              <div className="flex-1">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Notas del pedido
                </label>
                <textarea
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  placeholder="Instrucciones de entrega, comentarios, etc."
                  className="w-full p-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 resize-none h-24"
                ></textarea>
              </div>
              <div className="w-full md:w-64 bg-slate-800 text-white p-6 rounded-xl flex flex-col justify-center items-end shadow-inner">
                <span className="text-slate-300 text-sm mb-1">
                  Total a Pagar
                </span>
                <span className="text-3xl font-bold">
                  {formatCurrency(totalPedido)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* FOOTER DEL MODAL */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 text-slate-600 font-medium hover:bg-slate-200 rounded-lg transition-colors"
            disabled={isSubmitting}
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || loadingData}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm transition-colors flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Save className="h-5 w-5" />
            )}
            Confirmar Pedido
          </button>
        </div>
      </div>
    </div>
  );
};
