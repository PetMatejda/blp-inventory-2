# Project Instructions for AI Coding Agents (Claude Code / Cursor / Codex)

Welcome to **BLP Inventory 2.0**!

A comprehensive, detailed architectural blueprint and technical guide has been prepared for you in [`ARCHITECTURE.md`](./ARCHITECTURE.md).

## Quick Reference Summary

- **App Purpose**: Real-time film lighting & grip gear inventory management system.
- **Tech Stack**: React 18, Vite 5, Tailwind CSS, Lucide Icons, Google Cloud Firestore, Firebase Auth.
- **Deployment**: Hosted on **Vercel** (Auto-deploys from GitHub `PetMatejda/blp-inventory-2`, branch `main`).
- **Android Support**: PWA / WebAPK container with custom studio film icons (`public/icon-192.png`, `public/icon-512.png`). Web and Android app share 100% identical codebase and cloud database.
- **Cloud Database**: Firestore Document `/inventory_store/blp_main_store` stores the global state (`jobs`, `jobItems`, `catalog`, `consumables`, `auditLogs`).
- **Realtime Sync**:
  - `firebaseDb.subscribeToCloud()` listens to `/inventory_store/blp_main_store` with `{ includeMetadataChanges: true }`.
  - Pending local writes (`snap.metadata.hasPendingWrites`) are ignored to prevent echo loops.
  - `visibilitychange` & `focus` events automatically pull fresh cloud data when unlocking phone or returning to tab.

## Key Files to Understand

1. [`src/context/InventoryContext.jsx`](./src/context/InventoryContext.jsx) - Central state controller, realtime cloud listener, auth listener, action dispatches.
2. [`src/services/firebaseDb.js`](./src/services/firebaseDb.js) - Firestore `pushPayload`, `pullFromCloud`, `subscribeToCloud`.
3. [`src/services/storageService.js`](./src/services/storageService.js) - Local cache layer, item consolidation, audit logs, 50ms fast push trigger.
4. [`src/components/packing/ItemSwipeCard.jsx`](./src/components/packing/ItemSwipeCard.jsx) - Item card with 40px swipe threshold, explicit 12px status accent stripes (`#10b981` LOADED, `#06b6d4` PACKED, `#ef4444` DAMAGED, `#475569` PENDING).
5. [`src/components/dashboard/JobDashboard.jsx`](./src/components/dashboard/JobDashboard.jsx) - Project dashboard with mode-aware progress bars (Emerald Green for LOADING vs Cyan Blue for DERIGGING).
6. [`src/components/common/ItemThumbnail.jsx`](./src/components/common/ItemThumbnail.jsx) - Thumbnail image preview component with automatic Category Icon fallback.

Please consult [`ARCHITECTURE.md`](./ARCHITECTURE.md) for complete details on database schemas, mode rules, role authorization, and code patterns.
