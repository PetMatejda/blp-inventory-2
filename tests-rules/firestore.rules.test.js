// Firestore security rules (firestore.rules) tested against the emulator.
import { readFileSync } from 'node:fs';
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  initializeTestEnvironment, assertSucceeds, assertFails,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';

let env;

const approved = { email: 'petmatejda@gmail.com', email_verified: true };
const db = (uid, token) => (uid ? env.authenticatedContext(uid, token) : env.unauthenticatedContext()).firestore();
const member = () => db('member', approved);

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-blp',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});

afterAll(async () => { await env?.cleanup(); });

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const admin = ctx.firestore();
    await setDoc(doc(admin, 'jobs/job-1'), { name: 'Zakázka' });
    await setDoc(doc(admin, 'auditLogs/log-1'), { action: 'a', timestamp: '2026-11-01' });
    await setDoc(doc(admin, 'photos/p1'), { dataUrl: 'data:image/jpeg;base64,AAA' });
    await setDoc(doc(admin, 'inventory_store/blp_main_store'), { jobs: [] });
  });
});

describe('přístup k datům', () => {
  it('nepřihlášený nic nepřečte ani nezapíše', async () => {
    await assertFails(getDoc(doc(db(null), 'jobs/job-1')));
    await assertFails(setDoc(doc(db(null), 'jobs/x'), { name: 'x' }));
  });

  it('schválený ověřený e-mail čte i zapisuje zakázky, položky, katalog, spotřebák', async () => {
    await assertSucceeds(getDoc(doc(member(), 'jobs/job-1')));
    for (const col of ['jobs', 'jobItems', 'catalog', 'consumables']) {
      await assertSucceeds(setDoc(doc(member(), `${col}/new`), { name: 'x' }));
    }
  });

  it('velikost písmen v e-mailu nevadí', async () => {
    await assertSucceeds(getDoc(doc(db('u', { email: 'PetMatejda@Gmail.com', email_verified: true }), 'jobs/job-1')));
  });

  it('neověřený e-mail ze seznamu nemá přístup', async () => {
    await assertFails(getDoc(doc(db('u', { email: 'petmatejda@gmail.com', email_verified: false }), 'jobs/job-1')));
  });

  it('ověřený e-mail mimo seznam nemá přístup', async () => {
    await assertFails(getDoc(doc(db('u', { email: 'cizi@example.com', email_verified: true }), 'jobs/job-1')));
  });

  it('neznámá kolekce je zakázaná i schváleným', async () => {
    await assertFails(setDoc(doc(member(), 'whatever/x'), { a: 1 }));
  });
});

describe('auditní log je neměnný', () => {
  it('nový záznam jde přidat', async () => {
    await assertSucceeds(setDoc(doc(member(), 'auditLogs/log-2'), { action: 'b', timestamp: '2026-11-02' }));
  });
  it('existující záznam nejde změnit ani smazat', async () => {
    await assertFails(updateDoc(doc(member(), 'auditLogs/log-1'), { action: 'přepsáno' }));
    await assertFails(deleteDoc(doc(member(), 'auditLogs/log-1')));
  });
  it('opakovaný zápis stejných dat (opakovaná migrace) projde', async () => {
    await assertSucceeds(setDoc(doc(member(), 'auditLogs/log-1'), { action: 'a', timestamp: '2026-11-01' }));
  });
});

describe('sklad', () => {
  it('schválený uživatel čte a zapisuje stav skladu, kusy a inventury', async () => {
    for (const col of ['stockLevels', 'stockUnits', 'stocktakes', 'stocktakeLines']) {
      await assertSucceeds(setDoc(doc(member(), `${col}/x`), { a: 1 }));
      await assertSucceeds(getDoc(doc(member(), `${col}/x`)));
    }
  });
  it('cizí účet sklad nevidí', async () => {
    await assertFails(getDoc(doc(db('u', { email: 'cizi@example.com', email_verified: true }), 'stockLevels/x')));
  });
  it('pohyby skladu jdou jen přidávat', async () => {
    await assertSucceeds(setDoc(doc(member(), 'movements/m1'), { type: 'RECEIPT', qty: 1 }));
    await assertFails(updateDoc(doc(member(), 'movements/m1'), { qty: 99 }));
    await assertFails(deleteDoc(doc(member(), 'movements/m1')));
  });
});

describe('fotky', () => {
  it('JPEG fotku jde uložit', async () => {
    await assertSucceeds(setDoc(doc(member(), 'photos/p2'), { dataUrl: 'data:image/jpeg;base64,BBB', kind: 'damage' }));
  });
  it('jiný obsah než JPEG obrázek je odmítnut', async () => {
    await assertFails(setDoc(doc(member(), 'photos/p3'), { dataUrl: '<script>alert(1)</script>' }));
    await assertFails(setDoc(doc(member(), 'photos/p4'), { kind: 'damage' }));
  });
  it('příliš velká fotka je odmítnuta', async () => {
    await assertFails(setDoc(doc(member(), 'photos/p5'), { dataUrl: 'data:image/jpeg;base64,' + 'A'.repeat(1_000_000) }));
  });
  it('uloženou fotku nejde přepsat ani smazat', async () => {
    await assertFails(setDoc(doc(member(), 'photos/p1'), { dataUrl: 'data:image/jpeg;base64,CCC' }));
    await assertFails(deleteDoc(doc(member(), 'photos/p1')));
  });
});

describe('starý sdílený dokument a profily', () => {
  it('starý dokument jde číst, ale ne zapisovat', async () => {
    await assertSucceeds(getDoc(doc(member(), 'inventory_store/blp_main_store')));
    await assertFails(setDoc(doc(member(), 'inventory_store/blp_main_store'), { jobs: ['x'] }));
  });
  it('uživatel zapisuje jen vlastní profil', async () => {
    await assertSucceeds(setDoc(doc(db('me', { email: 'cizi@example.com', email_verified: true }), 'users/me'), { name: 'Já' }));
    await assertFails(setDoc(doc(member(), 'users/someone-else'), { name: 'X' }));
  });
});
