/* ============================================================
   olbo · foto-perfil.js
   Foto de perfil: elegir una imagen del dispositivo, RECORTARLA a cuadrado
   y reducirla a un data URL pequeño para guardarla en config.

   Por qué se redimensiona: una foto de cámara pesa 3–8 MB; guardarla cruda
   en IndexedDB infla el respaldo y la app. A 256px JPEG q0.82 pesa ~20-40 KB
   y se ve nítida en un avatar de 56px (incluso en pantallas @3x).

   La CSP permite `img-src 'self' data: blob:`, así que el data URL pinta sin
   tocar la red. Nada sale del dispositivo.
   ============================================================ */

export const LADO_FOTO = 256;         // px del lado del cuadrado final
export const CALIDAD_FOTO = 0.82;     // JPEG
export const MAX_ARCHIVO = 12 * 1024 * 1024; // 12 MB de entrada

/** Recorte cuadrado centrado: el lado corto manda. PURA. */
export function recorteCuadrado(ancho, alto) {
  const w = Number(ancho) || 0;
  const h = Number(alto) || 0;
  if (w <= 0 || h <= 0) return null;
  const lado = Math.min(w, h);
  return { sx: Math.round((w - lado) / 2), sy: Math.round((h - lado) / 2), lado };
}

/** ¿El archivo sirve como foto? Devuelve un motivo legible si no. PURA. */
export function validarArchivo(file) {
  if (!file) return { ok: false, motivo: 'No se eligió ninguna imagen.' };
  if (typeof file.type === 'string' && file.type && !file.type.startsWith('image/')) {
    return { ok: false, motivo: 'Ese archivo no es una imagen.' };
  }
  if (Number.isFinite(file.size) && file.size > MAX_ARCHIVO) {
    return { ok: false, motivo: 'La imagen es muy pesada. Elige una más liviana.' };
  }
  return { ok: true };
}

/**
 * Convierte un File de imagen en un data URL cuadrado de LADO_FOTO px.
 * IMPURA (usa Image/canvas del navegador). Rechaza con un mensaje legible.
 * @param {File} file
 * @returns {Promise<string>} data URL (image/jpeg)
 */
export function fotoADataURL(file) {
  return new Promise((resolve, reject) => {
    const v = validarArchivo(file);
    if (!v.ok) { reject(new Error(v.motivo)); return; }

    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const r = recorteCuadrado(img.naturalWidth, img.naturalHeight);
        if (!r) throw new Error('No se pudo leer la imagen.');
        const canvas = document.createElement('canvas');
        canvas.width = LADO_FOTO;
        canvas.height = LADO_FOTO;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, r.sx, r.sy, r.lado, r.lado, 0, 0, LADO_FOTO, LADO_FOTO);
        resolve(canvas.toDataURL('image/jpeg', CALIDAD_FOTO));
      } catch (err) {
        reject(new Error('No se pudo procesar la imagen.'));
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo abrir la imagen.')); };
    img.src = url;
  });
}
