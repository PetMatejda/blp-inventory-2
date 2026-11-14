import React, { useEffect } from 'react';
import { InventoryProvider, useInventory } from './context/InventoryContext';
import { TopAppBar } from './components/layout/TopAppBar';
import { BottomNavBar } from './components/layout/BottomNavBar';

import { JobDashboard } from './components/dashboard/JobDashboard';
import { PackingList } from './components/packing/PackingList';
import { EquipmentCatalog } from './components/catalog/EquipmentCatalog';
import { ConsumableKit } from './components/bracha/ConsumableKit';
import { AuditTimeline } from './components/audit/AuditTimeline';

import { NewJobModal } from './components/modals/NewJobModal';
import { AdHocModal } from './components/modals/AdHocModal';
import { BarcodeScannerModal } from './components/modals/BarcodeScannerModal';
import { DamageReportModal } from './components/damage/DamageReportModal';
import { RoleSwitcherModal } from './components/modals/RoleSwitcherModal';
import { SettingsModal } from './components/modals/SettingsModal';
import { MasterCatalogModal } from './components/modals/MasterCatalogModal';
import { EditJobModal } from './components/modals/EditJobModal';
import { DuplicateJobModal } from './components/modals/DuplicateJobModal';
import { ContextMenuModal } from './components/modals/ContextMenuModal';
import { AuthModal } from './components/auth/AuthModal';

const ModalLayer = () => {
  const { isAuthModalOpen, setIsAuthModalOpen, currentUser } = useInventory();
  const showAuthModal = isAuthModalOpen || !currentUser;

  return (
    <>
      <NewJobModal />
      <AdHocModal />
      <BarcodeScannerModal />
      <DamageReportModal />
      <RoleSwitcherModal />
      <SettingsModal />
      <MasterCatalogModal />
      <EditJobModal />
      <DuplicateJobModal />
      <ContextMenuModal />

      <AuthModal
        isOpen={showAuthModal}
        isForceAuth={!currentUser}
        onClose={() => {
          if (currentUser) setIsAuthModalOpen(false);
        }}
      />
    </>
  );
};

const MainContent = () => {
  const { activeTab } = useInventory();

  switch (activeTab) {
    case 'dashboard':
      return <JobDashboard />;
    case 'packing':
      return <PackingList />;
    case 'catalog':
      return <EquipmentCatalog />;
    case 'bracha':
      return <ConsumableKit />;
    case 'history':
      return <AuditTimeline />;
    default:
      return <JobDashboard />;
  }
};

/**
 * AuthGate — renders a loading splash until Firebase resolves auth state.
 * Prevents the dashboard from being visible (even briefly) before auth check.
 * Also installs a back-button interceptor so Android PWA back doesn't navigate
 * to the Google OAuth redirect page.
 */
const AuthGate = ({ children }) => {
  const { authLoading } = useInventory();

  // Show branded loading screen while Firebase checks session
  if (authLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center shadow-2xl animate-pulse">
          <span className="text-3xl font-black text-white">B</span>
        </div>
        <p className="text-outline text-sm font-mono">Načítám...</p>
      </div>
    );
  }

  return children;
};


class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary caught error]:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white p-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400 mb-4">
            <span className="text-2xl font-bold">!</span>
          </div>
          <h2 className="text-xl font-bold mb-2">Nastala neočekávaná chyba</h2>
          <p className="text-sm text-slate-400 max-w-md mb-6 font-mono text-xs bg-black/40 p-3 rounded-xl border border-white/10 overflow-auto">
            {this.state.error?.message || 'Neznámá chyba'}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-5 py-2.5 bg-emerald-500 text-black font-bold text-sm rounded-xl active:scale-95 shadow"
          >
            Načíst aplikaci znovu
          </button>
          <button
            onClick={() => {
              if (window.confirm('Smazat data uložená v tomto telefonu a načíst je znovu z cloudu?\n\nZměny, které se ještě neodeslaly do cloudu, budou ztraceny.')) {
                ['blp_jobs_v2', 'blp_job_items_v2', 'blp_catalog_v2', 'blp_consumables_v2', 'blp_audit_logs_v2']
                  .forEach((key) => localStorage.removeItem(key));
                window.location.reload();
              }
            }}
            className="mt-4 text-xs text-slate-400 underline"
          >
            Nepomohlo to? Smazat data v telefonu a stáhnout z cloudu
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const GlobalNoticeToast = () => {
  const { syncNotice } = useInventory();
  if (!syncNotice) return null;

  return (
    <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 max-w-sm w-11/12 pointer-events-none animate-in fade-in slide-in-from-top-4 duration-200">
      <div className="bg-slate-900/95 dark:bg-zinc-900/95 backdrop-blur-md text-white px-4 py-2.5 rounded-2xl shadow-2xl border border-white/20 text-xs font-semibold text-center flex items-center justify-center gap-2">
        <span>{syncNotice}</span>
      </div>
    </div>
  );
};

export function App() {
  return (
    <ErrorBoundary>
      <InventoryProvider>
        <AuthGate>
          <div className="min-h-screen flex flex-col bg-background text-on-surface">
            {/* Global toast notifications */}
            <GlobalNoticeToast />

            {/* Fixed Top Bar — h-14 (56px) */}
            <TopAppBar />

            {/* Main Dynamic View — fills space between TopAppBar and BottomNavBar */}
            <main className="flex-1 w-full max-w-5xl mx-auto">
              <MainContent />
            </main>


            {/* Bottom Mobile & Desktop Navigation — fixed, h-16 */}
            <BottomNavBar />

            {/* Dialog & Modal Layer */}
            <ModalLayer />
          </div>
        </AuthGate>
      </InventoryProvider>
    </ErrorBoundary>
  );
}


export default App;
