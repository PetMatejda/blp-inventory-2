# Project Instructions for AI Coding Agents (Claude Code / Cursor / Codex)

Welcome to **BLP Inventory 2.0**!

A comprehensive, detailed architectural blueprint and technical guide has been prepared for you in [`ARCHITECTURE.md`](./ARCHITECTURE.md).

## Quick Reference Summary

- **App Purpose**: Real-time film lighting & grip gear inventory management system.
- **Tech Stack**: React 18, Vite 5, Tailwind CSS, Lucide Icons, Google Cloud Firestore, Firebase Auth.
- **Deployment**: Hosted on **Vercel** (Auto-deploys from GitHub `PetMatejda/blp-inventory-2`, branch `main`).
- **Android Support**: PWA / WebAPK container with custom studio film icons (`public/icon-192.png`, `public/icon-512.png`). Web and Android app share 100% identical codebase and cloud database.
- **Cloud Database**: Firestore collections, one document per record: `jobs`, `jobItems`, `catalog`, `consumables`, `auditLogs` (append-only), `photos` (photos as JPEG data URLs — no Cloud Storage on the free plan). The legacy single document `/inventory_store/blp_main_store` is a read-only backup migrated once by `src/services/migration.js`.
- **Vehicles**: `vehicles` (STK `stkDue` as `YYYY-MM` or date, vignette `vignetteDue`); Settings › Vozidla, warnings on the dashboard and in the job forms (`src/domain/vehicles.js`).
- **Warehouse**: `stockLevels`, `stockUnits`, `movements` (append-only), `stocktakes`, `stocktakeLines`; job phases `LOADING → DERIGGING → RESTOCK` issue and return stock (see ARCHITECTURE.md › Warehouse).
- **Realtime & Offline**: Firestore persistent cache (IndexedDB) + `onSnapshot` per collection. Writes apply locally immediately and are queued offline by the SDK — no custom sync/merge layer.
- **Access**: `firestore.rules` — only verified e-mails on the approved list.
- **Tests**: `npm test` (unit), `npm run test:rules:emulator` (rules, needs Java). CI runs both.

## Key Files to Understand

1. [`src/context/InventoryContext.jsx`](./src/context/InventoryContext.jsx) - Central state from live Firestore data, auth listener, action API used by all screens.
2. [`src/services/inventoryActions.js`](./src/services/inventoryActions.js) - Every user action (writes + audit) against the repo interface.
3. [`src/domain/items.js`](./src/domain/items.js) - Item state machine (pure functions, spec section 4).
3b. [`src/services/inventoryRepo.js`](./src/services/inventoryRepo.js) - Firestore listeners and batched writes.
4. [`src/components/packing/ItemSwipeCard.jsx`](./src/components/packing/ItemSwipeCard.jsx) - Item card with 40px swipe threshold, explicit 12px status accent stripes (`#10b981` LOADED, `#06b6d4` PACKED, `#ef4444` DAMAGED, `#475569` PENDING).
5. [`src/components/dashboard/JobDashboard.jsx`](./src/components/dashboard/JobDashboard.jsx) - Project dashboard with mode-aware progress bars (Emerald Green for LOADING vs Cyan Blue for DERIGGING).
6. [`src/components/common/ItemThumbnail.jsx`](./src/components/common/ItemThumbnail.jsx) - Thumbnail image preview component with automatic Category Icon fallback.

Please consult [`ARCHITECTURE.md`](./ARCHITECTURE.md) for complete details on database schemas, mode rules, role authorization, and code patterns.
