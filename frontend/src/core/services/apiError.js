/**
 * Extrae el mensaje de error real del backend desde un error de axios.
 *
 * Cuando la request se hizo con `responseType: 'blob'` (descargas de PDF: certificados,
 * previsualizaciones), un error del backend con body JSON llega igual como Blob en
 * `error.response.data` — no como el objeto parseado — así que `error.response.data.message`
 * siempre da `undefined` y el mensaje real del backend queda silenciado detrás de un
 * fallback genérico. Acá se lee ese Blob como texto y se parsea a mano.
 */
export default async function extraerMensajeError(error, fallback) {
  const data = error?.response?.data;

  if (data instanceof Blob) {
    try {
      const texto = await data.text();
      const json = JSON.parse(texto);
      if (json?.message) return json.message;
    } catch (_) {
      // El blob no era JSON parseable (ej. sí llegó a generarse un PDF parcial) — se usa el fallback.
    }
    return fallback;
  }

  return data?.message || error?.message || fallback;
}
