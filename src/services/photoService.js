// Photos: shrink on the phone, upload to Firebase Storage, keep only the URL in data.
// A phone photo has 2–5 MB; stored inline it would break the 1 MB Firestore document.
import { storage, auth, storageRef, uploadBytes, getDownloadURL } from './firebase.js';

export const MAX_PHOTO_EDGE = 1600;
export const PHOTO_QUALITY = 0.8;

/** Target size that keeps the aspect ratio and fits within maxEdge. */
export function fitWithin(width, height, maxEdge = MAX_PHOTO_EDGE) {
  if (!width || !height) return { width: 0, height: 0 };
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/** Safe, unique storage path, e.g. damage/job-1/ji-5/1731577200000.jpg */
export function photoPath(folder, ...parts) {
  const clean = (s) => String(s ?? '').replace(/[^A-Za-z0-9_-]+/g, '_').slice(0, 60) || 'x';
  return [clean(folder), ...parts.map(clean), `${Date.now()}.jpg`].join('/');
}

const loadImage = (file) => new Promise((resolve, reject) => {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
  img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Soubor není obrázek, nebo se nedá načíst.')); };
  img.src = url;
});

/** Resizes and re-encodes a photo to JPEG (also strips EXIF incl. GPS). */
export async function compressImage(file, maxEdge = MAX_PHOTO_EDGE, quality = PHOTO_QUALITY) {
  const img = await loadImage(file);
  const { width, height } = fitWithin(img.naturalWidth, img.naturalHeight, maxEdge);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d').drawImage(img, 0, 0, width, height);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Fotku se nepodařilo zpracovat.'))),
      'image/jpeg',
      quality,
    );
  });
}

/**
 * Compresses and uploads a photo. Returns the download URL.
 * Throws an Error with a Czech message the UI can show.
 */
export async function uploadPhoto(file, path) {
  if (!file) throw new Error('Nebyla vybrána žádná fotka.');
  if (!auth.currentUser) throw new Error('Pro nahrání fotky se musíte přihlásit.');
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new Error('Jste offline – fotku teď nejde nahrát.');
  }

  const blob = await compressImage(file);
  try {
    const ref = storageRef(storage, path);
    await uploadBytes(ref, blob, { contentType: 'image/jpeg' });
    return await getDownloadURL(ref);
  } catch (err) {
    console.error('[PhotoService] Upload failed:', err);
    if (err?.code === 'storage/unauthorized') throw new Error('Nemáte oprávnění nahrávat fotky (zkontrolujte pravidla Storage).');
    if (err?.code === 'storage/retry-limit-exceeded') throw new Error('Nahrávání trvalo příliš dlouho – zkontrolujte připojení.');
    throw new Error('Fotku se nepodařilo nahrát do cloudu.');
  }
}
