import React, { useEffect, lazy, Suspense } from 'react';
import { InventoryProvider, useInventory } from './context/InventoryContext';
import { TopAppBar } from './components/layout/TopAppBar';
import { BottomNavBar } from './components/layout/BottomNavBar';
import { useBackLayer } from './hooks/useBackLayer';

import { JobDashboard } from './components/dashboard/JobDashboard';
import { PackingList } from './components/packing/PackingList';
// Screens that are not needed at start are loaded on first use (smaller start-up bundle).
const WarehouseScreen = lazy(() => import('./components/warehouse/WarehouseScreen').then((m) => ({ default: m.WarehouseScreen })));
const VehiclesScreen = lazy(() => import('./components/vehicles/VehiclesScreen').then((m) => ({ default: m.VehiclesScreen })));
const AlertsScreen = lazy(() => import('./components/alerts/AlertsScreen').then((m) => ({ default: m.AlertsScreen })));
const PersonalScreen = lazy(() => import('./components/personal/PersonalScreen').then((m) => ({ default: m.PersonalScreen })));
const AuditTimeline = lazy(() => import('./components/audit/AuditTimeline').then((m) => ({ default: m.AuditTimeline })));

import { NewJobModal } from './components/modals/NewJobModal';
import { AdHocModal } from './components/modals/AdHocModal';
import { BarcodeScannerModal } from './components/modals/BarcodeScannerModal';
import { DamageReportModal } from './components/damage/DamageReportModal';
import { SettingsModal } from './components/modals/SettingsModal';
import { ProtocolModal } from './components/protocol/ProtocolModal';
import { PhotoViewer } from './components/packing/PhotoViewer';
import { FinishJobSheet } from './components/dashboard/FinishJobSheet';
import { DialogProvider } from './components/common/Dialogs';
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
      <SettingsModal />
      <ProtocolModal />
      <EditJobModal />
      <DuplicateJobModal />
      <ContextMenuModal />
      <PhotoViewer />
      <FinishJobSheet />

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
  const { activeTab, setActiveTab } = useInventory();
  // Android Back: from any other tab go to Zakázky first; Back there leaves the app.
  // (Sheets, the scanner and drawers register their own layers — see useBackLayer.)
  useBackLayer(activeTab !== 'dashboard', () => setActiveTab('dashboard'));

  switch (activeTab) {
    case 'dashboard':
      return <JobDashboard />;
    case 'packing':
      return <PackingList />;
    case 'catalog':
      return <WarehouseScreen />;
    case 'vehicles':
      return <VehiclesScreen />;
    case 'alerts':
      return <AlertsScreen />;
    case 'personal':
      return <PersonalScreen />;
    case 'history':
      return <AuditTimeline />;
    default:
      return <JobDashboard />;
  }
};

/**
 * AuthGate — renders a loading splash until Firebase resolves auth state.
 * Prevents the dashboard from being visible (even briefly) before auth check.
 */
const AuthGate = ({ children }) => {
  const { authLoading } = useInventory();

  // Show branded loading screen while Firebase checks session
  if (authLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center shadow-2xl animate-pulse">
          <span className="text-3xl font-black text-on-primary">B</span>
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
    <div className="fixed top-[calc(4rem+env(safe-area-inset-top,0px))] left-1/2 -translate-x-1/2 z-50 max-w-sm w-11/12 pointer-events-none animate-fade-in">
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
        <DialogProvider>
        <AuthGate>
          <div className="min-h-screen flex flex-col bg-background text-on-surface">
            {/* Global toast notifications */}
            <GlobalNoticeToast />

            {/* Sticky top bar — 56px + iPhone status-bar safe area */}
            <TopAppBar />

            {/* Main Dynamic View — fills space between TopAppBar and BottomNavBar */}
            <main className="flex-1 w-full max-w-5xl mx-auto">
              <Suspense fallback={<p className="p-6 text-center text-on-surface-variant">Načítám…</p>}>
                <MainContent />
              </Suspense>
            </main>


            {/* Bottom Mobile & Desktop Navigation — fixed, h-16 */}
            <BottomNavBar />

            {/* Dialog & Modal Layer */}
            <ModalLayer />
          </div>
        </AuthGate>
        </DialogProvider>
      </InventoryProvider>
    </ErrorBoundary>
  );
}


export default App;
