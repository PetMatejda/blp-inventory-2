// Photos without Firebase Storage (Storage needs the paid Blaze plan).
// A photo is shrunk on the phone and stored as its own Firestore document
// photos/{id} = { dataUrl, kind, ... }; records keep only a "photo:<id>" reference.
// Works offline: the write is queued like any other change.
// Moving to Storage later = change savePhoto() and usePhotoSrc() only.
import { useEffect, useState } from 'react';
import { db, auth, doc, collection, setDoc, getDoc } from './firebase.js';

export const PHOTO_REF_PREFIX = 'photo:';
// Firestore documents are limited to 1 MiB; keep photos well below.
export const MAX_DATAURL_LENGTH = 700_000;
const ATTEMPTS = [
  { edge: 1280, quality: 0.72 },
  { edge: 1024, quality: 0.62 },
  { edge: 800, quality: 0.55 },
  { edge: 640, quality: 0.5 },
];

export const isPhotoRef = (src) => typeof src === 'string' && src.startsWith(PHOTO_REF_PREFIX);
export const photoIdFromRef = (src) => (isPhotoRef(src) ? src.slice(PHOTO_REF_PREFIX.length) : null);

/** Target size that keeps the aspect ratio and fits within maxEdge. */
export function fitWithin(width, height, maxEdge) {
  if (!width || !height) return { width: 0, height: 0 };
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

const loadImage = (file) => new Promise((resolve, reject) => {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
  img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Soubor není obrázek, nebo se nedá načíst.')); };
  img.src = url;
});

/**
 * Resizes and re-encodes to JPEG (strips EXIF incl. GPS), shrinking further
 * until it fits into a Firestore document. Returns a data URL.
 */
export async function compressToDataUrl(file, attempts = ATTEMPTS) {
  const img = await loadImage(file);
  for (const { edge, quality } of attempts) {
    const { width, height } = fitWithin(img.naturalWidth, img.naturalHeight, edge);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    if (dataUrl.length <= MAX_DATAURL_LENGTH) return dataUrl;
  }
  throw new Error('Fotka je příliš velká ani po zmenšení.');
}

/**
 * Compresses and saves a photo. Resolves with a "photo:<id>" reference as soon
 * as the photo is stored locally (it is sent to the cloud in the background).
 */
export async function savePhoto(file, meta = {}) {
  if (!file) throw new Error('Nebyla vybrána žádná fotka.');
  if (!auth.currentUser) throw new Error('Pro uložení fotky se musíte přihlásit.');
  const dataUrl = await compressToDataUrl(file);
  const ref = doc(collection(db, 'photos'));
  setDoc(ref, {
    dataUrl,
    kind: meta.kind || 'other',
    jobId: meta.jobId || '',
    itemId: meta.itemId || '',
    createdAt: new Date().toISOString(),
    createdBy: auth.currentUser.email || auth.currentUser.uid,
  }).catch((err) => console.error('[PhotoService] Photo sync failed:', err));
  return `${PHOTO_REF_PREFIX}${ref.id}`;
}

// Resolved photos are kept in memory so lists do not re-read them.
const cache = new Map();

export async function resolvePhoto(src) {
  if (!isPhotoRef(src)) return src || '';
  const id = photoIdFromRef(src);
  if (!cache.has(id)) {
    cache.set(id, getDoc(doc(db, 'photos', id))
      .then((snap) => (snap.exists() ? snap.data().dataUrl || '' : ''))
      .catch(() => { cache.delete(id); return ''; }));
  }
  return cache.get(id);
}

/** React hook: turns a stored image value (URL, data URL or photo ref) into an <img> src. */
export function usePhotoSrc(src) {
  const [resolved, setResolved] = useState(isPhotoRef(src) ? '' : (src || ''));
  useEffect(() => {
    let alive = true;
    if (!isPhotoRef(src)) { setResolved(src || ''); return undefined; }
    setResolved('');
    resolvePhoto(src).then((url) => { if (alive) setResolved(url); });
    return () => { alive = false; };
  }, [src]);
  return resolved;
}
