import { cn } from '../../utils';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export * from './SourceBadge';


// ─────────────────────────────────────────────────────────────
// PageShell — Standard page content wrapper
// Provides: consistent padding that fills the full available width
// ─────────────────────────────────────────────────────────────
interface PageShellProps {
  children: React.ReactNode;
  className?: string;
  /** Pass true for full-height flex pages (e.g. KanbanBoard) */
  fullHeight?: boolean;
}

export function PageShell({ children, className, fullHeight }: PageShellProps) {
  return (
    <div
      className={cn(
        'w-full px-8',
        fullHeight ? 'flex flex-col h-full' : 'py-8',
        className
      )}
    >
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// PageHeader — Standardized page title bar
// Provides: back button, title, optional subtitle, optional action
// ─────────────────────────────────────────────────────────────
interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  /** Show/hide the back button. Default: true */
  showBack?: boolean;
  /** Override back navigation */
  onBack?: () => void;
  className?: string;
}

export function PageHeader({ title, subtitle, action, showBack = true, onBack, className }: PageHeaderProps) {
  const navigate = useNavigate();
  const handleBack = onBack ?? (() => navigate(-1));

  return (
    <div className={cn('flex items-start justify-between gap-4 mb-8', className)}>
      <div className="flex items-start gap-4">
        {showBack && (
          <button
            onClick={handleBack}
            title="Go Back"
            className="group mt-0.5 flex items-center justify-center w-8 h-8 rounded-full border border-slate-200 bg-white text-slate-400 hover:text-slate-700 hover:border-slate-300 shadow-sm hover:shadow transition-all flex-shrink-0"
          >
            <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
          </button>
        )}
        <div>
          <h1 className="text-2xl font-bold text-slate-900 leading-tight">{title}</h1>
          {subtitle && (
            <p className="text-sm text-slate-500 mt-1">{subtitle}</p>
          )}
        </div>
      </div>
      {action && <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">{action}</div>}
    </div>
  );
}


interface BadgeProps {
  children: React.ReactNode;
  className?: string;
}

export function Badge({ children, className }: BadgeProps) {
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium', className)}>
      {children}
    </span>
  );
}

interface AvatarProps {
  name: string | null | undefined;
  src?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeMap = { xs: 'w-5 h-5 text-[10px]', sm: 'w-7 h-7 text-xs', md: 'w-8 h-8 text-sm', lg: 'w-10 h-10 text-base' };

export function Avatar({ name, src, size = 'sm', className }: AvatarProps) {
  const initials = name
    ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  if (src) {
    return <img src={src} alt={name || ''} className={cn('rounded-full object-cover', sizeMap[size], className)} />;
  }

  const colors = ['bg-violet-100 text-violet-700', 'bg-blue-100 text-blue-700', 'bg-green-100 text-green-700',
    'bg-amber-100 text-amber-700', 'bg-pink-100 text-pink-700', 'bg-teal-100 text-teal-700'];
  const color = colors[(name?.charCodeAt(0) || 0) % colors.length];

  return (
    <div className={cn('rounded-full flex items-center justify-center font-semibold flex-shrink-0', sizeMap[size], color, className)}>
      {initials}
    </div>
  );
}

interface ProgressBarProps {
  value: number;
  className?: string;
  color?: string;
}

export function ProgressBar({ value, className, color = 'bg-violet-500' }: ProgressBarProps) {
  return (
    <div className={cn('w-full bg-slate-100 rounded-full h-1.5', className)}>
      <div
        className={cn('h-1.5 rounded-full transition-all duration-300', color)}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

interface SpinnerProps {
  className?: string;
}

export function Spinner({ className }: SpinnerProps) {
  return (
    <div className={cn('animate-spin rounded-full border-2 border-slate-200 border-t-violet-600 w-5 h-5', className)} />
  );
}

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mb-4">
        {icon}
      </div>
      <h3 className="text-sm font-semibold text-slate-800 mb-1">{title}</h3>
      <p className="text-sm text-slate-500 max-w-xs mb-4">{description}</p>
      {action}
    </div>
  );
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  children: React.ReactNode;
}

const variantMap = {
  primary: 'bg-violet-600 text-white hover:bg-violet-700 focus-visible:ring-violet-500 shadow-sm',
  secondary: 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 focus-visible:ring-slate-400 shadow-sm',
  ghost: 'text-slate-600 hover:bg-slate-100 focus-visible:ring-slate-400',
  danger: 'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500 shadow-sm',
};

const sizeMapBtn = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2 text-sm', lg: 'px-5 py-2.5 text-sm' };

export function Button({ variant = 'secondary', size = 'md', loading, children, className, disabled, ...props }: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center gap-2 font-medium rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed',
        variantMap[variant],
        sizeMapBtn[size],
        className
      )}
    >
      {loading && <Spinner className="w-3.5 h-3.5" />}
      {children}
    </button>
  );
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className, id, ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label htmlFor={id} className="text-xs font-medium text-slate-600">{label}</label>}
      <input
        id={id}
        {...props}
        className={cn(
          'w-full px-3 py-2 text-sm bg-white border rounded-lg text-slate-800 placeholder:text-slate-400 transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent',
          error ? 'border-red-400' : 'border-slate-200 hover:border-slate-300',
          className
        )}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  children: React.ReactNode;
}

export function Select({ label, error, className, id, children, ...props }: SelectProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label htmlFor={id} className="text-xs font-medium text-slate-600">{label}</label>}
      <select
        id={id}
        {...props}
        className={cn(
          'w-full px-3 py-2 text-sm bg-white border rounded-lg text-slate-800 transition-colors appearance-none',
          'focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent',
          error ? 'border-red-400' : 'border-slate-200 hover:border-slate-300',
          className
        )}
      >
        {children}
      </select>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export function Textarea({ label, error, className, id, ...props }: TextareaProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label htmlFor={id} className="text-xs font-medium text-slate-600">{label}</label>}
      <textarea
        id={id}
        {...props}
        className={cn(
          'w-full px-3 py-2 text-sm bg-white border rounded-lg text-slate-800 placeholder:text-slate-400 transition-colors resize-none',
          'focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent',
          error ? 'border-red-400' : 'border-slate-200 hover:border-slate-300',
          className
        )}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const modalSizeMap = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };

export function Modal({ open, onClose, title, children, size = 'md' }: ModalProps) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-150"
      onKeyDown={e => e.key === 'Escape' && onClose()}
      tabIndex={-1}
    >
      {/* Click outside to close backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} title="Click outside to close" />

      {/* Modal Dialog container */}
      <div className={cn('relative w-full bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh] z-10 overflow-hidden', modalSizeMap[size])}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800 bg-white border border-slate-200 hover:bg-slate-100 px-2.5 py-1 rounded-lg transition-colors shadow-xs"
              title="Close modal"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              <span>Back</span>
            </button>
            <h2 className="text-base font-semibold text-slate-800">{title}</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors p-1.5 rounded-lg hover:bg-slate-100" title="Close">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
}
