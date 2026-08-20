import { useState, useEffect } from 'react';
import { Modal, Button, Input, Select } from '../../components/ui';
import { departmentService } from '../../services/departmentService';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';

interface DepartmentModalProps {
  open: boolean;
  onClose: () => void;
  department?: any; // If provided, edit mode. Otherwise, create mode.
  orgId: number; // For fetching employees
}

export default function DepartmentModal({ open, onClose, department, orgId }: DepartmentModalProps) {
  const queryClient = useQueryClient();
  const isEdit = !!department;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    head_employee_id: '',
    status: 'active'
  });

  useEffect(() => {
    if (open) {
      setErrorMsg('');
      if (department) {
        setFormData({
          name: department.name || '',
          code: department.code || '',
          description: department.description || '',
          head_employee_id: department.head?.id ? String(department.head.id) : '',
          status: department.status || 'active'
        });
      } else {
        setFormData({
          name: '',
          code: '',
          description: '',
          head_employee_id: '',
          status: 'active'
        });
      }
    }
  }, [open, department]);

  const { data: employees = [] } = useQuery({
    queryKey: ['orgEmployees', orgId],
    queryFn: async () => {
      const res = await api.get(`/organizations/${orgId}/employees`);
      return res.data || [];
    },
    enabled: open && !!orgId
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!formData.name.trim()) {
      setErrorMsg('Department name is required.');
      return;
    }

    try {
      setIsSubmitting(true);
      const payload = {
        name: formData.name.trim(),
        code: formData.code.trim() || undefined,
        description: formData.description.trim() || undefined,
        head_employee_id: formData.head_employee_id ? parseInt(formData.head_employee_id) : undefined,
        status: formData.status
      };

      if (isEdit) {
        await departmentService.updateDepartment(department.id, payload);
      } else {
        await departmentService.createDepartment(payload);
      }

      await queryClient.invalidateQueries({ queryKey: ['departments'] });
      onClose();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'An error occurred while saving the department.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? "Edit Department" : "Create Department"}>
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        {errorMsg && (
          <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200">
            {errorMsg}
          </div>
        )}

        <Input
          label="Department Name *"
          placeholder="e.g. Frontend"
          value={formData.name}
          onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
          required
        />

        <Input
          label="Department Code"
          placeholder="e.g. FE (Optional)"
          value={formData.code}
          onChange={e => setFormData(p => ({ ...p, code: e.target.value.toUpperCase() }))}
        />

        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
            Description
          </label>
          <textarea
            rows={3}
            className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
            placeholder="Briefly describe the department's responsibilities..."
            value={formData.description}
            onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
          />
        </div>

        <Select
          label="Department Head"
          value={formData.head_employee_id}
          onChange={e => setFormData(p => ({ ...p, head_employee_id: e.target.value }))}
        >
          <option value="">[ Select later ]</option>
          {employees.map((emp: any) => (
            <option key={emp.id} value={emp.id}>
              {emp.full_name || emp.name} {emp.designation ? `(${emp.designation})` : ''}
            </option>
          ))}
        </Select>

        <Select
          label="Status"
          value={formData.status}
          onChange={e => setFormData(p => ({ ...p, status: e.target.value }))}
        >
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </Select>

        <div className="pt-4 flex justify-end gap-3 border-t border-slate-100 mt-6">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting} className="bg-indigo-600 hover:bg-indigo-700 text-white">
            {isEdit ? "Save Changes" : "Create Department"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
