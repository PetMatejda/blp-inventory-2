import React from 'react';
import { useInventory } from '../../context/InventoryContext';
import { LayoutDashboard, PackageCheck, Warehouse, Truck, History } from 'lucide-react';

export const BottomNavBar = () => {
  const { activeTab, setActiveTab, alerts } = useInventory();

  // Badge on Auta: vehicles with an expired / soon expiring STK or vignette.
  const vehicleAlerts = alerts.filter((a) => a.group === 'vehicles');
  const vehicleBadge = new Set(vehicleAlerts.map((a) => a.target.vehicleId)).size;
  const vehicleCritical = vehicleAlerts.some((a) => a.severity === 'critical');

  const tabs = [
    { id: 'dashboard', label: 'Zakázky', icon: LayoutDashboard },
    { id: 'packing', label: 'Balení', icon: PackageCheck },
    { id: 'catalog', label: 'Sklad', icon: Warehouse },
    { id: 'vehicles', label: 'Auta', icon: Truck, badge: vehicleBadge, critical: vehicleCritical },
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
              aria-label={tab.badge ? `${tab.label}, ${tab.badge} upozornění` : tab.label}
              aria-current={isActive ? 'page' : undefined}
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
                  <span className={`absolute -top-1.5 -right-2 text-[10px] font-mono font-bold w-4 h-4 rounded-full flex items-center justify-center border border-background ${tab.critical ? 'bg-error text-on-error' : 'bg-amber-500 text-black'}`}>
                    {tab.badge}
                  </span>
                )}
              </div>

              <span
                className={`font-sans text-xs font-semibold tracking-tight transition-all ${
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
