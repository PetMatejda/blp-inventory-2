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
    <nav className="fixed bottom-0 left-0 right-0 z-40 h-16 bg-surface-container border-t border-outline-variant flex justify-around items-center px-2 backdrop-blur-md bg-opacity-95 shadow-lg">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex flex-col items-center justify-center flex-1 h-12 rounded-xl transition-all relative ${
              isActive
                ? 'bg-secondary-container text-on-secondary-container font-semibold shadow'
                : 'text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface'
            }`}
          >
            <div className="relative">
              <Icon className="w-5 h-5" />
              {tab.badge > 0 && (
                <span className="absolute -top-1.5 -right-2 bg-tertiary-container text-on-tertiary-container text-[10px] font-mono font-bold w-4 h-4 rounded-full flex items-center justify-center border border-background">
                  {tab.badge}
                </span>
              )}
            </div>
            <span className="font-mono text-[11px] mt-0.5 tracking-tight">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
};
