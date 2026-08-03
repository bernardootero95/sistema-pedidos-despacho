/**
 * Calcula el Dígito de Verificación (DV) para un NIT colombiano.
 * Basado en el algoritmo oficial Módulo 11 de la DIAN.
 *
 * @param {string} nit - El número de identificación sin guiones ni DV.
 * @returns {string} - El dígito de verificación calculado (0-9).
 */
export const calculateDV = (nit) => {
  // Validamos que el NIT sea válido y numérico
  if (!nit || isNaN(Number(nit))) return "";

  const vpri = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];
  let x = 0;
  let y = 0;
  const z = nit.length;

  for (let i = 0; i < z; i++) {
    y = parseInt(nit.substring(i, i + 1));
    x += y * vpri[z - 1 - i];
  }

  const y2 = x % 11;
  return y2 > 1 ? (11 - y2).toString() : y2.toString();
};
