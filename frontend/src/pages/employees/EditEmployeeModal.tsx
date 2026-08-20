import { useState, useEffect } from 'react';
import { Modal, Button, Input, Select } from '../../components/ui';
import type { Employee, Department } from '../../types';
import { orgApi } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';

interface EditEmployeeModalProps {
  open: boolean;
  onClose: () => void;
  employee: Employee;
  onSubmit: (formData: any) => Promise<void>;
  isSubmitting: boolean;
}

export default function EditEmployeeModal({
  open,
  onClose,
  employee,
  onSubmit,
  isSubmitting,
}: EditEmployeeModalProps) {
  const { orgId } = useAuthStore();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [formData, setFormData] = useState({
    full_name: employee.full_name || '',
    designation: employee.designation || '',
    phone: employee.phone || '',
    location: employee.location || '',
    department_id: employee.department_id ? String(employee.department_id) : '',
    date_joined: employee.date_joined || '',
    employee_code: employee.employee_code || '',
    
    // New fields
    employee_type: employee.employee_type || 'Full Time',
    dob: employee.dob || '',
    blood_group: employee.blood_group || '',
    personal_email: employee.personal_email || '',
    emergency_contact: employee.emergency_contact || '',
    permanent_address: employee.permanent_address || '',
  });

  useEffect(() => {
    if (orgId && open) {
      orgApi.departments(orgId).then(res => {
        setDepartments(Array.isArray(res.data) ? res.data : []);
      });
    }
  }, [orgId, open]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(p => ({ ...p, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(formData);
  };

  return (
    <Modal open={open} onClose={onClose} title="Edit Employee" size="xl">
      <form onSubmit={handleSubmit} className="flex flex-col h-[600px]">
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Full Name"
              name="full_name"
              value={formData.full_name}
              onChange={handleChange}
              required
            />
            <Input
              label="Employee ID Code"
              name="employee_code"
              value={formData.employee_code}
              onChange={handleChange}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Job Title / Designation"
              name="designation"
              value={formData.designation}
              onChange={handleChange}
            />
            <Select
              label="Department"
              name="department_id"
              value={formData.department_id}
              onChange={handleChange}
            >
              <option value="">— Select Department —</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Phone Number"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
            />
            <Input
              label="Work Location"
              name="location"
              value={formData.location}
              onChange={handleChange}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Date of Joining"
              type="date"
              name="date_joined"
              value={formData.date_joined}
              onChange={handleChange}
            />
            <Input
              label="Date of Birth"
              type="date"
              name="dob"
              value={formData.dob}
              onChange={handleChange}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Employee Type"
              name="employee_type"
              value={formData.employee_type}
              onChange={handleChange}
            >
              <option value="Permanent">Permanent</option>
              <option value="Contract">Contract</option>
              <option value="Intern">Intern</option>
              <option value="Consultant">Consultant</option>
              <option value="Full Time">Full Time</option>
              <option value="Part Time">Part Time</option>
            </Select>
            <Input
              label="Blood Group"
              name="blood_group"
              placeholder="e.g. O+"
              value={formData.blood_group}
              onChange={handleChange}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
             <Input
              label="Personal Email"
              type="email"
              name="personal_email"
              value={formData.personal_email}
              onChange={handleChange}
            />
            <Input
              label="Emergency Contact"
              name="emergency_contact"
              value={formData.emergency_contact}
              onChange={handleChange}
            />
          </div>

          <div>
             <Input
              label="Permanent Address"
              name="permanent_address"
              value={formData.permanent_address}
              onChange={handleChange}
            />
          </div>
        </div>
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-3 flex-shrink-0">
          <Button variant="ghost" onClick={onClose} type="button">Cancel</Button>
          <Button variant="primary" type="submit" loading={isSubmitting}>Save Changes</Button>
        </div>
      </form>
    </Modal>
  );
}
