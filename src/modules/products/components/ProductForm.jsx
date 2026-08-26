import { useState, useEffect } from "react";
import { productService } from "../services/productService";
import {
  validateProductField,
  validateProductForm,
  validateTierMayorista,
} from "../utils/productValidations";
import {
  X,
  Save,
  ShieldAlert,
  Package,
  Snowflake,
  Layers,
  CreditCard,
  Plus,
  Trash2,
  Loader2,
} from "lucide-react";

export const ProductForm = ({ onSuccess, onCancel, productToEdit = null }) => {
  const isEditing = !!productToEdit;

  const [formData, setFormData] = useState({
    codigo: productToEdit?.codigo || "",
    codigo_barra: productToEdit?.codigo_barra || "",
    nombre: productToEdit?.nombre || "",
    descripcion: productToEdit?.descripcion || "",
    tipo: productToEdit?.tipo || "",
    departamento: productToEdit?.departamento || "",
    linea: productToEdit?.linea || "",
    categoria: productToEdit?.categoria || "",
    precio_venta: productToEdit?.precio_venta ?? "",
    iva: productToEdit?.iva ?? "0",
    inc: productToEdit?.inc ?? "0",
    clasificacion: productToEdit?.clasificacion || "",
    disponible: productToEdit?.disponible ?? "0",
    precio_frio: productToEdit?.precio_frio ?? "",
    precio_credito: productToEdit?.precio_credito ?? "",
  });

  // Franjas de precio al por mayor: array independiente de formData porque
  // no es un campo plano de `productos`, sino filas de una tabla aparte
  // (productos_precios_mayoristas) que se reemplazan completas al guardar.
  const [tiers, setTiers] = useState([]);
  const [tiersErrors, setTiersErrors] = useState([]);
  const [loadingTiers, setLoadingTiers] = useState(isEditing);

  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");

  useEffect(() => {
    if (!isEditing) return;
    productService
      .getPreciosMayoristas(productToEdit.id)
      .then((data) =>
        setTiers(
          data.map((t) => ({
            cantidad_minima: String(t.cantidad_minima),
            precio: String(t.precio),
          })),
        ),
      )
      .catch((error) => setServerError(error.message))
      .finally(() => setLoadingTiers(false));
  }, [isEditing, productToEdit]);

  const agregarTier = () => {
    setTiers((prev) => [...prev, { cantidad_minima: "", precio: "" }]);
    setTiersErrors((prev) => [...prev, {}]);
  };

  const eliminarTier = (index) => {
    setTiers((prev) => prev.filter((_, i) => i !== index));
    setTiersErrors((prev) => prev.filter((_, i) => i !== index));
  };

  const handleTierChange = (index, field, value) => {
    setTiers((prev) => {
      const nuevo = [...prev];
      nuevo[index] = { ...nuevo[index], [field]: value };
      return nuevo;
    });
  };

  const handleTierBlur = (index) => {
    setTiersErrors((prev) => {
      const nuevo = [...prev];
      const otras = tiers.filter((_, i) => i !== index);
      nuevo[index] = validateTierMayorista(tiers[index], otras);
      return nuevo;
    });
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    const newFormState = { ...formData, [name]: value };
    setFormData(newFormState);

    if (touched[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: validateProductField(name, value, newFormState),
      }));
    }
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
    setErrors((prev) => ({
      ...prev,
      [name]: validateProductField(name, value, formData),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError("");

    const newErrors = validateProductForm(formData);
    const allTouched = {};
    Object.keys(formData).forEach((key) => (allTouched[key] = true));
    setTouched(allTouched);
    setErrors(newErrors);

    const newTiersErrors = tiers.map((tier, index) =>
      validateTierMayorista(
        tier,
        tiers.filter((_, i) => i !== index),
      ),
    );
    setTiersErrors(newTiersErrors);

    const hayErroresTiers = newTiersErrors.some(
      (e) => Object.keys(e).length > 0,
    );
    if (Object.keys(newErrors).length > 0 || hayErroresTiers) return;

    setIsSubmitting(true);
    try {
      const payload = {
        codigo: formData.codigo.trim(),
        codigo_barra: formData.codigo_barra.trim() || null,
        nombre: formData.nombre.trim(),
        descripcion: formData.descripcion.trim() || null,
        tipo: formData.tipo.trim() || null,
        departamento: formData.departamento.trim() || null,
        linea: formData.linea.trim() || null,
        categoria: formData.categoria.trim() || null,
        precio_venta: parseFloat(formData.precio_venta),
        iva: parseFloat(formData.iva) || 0,
        inc: parseFloat(formData.inc) || 0,
        clasificacion: formData.clasificacion,
        disponible: parseFloat(formData.disponible) || 0,
        precio_frio:
          formData.precio_frio !== "" ? parseFloat(formData.precio_frio) : null,
        precio_credito:
          formData.precio_credito !== ""
            ? parseFloat(formData.precio_credito)
            : null,
      };

      const productoGuardado = isEditing
        ? await productService.actualizarProducto(productToEdit.id, payload)
        : await productService.crearProducto(payload);

      await productService.reemplazarPreciosMayoristas(
        productoGuardado.id,
        tiers.map((t) => ({
          cantidad_minima: parseInt(t.cantidad_minima, 10),
          precio: parseFloat(t.precio),
        })),
      );

      onSuccess();
    } catch (error) {
      setServerError(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl flex flex-col max-h-[95vh]">
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 text-primary rounded-lg">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                {isEditing ? "Editar Producto" : "Nuevo Producto / Servicio"}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Completa la ficha técnica y configuración fiscal.
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-5 overflow-y-auto flex-1 relative">
          {serverError && (
            <div className="mb-5 bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg flex items-start gap-2 text-sm font-semibold">
              <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
              <p>{serverError}</p>
            </div>
          )}

          <form
            id="product-form"
            onSubmit={handleSubmit}
            className="space-y-6"
            noValidate
          >
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Identificación Básica
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Código Principal *
                  </label>
                  <input
                    type="text"
                    name="codigo"
                    value={formData.codigo}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    className={`w-full p-2.5 bg-white border rounded-lg text-sm focus:outline-none focus:ring-2 ${errors.codigo ? "border-red-400 focus:ring-red-200" : "border-slate-300 focus:ring-primary/20"}`}
                  />
                  {errors.codigo && (
                    <p className="mt-1 text-xs text-red-500 font-bold">
                      {errors.codigo}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Código de Barras
                  </label>
                  <input
                    type="text"
                    name="codigo_barra"
                    value={formData.codigo_barra}
                    onChange={handleChange}
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div className="sm:col-span-2 lg:col-span-3">
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Nombre del Producto / Servicio *
                  </label>
                  <input
                    type="text"
                    name="nombre"
                    value={formData.nombre}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    className={`w-full p-2.5 bg-white border rounded-lg text-sm focus:outline-none focus:ring-2 ${errors.nombre ? "border-red-400 focus:ring-red-200" : "border-slate-300 focus:ring-primary/20"}`}
                  />
                  {errors.nombre && (
                    <p className="mt-1 text-xs text-red-500 font-bold">
                      {errors.nombre}
                    </p>
                  )}
                </div>
                <div className="sm:col-span-2 lg:col-span-3">
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Descripción General
                  </label>
                  <textarea
                    name="descripcion"
                    rows="2"
                    value={formData.descripcion}
                    onChange={handleChange}
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  ></textarea>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Jerarquía (Datos Externos)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Tipo
                  </label>
                  <input
                    type="text"
                    name="tipo"
                    value={formData.tipo}
                    onChange={handleChange}
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Departamento
                  </label>
                  <input
                    type="text"
                    name="departamento"
                    value={formData.departamento}
                    onChange={handleChange}
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Línea
                  </label>
                  <input
                    type="text"
                    name="linea"
                    value={formData.linea}
                    onChange={handleChange}
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Categoría
                  </label>
                  <input
                    type="text"
                    name="categoria"
                    value={formData.categoria}
                    onChange={handleChange}
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Datos Fiscales e Inventario
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="lg:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Clasificación DIAN *
                  </label>
                  <select
                    name="clasificacion"
                    value={formData.clasificacion}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    className={`w-full p-2.5 bg-white border rounded-lg text-sm focus:outline-none focus:ring-2 ${errors.clasificacion ? "border-red-400 focus:ring-red-200" : "border-slate-300 focus:ring-primary/20"}`}
                  >
                    <option value="">Seleccionar...</option>
                    <option value="gravado">Gravado</option>
                    <option value="exento">Exento</option>
                    <option value="excluido">Excluido</option>
                  </select>
                  {errors.clasificacion && (
                    <p className="mt-1 text-xs text-red-500 font-bold">
                      {errors.clasificacion}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    % IVA *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    name="iva"
                    value={formData.iva}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    placeholder="Ej: 19"
                    className={`w-full p-2.5 bg-white border rounded-lg text-sm focus:outline-none focus:ring-2 ${errors.iva ? "border-red-400 focus:ring-red-200" : "border-slate-300 focus:ring-primary/20"}`}
                  />
                  {errors.iva && (
                    <p className="mt-1 text-xs text-red-500 font-bold">
                      {errors.iva}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    % INC *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    name="inc"
                    value={formData.inc}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    placeholder="Ej: 8"
                    className={`w-full p-2.5 bg-white border rounded-lg text-sm focus:outline-none focus:ring-2 ${errors.inc ? "border-red-400 focus:ring-red-200" : "border-slate-300 focus:ring-primary/20"}`}
                  />
                  {errors.inc && (
                    <p className="mt-1 text-xs text-red-500 font-bold">
                      {errors.inc}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Cantidad Disponible *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    name="disponible"
                    value={formData.disponible}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    className={`w-full p-2.5 bg-white border rounded-lg text-sm focus:outline-none focus:ring-2 ${errors.disponible ? "border-red-400 focus:ring-red-200" : "border-slate-300 focus:ring-primary/20"}`}
                  />
                  {errors.disponible && (
                    <p className="mt-1 text-xs text-red-500 font-bold">
                      {errors.disponible}
                    </p>
                  )}
                </div>
                <div className="sm:col-span-2 lg:col-span-5">
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Precio Venta (Base) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
                      $
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      name="precio_venta"
                      value={formData.precio_venta}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      className={`w-full pl-8 p-2.5 bg-white border rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 ${errors.precio_venta ? "border-red-400 focus:ring-red-200" : "border-slate-300 focus:ring-primary/20"}`}
                    />
                  </div>
                  {errors.precio_venta && (
                    <p className="mt-1 text-xs text-red-500 font-bold">
                      {errors.precio_venta}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-4">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Snowflake className="w-3.5 h-3.5" />
                  Precio Frío (Opcional)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Solo lo pueden aplicar gerencia, soporte y despachador al
                  armar un pedido.
                </p>
              </div>
              <div className="max-w-xs">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
                    $
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    name="precio_frio"
                    value={formData.precio_frio}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    placeholder="Ej: 4500"
                    className={`w-full pl-8 p-2.5 bg-white border rounded-lg text-sm focus:outline-none focus:ring-2 ${errors.precio_frio ? "border-red-400 focus:ring-red-200" : "border-slate-300 focus:ring-primary/20"}`}
                  />
                </div>
                {errors.precio_frio && (
                  <p className="mt-1 text-xs text-red-500 font-bold">
                    {errors.precio_frio}
                  </p>
                )}
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-4">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5" />
                  Precio a Crédito (Opcional)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Solo lo pueden aplicar gerencia, soporte y despachador al
                  armar un pedido.
                </p>
              </div>
              <div className="max-w-xs">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
                    $
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    name="precio_credito"
                    value={formData.precio_credito}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    placeholder="Ej: 6000"
                    className={`w-full pl-8 p-2.5 bg-white border rounded-lg text-sm focus:outline-none focus:ring-2 ${errors.precio_credito ? "border-red-400 focus:ring-red-200" : "border-slate-300 focus:ring-primary/20"}`}
                  />
                </div>
                {errors.precio_credito && (
                  <p className="mt-1 text-xs text-red-500 font-bold">
                    {errors.precio_credito}
                  </p>
                )}
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5" />
                    Precios al Por Mayor (Opcional)
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Franjas por cantidad mínima. Solo las aplican gerencia y
                    soporte al armar un pedido.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={agregarTier}
                  className="flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary-hover shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Agregar franja
                </button>
              </div>

              {loadingTiers ? (
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Cargando franjas...
                </div>
              ) : tiers.length === 0 ? (
                <p className="text-xs text-slate-400 italic">
                  Sin franjas configuradas.
                </p>
              ) : (
                <div className="space-y-2">
                  {tiers.map((tier, index) => (
                    <div key={index} className="flex items-start gap-2">
                      <div className="flex-1">
                        <input
                          type="number"
                          step="1"
                          min="1"
                          placeholder="Cantidad mínima"
                          value={tier.cantidad_minima}
                          onChange={(e) =>
                            handleTierChange(
                              index,
                              "cantidad_minima",
                              e.target.value,
                            )
                          }
                          onBlur={() => handleTierBlur(index)}
                          className={`w-full p-2.5 bg-white border rounded-lg text-sm focus:outline-none focus:ring-2 ${tiersErrors[index]?.cantidad_minima ? "border-red-400 focus:ring-red-200" : "border-slate-300 focus:ring-primary/20"}`}
                        />
                        {tiersErrors[index]?.cantidad_minima && (
                          <p className="mt-1 text-xs text-red-500 font-bold">
                            {tiersErrors[index].cantidad_minima}
                          </p>
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
                            $
                          </span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="Precio"
                            value={tier.precio}
                            onChange={(e) =>
                              handleTierChange(index, "precio", e.target.value)
                            }
                            onBlur={() => handleTierBlur(index)}
                            className={`w-full pl-8 p-2.5 bg-white border rounded-lg text-sm focus:outline-none focus:ring-2 ${tiersErrors[index]?.precio ? "border-red-400 focus:ring-red-200" : "border-slate-300 focus:ring-primary/20"}`}
                          />
                        </div>
                        {tiersErrors[index]?.precio && (
                          <p className="mt-1 text-xs text-red-500 font-bold">
                            {tiersErrors[index].precio}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => eliminarTier(index)}
                        className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </form>
        </div>

        <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="product-form"
            disabled={isSubmitting || loadingTiers}
            className="px-4 py-2.5 bg-primary hover:bg-primary-hover disabled:opacity-50 text-white text-sm font-bold rounded-lg shadow-sm flex items-center gap-2 transition-all"
          >
            <Save className="w-4 h-4" />
            {isSubmitting ? "Guardando..." : "Guardar Ficha"}
          </button>
        </div>
      </div>
    </div>
  );
};
