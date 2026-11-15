import React, { useState, useEffect } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { Copy } from 'lucide-react';
import { Sheet } from '../common/Dialogs';
import { SheetButtons } from '../common/FormField';
import { JobFormFields, emptyJobForm, toJobData } from './JobFormFields';

export const DuplicateJobModal = () => {
  const { templateJob, setTemplateJob, duplicateJobAsTemplate } = useInventory();
  const [form, setForm] = useState(emptyJobForm);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  useEffect(() => {
    if (!templateJob) return;
    setForm({
      ...emptyJobForm(),
      name: `${templateJob.name} (kopie)`,
      client: templateJob.client || '',
      blpResponsible: templateJob.blpResponsible || '',
      gaffer: templateJob.assignedGaffer || '',
    });
  }, [templateJob]);

  if (!templateJob) return null;

  const close = () => setTemplateJob(null);
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    duplicateJobAsTemplate(templateJob.id, toJobData(form, { withVehicles: false }));
  };

  return (
    <Sheet
      title="Nová zakázka podle vzoru"
      subtitle={`Vzor: ${templateJob.name}`}
      onClose={close}
      dismissOnBackdrop={false}
      wide
      footer={<SheetButtons onCancel={close} form="duplicate-job-form" submitLabel="Zkopírovat a vytvořit" icon={Copy} tone="secondary" />}
    >
      <form id="duplicate-job-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
        <JobFormFields form={form} set={set} nameLabel="Název nové zakázky" showVehicles={false} />
        <p className="bg-secondary-container/20 border border-secondary/40 p-3 rounded-xl text-sm text-on-surface">
          Do nové zakázky se zkopíruje celý seznam techniky ze vzoru, s nulovým počtem naložených kusů.
        </p>
      </form>
    </Sheet>
  );
};
