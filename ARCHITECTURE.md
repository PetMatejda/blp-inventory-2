# BLP Inventory 2.0 - Complete Architecture & Technical Reference

This document provides a comprehensive technical overview of the **BLP Inventory 2.0** application architecture, hosting, database schema, data synchronization, authentication, and state management. It is designed for developers and AI coding agents (such as Claude Code, Cursor, or Codex) to quickly understand the entire codebase.

---

## 1. Project Overview & Hosting Architecture

**BLP Inventory 2.0** is an interactive, real-time inventory management application tailored for film production crews, lead gaffers, riggers, and equipment warehouse managers. It manages film lighting gear, grip equipment, cables, power distribution, vehicle assignments, and consumable supplies across filming locations.

### Deployment & Infrastructure

- **Web Application**: Hosted on **Vercel**, auto-deployed from the `main` branch of GitHub repository [`https://github.com/PetMatejda/blp-inventory-2`](https://github.com/PetMatejda/blp-inventory-2).
- **Android Mobile Application**: Implemented via **PWA / WebAPK** architecture. The web app contains a fully compliant PWA Web App Manifest (`public/manifest.json`) and service worker hooks, allowing users to install it on Android devices as a native standalone app with custom film studio icons (`public/icon-192.png`, `public/icon-512.png`). Both web and mobile versions share **100% identical codebase and cloud database**.
- **Build Toolchain**: React 18, Vite 5, Tailwind CSS, Lucide React icons.

---

## 2. Cloud Backend & Firebase Architecture

- **Firebase Project ID**: `blp-inventory` (free Spark plan — no Cloud Storage)
- **Auth Domain**: `blp-inventory.firebaseapp.com`

### Database Schema (Cloud Firestore) — one document per record

| Collection | Document | Notes |
|---|---|---|
| `jobs/{id}` | `name, client, assignedGaffer, blpResponsible, riggingDate, deriggingDate, status (ACTIVE/ARCHIVED), mode (LOADING/DERIGGING), vehicleIds, updatedAt, updatedBy` | |
| `jobItems/{id}` | `jobId, catalogId, name, category, quantityRequested, quantityLoaded, status, serialNumber, barcode, isAdHoc, bundleTag, damageSeverity, damageNotes, photoUrls, updatedAt, updatedBy` | |
| `catalog/{id}` | `name, category, weight, power, image, serialPrefix, barcode, availableCount, isBundle, bundleItems` | |
| `consumables/{id}` | `name, category, state (0 OK / 1 50% / 2 REFILL), stateLabel` | |
| `auditLogs/{id}` | `timestamp, user, jobId, action, detail, type` | append-only (rules) |
| `photos/{id}` | `dataUrl (JPEG ≤ ~700 kB), kind, jobId, itemId, createdAt, createdBy` | referenced as `photo:<id>` |
| `stockLevels/{catalogId}` | `inStock, onJob, inService, missing` — counts change only via atomic `increment()` | |
| `stockUnits/{id}` | `catalogId, code, serialNumber, status (IN_STOCK/IN_SERVICE/RETIRED)` — labelled units (lights, ballasts) | |
| `movements/{id}` | `type (INIT/RECEIPT/ISSUE/RETURN/MISSING/TO_SERVICE/FROM_SERVICE/RETIRE/STOCKTAKE), catalogId, qty, jobId, unitCode, note, user, timestamp` | append-only |
| `stocktakes/{id}` | `status (OPEN/APPROVED/CANCELLED), category, startedBy, approvedBy, summary, differences` | |
| `stocktakeLines/{stocktakeId_catalogId}` | `expected (snapshot), counted / scannedUnitIds + extraCount, open` | |
| `meta/migration_v3` | `status (running/done), startedAt, finishedAt, by, counts` | one-time migration marker |
| `users/{uid}` | `uid, name, email, role, avatar, updatedAt` | own profile only |
| `inventory_store/blp_main_store` | legacy single document | **read-only backup** after migration |

**Photos** are stored as Firestore documents (Storage needs the paid Blaze plan). `photoService.savePhoto()` shrinks a photo on the phone (max 1280 px JPEG, EXIF/GPS stripped, re-compressed until it fits) and returns `photo:<id>`; `usePhotoSrc()` / `ItemThumbnail` resolve it. Moving to Storage later only touches `photoService.js`.

---

## 3. Data Layer & Offline Sync

```
Screen ──► InventoryContext (same API as before)
              │ actions                 ▲ live data (onSnapshot per collection)
              ▼                         │
        inventoryActions.js ──► inventoryRepo.js ──► Firestore SDK + persistent cache (IndexedDB)
        (rules: domain/items.js)                         │  queued writes survive restarts/offline
                                                         ▼
                                                   Cloud Firestore ──► other devices (realtime)
```

- **Offline first by the SDK**: `firebase.js` initialises Firestore with `persistentLocalCache` (multi-tab). Writes apply locally at once, are queued while offline and sent when the device is back online. No custom localStorage cache, merge or tombstones.
- **Per-record writes**: each action updates only the affected documents (plus an audit entry) in one batch, so two people editing different items never overwrite each other. Same-document conflicts are last-write-wins per field set.
- **Sync status**: `hasPendingWrites` from snapshot metadata → `syncStatus` (`synced` / `syncing` / `offline` / `error`). "Odeslat a ověřit" calls `waitForPendingWrites`.
- **Business rules** live in `src/domain/items.js` as pure functions (state machine, bundles, templates) and are unit-tested.
- **Migration** (`src/services/migration.js`): on first sign-in of an approved user, a transaction claims `meta/migration_v3`, the legacy document is converted (deleted records skipped via tombstones, duplicates merged, IDs made unique, audit trimmed to 300) and written in batches of ≤ 400. Other devices skip it. The legacy document is never modified.

---

### Warehouse (Sklad)

- **Tracking**: lights and ballasts per unit (labels, `stockUnits`), everything else by count; switchable per catalog item (`catalog.trackingType`). Locations: warehouse, job, service (+ missing).
- **Job cycle** (`src/services/stockActions.js`, rules in `src/domain/stock.js`):
  `LOADING` → *Zahájit derigging* issues loaded pieces (`job.issued`, `ISSUE` movements) → `DERIGGING` → *Zahájit naskladnění* (`RESTOCK`, counts start at 0) → *Dokončit naskladnění*: returned → warehouse, damaged → service, rest → missing; job archived. Going back to rigging cancels the issue. Jobs started before stock tracking (no `job.issued`) do not change counts except damaged → service.
- **Availability**: owned (warehouse + jobs + service) − requested by other ACTIVE jobs overlapping in dates − requested here; shortage shown on item cards while rigging and when adding from the catalog.
- **Stocktake**: lines snapshot the expected warehouse count; several people count at once (scanned units via `arrayUnion`); approval applies `counted − expected` as an increment (deliveries during the count are kept) and settles pieces recorded as missing. CSV exports for stock, movements and stocktakes.
- **Job progress** is counted in pieces.
- **Hardware barcode readers** (`src/hooks/useBarcodeScanner.js`): USB/Bluetooth readers type fast + Enter; a burst detector turns that into a scan anywhere on the screen (not while typing in a field or with a dialog open). Packing → `scanOnJob`; Sklad › Stav → item detail; Inventura → unit counted / count dialog; Katalog → add to the selected job.
- **Catalog repair** (`migration.restoreCatalog`): "Obnovit / Doplnit katalog" (Sklad › Katalog header, empty states, Settings › Stav dat) copies missing items from the legacy backup document or, when that has none, the built-in default catalog, and rebuilds entries for catalog ids used on jobs but missing everywhere (`catalogFromJobItems`, `restoredFromJobs: true`). Existing items are never overwritten.
- **Local cache maintenance** (`src/services/cacheMaintenance.js`): Firestore uses a single-tab persistent cache (`persistentSingleTabManager`; other tabs use memory). `…/?reset-cache=1` (or Settings › "Vymazat offline data") deletes the Firestore IndexedDB cache **before** Firebase starts (`main.jsx` loads the app afterwards) — the fix for a damaged cache that hangs the page / "Out of Memory". Legacy localStorage keys of the single-document version are removed at start.
- **Brácha refill order** (`src/domain/refill.js`, `RefillOrderSheet.jsx`): missing (and optionally 50 %) consumables as text → share / copy / e-mail; logged in history.
- **Bundle**: camera scanner (`html5-qrcode`), PDF, QR generator and the Sklad / Brácha / Historie screens load on demand; Firebase and React are separate cached chunks.
- **Labels & scanning** (`src/domain/labels-qr.js`, `stockActions.scanOnJob`, `LabelPrint.jsx`):
  - Payloads: labelled unit → its code (`FLT-MOD-001`); item tracked by count → `BLP:<catalogId>`; EAN and serial numbers still work.
  - *Vytvořit štítky* labels pieces already in stock (no count change, `LABEL` movement); codes `<serialPrefix>-001…`.
  - Print: A4 sheet 3 × 8 labels 70 × 37 mm (`#label-print` print CSS in `index.css`), QR via `qrcode` (loaded on demand).
  - Scan on a job by phase: Rigging +1 and the unit is recorded on the job (`jobItems.unitIds`, `stockUnits.jobId`), never twice, service/retired refused; Derigging packs (`packedUnitIds`, line packed when all pieces scanned); Restock +1 back (`returnedUnitIds`, unit leaves the job). Units not scanned back are set `MISSING` and listed by code; a stocktake scan or setting the unit back to "Ve skladu" (`FOUND` movement) returns them.

---

## 4. Authentication & Authorization

Implemented in `src/services/firebaseAuth.js` and `src/components/auth/AuthModal.jsx`:

- **Google OAuth** (popup, redirect fallback for WebViews) and **e-mail + password**. E-mail accounts must verify their address (verification link sent on registration / login).
- **Access control is in Firestore rules** (`firestore.rules`): only signed-in users with a **verified e-mail on the approved list** can read or write data. To add a team member, add the e-mail to the list and publish the rules (Firebase Console → Firestore → Rules).
- The shared test login (`blp/blpblp`) and anonymous sessions were removed.
- Session persists via `browserLocalPersistence`; a `null` Firebase user means signed out.
- Roles: everybody is `ADMIN` for now (`isAdmin()` returns true).

---

## 5. Modes & Operational Rules

### Job Modes

Jobs can operate in two distinct modes:

1. **`LOADING` Mode (Ze skladu na plac)**:
   - Progress Bar: **Emerald Green (`bg-emerald-500`)** labeled `PRŮBĚH NAKLÁDKY (NA PLACE)`.
   - Right Swipe: Sets status to `LOADED` (Na place / Naloženo).
   - Left Swipe: Resets status to `PENDING` (K naložení).
2. **`DERIGGING` Mode (Vracení z placu do auta/skladu)**:
   - Progress Bar: **Cyan Blue (`bg-cyan-400`)** labeled `PRŮBĚH DERIGGINGU (SBALENO K ODVOZU)`.
   - Right Swipe: Sets status to `PACKED` (Sbaleno k odvozu).
   - Left Swipe: Returns item status to `LOADED` (Na place / Naloženo).

### Item Card UI & Status Accent Bars

Item cards in `ItemSwipeCard.jsx` feature a dedicated 12px left accent bar with explicit status colors:
- 🟢 **Emerald Green (`#10b981`)**: `LOADED`
- 🔷 **Cyan Blue (`#06b6d4`)**: `PACKED`
- 🔴 **Bright Red (`#ef4444`)**: `DAMAGED`
- 🔘 **Slate Gray (`#475569`)**: `PENDING`

### Thumbnail Fallback System

Catalog items may carry an `icon` (equipment type: balloon shapes, LED panel / net, ballast, cable, fan…; list in `ITEM_ICONS`, `src/utils/categoryIcons.jsx`). `getItemMeta(item)` returns the category label/colour with that icon; without one the category icon is used. Job items copy the icon from the catalog.

### ZapSklad import

`scripts/zapsklad/`: `read_xlsx.py` (Excel export → JSON) → `build-plan.mjs` (merges names into models, category, icon, SERIAL/QUANTITY, labelled units with the old inventory number as code) → `upload.mjs` (admin write via `gcloud auth print-access-token`). IDs are deterministic (`zs-…`), so a fresh export re-imports over the same records. The built-in demo catalog is no longer used by "Obnovit katalog".

Component `src/components/common/ItemThumbnail.jsx` renders image previews. If an image fails to load (404, CORS, offline), it automatically renders a styled category icon card (e.g. Light bulb for Lights, Tripod for Grip, Cable plug for Cables). Photos taken in the app (`photo:<id>`) are resolved through `usePhotoSrc()`.

---

## 6. Directory Structure & Key Files

```
blp-inventory-2/
├── src/
│   ├── domain/items.js              # Item state machine, bundles, templates (pure, tested)
│   ├── services/
│   │   ├── firebase.js              # Firebase init, Firestore persistent cache, emulator switch
│   │   ├── firebaseAuth.js          # Google / e-mail auth
│   │   ├── inventoryRepo.js         # Firestore collections: listeners + writes
│   │   ├── inventoryActions.js      # Everything a user can do (writes + audit)
│   │   ├── migration.js             # One-time legacy document → collections
│   │   ├── tombstones.js            # Legacy deletion markers (used by migration only)
│   │   ├── photoService.js          # Photos as Firestore docs, usePhotoSrc()
│   │   └── pdfService.js            # Handover protocol PDF
│   ├── context/InventoryContext.jsx # React state from live data, action API for screens
│   └── components/…                 # Screens and modals
├── tests/                           # Vitest unit tests (npm test)
├── tests-rules/                     # Firestore rules tests (emulator)
├── scripts/emulator-seed.mjs        # Seeds local emulators with legacy data + test user
├── firestore.rules                  # Security rules (publish in Firebase Console)
├── firebase.json                    # Emulator config
└── .github/workflows/ci.yml         # CI: tests, build, rules tests
```

---

## 7. Developer & Build Commands

- `npm run dev` — development server
- `npm run build` — production build (`dist/`)
- `npm test` — unit tests (domain, actions, migration, photos, protocol)
- `npm run test:rules:emulator` — Firestore rules tests (needs Java; CI runs them)
- **Local testing against emulators** (never touches production data):
  1. `npm run emulators` (needs Java, e.g. Android Studio's `jbr` via `JAVA_HOME`)
  2. `node scripts/emulator-seed.mjs` — legacy data + test user `admin@blp.cz` / `emulator-test-123`
  3. `VITE_USE_EMULATORS=true VITE_FIREBASE_PROJECT_ID=demo-blp npm run dev`
- **Note**: npm/Vite may fail inside the OneDrive folder (OneDrive locks `node_modules`); keep the working copy outside OneDrive.
- **Git Repository**: `https://github.com/PetMatejda/blp-inventory-2.git`
