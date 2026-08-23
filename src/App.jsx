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
import { ProtocolModal } from './components/protocol/ProtocolModal';
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
      <ProtocolModal />
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

export function App() {
  return (
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
  );
}

export default App;
