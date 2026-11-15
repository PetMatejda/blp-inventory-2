import React, { useState, useEffect } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { Plus } from 'lucide-react';
import { Sheet } from '../common/Dialogs';
import { SheetButtons } from '../common/FormField';
import { JobFormFields, emptyJobForm, toJobData } from './JobFormFields';

export const NewJobModal = () => {
  const { isNewJobModalOpen, setIsNewJobModalOpen, createJob, currentUser } = useInventory();
  const [form, setForm] = useState(emptyJobForm);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  // Fresh form each time it opens; the signed-in user is the default BLP contact.
  useEffect(() => {
    if (isNewJobModalOpen) setForm({ ...emptyJobForm(), blpResponsible: currentUser?.name || '' });
  }, [isNewJobModalOpen, currentUser?.name]);

  if (!isNewJobModalOpen) return null;

  const close = () => setIsNewJobModalOpen(false);
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    createJob(toJobData(form));
  };

  return (
    <Sheet
      title="Nová zakázka"
      onClose={close}
      dismissOnBackdrop={false}
      wide
      footer={<SheetButtons onCancel={close} form="new-job-form" submitLabel="Vytvořit zakázku" icon={Plus} />}
    >
      <form id="new-job-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
        <JobFormFields form={form} set={set} />
      </form>
    </Sheet>
  );
};
