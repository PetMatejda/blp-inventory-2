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

- **Firebase Project ID**: `blp-inventory`
- **Auth Domain**: `blp-inventory.firebaseapp.com`
- **Storage Bucket**: `blp-inventory.firebasestorage.app`

### Database Schema (Cloud Firestore)

All persistent application state is stored in Google Cloud Firestore under two main structures:

1. **Global Inventory Store Document**:
   - Path: `/inventory_store/blp_main_store`
   - Contains:
     - `jobs`: Array of job project objects (`id`, `name`, `client`, `assignedGaffer`, `riggingDate`, `deriggingDate`, `status`, `mode`, `vehicleIds`).
     - `jobItems`: Array of equipment items assigned to jobs (`id`, `jobId`, `catalogId`, `name`, `category`, `quantityRequested`, `quantityLoaded`, `status`, `serialNumber`, `isBundle`, `bundleItems`, `damageNotes`, `photoUrls`).
     - `catalog`: Array of master equipment catalog items (`id`, `name`, `category`, `weight`, `power`, `image`, `serialPrefix`, `availableCount`, `isBundle`, `bundleItems`).
     - `consumables`: Array of consumable supplies (`id`, `name`, `category`, `state`, `stateLabel`).
     - `auditLogs`: Array of timestamped action logs (`id`, `timestamp`, `user`, `jobId`, `action`, `detail`, `type`).
     - `updatedAt`: ISO timestamp of the last database modification.

2. **User Profiles Collection**:
   - Path: `/users/{uid}`
   - Contains: `{ uid, name, email, role, avatar, updatedAt }`.

---

## 3. Realtime Dual-Layer Data Synchronization

The application uses a **dual-layer synchronization strategy** (Local Cache + Realtime Firestore Listener):

```
┌─────────────────────────────────────────────────────────┐
│                    User Action                          │
│        (Swipe Card, Stepper Qty, Add Item)              │
└────────────────────────────┬────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────┐
│               Local Storage & Context                   │
│          Instant UI Update (< 16ms render)              │
└────────────────────────────┬────────────────────────────┘
                             │ (50ms fast push)
                             ▼
┌─────────────────────────────────────────────────────────┐
│                 Firebase Cloud Firestore                │
│             Doc: /inventory_store/blp_main_store        │
└────────────────────────────┬────────────────────────────┘
                             │ (onSnapshot Realtime Event)
                             ▼
┌─────────────────────────────────────────────────────────┐
│              Remote Devices (Web / Mobile)              │
│       Filtered by hasPendingWrites -> Live Sync         │
└─────────────────────────────────────────────────────────┘
```

### Sync Safety Mechanisms

- **Metadata Filter (`hasPendingWrites`)**: In `src/services/firebaseDb.js`, `subscribeToCloud` sets `{ includeMetadataChanges: true }` and ignores snapshots where `snap.metadata.hasPendingWrites === true`. This prevents local uncommitted writes from echoing back and overwriting local component state.
- **Tab Focus Auto-Pull**: `InventoryContext.jsx` registers listeners on `visibilitychange` and `focus`. When a user unlocks their mobile phone or switches back to the app tab, `firebaseDb.pullFromCloud()` automatically fetches the newest server payload.
- **Manual Force Sync**: The top navigation bar and settings modal contain a 1-click **🔄 Force Sync** button that triggers `forceSyncAll()` (`syncToCloudManual` + `syncFromCloudManual`).

---

## 4. Authentication & Authorization

Implemented in `src/services/firebaseAuth.js` and `src/components/auth/AuthModal.jsx`:

- **Google OAuth**: `signInWithPopup(auth, googleProvider)` with an automatic fallback to `signInWithRedirect` for mobile WebViews or browsers with popup blockers.
- **Email & Password**: Standard Firebase Auth sign-in and registration with error translation in Czech.
- **Roles**:
  - `ADMIN` (Lead Gaffer): Full access to create/edit/delete jobs, archive jobs, edit master catalog, duplicate jobs as templates.
  - `USER` (Crew Member): Access restricted to operational tasks (Packing list swiping, stepper quantity adjustments, damage reporting, consumable updates).
- **Auto-Admin Whitelist**: Users with email `petmatejda@gmail.com` or containing `petr`/`gaffer`/`admin` are automatically assigned `ADMIN` status.

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

Component `src/components/common/ItemThumbnail.jsx` renders image previews. If an image fails to load (404, CORS, offline), it automatically renders a styled category icon card (e.g. Light bulb for Lights, Tripod for Grip, Cable plug for Cables).

---

## 6. Directory Structure & Key Files

```
blp-inventory-2/
├── public/
│   ├── manifest.json              # PWA Manifest for Android WebAPK
│   ├── icon-192.png               # Android App Icon (192x192)
│   └── icon-512.png               # Android App Icon (512x512)
├── src/
│   ├── components/
│   │   ├── auth/
│   │   │   └── AuthModal.jsx      # Authentication Modal (Login/Register/Logout)
│   │   ├── catalog/
│   │   │   └── EquipmentCatalog.jsx # Master Equipment Catalog & Bundle Viewer
│   │   ├── common/
│   │   │   └── ItemThumbnail.jsx  # Image preview with Category Icon fallback
│   │   ├── dashboard/
│   │   │   └── JobDashboard.jsx   # Project Dashboard & Mode Progress Bars
│   │   ├── layout/
│   │   │   └── TopAppBar.jsx      # Navigation bar, User Profile, Sync Status
│   │   ├── modals/
│   │   │   └── SettingsModal.jsx  # App Settings, Manual Cloud Sync, PWA Installer
│   │   └── packing/
│   │       ├── ItemSwipeCard.jsx  # Swipeable Item Card (40px threshold)
│   │       └── PackingList.jsx    # Main Equipment Packing View
│   ├── context/
│   │   └── InventoryContext.jsx   # React Context & Central State Controller
│   ├── services/
│   │   ├── firebase.js            # Firebase App, Auth & Firestore Initialization
│   │   ├── firebaseAuth.js        # Authentication Handlers (Google / Email)
│   │   ├── firebaseDb.js          # Firestore Realtime Listeners & Push/Pull
│   │   └── storageService.js      # Local Cache, Consolidation & Audit Logging
│   ├── mockData/
│   │   └── initialData.js         # Fallback Initial Catalog & Job Data
│   └── App.jsx                    # Root App Component & Auth Modal Guard
├── vercel.json                    # Vercel SSR/Build Configuration
├── vite.config.js                 # Vite Bundler Config
└── package.json                   # Dependencies & Scripts
```

---

## 7. Developer & Build Commands

- **Development Server**: `npm run dev` (Runs locally on `http://localhost:3000` or `5173`)
- **Production Build**: `npm run build` (Outputs to `dist/`)
- **Preview Build**: `npm run preview`
- **Git Repository**: `https://github.com/PetMatejda/blp-inventory-2.git`
