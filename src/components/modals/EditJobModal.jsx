import React, { useState, useEffect } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { Check } from 'lucide-react';
import { Sheet } from '../common/Dialogs';
import { SheetButtons } from '../common/FormField';
import { JobFormFields, emptyJobForm, toJobData, todayIso } from './JobFormFields';

export const EditJobModal = () => {
  const { editingJob, setEditingJob, updateJob } = useInventory();
  const [form, setForm] = useState(emptyJobForm);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  useEffect(() => {
    if (!editingJob) return;
    setForm({
      name: editingJob.name || '',
      client: editingJob.client || '',
      blpResponsible: editingJob.blpResponsible || '',
      gaffer: editingJob.assignedGaffer || '',
      riggingDate: editingJob.riggingDate || editingJob.date || todayIso(),
      deriggingDate: editingJob.deriggingDate || todayIso(),
      vehicleIds: editingJob.vehicleIds || [],
    });
  }, [editingJob]);

  if (!editingJob) return null;

  const close = () => setEditingJob(null);
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    updateJob(editingJob.id, toJobData(form));
  };

  return (
    <Sheet
      title="Upravit zakázku"
      subtitle={editingJob.name}
      onClose={close}
      dismissOnBackdrop={false}
      wide
      footer={<SheetButtons onCancel={close} form="edit-job-form" submitLabel="Uložit změny" icon={Check} />}
    >
      <form id="edit-job-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
        <JobFormFields form={form} set={set} />
      </form>
    </Sheet>
  );
};
