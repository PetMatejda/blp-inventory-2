import React from 'react';
import { useInventory } from '../../context/InventoryContext';
import { UserCheck, X, Shield, Wrench, Warehouse } from 'lucide-react';

export const RoleSwitcherModal = () => {
  const { isRoleModalOpen, setIsRoleModalOpen, userRole, setUserRole } = useInventory();

  if (!isRoleModalOpen) return null;

  const roles = [
    {
      id: 'Lead Gaffer',
      title: 'Lead Gaffer (Vedoucí osvětlovač)',
      desc: 'Hlavní odpovědnost za zakázku, schvalování techniky a finální podpis předávacího protokolu.',
      icon: Shield,
      color: 'border-primary bg-primary-container/10',
    },
    {
      id: 'Best Boy Electric',
      title: 'Best Boy Electric (Logistik techniky)',
      desc: 'Řízení nakládky/vykládky na place, kontrola kusů, zápis ad-hoc položek a hlášení poruch.',
      icon: Wrench,
      color: 'border-secondary bg-secondary-container/10',
    },
    {
      id: 'Rental Custodian',
      title: 'Rental Custodian (Filmový skladník)',
      desc: 'Příjem závad z placu, vyřizování doplňování kufru Brácha a fyzické naskladňování do skladu.',
      icon: Warehouse,
      color: 'border-tertiary bg-tertiary-container/10',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-card-bg rounded-2xl border border-outline-variant max-w-md w-full p-6 flex flex-col gap-5 shadow-2xl relative my-8">
        <div className="flex justify-between items-start border-b border-outline-variant pb-3">
          <div>
            <span className="text-xs font-mono font-bold text-primary uppercase flex items-center gap-1">
              <UserCheck className="w-4 h-4" /> UŽIVATELSKÁ ROLE & OPRÁVNĚNÍ
            </span>
            <h2 className="text-xl font-bold text-on-surface mt-1">Přepínač Rolí</h2>
          </div>
          <button onClick={() => setIsRoleModalOpen(false)} className="text-outline hover:text-on-surface p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-col gap-3 my-1">
          {roles.map((r) => {
            const Icon = r.icon;
            const isSelected = userRole.includes(r.id);
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  setUserRole(r.id);
                  setIsRoleModalOpen(false);
                }}
                className={`p-4 rounded-xl border text-left transition-all flex items-start gap-3.5 ${
                  isSelected
                    ? `${r.color} ring-1 ring-primary`
                    : 'bg-surface-container border-outline-variant hover:border-outline'
                }`}
              >
                <div className="p-2 rounded-lg bg-surface-variant text-primary shrink-0 mt-0.5">
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-on-surface">{r.title}</h3>
                  <p className="text-xs text-outline mt-1 leading-normal">{r.desc}</p>
                </div>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => setIsRoleModalOpen(false)}
          className="w-full py-3 bg-surface-container text-on-surface border border-outline-variant font-semibold rounded-xl text-sm"
        >
          Zavřít
        </button>
      </div>
    </div>
  );
};
