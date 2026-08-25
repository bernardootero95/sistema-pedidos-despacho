import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Save,
  Loader2,
  AlertCircle,
  UserCheck,
  ShoppingCart,
  UserPlus,
} from "lucide-react";
import { supabase } from "../../../config/supabase";
import { orderService } from "../services/orderService";
import { clientService } from "../../clients/services/clientService";
import { productService } from "../../products/services/productService";
import { validateOrderForm, validateOrderField } from "../utils/orderValidations";
import { useCarritoPedido } from "../hooks/useCarritoPedido";
import { ProductSearchBar } from "../components/ProductSearchBar";
import { CarritoPedido } from "../components/CarritoPedido";
import { ClientForm } from "../../clients/components/ClientForm";
import { getNombreCliente } from "../../clients/utils/clienteDisplay";
import { useAuth } from "../../../context/useAuth";

// Precio al por mayor: solo soporte/gerencia. Precio frío: además despachador
// (sí lo ve al facturar), nunca vendedor. Mismos roles que valida
// resolver_precio_pedido en el servidor — esto es solo para no mostrar un
// control que el backend rechazaría.
const ROLES_MAYORISTA = ["soporte", "gerencia"];
const ROLES_FRIO = ["soporte", "gerencia", "despachador"];

export const OrderCreatePage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const puedeMayorista = ROLES_MAYORISTA.includes(user?.rol);
  const puedeFrio = ROLES_FRIO.includes(user?.rol);

  // --- ESTADOS DE DATOS EXTERNOS ---
  const [clientes, setClientes] = useState([]);
  const [productos, setProductos] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  // --- ESTADOS DEL FORMULARIO ---
  const [clienteId, setClienteId] = useState("");
  const [vendedorId, setVendedorId] = useState("");
  const [vendedorNombre, setVendedorNombre] = useState("");
  const [notas, setNotas] = useState("");
  const [productoSeleccionado, setProductoSeleccionado] = useState("");
  const [isClientFormOpen, setIsClientFormOpen] = useState(false);

  const {
    carrito,
    errorStock,
    agregarAlCarrito: agregarProductoAlCarrito,
    modificarCantidad,
    actualizarCantidadInput,
    cambiarTipoPrecio,
    eliminarDelCarrito,
    totalPedido,
  } = useCarritoPedido(productos);

  // --- ESTADOS DE CONTROL ---
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Cargar datos iniciales trayendo el campo 'disponible' de productos
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoadingData(true);

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

        const [clientesData, productosData, preciosMayoristas] =
          await Promise.all([
            clientService.getClientesActivos(),
            productService.getProductosActivos(),
            // Solo soporte/gerencia las aplican; el resto ni las ve (RLS
            // igual las filtraría, pero así se evita la consulta de más).
            ROLES_MAYORISTA.includes(user?.rol)
              ? productService.getTodosPreciosMayoristas()
              : Promise.resolve([]),
          ]);

        setClientes(clientesData);
        setProductos(
          productosData.map((p) => ({
            ...p,
            tiersMayoristas: preciosMayoristas.filter(
              (t) => t.producto_id === p.id,
            ),
          })),
        );
      } catch (error) {
        console.error("Error cargando datos base:", error);
      } finally {
        setLoadingData(false);
      }
    };
    fetchData();
  }, [user?.rol]);

  // Refresca el selector de clientes tras crear uno nuevo desde el
  // quick-add y lo deja preseleccionado, sin recargar toda la página.
  const handleClienteCreado = async (clienteNuevo) => {
    setIsClientFormOpen(false);
    try {
      const clientesData = await clientService.getClientesActivos();
      setClientes(clientesData);
    } finally {
      if (clienteNuevo?.id) handleClienteChange(clienteNuevo.id);
    }
  };

  // --- VALIDACIÓN INMEDIATA DEL CLIENTE (mismo patrón que DispatchCreatePage) ---
  const handleClienteChange = (value) => {
    setClienteId(value);
    if (touched.cliente_id) {
      setErrors((prev) => ({
        ...prev,
        cliente_id: validateOrderField("cliente_id", value),
      }));
    }
  };

  const handleClienteBlur = () => {
    setTouched((prev) => ({ ...prev, cliente_id: true }));
    setErrors((prev) => ({
      ...prev,
      cliente_id: validateOrderField("cliente_id", clienteId),
    }));
  };

  const agregarAlCarrito = () => {
    agregarProductoAlCarrito(productoSeleccionado);
    setProductoSeleccionado("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const cabeceraData = {
      cliente_id: clienteId,
      vendedor_id: vendedorId,
      notas,
    };

    const validationErrors = validateOrderForm(cabeceraData, carrito);
    setTouched((prev) => ({ ...prev, cliente_id: true }));
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    const detallesParaGuardar = carrito.map(
      // eslint-disable-next-line no-unused-vars -- se destructuran para excluirlas de "rest"
      ({ nombre, codigo, disponible, ...rest }) => rest,
    );

    try {
      setIsSubmitting(true);
      await orderService.crearPedido(cabeceraData, detallesParaGuardar);
      navigate("/pedidos");
    } catch (error) {
      console.error(error);
      setErrors({
        global: error.message || "Ocurrió un error al guardar el pedido.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (loadingData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-slate-500 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <p>Preparando punto de venta móvil...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full bg-slate-50 pb-24">
      {/* HEADER */}
      <div className="flex items-center justify-between p-4 bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/pedidos")}
            className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="h-6 w-6" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-slate-800 flex items-center gap-1.5">
              <ShoppingCart className="h-5 w-5 text-blue-600" />
              Nuevo Pedido
            </h1>
            {vendedorNombre && (
              <p className="text-xs text-slate-500 flex items-center gap-1">
                <UserCheck className="h-3 w-3 text-emerald-500" />{" "}
                {vendedorNombre}
              </p>
            )}
          </div>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="p-4 flex flex-col gap-4 max-w-3xl mx-auto w-full"
      >
        {errors.global && (
          <div className="bg-red-50 text-red-700 p-3 rounded-xl flex items-center gap-2 text-sm border border-red-200">
            <AlertCircle className="h-5 w-5 shrink-0" />
            {errors.global}
          </div>
        )}

        {/* CLIENTE */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-sm font-semibold text-slate-700">
              Seleccionar Cliente *
            </label>
            <button
              type="button"
              onClick={() => setIsClientFormOpen(true)}
              className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
            >
              <UserPlus className="h-3.5 w-3.5" />
              Cliente nuevo
            </button>
          </div>
          <select
            value={clienteId}
            onChange={(e) => handleClienteChange(e.target.value)}
            onBlur={handleClienteBlur}
            className={`w-full p-3 border rounded-xl outline-none bg-white text-base transition-all ${errors.cliente_id ? "border-red-500 ring-2 ring-red-100" : "border-slate-300 focus:ring-2 focus:ring-blue-100 focus:border-blue-500"}`}
          >
            <option value="">-- Toca para elegir cliente --</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.numero_identificacion} - {getNombreCliente(c)}
              </option>
            ))}
          </select>
          {errors.cliente_id && (
            <p className="text-red-500 text-xs mt-1 font-medium">
              {errors.cliente_id}
            </p>
          )}
        </div>

        {/* BUSCADOR DE PRODUCTOS CON STOCK VISIBLE */}
        <ProductSearchBar
          productos={productos}
          productoSeleccionado={productoSeleccionado}
          onSelectChange={setProductoSeleccionado}
          onAgregar={agregarAlCarrito}
          error={errorStock || errors.carrito}
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
          error={errorStock || errors.carrito}
          puedeMayorista={puedeMayorista}
          puedeFrio={puedeFrio}
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
            Guardar Pedido
          </button>
        </div>
      </form>

      {isClientFormOpen && (
        <ClientForm
          onSuccess={handleClienteCreado}
          onCancel={() => setIsClientFormOpen(false)}
        />
      )}
    </div>
  );
};
