// Photo helpers: resize maths, storage paths and upload guards.
import { describe, it, expect, vi } from 'vitest';

vi.mock('../src/services/firebase.js', () => ({
  storage: {},
  auth: { currentUser: null },
  storageRef: vi.fn(),
  uploadBytes: vi.fn(),
  getDownloadURL: vi.fn(),
}));

import { fitWithin, photoPath, uploadPhoto } from '../src/services/photoService.js';

describe('fotky', () => {
  it('velkou fotku zmenší na max. 1600 px a zachová poměr stran', () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(3000, 4000)).toEqual({ width: 1200, height: 1600 });
  });

  it('malou fotku nezvětšuje', () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
  });

  it('cesta v úložišti je bezpečná a jedinečná', () => {
    const p = photoPath('damage', 'job-1', 'ji/../5 x');
    expect(p).toMatch(/^damage\/job-1\/ji_5_x\/\d+\.jpg$/);
  });

  it('bez přihlášení fotku nenahraje a vrátí srozumitelnou chybu', async () => {
    await expect(uploadPhoto(new Blob(['x']), 'damage/x.jpg')).rejects.toThrow('přihlásit');
  });

  it('bez vybrané fotky vrátí chybu', async () => {
    await expect(uploadPhoto(null, 'damage/x.jpg')).rejects.toThrow('fotka');
  });
});
