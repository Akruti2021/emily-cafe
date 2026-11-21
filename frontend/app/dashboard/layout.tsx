import type { ReactNode } from 'react';
import DashboardShell from '../../src/components/dashboard/DashboardShell';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>;
}
