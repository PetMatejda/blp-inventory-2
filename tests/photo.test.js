// Photos stored as Firestore documents: resize maths, references, guards, resolving.
import { describe, it, expect, vi } from 'vitest';

vi.mock('../src/services/firebase.js', () => ({
  db: {},
  auth: { currentUser: null },
  doc: vi.fn((_db, col, id) => ({ col, id })),
  collection: vi.fn(),
  setDoc: vi.fn(),
  getDoc: vi.fn(async ({ id }) => ({
    exists: () => id === 'known',
    data: () => ({ dataUrl: 'data:image/jpeg;base64,AAA' }),
  })),
}));

import { fitWithin, isPhotoRef, photoIdFromRef, savePhoto, resolvePhoto } from '../src/services/photoService.js';

describe('fotky', () => {
  it('velkou fotku zmenší na zadanou hranu a zachová poměr stran', () => {
    expect(fitWithin(4000, 3000, 1280)).toEqual({ width: 1280, height: 960 });
    expect(fitWithin(3000, 4000, 1280)).toEqual({ width: 960, height: 1280 });
  });

  it('malou fotku nezvětšuje', () => {
    expect(fitWithin(800, 600, 1280)).toEqual({ width: 800, height: 600 });
  });

  it('rozpozná odkaz na fotku uloženou v aplikaci', () => {
    expect(isPhotoRef('photo:abc')).toBe(true);
    expect(isPhotoRef('https://x/y.jpg')).toBe(false);
    expect(photoIdFromRef('photo:abc')).toBe('abc');
  });

  it('bez přihlášení fotku neuloží a vrátí srozumitelnou chybu', async () => {
    await expect(savePhoto(new Blob(['x']))).rejects.toThrow('přihlásit');
  });

  it('bez vybrané fotky vrátí chybu', async () => {
    await expect(savePhoto(null)).rejects.toThrow('fotka');
  });

  it('odkaz převede na obrázek, běžnou URL nechá být', async () => {
    expect(await resolvePhoto('photo:known')).toBe('data:image/jpeg;base64,AAA');
    expect(await resolvePhoto('photo:missing')).toBe('');
    expect(await resolvePhoto('https://x/y.jpg')).toBe('https://x/y.jpg');
  });
});
