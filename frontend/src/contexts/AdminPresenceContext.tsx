'use client';

/**
 * AdminPresenceContext — gere a presença online dos administradores.
 * Ao ser incluído no layout do admin, faz tracking de presença em
 * TODAS as páginas do painel (não apenas no chat).
 * 
 * Expõe:
 *  - onlineAdmins: Set de user_ids online
 *  - typingAdmins: Map de user_ids a escrever no chat
 *  - sendTyping(): notifica outros admins que estou a escrever
 */

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '@/lib/supabase';

interface TypingInfo {
  name: string;
  avatar_url: string | null;
}

interface AdminPresenceContextType {
  onlineAdmins: Set<string>;
  typingAdmins: Map<string, TypingInfo>;
  sendTyping: () => void;
}

const AdminPresenceContext = createContext<AdminPresenceContextType>({
  onlineAdmins: new Set(),
  typingAdmins: new Map(),
  sendTyping: () => {},
});

export function AdminPresenceProvider({ children }: { children: React.ReactNode }) {
  const { user, profile, isAdmin, isAuthenticated } = useAuth();
  const [onlineAdmins, setOnlineAdmins] = useState<Set<string>>(new Set());
  const [typingAdmins, setTypingAdmins] = useState<Map<string, TypingInfo>>(new Map());
  const channelRef = useRef<any>(null);
  const typingTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const lastTypingBroadcast = useRef<number>(0);

  useEffect(() => {
    if (!isAuthenticated || !isAdmin || !user || !profile) return;

    const channel = supabase.channel('admin-panel-presence', {
      config: { presence: { key: user.id } },
    });
    channelRef.current = channel;

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const ids = new Set<string>();
        Object.values(state).forEach((presences: any) => {
          presences.forEach((p: any) => {
            if (p.user_id) ids.add(p.user_id);
          });
        });
        setOnlineAdmins(ids);
      })
      .on('broadcast', { event: 'typing' }, ({ payload }: any) => {
        if (!payload || payload.user_id === user.id) return;

        const { user_id, name, avatar_url } = payload;

        setTypingAdmins(prev => {
          const next = new Map(prev);
          next.set(user_id, { name: name || 'Admin', avatar_url: avatar_url || null });
          return next;
        });

        // Limpar timeout anterior
        const existing = typingTimeoutsRef.current.get(user_id);
        if (existing) clearTimeout(existing);

        // Auto-remover após 3s sem atividade
        const timeout = setTimeout(() => {
          setTypingAdmins(prev => {
            const next = new Map(prev);
            next.delete(user_id);
            return next;
          });
          typingTimeoutsRef.current.delete(user_id);
        }, 3000);
        typingTimeoutsRef.current.set(user_id, timeout);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            name: profile.display_name || user.email?.split('@')[0] || 'Admin',
            user_id: user.id,
            online_at: new Date().toISOString(),
          });
        }
      });

    return () => {
      channelRef.current = null;
      typingTimeoutsRef.current.forEach(t => clearTimeout(t));
      typingTimeoutsRef.current.clear();
      supabase.removeChannel(channel);
    };
  }, [isAuthenticated, isAdmin, user?.id, profile?.display_name]);

  const sendTyping = useCallback(() => {
    if (!channelRef.current || !user) return;
    const now = Date.now();
    // Throttle: enviar no máximo 1x por segundo
    if (now - lastTypingBroadcast.current < 1000) return;
    lastTypingBroadcast.current = now;

    channelRef.current.send({
      type: 'broadcast',
      event: 'typing',
      payload: {
        user_id: user.id,
        name: profile?.display_name || user.email?.split('@')[0] || 'Admin',
        avatar_url: profile?.avatar_url || null,
      },
    });
  }, [user, profile]);

  return (
    <AdminPresenceContext.Provider value={{ onlineAdmins, typingAdmins, sendTyping }}>
      {children}
    </AdminPresenceContext.Provider>
  );
}

export const useAdminPresence = () => useContext(AdminPresenceContext);
