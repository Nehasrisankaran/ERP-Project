import React, { useState, useMemo } from 'react';
import { Modal, Button, Input, Select, Avatar } from '../../components/ui';
import type { Department, Employee } from '../../types';


import {
  User, Briefcase, Building2, Shield, Users, Mail, CheckCircle2,
  ChevronRight, ChevronLeft, AlertCircle, Sparkles, Lock, ShieldCheck, Check
} from 'lucide-react';
import { cn } from '../../utils';


interface AddEmployeeWizardProps {
  open: boolean;
  onClose: () => void;
  departments: Department[];
  employees: Employee[];
  onSubmit: (formData: any) => Promise<void>;
  isSubmitting: boolean;
}

const STEPS = [
  { id: 1, title: 'Basic Info', icon: <User size={16} /> },
  { id: 2, title: 'Employment', icon: <Briefcase size={16} /> },
  { id: 3, title: 'Organization', icon: <Building2 size={16} /> },
  { id: 4, title: 'Role & Access', icon: <Shield size={16} /> },
  { id: 5, title: 'Reporting', icon: <Users size={16} /> },
  { id: 6, title: 'Onboarding', icon: <Mail size={16} /> },
  { id: 7, title: 'Review', icon: <CheckCircle2 size={16} /> },
];

const WORKMATE_ROLES = [
  {
    role: 'employee',
    title: 'Employee',
    description: 'Standard access to personal work, assigned tasks, project views, and team communications.',
    permissions: ['View assigned projects', 'Manage own tasks', 'Access personal calendar', 'View team directory']
  },
  {
    role: 'manager',
    title: 'Manager / Team Lead',
    description: 'Management access for tracking team progress, assigning tasks, and monitoring workload.',
    permissions: ['Create & assign tasks', 'Manage team projects', 'View team workload & reports', 'Approve milestones']
  },
  {
    role: 'hr',
    title: 'HR Specialist',
    description: 'People operations access for onboarding employees and managing organization records.',
    permissions: ['Onboard & invite employees', 'View employee directory & org stats', 'Manage departments', 'Audit activity']
  },
  {
    role: 'admin',
    title: 'Administrator',
    description: 'Full administrative access across organization settings, roles, integrations, and workspace configs.',
    permissions: ['Full workspace configuration', 'Manage user roles & permissions', 'Configure integrations & security', 'Manage billing & org details']
  }
];

export default function AddEmployeeWizard({
  open,
  onClose,
  departments,
  employees,
  onSubmit,
  isSubmitting,
}: AddEmployeeWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [errorMsg, setErrorMsg] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    // Step 1: Basic
    first_name: '',
    middle_name: '',
    last_name: '',
    preferred_name: '',
    personal_email: '',
    work_email: '',
    phone: '',
    
    // Step 2: Employment
    employee_code: `EMP-${Math.floor(1000 + Math.random() * 9000)}`,
    designation: '',
    employment_type: 'Full Time',
    job_level: 'Individual Contributor',
    date_joined: new Date().toISOString().split('T')[0],
    status: 'active',
    location: 'Remote / HQ',
    work_mode: 'Hybrid',
    
    // Step 3: Organization
    department_id: '',
    team_name: '',
    office_location: 'Headquarters',
    org_level: 'Individual Contributor',

    // Step 4: Role & Access
    app_role: 'employee',
    pm_access: false,

    // Step 5: Reporting
    reporting_manager_id: '',
    reports_to_none: false,

    // Step 6: Account
    send_invitation: true,
    require_password_setup: true,
  });

  // Calculate fullName
  const full_name = useMemo(() => {
    return [formData.first_name, formData.middle_name, formData.last_name].filter(Boolean).join(' ');
  }, [formData.first_name, formData.middle_name, formData.last_name]);

  // Selected manager object
  const selectedManager = useMemo(() => {
    if (!formData.reporting_manager_id) return null;
    return employees.find(e => String(e.id) === String(formData.reporting_manager_id)) || null;
  }, [employees, formData.reporting_manager_id]);

  // Validate Step transitions
  const canProceed = () => {
    if (currentStep === 1) {
      if (!formData.first_name.trim() || !formData.last_name.trim()) return false;
      if (!formData.work_email.trim() || !formData.work_email.includes('@')) return false;
      // Duplicate check
      const duplicate = employees.some(e => e.email?.toLowerCase() === formData.work_email.trim().toLowerCase());
      if (duplicate) return false;
    }
    if (currentStep === 2) {
      if (!formData.designation.trim()) return false;
    }
    return true;
  };

  const handleNext = () => {
    setErrorMsg('');
    if (currentStep === 1) {
      const duplicate = employees.some(e => e.email?.toLowerCase() === formData.work_email.trim().toLowerCase());
      if (duplicate) {
        setErrorMsg(`An employee with work email "${formData.work_email}" already exists.`);
        return;
      }
    }
    if (currentStep < 7) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    setErrorMsg('');
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleFinalSubmit = async () => {
    try {
      setErrorMsg('');
      await onSubmit({ ...formData, full_name });
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create employee. Please try again.');
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Enterprise Employee Onboarding" size="xl">
      <div className="flex flex-col h-[640px] max-h-[85vh]">
        {/* Stepper Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex-shrink-0">
          <div className="flex items-center justify-between max-w-4xl mx-auto">
            {STEPS.map((step, idx) => {
              const isActive = currentStep === step.id;
              const isDone = currentStep > step.id;
              return (
                <React.Fragment key={step.id}>
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all',
                        isDone ? 'bg-emerald-600 text-white shadow-xs' :
                        isActive ? 'bg-violet-600 text-white ring-4 ring-violet-100 shadow-sm' :
                        'bg-slate-200 text-slate-500'
                      )}
                    >
                      {isDone ? <Check size={14} /> : step.id}
                    </div>
                    <span
                      className={cn(
                        'text-xs font-medium hidden md:inline-block',
                        isActive ? 'text-violet-700 font-bold' : isDone ? 'text-slate-700' : 'text-slate-400'
                      )}
                    >
                      {step.title}
                    </span>
                  </div>
                  {idx < STEPS.length - 1 && (
                    <div className={cn('h-0.5 flex-1 mx-2 transition-all', isDone ? 'bg-emerald-500' : 'bg-slate-200')} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Step Content */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          {errorMsg && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-700 text-xs font-medium">
              <AlertCircle size={18} className="flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* STEP 1: Basic Information */}
          {currentStep === 1 && (
            <div className="space-y-6 max-w-2xl mx-auto">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Step 1: Basic Information</h3>
                <p className="text-xs text-slate-500 mt-1">Specify official identity details and primary work contact email.</p>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <Input
                  label="First Name *"
                  placeholder="Arun"
                  value={formData.first_name}
                  onChange={e => setFormData(p => ({ ...p, first_name: e.target.value }))}
                />
                <Input
                  label="Middle Name"
                  placeholder="Kumar"
                  value={formData.middle_name}
                  onChange={e => setFormData(p => ({ ...p, middle_name: e.target.value }))}
                />
                <Input
                  label="Last Name *"
                  placeholder="Sharma"
                  value={formData.last_name}
                  onChange={e => setFormData(p => ({ ...p, last_name: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Preferred Name"
                  placeholder="Arun"
                  value={formData.preferred_name}
                  onChange={e => setFormData(p => ({ ...p, preferred_name: e.target.value }))}
                />
                <Input
                  label="Phone Number"
                  placeholder="+91 98765 43210"
                  value={formData.phone}
                  onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Input
                    label="Work Email * (Primary WORKMATE Identity)"
                    type="email"
                    placeholder="arun.kumar@company.com"
                    value={formData.work_email}
                    onChange={e => setFormData(p => ({ ...p, work_email: e.target.value }))}
                  />
                  <p className="text-[11px] text-slate-400 mt-1">This email will receive the onboarding invitation link.</p>
                </div>
                <Input
                  label="Personal Email (Optional)"
                  type="email"
                  placeholder="arun.personal@gmail.com"
                  value={formData.personal_email}
                  onChange={e => setFormData(p => ({ ...p, personal_email: e.target.value }))}
                />
              </div>
            </div>
          )}

          {/* STEP 2: Employment Information */}
          {currentStep === 2 && (
            <div className="space-y-6 max-w-2xl mx-auto">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Step 2: Employment Details</h3>
                <p className="text-xs text-slate-500 mt-1">Define official job title, employment tier, location, and joining date.</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Employee ID Code *"
                  value={formData.employee_code}
                  onChange={e => setFormData(p => ({ ...p, employee_code: e.target.value }))}
                />
                <Input
                  label="Job Title / Designation *"
                  placeholder="Senior Software Engineer / CTO"
                  value={formData.designation}
                  onChange={e => setFormData(p => ({ ...p, designation: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Select
                  label="Employment Type"
                  value={formData.employment_type}
                  onChange={e => setFormData(p => ({ ...p, employment_type: e.target.value }))}
                >
                  <option value="Full Time">Full Time</option>
                  <option value="Part Time">Part Time</option>
                  <option value="Contract">Contract</option>
                  <option value="Intern">Intern</option>
                  <option value="Consultant">Consultant</option>
                </Select>
                <Select
                  label="Workplace Location Mode"
                  value={formData.work_mode}
                  onChange={e => setFormData(p => ({ ...p, work_mode: e.target.value }))}
                >
                  <option value="On-site">On-site (HQ)</option>
                  <option value="Hybrid">Hybrid</option>
                  <option value="Remote">Remote</option>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Work Location City"
                  placeholder="San Francisco, CA / Remote"
                  value={formData.location}
                  onChange={e => setFormData(p => ({ ...p, location: e.target.value }))}
                />
                <Input
                  label="Date of Joining"
                  type="date"
                  value={formData.date_joined}
                  onChange={e => setFormData(p => ({ ...p, date_joined: e.target.value }))}
                />
              </div>
            </div>
          )}

          {/* STEP 3: Organization */}
          {currentStep === 3 && (
            <div className="space-y-6 max-w-2xl mx-auto">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Step 3: Organization & Department</h3>
                <p className="text-xs text-slate-500 mt-1">Assign employee to department, team, and organization tier level.</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Select
                  label="Department *"
                  value={formData.department_id}
                  onChange={e => setFormData(p => ({ ...p, department_id: e.target.value }))}
                >
                  <option value="">— Select Department —</option>
                  {departments.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </Select>
                <Input
                  label="Team / Squad Name"
                  placeholder="e.g. Core Platform / Frontend Guild"
                  value={formData.team_name}
                  onChange={e => setFormData(p => ({ ...p, team_name: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Select
                  label="Organization Hierarchy Level"
                  value={formData.org_level}
                  onChange={e => setFormData(p => ({ ...p, org_level: e.target.value }))}
                >
                  <option value="Executive">Executive (CEO, CTO, Directors)</option>
                  <option value="Leadership">Leadership (VP, Dept Heads)</option>
                  <option value="Management">Management (Managers, Leads)</option>
                  <option value="Individual Contributor">Individual Contributor (Engineers, Designers)</option>
                </Select>
                <Input
                  label="Office Base"
                  placeholder="HQ Building A"
                  value={formData.office_location}
                  onChange={e => setFormData(p => ({ ...p, office_location: e.target.value }))}
                />
              </div>
            </div>
          )}

          {/* STEP 4: WORKMATE Role & Access */}
          {currentStep === 4 && (
            <div className="space-y-6 max-w-2xl mx-auto">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Step 4: WORKMATE Application Role & Access</h3>
                <p className="text-xs text-slate-500 mt-1">Separate from Job Title: Select actual system permissions granted in WORKMATE.</p>
              </div>

              <div className="space-y-3">
                {WORKMATE_ROLES.map(r => {
                  const isSelected = formData.app_role === r.role;
                  return (
                    <div
                      key={r.role}
                      onClick={() => setFormData(p => ({ ...p, app_role: r.role }))}
                      className={cn(
                        'p-4 border rounded-xl cursor-pointer transition-all flex items-start gap-4',
                        isSelected
                          ? 'border-violet-600 bg-violet-50/40 ring-2 ring-violet-100'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      )}
                    >
                      <div className={cn(
                        'w-5 h-5 rounded-full border flex items-center justify-center mt-0.5 flex-shrink-0',
                        isSelected ? 'border-violet-600 bg-violet-600 text-white' : 'border-slate-300'
                      )}>
                        {isSelected && <Check size={12} />}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-bold text-slate-900">{r.title}</h4>
                          <span className="text-[10px] font-mono uppercase bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-semibold">
                            Role: {r.role}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">{r.description}</p>
                        <div className="mt-2.5 flex flex-wrap gap-1.5">
                          {r.permissions.map((perm, idx) => (
                            <span key={idx} className="text-[11px] bg-white border border-slate-200 text-slate-700 px-2 py-0.5 rounded-md font-medium">
                              ✓ {perm}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Special Project Manager Access Checkbox */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-800">Project Manager Responsibilities</h4>
                  <p className="text-[11px] text-slate-500">Enable project allocation, risk reporting, and Gantt management capabilities.</p>
                </div>
                <input
                  type="checkbox"
                  checked={formData.pm_access}
                  onChange={e => setFormData(p => ({ ...p, pm_access: e.target.checked }))}
                  className="w-4 h-4 text-violet-600 rounded focus:ring-violet-400"
                />
              </div>
            </div>
          )}

          {/* STEP 5: Reporting Relationship */}
          {currentStep === 5 && (
            <div className="space-y-6 max-w-2xl mx-auto">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Step 5: Reporting Hierarchy</h3>
                <p className="text-xs text-slate-500 mt-1">Configure reporting manager. Top-level executives (CEO) may have no reporting manager.</p>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800">Top-Level Position (No Manager)</label>
                  <input
                    type="checkbox"
                    checked={formData.reports_to_none}
                    onChange={e => setFormData(p => ({
                      ...p,
                      reports_to_none: e.target.checked,
                      reporting_manager_id: e.target.checked ? '' : p.reporting_manager_id
                    }))}
                    className="w-4 h-4 text-violet-600 rounded"
                  />
                </div>
                <p className="text-[11px] text-slate-500">Check this for CEO, Founder, or independent board executives.</p>
              </div>

              {!formData.reports_to_none && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700">Select Direct Manager *</label>
                  <select
                    value={formData.reporting_manager_id}
                    onChange={e => setFormData(p => ({ ...p, reporting_manager_id: e.target.value }))}
                    className="w-full text-sm border border-slate-200 bg-white rounded-xl p-3 outline-none focus:ring-2 focus:ring-violet-400 text-slate-800"
                  >
                    <option value="">— Search & Select Manager —</option>
                    {employees.map(e => (
                      <option key={e.id} value={e.id}>
                        {e.full_name} ({e.designation || 'Staff'}) · {e.department_name || 'Organization'}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Visual Hierarchy Preview */}
              <div className="p-5 bg-violet-50/50 border border-violet-100 rounded-2xl">
                <h4 className="text-xs font-bold text-violet-900 uppercase tracking-wider mb-3">Hierarchy Preview</h4>
                <div className="flex items-center gap-3">
                  {formData.reports_to_none ? (
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 bg-white px-3 py-2 rounded-lg border border-slate-200">
                      <ShieldCheck size={14} className="text-violet-600" /> Executive Board / CEO (Top Level)
                    </div>
                  ) : selectedManager ? (
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 bg-white px-3 py-2 rounded-lg border border-slate-200">
                      <Avatar name={selectedManager.full_name} size="xs" />
                      <span>{selectedManager.full_name} ({selectedManager.designation || 'Manager'})</span>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-400 italic">No manager selected yet</div>
                  )}

                  <ChevronRight size={16} className="text-slate-400" />

                  <div className="flex items-center gap-2 text-xs font-bold text-violet-900 bg-violet-100 px-3 py-2 rounded-lg border border-violet-200">
                    <User size={14} className="text-violet-700" />
                    <span>{full_name || 'New Employee'} ({formData.designation || 'Job Title'})</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 6: Account & Onboarding */}
          {currentStep === 6 && (
            <div className="space-y-6 max-w-2xl mx-auto">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Step 6: Account & Onboarding Workflow</h3>
                <p className="text-xs text-slate-500 mt-1">Control WORKMATE account activation and invitation security.</p>
              </div>

              <div className="p-5 bg-white border border-slate-200 rounded-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-slate-800">Send Onboarding Invitation Email</h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Sends a secure invitation link to <span className="font-mono text-violet-700">{formData.work_email || 'work email'}</span>.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.send_invitation}
                    onChange={e => setFormData(p => ({ ...p, send_invitation: e.target.checked }))}
                    className="w-5 h-5 text-violet-600 rounded"
                  />
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-semibold text-slate-700">Require Password Setup on First Login</h4>
                    <p className="text-[11px] text-slate-400">Employee establishes their own confidential password upon email verification.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.require_password_setup}
                    disabled
                    className="w-4 h-4 text-violet-600 rounded opacity-60"
                  />
                </div>
              </div>

              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3">
                <Lock size={16} className="text-emerald-600 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-emerald-800 leading-relaxed">
                  <span className="font-bold">Credential Ownership:</span> Administrators never set or see permanent passwords. The employee receives a secure 24-hour single-use token to verify their identity and set their secret password.
                </p>
              </div>
            </div>
          )}

          {/* STEP 7: Review & Confirm */}
          {currentStep === 7 && (
            <div className="space-y-6 max-w-2xl mx-auto">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Step 7: Final Review & Create</h3>
                <p className="text-xs text-slate-500 mt-1">Verify employee details before provisioning record and sending invitation.</p>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 space-y-4 divide-y divide-slate-200">
                {/* Basic */}
                <div className="pb-3">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Basic Identity</h4>
                  <p className="text-base font-bold text-slate-900">{full_name}</p>
                  <p className="text-xs text-slate-600 mt-0.5">{formData.work_email} · {formData.phone || 'No phone'}</p>
                </div>

                {/* Employment */}
                <div className="py-3">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Employment & Position</h4>
                  <p className="text-sm font-bold text-slate-800">{formData.designation} ({formData.employment_type})</p>
                  <p className="text-xs text-slate-600 mt-0.5">Code: {formData.employee_code} · Location: {formData.location} ({formData.work_mode})</p>
                </div>

                {/* Organization */}
                <div className="py-3">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Organization & Reporting</h4>
                  <p className="text-xs text-slate-700">Level: <span className="font-semibold">{formData.org_level}</span></p>
                  <p className="text-xs text-slate-700 mt-1">
                    Reports To: <span className="font-semibold">{formData.reports_to_none ? 'None (Top Level Executive)' : selectedManager ? selectedManager.full_name : 'Not Specified'}</span>
                  </p>
                </div>

                {/* Access */}
                <div className="pt-3">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">WORKMATE Access & Account</h4>
                  <p className="text-xs text-slate-700">Application Role: <span className="font-bold uppercase text-violet-700">{formData.app_role}</span></p>
                  <p className="text-xs text-slate-600 mt-1">Onboarding Status: <span className="font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">Pending Invitation</span></p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer controls */}
        <div className="px-6 py-4 bg-white border-t border-slate-200 flex items-center justify-between flex-shrink-0">
          <Button variant="ghost" onClick={currentStep === 1 ? onClose : handlePrev}>
            {currentStep === 1 ? 'Cancel' : <><ChevronLeft size={16} /> Back</>}
          </Button>

          {currentStep < 7 ? (
            <Button variant="primary" onClick={handleNext} disabled={!canProceed()}>
              Next <ChevronRight size={16} />
            </Button>
          ) : (
            <Button
              variant="primary"
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
              loading={isSubmitting}
              onClick={handleFinalSubmit}
            >
              <Sparkles size={16} /> Create Employee & Send Invitation
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
