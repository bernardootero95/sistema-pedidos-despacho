import { supabase } from "../../../config/supabase";

const BUCKET_LOGO = "empresa";

const CAMPOS = [
  "razon_social",
  "nombre_comercial",
  "nit",
  "digito_verificacion",
  "direccion",
  "ciudad",
  "telefono",
  "correo",
  "resolucion_facturacion",
];

const urlPublicaLogo = (logoPath) =>
  logoPath
    ? supabase.storage.from(BUCKET_LOGO).getPublicUrl(logoPath).data.publicUrl
    : null;

/**
 * Datos de identidad de la empresa (fila única de `datos_empresa`) y su
 * logo en Storage. Los leen los comprobantes impresos de todos los roles;
 * solo soporte/gerencia los editan (RLS).
 */
export const companyService = {
  async getDatosEmpresa() {
    const { data, error } = await supabase
      .from("datos_empresa")
      .select([...CAMPOS, "logo_path"].join(", "))
      .single();

    if (error)
      throw new Error(
        "Error al cargar los datos de la empresa: " + error.message,
      );

    return { ...data, logoUrl: urlPublicaLogo(data.logo_path) };
  },

  async actualizarDatosEmpresa(datos) {
    const cambios = Object.fromEntries(
      CAMPOS.map((campo) => [campo, datos[campo]?.trim() || null]),
    );

    // Fila única (id = true): filtro fijo para que PostgREST acepte el UPDATE.
    const { error } = await supabase
      .from("datos_empresa")
      .update(cambios)
      .eq("id", true);

    if (error)
      throw new Error(
        "Error al guardar los datos de la empresa: " + error.message,
      );
  },

  /**
   * Sube un logo nuevo con nombre único (evita que el navegador o la CDN
   * sirvan el anterior desde caché), lo registra y borra el previo.
   */
  async subirLogo(archivo, logoPathAnterior) {
    const extension = archivo.name.split(".").pop().toLowerCase();
    const logoPath = `logo-${Date.now()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_LOGO)
      .upload(logoPath, archivo, { contentType: archivo.type });

    if (uploadError)
      throw new Error("Error al subir el logo: " + uploadError.message);

    await this._registrarLogo(logoPath, logoPathAnterior);
    return urlPublicaLogo(logoPath);
  },

  async eliminarLogo(logoPathAnterior) {
    await this._registrarLogo(null, logoPathAnterior);
  },

  async _registrarLogo(logoPath, logoPathAnterior) {
    const { error } = await supabase
      .from("datos_empresa")
      .update({ logo_path: logoPath })
      .eq("id", true);

    if (error) throw new Error("Error al guardar el logo: " + error.message);

    // Si falla el borrado del archivo anterior solo queda un huérfano en el
    // bucket; no vale la pena fallar la operación por eso.
    if (logoPathAnterior) {
      await supabase.storage.from(BUCKET_LOGO).remove([logoPathAnterior]);
    }
  },
};
