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
  const { authLoading, currentUser, activeTab, setActiveTab } = useInventory();

  // ── Android back button guard ──
  // Push a dummy history entry so pressing back lands here instead of the
  // Google OAuth redirect URL that Firebase left in browser history.
  useEffect(() => {
    // Push a state so we have something to intercept
    window.history.pushState({ blp: true }, '', window.location.href);

    const handlePopState = (e) => {
      // Always push state back to prevent further back navigation
      window.history.pushState({ blp: true }, '', window.location.href);

      if (!currentUser) {
        // Not logged in — back does nothing (auth modal is already shown)
        return;
      }

      // Navigate between tabs: packing → dashboard, others → dashboard
      if (activeTab === 'packing' || activeTab === 'catalog' || activeTab === 'bracha' || activeTab === 'history') {
        setActiveTab('dashboard');
      }
      // On dashboard: back is a no-op (prevents accidental exit)
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [currentUser, activeTab, setActiveTab]);

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
            onClick={() => {
              localStorage.clear();
              window.location.reload();
            }}
            className="px-5 py-2.5 bg-emerald-500 text-black font-bold text-sm rounded-xl active:scale-95 shadow"
          >
            Obnovit a resetovat data
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export function App() {
  return (
    <ErrorBoundary>
      <InventoryProvider>
        <AuthGate>
          <div className="min-h-screen flex flex-col bg-background text-on-surface">
            {/* Fixed Top Bar — h-14 (56px) */}
            <TopAppBar />

            {/* Main Dynamic View — fills space between TopAppBar and BottomNavBar */}
            <main className="flex-1 w-full max-w-5xl mx-auto overflow-x-hidden">
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
