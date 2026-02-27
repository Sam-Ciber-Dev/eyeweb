'use client';

import { AdminPresenceProvider } from '@/contexts/AdminPresenceContext';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminPresenceProvider>
      {children}
    </AdminPresenceProvider>
  );
}
