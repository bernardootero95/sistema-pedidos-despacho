import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Save,
  Loader2,
  AlertCircle,
  ShoppingCart,
  Lock,
} from "lucide-react";
import { supabase } from "../../../config/supabase";
import { orderService } from "../services/orderService";
import { productService } from "../../products/services/productService";
import { validateOrderField } from "../utils/orderValidations";
import { useCarritoPedido } from "../hooks/useCarritoPedido";
import { ProductSearchBar } from "../components/ProductSearchBar";
import { CarritoPedido } from "../components/CarritoPedido";
import { getNombreCliente } from "../../clients/utils/clienteDisplay";
import { useAuth } from "../../../context/useAuth";

// Mismos roles que resolver_precio_pedido valida en el servidor.
const ROLES_MAYORISTA = ["soporte", "gerencia"];
const ROLES_FRIO = ["soporte", "gerencia", "despachador"];
const ROLES_CREDITO = ["soporte", "gerencia", "despachador"];

/**
 * Edita un pedido pendiente: mismo carrito/buscador de productos que
 * OrderCreatePage (comparten useCarritoPedido), pero cliente y vendedor
 * quedan fijos — editar es ajustar productos/cantidades/notas, no
 * reasignar el pedido a otro cliente.
 */
export const OrderEditPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const puedeMayorista = ROLES_MAYORISTA.includes(user?.rol);
  const puedeFrio = ROLES_FRIO.includes(user?.rol);
  const puedeCredito = ROLES_CREDITO.includes(user?.rol);

  const [pedido, setPedido] = useState(null);
  const [productos, setProductos] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [notas, setNotas] = useState("");
  const [productoSeleccionado, setProductoSeleccionado] = useState("");
  const [carritoError, setCarritoError] = useState("");
  const [globalError, setGlobalError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    carrito,
    setCarrito,
    errorStock,
    agregarAlCarrito: agregarProductoAlCarrito,
    modificarCantidad,
    actualizarCantidadInput,
    cambiarTipoPrecio,
    eliminarDelCarrito,
    totalPedido,
  } = useCarritoPedido(productos);

  useEffect(() => {
    const cargarDatos = async () => {
      try {
        setLoadingData(true);
        setLoadError("");

        const [pedidoData, { data: productosData }, preciosMayoristas] =
          await Promise.all([
            orderService.getPedidoCompleto(id),
            supabase
              .from("productos")
              .select(
                "id, nombre, codigo, precio_venta, iva, inc, disponible, precio_frio, precio_credito",
              )
              .is("eliminado", null),
            ROLES_MAYORISTA.includes(user?.rol)
              ? productService.getTodosPreciosMayoristas()
              : Promise.resolve([]),
          ]);

        setPedido(pedidoData);

        if (pedidoData.estado !== "pendiente") {
          setLoadError(
            `Este pedido ya no se puede editar (estado actual: ${pedidoData.estado}).`,
          );
          return;
        }

        const detalles = pedidoData.detalles || [];

        // El stock que este pedido ya tenía reservado se suma de vuelta al
        // "techo" disponible: editar_pedido_transaccional también lo
        // devuelve antes de re-validar, así que el vendedor debe poder
        // subir hasta ahí, no solo hasta el disponible crudo del catálogo.
        const productosAjustados = (productosData || []).map((p) => {
          const detallePrevio = detalles.find((d) => d.producto_id === p.id);
          return {
            ...p,
            disponible: detallePrevio
              ? p.disponible + detallePrevio.cantidad
              : p.disponible,
            tiersMayoristas: preciosMayoristas.filter(
              (t) => t.producto_id === p.id,
            ),
          };
        });

        const itemsIniciales = detalles.map((d) => {
          const productoAjustado = productosAjustados.find(
            (p) => p.id === d.producto_id,
          );
          return {
            producto_id: d.producto_id,
            nombre: d.producto?.nombre || "Producto",
            codigo: d.producto?.codigo || "",
            cantidad: d.cantidad,
            precio_unitario: Number(d.precio_unitario),
            iva_porcentaje: Number(d.iva_porcentaje),
            inc_porcentaje: Number(d.inc_porcentaje),
            subtotal_linea: Number(d.subtotal_linea),
            disponible: productoAjustado?.disponible ?? 0,
            tipo_precio: d.tipo_precio || "normal",
            precio_venta: productoAjustado?.precio_venta ?? Number(d.precio_unitario),
            precio_frio: productoAjustado?.precio_frio ?? null,
            precio_credito: productoAjustado?.precio_credito ?? null,
            tiersMayoristas: productoAjustado?.tiersMayoristas || [],
          };
        });

        setNotas(pedidoData.notas || "");
        setProductos(productosAjustados);
        setCarrito(itemsIniciales);
      } catch (err) {
        console.error(err);
        setLoadError("No se pudo cargar el pedido para edición.");
      } finally {
        setLoadingData(false);
      }
    };

    if (id) cargarDatos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const agregarAlCarrito = () => {
    agregarProductoAlCarrito(productoSeleccionado);
    setProductoSeleccionado("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setGlobalError("");

    const errorCarrito = validateOrderField("carrito", carrito);
    if (errorCarrito) {
      setCarritoError(errorCarrito);
      return;
    }
    setCarritoError("");

    const detallesParaGuardar = carrito.map((item) => ({
      producto_id: item.producto_id,
      cantidad: item.cantidad,
      tipo_precio: item.tipo_precio,
    }));

    try {
      setIsSubmitting(true);
      await orderService.editarPedido(id, {
        notas,
        detalles: detallesParaGuardar,
      });
      navigate(`/orders/${id}`);
    } catch (err) {
      console.error(err);
      setGlobalError(
        err.message || "Ocurrió un error al guardar los cambios.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCurrency = (amount) =>
    new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(amount || 0);

  if (loadingData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-slate-500 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <p>Cargando pedido...</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="p-6 max-w-lg mx-auto">
        <div className="bg-amber-50 text-amber-800 p-4 rounded-xl flex items-center gap-3 border border-amber-200">
          <Lock className="h-6 w-6 shrink-0" />
          <p className="text-sm font-medium">{loadError}</p>
        </div>
        <button
          onClick={() => navigate(pedido ? `/orders/${id}` : "/pedidos")}
          className="mt-4 flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" /> Volver
        </button>
      </div>
    );
  }

  const cliente = pedido?.clientes;

  return (
    <div className="flex flex-col min-h-full bg-slate-50 pb-24">
      {/* HEADER */}
      <div className="flex items-center justify-between p-4 bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(`/orders/${id}`)}
            className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="h-6 w-6" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-slate-800 flex items-center gap-1.5">
              <ShoppingCart className="h-5 w-5 text-blue-600" />
              Editar Pedido #{pedido?.numero_pedido}
            </h1>
          </div>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="p-4 flex flex-col gap-4 max-w-3xl mx-auto w-full"
      >
        {globalError && (
          <div className="bg-red-50 text-red-700 p-3 rounded-xl flex items-center gap-2 text-sm border border-red-200">
            <AlertCircle className="h-5 w-5 shrink-0" />
            {globalError}
          </div>
        )}

        {/* CLIENTE (solo lectura: editar es ajustar productos, no reasignar) */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Cliente
          </p>
          <p className="text-base font-bold text-slate-800">
            {getNombreCliente(cliente)}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            El cliente no se puede cambiar desde la edición.
          </p>
        </div>

        {/* BUSCADOR DE PRODUCTOS CON STOCK VISIBLE */}
        <ProductSearchBar
          productos={productos}
          productoSeleccionado={productoSeleccionado}
          onSelectChange={setProductoSeleccionado}
          onAgregar={agregarAlCarrito}
          error={errorStock || carritoError}
          formatCurrency={formatCurrency}
        />

        {/* CARRITO */}
        <CarritoPedido
          carrito={carrito}
          onModificarCantidad={modificarCantidad}
          onActualizarCantidadInput={actualizarCantidadInput}
          onCambiarTipoPrecio={cambiarTipoPrecio}
          onEliminar={eliminarDelCarrito}
          formatCurrency={formatCurrency}
          error={errorStock || carritoError}
          puedeMayorista={puedeMayorista}
          puedeFrio={puedeFrio}
          puedeCredito={puedeCredito}
        />

        {/* NOTAS Y TOTAL */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Notas u observaciones
            </label>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Instrucciones de entrega..."
              className="w-full p-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 resize-none h-20 text-sm"
            ></textarea>
          </div>

          <div className="bg-slate-900 text-white p-4 rounded-xl flex items-center justify-between">
            <span className="text-slate-300 text-sm font-medium">
              Total Pedido
            </span>
            <span className="text-2xl font-bold">
              {formatCurrency(totalPedido)}
            </span>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-md transition-colors flex items-center justify-center gap-2 disabled:opacity-70 text-base"
          >
            {isSubmitting ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Save className="h-5 w-5" />
            )}
            Guardar Cambios
          </button>
        </div>
      </form>
    </div>
  );
};
