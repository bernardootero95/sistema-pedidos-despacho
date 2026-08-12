import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Save,
  Loader2,
  AlertCircle,
  UserCheck,
  ShoppingCart,
} from "lucide-react";
import { supabase } from "../../../config/supabase";
import { orderService } from "../services/orderService";
import {
  validateOrderForm,
  validateOrderField,
  validarStockParaAgregar,
  validarStockParaCantidad,
} from "../utils/orderValidations";
import { ProductSearchBar } from "../components/ProductSearchBar";
import { CarritoPedido } from "../components/CarritoPedido";

export const OrderCreatePage = () => {
  const navigate = useNavigate();

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

        const [resClientes, resProductos] = await Promise.all([
          supabase
            .from("clientes")
            .select(
              "id, razon_social, primer_nombre, primer_apellido, numero_identificacion",
            )
            .is("eliminado", null),
          supabase
            .from("productos")
            .select("id, nombre, codigo, precio_venta, iva, inc, disponible") // Incluimos disponible
            .is("eliminado", null),
        ]);

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

  // --- LÓGICA DEL CARRITO CON VALIDACIÓN DE STOCK INLINE (sin alert()) ---
  const agregarAlCarrito = () => {
    if (!productoSeleccionado) return;

    const producto = productos.find((p) => p.id === productoSeleccionado);
    if (!producto) return;

    const existeIndex = carrito.findIndex(
      (item) => item.producto_id === producto.id,
    );
    const cantidadEnCarrito =
      existeIndex >= 0 ? carrito[existeIndex].cantidad : 0;

    const stockError = validarStockParaAgregar(producto, cantidadEnCarrito);
    if (stockError) {
      setErrors((prev) => ({ ...prev, carrito: stockError }));
      return;
    }

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
          nombre: producto.nombre,
          codigo: producto.codigo,
          cantidad: 1,
          precio_unitario: producto.precio_venta,
          iva_porcentaje: producto.iva || 0,
          inc_porcentaje: producto.inc || 0,
          subtotal_linea: producto.precio_venta * 1,
          disponible: producto.disponible, // Guardamos referencia de stock en el item
        },
      ]);
    }

    setErrors((prev) => ({ ...prev, carrito: "" }));
    setProductoSeleccionado("");
  };

  const modificarCantidad = (index, delta) => {
    const nuevoCarrito = [...carrito];
    const item = nuevoCarrito[index];
    const nuevaCantidad = item.cantidad + delta;

    if (nuevaCantidad <= 0) {
      eliminarDelCarrito(index);
      return;
    }

    const stockError = validarStockParaCantidad(
      nuevaCantidad,
      item.disponible,
      item.nombre,
    );
    if (stockError) {
      setErrors((prev) => ({ ...prev, carrito: stockError }));
      return;
    }

    item.cantidad = nuevaCantidad;
    item.subtotal_linea = nuevaCantidad * item.precio_unitario;
    setCarrito(nuevoCarrito);
    setErrors((prev) => ({ ...prev, carrito: "" }));
  };

  const actualizarCantidadInput = (index, valorTexto) => {
    const cantidadStr = valorTexto.toString().replace(/\D/g, "");
    const cantidad = cantidadStr === "" ? 1 : Number(cantidadStr);

    const nuevoCarrito = [...carrito];
    const item = nuevoCarrito[index];

    const stockError = validarStockParaCantidad(
      cantidad,
      item.disponible,
      item.nombre,
    );
    if (stockError) {
      setErrors((prev) => ({ ...prev, carrito: stockError }));
      item.cantidad = item.disponible;
    } else {
      setErrors((prev) => ({ ...prev, carrito: "" }));
      item.cantidad = cantidad;
    }

    item.subtotal_linea = item.cantidad * item.precio_unitario;
    setCarrito(nuevoCarrito);
  };

  const eliminarDelCarrito = (index) => {
    setCarrito(carrito.filter((_, i) => i !== index));
  };

  const totalPedido = carrito.reduce(
    (acc, item) => acc + (item.subtotal_linea || 0),
    0,
  );

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
    setTouched((prev) => ({ ...prev, cliente_id: true }));
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    const detallesParaGuardar = carrito.map(
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

  const obtenerNombreCliente = (c) =>
    c.razon_social || `${c.primer_nombre} ${c.primer_apellido}`;

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
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">
            Seleccionar Cliente *
          </label>
          <select
            value={clienteId}
            onChange={(e) => handleClienteChange(e.target.value)}
            onBlur={handleClienteBlur}
            className={`w-full p-3 border rounded-xl outline-none bg-white text-base transition-all ${errors.cliente_id ? "border-red-500 ring-2 ring-red-100" : "border-slate-300 focus:ring-2 focus:ring-blue-100 focus:border-blue-500"}`}
          >
            <option value="">-- Toca para elegir cliente --</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.numero_identificacion} - {obtenerNombreCliente(c)}
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
          error={errors.carrito}
          formatCurrency={formatCurrency}
        />

        {/* CARRITO */}
        <CarritoPedido
          carrito={carrito}
          onModificarCantidad={modificarCantidad}
          onActualizarCantidadInput={actualizarCantidadInput}
          onEliminar={eliminarDelCarrito}
          formatCurrency={formatCurrency}
          error={errors.carrito}
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
    </div>
  );
};
