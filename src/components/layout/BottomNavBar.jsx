import React from 'react';
import { useInventory } from '../../context/InventoryContext';
import { LayoutDashboard, PackageCheck, BookOpen, Briefcase, History } from 'lucide-react';

export const BottomNavBar = () => {
  const { activeTab, setActiveTab, consumables } = useInventory();

  const refillCount = consumables.filter(c => c.state === 2).length;

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'packing', label: 'Packing', icon: PackageCheck },
    { id: 'catalog', label: 'Katalog', icon: BookOpen },
    { id: 'bracha', label: 'Brácha', icon: Briefcase, badge: refillCount },
    { id: 'history', label: 'Historie', icon: History },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-surface-container/95 backdrop-blur-md border-t border-outline-variant shadow-xl bottom-nav">
      <div className="flex justify-around items-center h-16 px-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center justify-center flex-1 h-full py-1.5 gap-0.5 relative transition-all active:scale-95 rounded-xl mx-0.5 ${
                isActive ? '' : 'text-on-surface-variant'
              }`}
            >
              {/* Active indicator pill above icon */}
              {isActive && (
                <span className="absolute top-1.5 left-1/2 -translate-x-1/2 w-8 h-1 bg-secondary rounded-full" />
              )}

              <div className="relative mt-1">
                <Icon
                  className={`w-5 h-5 transition-all ${
                    isActive ? 'text-secondary' : 'text-on-surface-variant'
                  }`}
                />
                {tab.badge > 0 && (
                  <span className="absolute -top-1.5 -right-2 bg-tertiary-container text-on-tertiary-container text-[10px] font-mono font-bold w-4 h-4 rounded-full flex items-center justify-center border border-background">
                    {tab.badge}
                  </span>
                )}
              </div>

              <span
                className={`font-sans text-[10px] font-semibold tracking-tight transition-all ${
                  isActive ? 'text-secondary' : 'text-on-surface-variant'
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
