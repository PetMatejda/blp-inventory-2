import React from 'react';
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

export function App() {
  return (
    <InventoryProvider>
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
    </InventoryProvider>
  );
}

export default App;
