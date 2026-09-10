import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Save,
  Loader2,
  AlertCircle,
  ShoppingBag,
  Truck,
  PlusCircle,
} from "lucide-react";
import { purchaseService } from "../services/purchaseService";
import { supplierService } from "../../suppliers/services/supplierService";
import { productService } from "../../products/services/productService";
import { validatePurchaseForm } from "../utils/purchaseValidations";
import { usePurchaseCart } from "../hooks/usePurchaseCart";
import { PurchaseProductPicker } from "../components/PurchaseProductPicker";
import { PurchaseCart } from "../components/PurchaseCart";
import { SupplierForm } from "../../suppliers/components/SupplierForm";

export const PurchaseCreatePage = () => {
  const navigate = useNavigate();

  const [proveedores, setProveedores] = useState([]);
  const [productos, setProductos] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  const [proveedorId, setProveedorId] = useState("");
  const [notas, setNotas] = useState("");
  const [isSupplierFormOpen, setIsSupplierFormOpen] = useState(false);

  const {
    carrito,
    agregarLinea,
    actualizarCantidad,
    actualizarCosto,
    eliminarLinea,
    total,
  } = usePurchaseCart();

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoadingData(true);
        const [proveedoresData, productosData] = await Promise.all([
          supplierService.getProveedoresActivos(),
          productService.getProductosActivos(),
        ]);
        setProveedores(proveedoresData);
        setProductos(productosData);
      } catch (error) {
        console.error("Error cargando datos base:", error);
      } finally {
        setLoadingData(false);
      }
    };
    fetchData();
  }, []);

  const handleProveedorCreado = async (proveedorNuevo) => {
    setIsSupplierFormOpen(false);
    try {
      const proveedoresData = await supplierService.getProveedoresActivos();
      setProveedores(proveedoresData);
    } finally {
      if (proveedorNuevo?.id) setProveedorId(proveedorNuevo.id);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const cabeceraData = { proveedor_id: proveedorId, notas };
    const validationErrors = validatePurchaseForm(cabeceraData, carrito);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    const detalles = carrito.map((l) => ({
      producto_id: l.producto_id,
      cantidad: l.cantidad,
      costo_unitario: l.costo_unitario,
    }));

    try {
      setIsSubmitting(true);
      const resultado = await purchaseService.crearCompraTransaccional(
        cabeceraData,
        detalles,
      );
      navigate(`/compras/${resultado.id}`);
    } catch (error) {
      console.error(error);
      setErrors({
        global: error.message || "Ocurrió un error al guardar la compra.",
      });
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
        <p>Preparando registro de compra...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full bg-slate-50 pb-24">
      <div className="flex items-center justify-between p-4 bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/compras")}
            className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="h-6 w-6" />
          </button>
          <h1 className="text-lg font-bold text-slate-800 flex items-center gap-1.5">
            <ShoppingBag className="h-5 w-5 text-blue-600" />
            Nueva Compra
          </h1>
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

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-sm font-semibold text-slate-700">
              Proveedor *
            </label>
            <button
              type="button"
              onClick={() => setIsSupplierFormOpen(true)}
              className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
            >
              <PlusCircle className="h-3.5 w-3.5" />
              Proveedor nuevo
            </button>
          </div>
          <select
            value={proveedorId}
            onChange={(e) => setProveedorId(e.target.value)}
            className={`w-full p-3 border rounded-xl outline-none bg-white text-base transition-all ${errors.proveedor_id ? "border-red-500 ring-2 ring-red-100" : "border-slate-300 focus:ring-2 focus:ring-blue-100 focus:border-blue-500"}`}
          >
            <option value="">-- Selecciona un proveedor --</option>
            {proveedores.map((p) => (
              <option key={p.id} value={p.id}>
                {p.numero_identificacion} - {p.nombre_comercial}
              </option>
            ))}
          </select>
          {errors.proveedor_id && (
            <p className="text-red-500 text-xs mt-1 font-medium">
              {errors.proveedor_id}
            </p>
          )}
          {proveedores.length === 0 && (
            <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
              <Truck className="h-3.5 w-3.5" /> No hay proveedores registrados
              todavía.
            </p>
          )}
        </div>

        <PurchaseProductPicker
          productos={productos}
          onAgregar={agregarLinea}
          error={errors.carrito}
        />

        <PurchaseCart
          carrito={carrito}
          onActualizarCantidad={actualizarCantidad}
          onActualizarCosto={actualizarCosto}
          onEliminar={eliminarLinea}
          formatCurrency={formatCurrency}
          total={total}
        />

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Notas u observaciones
            </label>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Número de factura, condiciones de pago..."
              className="w-full p-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 resize-none h-20 text-sm"
            ></textarea>
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
            Guardar Compra
          </button>
        </div>
      </form>

      {isSupplierFormOpen && (
        <SupplierForm
          onSuccess={handleProveedorCreado}
          onCancel={() => setIsSupplierFormOpen(false)}
        />
      )}
    </div>
  );
};
