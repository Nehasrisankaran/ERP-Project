import React from 'react';
import { PageShell, PageHeader } from '../ui';

interface DashboardShellProps {
  greeting: string;
  subtitle: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}

export function DashboardShell({ greeting, subtitle, children, action }: DashboardShellProps) {
  return (
    <PageShell>
      <PageHeader 
        showBack={false} 
        title={greeting} 
        subtitle={subtitle} 
        action={action}
      />
      <div className="space-y-7 animate-in fade-in duration-500">
        {children}
      </div>
    </PageShell>
  );
}
