'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useAdminPresence } from '@/contexts/AdminPresenceContext';
import { supabase } from '@/lib/supabase';
import JSZip from 'jszip';
import './chat.css';

// ===========================================
// TIPOS
// ===========================================

interface ChatMessage {
  id: string;
  sender_id: string;
  sender_name: string;
  sender_avatar: string | null;
  message: string;
  message_type: 'text' | 'image' | 'file' | 'ai_response' | 'ai_request' | 'system';
  file_url: string | null;
  file_name: string | null;
  file_size: number | null;
  created_at: string;
  edited_at: string | null;
}

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  message: ChatMessage | null;
}

interface MentionUser {
  id: string;
  name: string;
  type: 'admin' | 'ai';
  icon: string;
  email?: string;
  avatar_url?: string | null;
}

interface MentionProfileCard {
  visible: boolean;
  x: number;
  y: number;
  member: MentionUser | null;
  avatar: string | null;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// IA sempre presente no chat
const AI_MEMBER: MentionUser = { id: '00000000-0000-0000-0000-000000000000', name: 'Eye AI', type: 'ai', icon: 'fa-solid fa-robot' };

// ===========================================
// COMPONENTE PRINCIPAL
// ===========================================

export default function AdminChatPage() {
  const router = useRouter();
  const { user, profile, isAuthenticated, isAdmin, loading } = useAuth();
  
  // Verificar MFA
  const isMfaVerified = () => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('mfa_verified') === 'true';
  };

  // ═══ ESTADO ═══
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [aiAvailable, setAiAvailable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Context menu
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false, x: 0, y: 0, message: null
  });
  
  // Edit mode
  const [editingMessage, setEditingMessage] = useState<{ id: string; text: string } | null>(null);
  
  // Pending files (preview before sending)
  const [pendingFiles, setPendingFiles] = useState<{ file: File; previewUrl: string | null }[]>([]);
  
  // Mentions
  const [showMentions, setShowMentions] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [mentionIndex, setMentionIndex] = useState(0);
  
  // Mention profile card
  const [mentionProfileCard, setMentionProfileCard] = useState<MentionProfileCard>({
    visible: false, x: 0, y: 0, member: null, avatar: null
  });
  
  // Sidebar
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Clear chat confirmation
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  
  // Online presence + typing (geridos pelo AdminPresenceContext no layout)
  const { onlineAdmins, typingAdmins, sendTyping } = useAdminPresence();
  
  // Membros do chat (carregados dinamicamente do Supabase)
  const [chatMembers, setChatMembers] = useState<MentionUser[]>([AI_MEMBER]);
  
  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const profileCardRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // ═══ AUTH REDIRECT ═══
  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) { router.push('/login'); return; }
    if (!isAdmin) { router.push('/perfil'); return; }
    if (!isMfaVerified()) { router.push('/admin/mfa'); return; }
  }, [isAuthenticated, isAdmin, loading, router]);

  // ═══ SCROLL ═══
  const scrollToBottom = useCallback((smooth = true) => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ 
        behavior: smooth ? 'smooth' : 'instant' 
      });
    }, 100);
  }, []);

  // ═══ CARREGAR MENSAGENS ═══
  const loadMessages = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/admin/chat/messages?limit=100`);
      if (!response.ok) throw new Error('Erro ao carregar mensagens');
      
      const data = await response.json();
      setMessages(data.messages || []);
      setIsLoadingMessages(false);
      scrollToBottom(false);
    } catch (err: any) {
      console.error('Erro ao carregar mensagens:', err);
      setError('Erro ao carregar mensagens');
      setIsLoadingMessages(false);
    }
  }, [scrollToBottom]);

  // ═══ VERIFICAR IA ═══
  const checkAiStatus = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/admin/chat/ai/status`);
      const data = await response.json();
      setAiAvailable(data.available);
    } catch {
      setAiAvailable(false);
    }
  }, []);

  // Carregar ao montar
  useEffect(() => {
    if (!loading && isAuthenticated && isAdmin) {
      loadMessages();
      checkAiStatus();
    }
  }, [loading, isAuthenticated, isAdmin, loadMessages, checkAiStatus]);

  // Carregar membros dinamicamente via API (backend usa SERVICE_KEY, sem RLS)
  useEffect(() => {
    if (!isAuthenticated || !isAdmin) return;
    
    const loadMembers = async () => {
      try {
        const response = await fetch(`${API_URL}/api/admin/chat/members`);
        if (!response.ok) throw new Error('Erro ao carregar membros');
        const data = await response.json();
        
        if (data.members && data.members.length > 0) {
          const admins: MentionUser[] = data.members.map((p: any) => ({
            id: p.id,
            name: p.name || 'Admin',
            type: 'admin' as const,
            icon: 'fa-solid fa-user-shield',
            email: p.email,
            avatar_url: p.avatar_url || null,
          }));
          
          setChatMembers([...admins, AI_MEMBER]);
        }
      } catch (err) {
        console.error('Erro ao carregar membros:', err);
        // Fallback: tentar Supabase direto (funciona para Samuka via RLS)
        try {
          const { data: adminProfiles } = await supabase
            .from('profiles')
            .select('id, display_name, avatar_url, email, role')
            .eq('role', 'admin');
          
          if (adminProfiles && adminProfiles.length > 0) {
            const admins: MentionUser[] = adminProfiles.map((p: any) => ({
              id: p.id,
              name: p.display_name || p.email?.split('@')[0] || 'Admin',
              type: 'admin' as const,
              icon: 'fa-solid fa-user-shield',
              email: p.email,
              avatar_url: p.avatar_url || null,
            }));
            setChatMembers([...admins, AI_MEMBER]);
          }
        } catch {}
      }
    };
    
    loadMembers();
    
    // Subscrever a mudancas nos perfis (nome, avatar, etc.)
    const profilesChannel = supabase
      .channel('chat-profiles-sync')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles' },
        () => { loadMembers(); }
      )
      .subscribe();
    
    return () => { supabase.removeChannel(profilesChannel); };
  }, [isAuthenticated, isAdmin]);

  // ═══ REALTIME ═══
  useEffect(() => {
    if (!isAuthenticated || !isAdmin) return;

    const channel = supabase
      .channel('admin-chat-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'admin_chat_messages' },
        (payload) => {
          const newMsg = payload.new as ChatMessage;
          setMessages(prev => {
            if (prev.some(m => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
          scrollToBottom();
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'admin_chat_messages' },
        (payload) => {
          const deletedId = payload.old?.id;
          if (deletedId) {
            setMessages(prev => prev.filter(m => m.id !== deletedId));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'admin_chat_messages' },
        (payload) => {
          const updated = payload.new as ChatMessage;
          setMessages(prev => prev.map(m => m.id === updated.id ? updated : m));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAuthenticated, isAdmin, scrollToBottom]);

  // Presença gerida pelo AdminPresenceContext (admin/layout.tsx)
  // onlineAdmins + typingAdmins + sendTyping vêm do contexto partilhado

  // ═══ FECHAR CONTEXT MENU AO CLICAR FORA ═══
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenu.visible && contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(prev => ({ ...prev, visible: false }));
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [contextMenu.visible]);

  // ═══ FECHAR PROFILE CARD AO CLICAR FORA ═══
  useEffect(() => {
    const handleClickOutsideProfile = (e: MouseEvent) => {
      if (mentionProfileCard.visible && profileCardRef.current && !profileCardRef.current.contains(e.target as Node)) {
        setMentionProfileCard(prev => ({ ...prev, visible: false }));
      }
    };
    document.addEventListener('mousedown', handleClickOutsideProfile);
    return () => document.removeEventListener('mousedown', handleClickOutsideProfile);
  }, [mentionProfileCard.visible]);

  // ═══ AVATARES DOS MEMBROS (derivado das mensagens) ═══
  const memberAvatars = useMemo(() => {
    const avatars: Record<string, string> = {};
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg.sender_avatar && !avatars[msg.sender_name]) {
        avatars[msg.sender_name] = msg.sender_avatar;
      }
    }
    return avatars;
  }, [messages]);

  // Regex dinamica para mencoes (baseada nos membros carregados)
  const mentionRegex = useMemo(() => {
    const names = chatMembers
      .filter(m => m.type === 'admin')
      .map(m => m.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('|');
    return new RegExp(`(@(?:eye|ia|ai${names ? '|' + names : ''}))`, 'gi');
  }, [chatMembers]);

  // ===========================================
  // HANDLERS
  // ===========================================

  // ═══ HELPERS PARA EXTRAIR FICHEIROS DE ZIP ═══
  const isTextFile = (name: string, mime?: string): boolean => {
    if (mime && ['text/plain', 'text/csv', 'text/html', 'text/css', 'text/javascript', 'application/json', 'application/xml'].includes(mime)) return true;
    return /\.(txt|csv|json|xml|html|css|js|ts|py|md|log|yml|yaml|ini|cfg|env|sh|bat|sql)$/i.test(name);
  };
  
  const isImageFile = (name: string, mime?: string): boolean => {
    if (mime && mime.startsWith('image/')) return true;
    return /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(name);
  };
  
  const isZipFile = (name: string, mime?: string): boolean => {
    if (mime && ['application/zip', 'application/x-zip-compressed'].includes(mime)) return true;
    return /\.zip$/i.test(name);
  };
  
  const isNonExtractableArchive = (name: string, mime?: string): boolean => {
    if (mime && ['application/x-rar-compressed', 'application/x-7z-compressed', 'application/vnd.rar'].includes(mime)) return true;
    return /\.(rar|7z)$/i.test(name);
  };

  const extractZipContents = async (file: File): Promise<{ images: { name: string; base64: string }[]; texts: { name: string; content: string }[] }> => {
    const images: { name: string; base64: string }[] = [];
    const texts: { name: string; content: string }[] = [];
    try {
      const zip = await JSZip.loadAsync(file);
      const entries = Object.values(zip.files).filter(f => !f.dir);
      for (const entry of entries) {
        if (isImageFile(entry.name)) {
          const blob = await entry.async('blob');
          const ext = entry.name.split('.').pop()?.toLowerCase() || 'png';
          const mimeType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : ext === 'webp' ? 'image/webp' : 'image/png';
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(new File([blob], entry.name, { type: mimeType }));
          });
          images.push({ name: entry.name, base64 });
        } else if (isTextFile(entry.name)) {
          const content = await entry.async('string');
          texts.push({ name: entry.name, content });
        }
      }
    } catch (e) {
      console.warn('Nao foi possivel extrair ZIP:', e);
    }
    return { images, texts };
  };

  // ═══ ENVIAR MENSAGEM ═══
  const handleSend = async () => {
    const hasText = newMessage.trim().length > 0;
    const hasFiles = pendingFiles.length > 0;
    if ((!hasText && !hasFiles) || isSending || !user) return;

    const messageText = newMessage.trim();
    const isAiCall = hasText && /@(eye|ia|ai)\b/i.test(messageText);

    setNewMessage('');
    setShowMentions(false);
    setIsSending(true);
    setError(null);

    try {
      // Guardar info dos ficheiros antes de limpar (para usar na chamada AI)
      const savedFiles = [...pendingFiles];
      const uploadedFilesData: { file: File; url: string }[] = [];
      
      // Se tem ficheiros pendentes, fazer upload de todos
      if (hasFiles) {
        for (let i = 0; i < savedFiles.length; i++) {
          const pf = savedFiles[i];
          const file = pf.file;
          const fileExt = file.name.split('.').pop();
          const fileName = `chat/${user.id}-${Date.now()}-${i}.${fileExt}`;
          const isImage = file.type.startsWith('image/');

          const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(fileName, file, { cacheControl: '3600', upsert: true });

          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage
            .from('avatars')
            .getPublicUrl(fileName);

          uploadedFilesData.push({ file, url: publicUrl });

          // Enviar mensagem de chat para cada ficheiro
          const fileLabel = savedFiles.length > 1 ? `(${i + 1}/${savedFiles.length}) ` : '';
          await fetch(`${API_URL}/api/admin/chat/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sender_id: user.id,
              sender_name: profile?.display_name || user.email?.split('@')[0] || 'Admin',
              sender_avatar: profile?.avatar_url || null,
              message: hasText && i === 0 ? messageText : (isImage ? `${fileLabel}Enviou uma imagem` : `${fileLabel}Enviou: ${file.name}`),
              message_type: isImage ? 'image' : 'file',
              file_url: publicUrl,
              file_name: file.name,
              file_size: file.size,
            }),
          });
        }

        // Limpar previews
        for (const pf of savedFiles) {
          if (pf.previewUrl) URL.revokeObjectURL(pf.previewUrl);
        }
        setPendingFiles([]);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }

      // Se so tem texto (sem ficheiro), enviar mensagem normal
      if (hasText && !hasFiles) {
        const msgData = {
          sender_id: user.id,
          sender_name: profile?.display_name || user.email?.split('@')[0] || 'Admin',
          sender_avatar: profile?.avatar_url || null,
          message: messageText,
          message_type: isAiCall ? 'ai_request' : 'text',
        };

        const response = await fetch(`${API_URL}/api/admin/chat/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(msgData),
        });

        if (!response.ok) throw new Error('Erro ao enviar mensagem');
      }

      // Se e uma chamada a IA
      if (isAiCall && aiAvailable) {
        setIsAiThinking(true);
        const aiMessage = messageText.replace(/@(eye|ia|ai)\b\s*/gi, '').trim();
        
        // Recolher imagens e ficheiros de TODOS os ficheiros enviados
        const imageUrls: string[] = [];
        const fileContents: { name: string; content: string }[] = [];
        
        // Processar todos os ficheiros uploaded
        for (const uf of uploadedFilesData) {
          const { file, url } = uf;
          
          if (file.type.startsWith('image/')) {
            // Converter imagem para base64 data URL
            try {
              const base64DataUrl = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(file);
              });
              imageUrls.push(base64DataUrl);
            } catch {
              imageUrls.push(url);
            }
          } else if (isZipFile(file.name, file.type)) {
            // Extrair conteudo de ZIP
            const zipContents = await extractZipContents(file);
            for (const img of zipContents.images) {
              if (imageUrls.length < 4) imageUrls.push(img.base64);
            }
            for (const txt of zipContents.texts) {
              fileContents.push({ name: `${file.name}/${txt.name}`, content: txt.content });
            }
            if (zipContents.images.length === 0 && zipContents.texts.length === 0) {
              fileContents.push({ name: file.name, content: '[Arquivo ZIP vazio ou sem ficheiros de texto/imagem reconhecidos]' });
            }
          } else if (isNonExtractableArchive(file.name, file.type)) {
            // RAR e 7z nao podem ser extraidos no browser
            fileContents.push({ name: file.name, content: `[Ficheiro ${file.name.split('.').pop()?.toUpperCase()} - nao e possivel extrair no browser. Para a IA analisar o conteudo, envia como .zip ou envia os ficheiros separadamente.]` });
          } else if (isTextFile(file.name, file.type)) {
            try {
              const textContent = await file.text();
              fileContents.push({ name: file.name, content: textContent });
            } catch {}
          }
        }
        
        // Verificar mensagens recentes por imagens (ultimas 5)
        const recentMsgs = messages.slice(-5);
        for (const m of recentMsgs) {
          if (m.message_type === 'image' && m.file_url && !imageUrls.includes(m.file_url)) {
            imageUrls.push(m.file_url);
          }
        }
        
        try {
          // Carregar servicos marcados como propositados pelo admin
          let intentionalList: string[] | undefined;
          try {
            const raw = localStorage.getItem('eyeweb_intentional_services');
            if (raw) { const arr = JSON.parse(raw); if (Array.isArray(arr) && arr.length > 0) intentionalList = arr; }
          } catch {}
          
          const aiResponse = await fetch(`${API_URL}/api/admin/chat/ai`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: aiMessage || (imageUrls.length > 0 ? 'Analisa esta imagem.' : 'Analisa este ficheiro.'),
              sender_name: profile?.display_name || 'Admin',
              context: messages.slice(-10).map(m => ({
                sender_name: m.sender_name,
                message: m.message,
                message_type: m.message_type,
              })),
              image_urls: imageUrls.length > 0 ? imageUrls : undefined,
              file_contents: fileContents.length > 0 ? fileContents : undefined,
              intentional_services: intentionalList,
            }),
          });

          if (!aiResponse.ok) {
            const errorData = await aiResponse.json().catch(() => null);
            const detail = errorData?.detail || `HTTP ${aiResponse.status}`;
            throw new Error(detail);
          }
          const aiData = await aiResponse.json();
          
          await fetch(`${API_URL}/api/admin/chat/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sender_id: '00000000-0000-0000-0000-000000000000',
              sender_name: 'Eye AI',
              sender_avatar: null,
              message: aiData.response,
              message_type: 'ai_response',
            }),
          });
        } catch (aiErr: any) {
          console.error('AI Error:', aiErr);
          const errDetail = aiErr?.message ? ` (${aiErr.message.slice(0, 300)})` : '';
          await fetch(`${API_URL}/api/admin/chat/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sender_id: '00000000-0000-0000-0000-000000000000',
              sender_name: 'Eye AI',
              sender_avatar: null,
              message: `⚠️ Desculpa, nao consegui processar o teu pedido.${errDetail}`,
              message_type: 'ai_response',
            }),
          });
        } finally {
          setIsAiThinking(false);
        }
      }
    } catch (err: any) {
      console.error('Erro ao enviar:', err);
      setError('Erro ao enviar mensagem');
    } finally {
      setIsSending(false);
      inputRef.current?.focus();
    }
  };

  // ═══ SELECIONAR FICHEIROS (preview antes de enviar) ═══
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newFiles: { file: File; previewUrl: string | null }[] = [];
    let totalSize = pendingFiles.reduce((acc, pf) => acc + pf.file.size, 0);
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      totalSize += file.size;
      
      if (file.size > 10 * 1024 * 1024) {
        setError(`${file.name} demasiado grande (max 10MB por ficheiro)`);
        continue;
      }
      
      if (totalSize > 25 * 1024 * 1024) {
        setError('Limite total de 25MB excedido');
        break;
      }
      
      if (pendingFiles.length + newFiles.length >= 8) {
        setError('Maximo de 8 ficheiros de uma vez');
        break;
      }
      
      const isImage = file.type.startsWith('image/');
      const previewUrl = isImage ? URL.createObjectURL(file) : null;
      newFiles.push({ file, previewUrl });
    }
    
    if (newFiles.length > 0) {
      setPendingFiles(prev => [...prev, ...newFiles]);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
    inputRef.current?.focus();
  };

  // ═══ CANCELAR FICHEIRO PENDENTE ═══
  const handleCancelFile = (index?: number) => {
    if (index !== undefined) {
      // Remover ficheiro especifico
      setPendingFiles(prev => {
        const updated = [...prev];
        if (updated[index]?.previewUrl) URL.revokeObjectURL(updated[index].previewUrl);
        updated.splice(index, 1);
        return updated;
      });
    } else {
      // Remover todos
      for (const pf of pendingFiles) {
        if (pf.previewUrl) URL.revokeObjectURL(pf.previewUrl);
      }
      setPendingFiles([]);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ═══ CONTEXT MENU ═══
  const handleContextMenu = (e: React.MouseEvent, msg: ChatMessage) => {
    e.preventDefault();
    e.stopPropagation();
    
    let x = e.clientX;
    let y = e.clientY;
    
    const menuWidth = 200;
    const menuHeight = 200;
    
    if (x + menuWidth > window.innerWidth) x = window.innerWidth - menuWidth - 10;
    if (y + menuHeight > window.innerHeight) y = window.innerHeight - menuHeight - 10;
    if (x < 10) x = 10;
    if (y < 10) y = 10;
    
    setContextMenu({ visible: true, x, y, message: msg });
  };

  // ═══ COPIAR MENSAGEM ═══
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setContextMenu(prev => ({ ...prev, visible: false }));
  };

  // ═══ INICIAR EDICAO ═══
  const handleStartEdit = (msg: ChatMessage) => {
    setEditingMessage({ id: msg.id, text: msg.message });
    setContextMenu(prev => ({ ...prev, visible: false }));
  };

  // ═══ GUARDAR EDICAO ═══
  const handleSaveEdit = async () => {
    if (!editingMessage || !editingMessage.text.trim()) return;
    
    try {
      const response = await fetch(`${API_URL}/api/admin/chat/messages/${editingMessage.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: editingMessage.text.trim() }),
      });
      
      if (!response.ok) throw new Error('Erro ao editar');
      
      const updated = await response.json();
      setMessages(prev => prev.map(m => m.id === editingMessage.id ? { ...m, ...updated } : m));
      setEditingMessage(null);
    } catch (err) {
      console.error('Erro ao editar:', err);
      setError('Erro ao editar mensagem');
    }
  };

  // ═══ CANCELAR EDICAO ═══
  const handleCancelEdit = () => {
    setEditingMessage(null);
  };

  // ═══ APAGAR MENSAGEM (ANULAR ENVIO) ═══
  const handleDelete = async (msgId: string) => {
    try {
      await fetch(`${API_URL}/api/admin/chat/messages/${msgId}`, { method: 'DELETE' });
      setMessages(prev => prev.filter(m => m.id !== msgId));
      setContextMenu(prev => ({ ...prev, visible: false }));
    } catch (err) {
      console.error('Erro ao apagar:', err);
    }
  };

  // ═══ CLICAR NUMA MENCAO (ver perfil) ═══
  const handleMentionClick = (e: React.MouseEvent, mentionText: string) => {
    e.stopPropagation();
    const nameWithoutAt = mentionText.replace('@', '').trim();
    
    const member = chatMembers.find(m => 
      m.name.toLowerCase() === nameWithoutAt.toLowerCase() ||
      (m.type === 'ai' && ['eye', 'ia', 'ai'].includes(nameWithoutAt.toLowerCase()))
    );
    
    if (!member) return;
    
    const avatarUrl = member.avatar_url || memberAvatars[member.name] || null;
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    let x = rect.left;
    let y = rect.top;
    
    const cardWidth = 280;
    const cardHeight = 150;
    
    if (x + cardWidth > window.innerWidth) x = window.innerWidth - cardWidth - 10;
    if (x < 10) x = 10;
    
    if (y - cardHeight - 10 >= 0) {
      y = y - cardHeight - 10;
    } else {
      y = rect.bottom + 10;
    }
    
    setMentionProfileCard({ visible: true, x, y, member, avatar: avatarUrl });
  };

  // ═══ ABRIR PERFIL A PARTIR DO SIDEBAR ═══
  const handleSidebarMemberClick = (member: MentionUser, e: React.MouseEvent) => {
    e.stopPropagation();
    const avatarUrl = member.avatar_url || memberAvatars[member.name] || null;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    let x = rect.left - 290;
    let y = rect.top;
    
    const cardHeight = 150;
    if (x < 10) x = rect.right + 10;
    if (y + cardHeight > window.innerHeight) y = window.innerHeight - cardHeight - 10;
    
    setMentionProfileCard({ visible: true, x, y, member, avatar: avatarUrl });
  };

  // ═══ LIMPAR CHAT INTEIRO ═══
  const handleClearChat = async () => {
    try {
      const response = await fetch(`${API_URL}/api/admin/chat/messages`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Erro ao limpar chat');
      setMessages([]);
      setShowClearConfirm(false);
    } catch (err) {
      console.error('Erro ao limpar chat:', err);
      setError('Erro ao limpar o chat');
      setShowClearConfirm(false);
    }
  };

  // ═══ INPUT COM DETECAO DE MENCOES ═══
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setNewMessage(value);
    
    // Broadcast typing (throttled pelo contexto)
    if (value.trim()) {
      sendTyping();
    }
    
    const cursorPos = e.target.selectionStart || 0;
    const textBeforeCursor = value.substring(0, cursorPos);
    const atIndex = textBeforeCursor.lastIndexOf('@');
    
    if (atIndex !== -1 && (atIndex === 0 || textBeforeCursor[atIndex - 1] === ' ' || textBeforeCursor[atIndex - 1] === '\n')) {
      const searchTerm = textBeforeCursor.substring(atIndex + 1);
      if (!searchTerm.includes(' ') || searchTerm.toLowerCase().startsWith('vanina ')) {
        setMentionSearch(searchTerm);
        setShowMentions(true);
        setMentionIndex(0);
        return;
      }
    }
    
    setShowMentions(false);
  };

  // Membros filtrados pela pesquisa
  const filteredMentions = chatMembers.filter(m => 
    m.name.toLowerCase().includes(mentionSearch.toLowerCase())
  );

  // ═══ SELECIONAR MENCAO ═══
  const handleMentionSelect = (member: MentionUser) => {
    const cursorPos = inputRef.current?.selectionStart || 0;
    const textBeforeCursor = newMessage.substring(0, cursorPos);
    const atIndex = textBeforeCursor.lastIndexOf('@');
    
    const before = newMessage.substring(0, atIndex);
    const after = newMessage.substring(cursorPos);
    
    // Para Eye AI, usar @eye que ativa a IA
    const mentionText = member.type === 'ai' ? '@eye ' : `@${member.name} `;
    
    const newText = before + mentionText + after;
    setNewMessage(newText);
    setShowMentions(false);
    
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        const newPos = (before + mentionText).length;
        inputRef.current.setSelectionRange(newPos, newPos);
      }
    }, 0);
  };

  // ═══ TECLAS ═══
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Navegacao no popup de mencoes
    if (showMentions && filteredMentions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex(prev => (prev + 1) % filteredMentions.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex(prev => (prev - 1 + filteredMentions.length) % filteredMentions.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        handleMentionSelect(filteredMentions[mentionIndex]);
        return;
      }
      if (e.key === 'Escape') {
        setShowMentions(false);
        return;
      }
    }
    
    // Enter para enviar (sem Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    
    // Escape para cancelar edicao
    if (editingMessage && e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  // ═══ RENDERIZAR TEXTO COM MENCOES DESTACADAS ═══
  const renderMessageText = (text: string) => {
    const parts = text.split(mentionRegex);
    
    if (parts.length <= 1) {
      return <p className="chat-msg-text">{text}</p>;
    }
    
    return (
      <p className="chat-msg-text">
        {parts.map((part, i) => {
          if (mentionRegex.test(part)) {
            // Reset regex lastIndex
            mentionRegex.lastIndex = 0;
            return (
              <span 
                key={i} 
                className="chat-mention clickable"
                onClick={(e) => handleMentionClick(e, part)}
              >
                {part}
              </span>
            );
          }
          return <span key={i}>{part}</span>;
        })}
      </p>
    );
  };

  // ═══ FORMATAR DATA ═══
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
      return date.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
    }
    
    return date.toLocaleDateString('pt-PT', { 
      day: '2-digit', month: '2-digit', 
      hour: '2-digit', minute: '2-digit' 
    });
  };

  // ═══ FORMATAR TAMANHO ═══
  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // ═══ HELPERS ═══
  const isOwnMessage = (msg: ChatMessage) => msg.sender_id === user?.id;
  const isAiMessage = (msg: ChatMessage) => msg.message_type === 'ai_response';
  const isSystemMessage = (msg: ChatMessage) => msg.message_type === 'system';

  // Nao mostrar nada enquanto verifica autenticacao
  if (loading || !isAuthenticated || !isAdmin || !isMfaVerified()) {
    return null;
  }

  // ===========================================
  // RENDER
  // ===========================================

  return (
    <div className="chat-container">
      {/* Header fixo */}
      <div className="chat-header">
        <button className="chat-back-btn" onClick={() => router.push('/admin')}>
          <i className="fa-solid fa-arrow-left"></i>
          Voltar
        </button>
        <div className="chat-header-center">
          <h1>
            <i className="fa-solid fa-comments"></i>
            Chat Admin
          </h1>
        </div>
        <div className="chat-header-actions">
          <button className="chat-trash-btn" onClick={() => setShowClearConfirm(true)} title="Limpar chat">
            <i className="fa-solid fa-trash"></i>
          </button>
          <button className="chat-hamburger-btn" onClick={() => setSidebarOpen(true)} title="Membros">
            <i className="fa-solid fa-bars"></i>
          </button>
        </div>
      </div>

      {/* Sidebar Membros */}
      {sidebarOpen && (
        <div className="chat-sidebar-overlay" onClick={() => setSidebarOpen(false)}>
          <div 
            ref={sidebarRef}
            className="chat-sidebar"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sidebar-header">
              <h3>Membros</h3>
              <button className="sidebar-close" onClick={() => setSidebarOpen(false)}>
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <div className="sidebar-members">
              {chatMembers.map((member) => {
                const avatarUrl = member.avatar_url || memberAvatars[member.name];
                return (
                  <button 
                    key={member.id}
                    className="sidebar-member"
                    onClick={(e) => handleSidebarMemberClick(member, e)}
                  >
                    <div className={`sidebar-member-avatar ${member.type === 'ai' ? 'ai' : ''}`}>
                      {member.type === 'ai' ? (
                        <i className="fa-solid fa-robot"></i>
                      ) : avatarUrl ? (
                        <img src={avatarUrl} alt={member.name} />
                      ) : (
                        <i className="fa-solid fa-user-shield"></i>
                      )}
                    </div>
                    <div className="sidebar-member-info">
                      <span className={`sidebar-member-name ${member.type === 'ai' ? 'ai' : ''}`}>
                        {member.name}
                      </span>
                      <span className="sidebar-member-role">
                        {member.type === 'ai' ? 'Assistente IA' : 'Administrador'}
                      </span>
                    </div>
                    {member.type === 'ai' ? (
                      <span className={`sidebar-ai-status ${aiAvailable ? 'online' : 'offline'}`}>
                        <span className="sidebar-ai-dot"></span>
                        {aiAvailable ? 'Online' : 'Offline'}
                      </span>
                    ) : (
                      <span className={`sidebar-ai-status ${onlineAdmins.has(member.id) ? 'online' : 'offline'}`}>
                        <span className="sidebar-ai-dot"></span>
                        {onlineAdmins.has(member.id) ? 'Online' : 'Offline'}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Area de mensagens */}
      <div className="chat-messages" ref={chatContainerRef}>
        {isLoadingMessages ? (
          <div className="chat-loading">
            <div className="spinner"></div>
            <p>A carregar mensagens...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="chat-empty">
            <i className="fa-solid fa-comments"></i>
            <h3>Sem mensagens</h3>
            <p>Envia a primeira mensagem para comecar a conversa.</p>
            {aiAvailable && (
              <p className="chat-empty-hint">
                Experimenta escrever <code>@eye ola!</code> para falar com a IA.
              </p>
            )}
          </div>
        ) : (
          <>
            {messages.map((msg, index) => {
              const own = isOwnMessage(msg);
              const ai = isAiMessage(msg);
              const system = isSystemMessage(msg);
              const isEditing = editingMessage?.id === msg.id;
              const showAvatar = index === 0 || 
                messages[index - 1].sender_id !== msg.sender_id ||
                (new Date(msg.created_at).getTime() - new Date(messages[index - 1].created_at).getTime()) > 300000;

              if (system) {
                return (
                  <div key={msg.id} className="chat-system-msg">
                    <span>{msg.message}</span>
                  </div>
                );
              }

              return (
                <div
                  key={msg.id}
                  className={`chat-msg ${own ? 'own' : ''} ${ai ? 'ai' : ''} ${showAvatar ? 'with-avatar' : 'grouped'}`}
                  onContextMenu={(e) => handleContextMenu(e, msg)}
                >
                  {showAvatar && !own && (
                    <div className={`chat-msg-avatar ${ai ? 'ai-avatar' : ''}`}>
                      {ai ? (
                        <i className="fa-solid fa-robot"></i>
                      ) : msg.sender_avatar ? (
                        <img src={msg.sender_avatar} alt={msg.sender_name} />
                      ) : (
                        <i className="fa-solid fa-user"></i>
                      )}
                    </div>
                  )}
                  
                  <div className="chat-msg-content">
                    {showAvatar && (
                      <div className={`chat-msg-header ${own ? 'own' : ''}`}>
                        <span className={`chat-msg-name ${ai ? 'ai-name' : ''}`}>
                          {msg.sender_name}
                        </span>
                      </div>
                    )}
                    
                    <div className="chat-msg-bubble-row">
                    <div className={`chat-msg-bubble ${own ? 'own' : ''} ${ai ? 'ai' : ''} ${msg.message_type === 'ai_request' ? 'ai-request' : ''} ${isEditing ? 'editing' : ''}`}>
                      {/* Imagem */}
                      {msg.message_type === 'image' && msg.file_url && (
                        <div className="chat-msg-image">
                          <a href={msg.file_url} target="_blank" rel="noopener noreferrer">
                            <img src={msg.file_url} alt={msg.file_name || 'Imagem'} />
                          </a>
                        </div>
                      )}
                      
                      {/* Ficheiro */}
                      {msg.message_type === 'file' && msg.file_url && (
                        <a href={msg.file_url} target="_blank" rel="noopener noreferrer" className="chat-msg-file">
                          <i className="fa-solid fa-file"></i>
                          <div>
                            <span className="file-name">{msg.file_name || 'Ficheiro'}</span>
                            <span className="file-size">{formatFileSize(msg.file_size)}</span>
                          </div>
                          <i className="fa-solid fa-download"></i>
                        </a>
                      )}
                      
                      {/* Texto - com modo de edicao */}
                      {isEditing ? (
                        <div className="chat-msg-edit-area">
                          <textarea
                            value={editingMessage.text}
                            onChange={(e) => setEditingMessage({ ...editingMessage, text: e.target.value })}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSaveEdit(); }
                              if (e.key === 'Escape') handleCancelEdit();
                            }}
                            autoFocus
                          />
                          <div className="chat-msg-edit-actions">
                            <button onClick={handleCancelEdit} className="edit-cancel">
                              <i className="fa-solid fa-xmark"></i> Cancelar
                            </button>
                            <button onClick={handleSaveEdit} className="edit-save">
                              <i className="fa-solid fa-check"></i> Guardar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {renderMessageText(msg.message)}
                          {msg.edited_at && (
                            <span className="chat-msg-edited">editado</span>
                          )}
                        </>
                      )}
                      
                    </div>
                    
                    {/* Botao 3 pontos (fora da bolha) */}
                    {!isEditing && (
                      <button 
                        className="chat-msg-actions-btn"
                        onClick={(e) => handleContextMenu(e, msg)}
                        title="Opcoes"
                      >
                        <i className="fa-solid fa-ellipsis-vertical"></i>
                      </button>
                    )}
                    </div>
                    
                    {!showAvatar && (
                      <span className="chat-msg-time-inline">{formatTime(msg.created_at)}</span>
                    )}
                  </div>
                </div>
              );
            })}
            
            {/* Indicadores de quem esta a escrever */}
            {Array.from(typingAdmins.entries()).map(([uid, { name, avatar_url }]) => {
              const memberAvatar = avatar_url || chatMembers.find(m => m.id === uid)?.avatar_url || memberAvatars[name];
              return (
                <div key={`typing-${uid}`} className="chat-msg with-avatar">
                  <div className="chat-msg-avatar">
                    {memberAvatar ? (
                      <img src={memberAvatar} alt={name} />
                    ) : (
                      <i className="fa-solid fa-user-shield"></i>
                    )}
                  </div>
                  <div className="chat-msg-content">
                    <div className="chat-msg-header">
                      <span className="chat-msg-name">{name}</span>
                    </div>
                    <div className="chat-msg-bubble thinking">
                      <div className="typing-indicator">
                        <span></span>
                        <span></span>
                        <span></span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            
            {/* Indicador IA a pensar */}
            {isAiThinking && (
              <div className="chat-msg ai with-avatar">
                <div className="chat-msg-avatar ai-avatar">
                  <i className="fa-solid fa-robot"></i>
                </div>
                <div className="chat-msg-content">
                  <div className="chat-msg-header">
                    <span className="chat-msg-name ai-name">Eye AI</span>
                  </div>
                  <div className="chat-msg-bubble ai thinking">
                    <div className="typing-indicator">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu.visible && contextMenu.message && (
        <div 
          className="chat-context-overlay"
          onClick={() => setContextMenu(prev => ({ ...prev, visible: false }))}
        >
          <div 
            ref={contextMenuRef}
            className="chat-context-menu"
            style={{ top: contextMenu.y, left: contextMenu.x }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Hora */}
            <div className="context-menu-time">
              {formatTime(contextMenu.message.created_at)}
            </div>
            
            {/* Editar (so mensagens proprias de texto) */}
            {isOwnMessage(contextMenu.message) && 
             contextMenu.message.message_type !== 'image' && 
             contextMenu.message.message_type !== 'file' && (
              <button className="context-menu-item" onClick={() => handleStartEdit(contextMenu.message!)}>
                <span>Editar</span>
                <i className="fa-solid fa-pen"></i>
              </button>
            )}
            
            {/* Copiar */}
            <button className="context-menu-item" onClick={() => handleCopy(contextMenu.message!.message)}>
              <span>Copiar</span>
              <i className="fa-regular fa-copy"></i>
            </button>
            
            {/* Anular envio (so mensagens proprias) */}
            {isOwnMessage(contextMenu.message) && (
              <button className="context-menu-item danger" onClick={() => handleDelete(contextMenu.message!.id)}>
                <span>Anular envio</span>
                <i className="fa-solid fa-clock-rotate-left"></i>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Mention Profile Card */}
      {mentionProfileCard.visible && mentionProfileCard.member && (
        <div 
          className="mention-profile-overlay"
          onClick={() => setMentionProfileCard(prev => ({ ...prev, visible: false }))}
        >
          <div 
            ref={profileCardRef}
            className="mention-profile-card"
            style={{ top: mentionProfileCard.y, left: mentionProfileCard.x }}
            onClick={(e) => e.stopPropagation()}
          >
            {mentionProfileCard.member.type === 'ai' ? (
              <>
                <div className="profile-card-avatar ai">
                  <i className="fa-solid fa-robot"></i>
                </div>
                <div className="profile-card-info">
                  <span className="profile-card-name ai">Eye AI</span>
                  <span className="profile-card-role">
                    <i className="fa-solid fa-microchip"></i> Chat IA
                  </span>
                  <span className="profile-card-detail">
                    <i className="fa-solid fa-brain"></i> Assistente Inteligente
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className="profile-card-avatar">
                  {mentionProfileCard.avatar ? (
                    <img src={mentionProfileCard.avatar} alt={mentionProfileCard.member.name} />
                  ) : (
                    <i className="fa-solid fa-user-shield"></i>
                  )}
                </div>
                <div className="profile-card-info">
                  <span className="profile-card-name">{mentionProfileCard.member.name}</span>
                  <span className="profile-card-role">
                    <i className="fa-solid fa-shield-halved"></i> Administrador
                  </span>
                  {mentionProfileCard.member.email && (
                    <span className="profile-card-detail">
                      <i className="fa-solid fa-envelope"></i> {mentionProfileCard.member.email}
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Erro */}
      {error && (
        <div className="chat-error">
          <i className="fa-solid fa-circle-exclamation"></i>
          <span>{error}</span>
          <button onClick={() => setError(null)}>
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>
      )}

      {/* Modal de confirmacao para limpar chat */}
      {showClearConfirm && (
        <div className="chat-clear-overlay" onClick={() => setShowClearConfirm(false)}>
          <div className="chat-clear-modal" onClick={(e) => e.stopPropagation()}>
            <div className="clear-modal-icon">
              <i className="fa-solid fa-trash"></i>
            </div>
            <h3>Limpar todo o chat?</h3>
            <p>Esta ação vai apagar todas as mensagens permanentemente. Não pode ser desfeita.</p>
            <div className="clear-modal-actions">
              <button className="clear-modal-cancel" onClick={() => setShowClearConfirm(false)}>
                Cancelar
              </button>
              <button className="clear-modal-confirm" onClick={handleClearChat}>
                <i className="fa-solid fa-trash"></i> Apagar tudo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="chat-input-area">
        <input
          ref={fileInputRef}
          type="file"
          style={{ display: 'none' }}
          onChange={handleFileSelect}
          accept="image/*,.pdf,.doc,.docx,.txt,.zip,.rar,.7z,.csv,.json,.xml,.html,.css,.js,.ts,.py,.md,.log,.yml,.yaml,.sql"
          multiple
        />
        
        <button 
          className="chat-input-btn attach"
          onClick={() => fileInputRef.current?.click()}
          disabled={isSending}
          title="Anexar ficheiro"
        >
          <i className="fa-solid fa-paperclip"></i>
        </button>
        
        <div className="chat-input-wrapper">
          {/* Preview dos ficheiros pendentes */}
          {pendingFiles.length > 0 && (
            <div className="chat-files-preview">
              {pendingFiles.length > 1 && (
                <div className="files-preview-header">
                  <span>{pendingFiles.length} ficheiros selecionados</span>
                  <button className="files-preview-clear" onClick={() => handleCancelFile()} title="Remover todos">
                    <i className="fa-solid fa-xmark"></i> Limpar todos
                  </button>
                </div>
              )}
              <div className="files-preview-grid">
                {pendingFiles.map((pf, idx) => (
                  <div key={idx} className="chat-file-preview">
                    {pf.previewUrl ? (
                      <img src={pf.previewUrl} alt="Preview" className="file-preview-img" />
                    ) : pf.file.name.match(/\.(zip|rar|7z)$/i) ? (
                      <i className="fa-solid fa-file-zipper file-preview-icon"></i>
                    ) : (
                      <i className="fa-solid fa-file file-preview-icon"></i>
                    )}
                    <div className="file-preview-info">
                      <span className="file-preview-name">{pf.file.name}</span>
                      <span className="file-preview-size">{formatFileSize(pf.file.size)}</span>
                    </div>
                    <button className="file-preview-remove" onClick={() => handleCancelFile(idx)} title="Remover">
                      <i className="fa-solid fa-xmark"></i>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Popup de mencoes */}
          {showMentions && filteredMentions.length > 0 && (
            <div className="chat-mentions-popup">
              {filteredMentions.map((member, idx) => {
                const avatarUrl = member.avatar_url || memberAvatars[member.name];
                return (
                  <button
                    key={member.name}
                    className={`mention-item ${idx === mentionIndex ? 'active' : ''}`}
                    onClick={() => handleMentionSelect(member)}
                    onMouseEnter={() => setMentionIndex(idx)}
                  >
                    <div className="mention-avatar">
                      {member.type === 'ai' ? (
                        <i className="fa-solid fa-robot"></i>
                      ) : avatarUrl ? (
                        <img src={avatarUrl} alt={member.name} />
                      ) : (
                        <i className="fa-solid fa-user-shield"></i>
                      )}
                    </div>
                    <span>{member.name}</span>
                    {member.type === 'ai' && <span className="mention-badge">IA</span>}
                  </button>
                );
              })}
            </div>
          )}
          
          <textarea
            ref={inputRef}
            value={newMessage}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={aiAvailable ? 'Escreve uma mensagem ou @eye para chamar a IA...' : 'Escreve uma mensagem...'}
            rows={1}
            disabled={isSending}
          />
        </div>
        
        <button 
          className="chat-input-btn send"
          onClick={handleSend}
          disabled={isSending || (!newMessage.trim() && pendingFiles.length === 0)}
          title="Enviar"
        >
          {isSending ? (
            <i className="fa-solid fa-spinner fa-spin"></i>
          ) : (
            <i className="fa-solid fa-paper-plane"></i>
          )}
        </button>
      </div>
    </div>
  );
}
