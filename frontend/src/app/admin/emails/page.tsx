'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import './emails.css';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface Subscriber {
  id: string;
  email: string;
  display_name: string | null;
  subscribed_at: string | null;
}

interface BannedUser {
  id: string;
  email: string;
  display_name: string | null;
  banned_at: string | null;
  created_at: string | null;
}

interface AdminEmail {
  id: string;
  email: string;
  display_name: string | null;
}

interface BroadcastResponse {
  success: boolean;
  message: string;
  total_recipients: number;
  successful_sends: number;
  failed_sends: number;
  failed_emails: string[] | null;
}

type Tab = 'compose' | 'subscribers' | 'banned';

export default function EmailManagerPage() {
  const router = useRouter();
  const { isAuthenticated, isAdmin, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('compose');
  
  const isMfaVerified = () => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('mfa_verified') === 'true';
  };
  
  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) { router.push('/login'); return; }
    if (!isAdmin) { router.push('/perfil'); return; }
    if (!isMfaVerified()) { router.push('/admin/mfa'); return; }
  }, [isAuthenticated, isAdmin, loading, router]);
  
  // ─── Compose State ───
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [testMode, setTestMode] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [sendResult, setSendResult] = useState<BroadcastResponse | null>(null);
  const [isFadingOut, setIsFadingOut] = useState(false);
  
  // ─── Admin Email Selector (Test Mode) ───
  const [showAdminSelector, setShowAdminSelector] = useState(false);
  const [adminEmails, setAdminEmails] = useState<AdminEmail[]>([]);
  const [selectedAdminEmails, setSelectedAdminEmails] = useState<Set<string>>(new Set());
  
  // ─── Subscribers State ───
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [totalSubscribers, setTotalSubscribers] = useState(0);
  const [isLoadingSubscribers, setIsLoadingSubscribers] = useState(false);
  
  // ─── Banned Users State ───
  const [bannedUsers, setBannedUsers] = useState<BannedUser[]>([]);
  const [isLoadingBanned, setIsLoadingBanned] = useState(false);
  
  // ─── Modals ───
  const [confirmModal, setConfirmModal] = useState<{
    show: boolean;
    type: 'ban' | 'unban' | 'delete';
    userId: string;
    email: string;
    reason: string;
  } | null>(null);
  const [editModal, setEditModal] = useState<{
    show: boolean;
    userId: string;
    email: string;
    currentName: string;
    newName: string;
    reason: string;
  } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  
  // ─── Reason Options (always in English — sent in user-facing emails) ───
  const banReasons = [
    'Violation of terms of service',
    'Abusive behavior or harassment',
    'Spam or unwanted content',
    'Unauthorized access attempt',
    'Suspicious or fraudulent activity',
    'Misuse of site tools',
    'Sharing malicious content',
  ];
  const deleteReasons = [
    'User request',
    'Account inactive for extended period',
    'Serious violation of terms of service',
    'Duplicate account',
    'Suspicious or fraudulent activity',
    'Spam or platform abuse',
  ];
  const editReasons = [
    'Inappropriate or offensive name',
    'Name with false information',
    'User request',
    'Administrative correction',
    'Violation of terms of service',
  ];
  
  // ─── Data Loading ───
  const loadSubscribers = async () => {
    setIsLoadingSubscribers(true);
    try {
      const r = await fetch(`${API}/api/admin/emails/subscribers`);
      if (r.ok) {
        const data = await r.json();
        setSubscribers(data.subscribers || []);
        setTotalSubscribers(data.total_subscribers || 0);
      }
    } catch (e) { console.error('Erro ao carregar subscritores:', e); }
    finally { setIsLoadingSubscribers(false); }
  };
  
  const loadBannedUsers = async () => {
    setIsLoadingBanned(true);
    try {
      const r = await fetch(`${API}/api/admin/users/banned`);
      if (r.ok) {
        const data = await r.json();
        setBannedUsers(data.banned_users || []);
      }
    } catch (e) { console.error('Erro ao carregar banidos:', e); }
    finally { setIsLoadingBanned(false); }
  };
  
  const loadAdminEmails = async () => {
    try {
      const r = await fetch(`${API}/api/admin/users/admins`);
      if (r.ok) {
        const data = await r.json();
        setAdminEmails(data.admins || []);
        // Pre-select all
        setSelectedAdminEmails(new Set((data.admins || []).map((a: AdminEmail) => a.email)));
      }
    } catch (e) { console.error('Erro ao carregar admins:', e); }
  };
  
  useEffect(() => {
    loadSubscribers();
    loadAdminEmails();
  }, []);
  
  useEffect(() => {
    if (activeTab === 'banned') loadBannedUsers();
  }, [activeTab]);
  
  // ─── Send Email ───
  const handleSendEmail = async () => {
    if (!subject.trim() || !message.trim()) {
      alert('Preenche o assunto e a mensagem');
      return;
    }
    
    if (testMode) {
      setShowAdminSelector(true);
      return;
    }
    
    await doSendEmail([]);
  };
  
  const doSendEmail = async (testEmails: string[]) => {
    setIsSending(true);
    setSendResult(null);
    
    try {
      const r = await fetch(`${API}/api/admin/emails/broadcast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: subject.trim(),
          message: message.trim(),
          test_mode: testMode,
          test_emails: testMode ? testEmails : undefined,
        }),
      });
      
      const data: BroadcastResponse = await r.json();
      setSendResult(data);
      
      setTimeout(() => {
        setIsFadingOut(true);
        setTimeout(() => {
          setSubject('');
          setMessage('');
          setSendResult(null);
          setIsFadingOut(false);
        }, 500);
      }, 1500);
    } catch (e) {
      console.error('Erro ao enviar email:', e);
      setSendResult({
        success: false,
        message: 'Erro de conexão ao servidor',
        total_recipients: 0,
        successful_sends: 0,
        failed_sends: 0,
        failed_emails: null,
      });
    } finally {
      setIsSending(false);
    }
  };
  
  // ─── User Actions ───
  const handleBan = async (userId: string) => {
    setActionLoading(true);
    try {
      const r = await fetch(`${API}/api/admin/users/ban`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, reason: confirmModal?.reason || undefined }),
      });
      if (r.ok) {
        await loadSubscribers();
        if (activeTab === 'banned') await loadBannedUsers();
      } else {
        const data = await r.json();
        alert(data.detail || 'Erro ao banir utilizador');
      }
    } catch (e) { alert('Erro de conexão'); }
    finally { setActionLoading(false); setConfirmModal(null); }
  };
  
  const handleUnban = async (userId: string) => {
    setActionLoading(true);
    try {
      const r = await fetch(`${API}/api/admin/users/unban`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      });
      if (r.ok) {
        await loadBannedUsers();
        await loadSubscribers();
      } else {
        const data = await r.json();
        alert(data.detail || 'Erro ao desbanir');
      }
    } catch (e) { alert('Erro de conexão'); }
    finally { setActionLoading(false); setConfirmModal(null); }
  };
  
  const handleDelete = async (userId: string) => {
    setActionLoading(true);
    try {
      const reasonParam = confirmModal?.reason ? `?reason=${encodeURIComponent(confirmModal.reason)}` : '';
      const r = await fetch(`${API}/api/admin/users/${userId}${reasonParam}`, { method: 'DELETE' });
      if (r.ok) {
        await loadSubscribers();
        await loadBannedUsers();
      } else {
        const data = await r.json();
        alert(data.detail || 'Erro ao eliminar');
      }
    } catch (e) { alert('Erro de conexão'); }
    finally { setActionLoading(false); setConfirmModal(null); }
  };
  
  const handleEditName = async () => {
    if (!editModal || !editModal.newName.trim()) return;
    setActionLoading(true);
    try {
      const r = await fetch(`${API}/api/admin/users/update-name`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: editModal.userId,
          display_name: editModal.newName.trim(),
          reason: editModal.reason || undefined,
        }),
      });
      if (r.ok) {
        await loadSubscribers();
        if (activeTab === 'banned') await loadBannedUsers();
      }
    } catch (e) { alert('Erro de conexão'); }
    finally { setActionLoading(false); setEditModal(null); }
  };
  
  // ─── Helpers ───
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('pt-PT', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };
  
  const allAdminsSelected = adminEmails.length > 0 && selectedAdminEmails.size === adminEmails.length;
  
  const toggleAdminEmail = (email: string) => {
    setSelectedAdminEmails(prev => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
  };
  
  const toggleAllAdmins = () => {
    if (allAdminsSelected) {
      setSelectedAdminEmails(new Set());
    } else {
      setSelectedAdminEmails(new Set(adminEmails.map(a => a.email)));
    }
  };
  
  if (loading || !isAuthenticated || !isAdmin || !isMfaVerified()) return null;
  
  return (
    <div className="emails-container">
      {/* Back Button */}
      <div className="back-btn-wrapper">
        <button className="back-btn" onClick={() => router.push('/admin')}>
          <i className="fa-solid fa-arrow-left"></i>
          Voltar
        </button>
      </div>
      
      {/* Header */}
      <div className="emails-header">
        <h1>
          <i className="fa-solid fa-envelope"></i>
          Gestor de E-Mails
        </h1>
        <div className="header-stats">
          <span className="stat-badge">
            <i className="fa-solid fa-users"></i>
            {totalSubscribers} subscritores
          </span>
        </div>
      </div>
      
      {/* Tabs */}
      <div className="emails-tabs">
        <button
          className={`tab-btn ${activeTab === 'compose' ? 'active' : ''}`}
          onClick={() => setActiveTab('compose')}
        >
          Escrever Email
        </button>
        <button
          className={`tab-btn ${activeTab === 'subscribers' ? 'active' : ''}`}
          onClick={() => setActiveTab('subscribers')}
        >
          Subscritores
        </button>
        <button
          className={`tab-btn ${activeTab === 'banned' ? 'active' : ''}`}
          onClick={() => setActiveTab('banned')}
        >
          Contas Banidas
        </button>
      </div>
      
      {/* Content */}
      <div className="emails-content">
        
        {/* ═══ TAB: COMPOSE ═══ */}
        {activeTab === 'compose' && (
          <div className="compose-section">
            <div className="compose-card">
              <h2>Enviar E-mails</h2>
              
              {/* Send Mode Toggle */}
              <div className="send-mode-toggle">
                <label className={`mode-option ${testMode ? 'active' : ''}`}>
                  <input type="radio" name="sendMode" checked={testMode} onChange={() => setTestMode(true)} />
                  <span>Modo Teste</span>
                </label>
                <label className={`mode-option ${!testMode ? 'active' : ''}`}>
                  <input type="radio" name="sendMode" checked={!testMode} onChange={() => setTestMode(false)} />
                  <span>Enviar Novidades</span>
                </label>
              </div>
              
              {/* Form */}
              <div className="compose-form">
                <div className="form-group">
                  <label htmlFor="subject">
                    <i className="fa-solid fa-heading"></i>
                    Assunto
                  </label>
                  <input
                    id="subject"
                    type="text"
                    placeholder="Assunto do comunicado"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    maxLength={100}
                  />
                  <span className="char-count">{subject.length}/100</span>
                </div>
                
                <div className="form-group">
                  <label htmlFor="message">
                    <i className="fa-solid fa-message"></i>
                    Mensagem
                  </label>
                  <textarea
                    id="message"
                    placeholder="Escreva a sua mensagem."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={10}
                  />
                  <small className="form-hint">
                    A sua mensagem suporta HTML básico: &lt;strong&gt;, &lt;em&gt;, &lt;br&gt;, &lt;p&gt;, &lt;ul&gt;, &lt;li&gt;
                  </small>
                </div>
                
                {/* Result */}
                {sendResult && (
                  <div className={`send-result ${sendResult.success ? 'success' : 'error'} ${isFadingOut ? 'fade-out' : ''}`}>
                    <div className="result-content">
                      <strong>Emails enviados: {sendResult.successful_sends}/{sendResult.total_recipients}</strong>
                      {sendResult.failed_sends > 0 && (
                        <span>Erro: {sendResult.failed_sends} email(s) não enviado(s)</span>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Send Button */}
                <button
                  className="send-btn"
                  onClick={handleSendEmail}
                  disabled={isSending || !subject.trim() || !message.trim()}
                >
                  {isSending ? (
                    <>
                      <div className="spinner-small"></div>
                      A enviar...
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-paper-plane"></i>
                      Enviar Email
                    </>
                  )}
                </button>
                
                {!testMode && (
                  <p className="warning-text-simple">
                    Este email será enviado para todos os subscritores.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
        
        {/* ═══ TAB: SUBSCRIBERS ═══ */}
        {activeTab === 'subscribers' && (
          <div className="subscribers-section">
            <div className="subscribers-card">
              <div className="subscribers-header">
                <h2>Lista de Subscritores</h2>
                <button className="refresh-btn" onClick={loadSubscribers} disabled={isLoadingSubscribers}>
                  <i className={`fa-solid fa-rotate ${isLoadingSubscribers ? 'fa-spin' : ''}`}></i>
                </button>
              </div>
              
              {isLoadingSubscribers ? (
                <div className="loading-state">
                  <div className="spinner"></div>
                  <p>A carregar subscritores...</p>
                </div>
              ) : subscribers.length === 0 ? (
                <div className="empty-state">
                  <i className="fa-solid fa-inbox"></i>
                  <p>Nenhum subscritor encontrado</p>
                </div>
              ) : (
                <div className="subscribers-table-wrapper">
                  <table className="subscribers-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Email</th>
                        <th>Nome</th>
                        <th>Registado em</th>
                        <th>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {subscribers.map((sub, index) => (
                        <tr key={sub.id || sub.email}>
                          <td className="row-number">{index + 1}</td>
                          <td className="email-cell">{sub.email}</td>
                          <td className="name-cell">
                            {sub.display_name || <span className="no-name">Sem nome</span>}
                          </td>
                          <td className="date-cell">{formatDate(sub.subscribed_at)}</td>
                          <td className="actions-cell">
                            <button
                              className="action-icon-btn edit"
                              title="Editar nome"
                              onClick={() => setEditModal({
                                show: true,
                                userId: sub.id,
                                email: sub.email,
                                currentName: sub.display_name || '',
                                newName: sub.display_name || '',
                                reason: '',
                              })}
                            >
                              <i className="fa-solid fa-pen"></i>
                            </button>
                            <button
                              className="action-icon-btn delete"
                              title="Eliminar conta"
                              onClick={() => setConfirmModal({ show: true, type: 'delete', userId: sub.id, email: sub.email, reason: '' })}
                            >
                              <i className="fa-solid fa-trash"></i>
                            </button>
                            <button
                              className="action-icon-btn ban"
                              title="Banir utilizador"
                              onClick={() => setConfirmModal({ show: true, type: 'ban', userId: sub.id, email: sub.email, reason: '' })}
                            >
                              <i className="fa-solid fa-ban"></i>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* ═══ TAB: BANNED ═══ */}
        {activeTab === 'banned' && (
          <div className="subscribers-section">
            <div className="subscribers-card">
              <div className="subscribers-header">
                <h2>Contas Banidas</h2>
                <button className="refresh-btn" onClick={loadBannedUsers} disabled={isLoadingBanned}>
                  <i className={`fa-solid fa-rotate ${isLoadingBanned ? 'fa-spin' : ''}`}></i>
                </button>
              </div>
              
              {isLoadingBanned ? (
                <div className="loading-state">
                  <div className="spinner"></div>
                  <p>A carregar...</p>
                </div>
              ) : bannedUsers.length === 0 ? (
                <div className="empty-state">
                  <i className="fa-solid fa-check-circle"></i>
                  <p>Nenhuma conta banida</p>
                </div>
              ) : (
                <div className="subscribers-table-wrapper">
                  <table className="subscribers-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Email</th>
                        <th>Nome</th>
                        <th>Banido em</th>
                        <th>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bannedUsers.map((user, index) => (
                        <tr key={user.id}>
                          <td className="row-number">{index + 1}</td>
                          <td className="email-cell">{user.email}</td>
                          <td className="name-cell">
                            {user.display_name || <span className="no-name">Sem nome</span>}
                          </td>
                          <td className="date-cell">{formatDate(user.banned_at)}</td>
                          <td className="actions-cell">
                            <button
                              className="action-icon-btn unban"
                              title="Remover ban"
                              onClick={() => setConfirmModal({ show: true, type: 'unban', userId: user.id, email: user.email, reason: '' })}
                            >
                              <i className="fa-solid fa-lock-open"></i>
                            </button>
                            <button
                              className="action-icon-btn delete"
                              title="Eliminar conta permanentemente"
                              onClick={() => setConfirmModal({ show: true, type: 'delete', userId: user.id, email: user.email, reason: '' })}
                            >
                              <i className="fa-solid fa-trash"></i>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      
      {/* ═══ ADMIN EMAIL SELECTOR MODAL (Test Mode) ═══ */}
      {showAdminSelector && (
        <div className="modal-overlay" onClick={() => setShowAdminSelector(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>
              <i className="fa-solid fa-flask"></i>
              Selecionar Destinatários (Teste)
            </h3>
            <p className="modal-desc">Escolhe quais administradores receberão o email de teste:</p>
            
            <div className="admin-selector-list">
              <label className="admin-selector-item select-all">
                <input
                  type="checkbox"
                  checked={allAdminsSelected}
                  onChange={toggleAllAdmins}
                />
                <span>Selecionar Todos</span>
              </label>
              {adminEmails.map((admin) => (
                <label key={admin.email} className="admin-selector-item">
                  <input
                    type="checkbox"
                    checked={selectedAdminEmails.has(admin.email)}
                    onChange={() => toggleAdminEmail(admin.email)}
                  />
                  <span>{admin.display_name || admin.email}</span>
                  <small>{admin.email}</small>
                </label>
              ))}
            </div>
            
            <div className="modal-actions">
              <button className="modal-cancel" onClick={() => setShowAdminSelector(false)}>
                Cancelar
              </button>
              <button
                className="modal-confirm"
                disabled={selectedAdminEmails.size === 0 || isSending}
                onClick={() => {
                  setShowAdminSelector(false);
                  doSendEmail(Array.from(selectedAdminEmails));
                }}
              >
                {isSending ? (
                  <i className="fa-solid fa-spinner fa-spin"></i>
                ) : (
                  <i className="fa-solid fa-paper-plane"></i>
                )}
                Enviar para {selectedAdminEmails.size} admin{selectedAdminEmails.size !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* ═══ CONFIRM ACTION MODAL ═══ */}
      {confirmModal && (
        <div className="modal-overlay" onClick={() => !actionLoading && setConfirmModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>
              <i className={`fa-solid ${
                confirmModal.type === 'ban' ? 'fa-ban' :
                confirmModal.type === 'unban' ? 'fa-lock-open' : 'fa-trash'
              }`}></i>
              {confirmModal.type === 'ban' && 'Banir Utilizador'}
              {confirmModal.type === 'unban' && 'Remover Ban'}
              {confirmModal.type === 'delete' && 'Eliminar Conta'}
            </h3>
            <p className="modal-desc">
              {confirmModal.type === 'ban' && (
                <>Tens a certeza que queres banir <strong>{confirmModal.email}</strong>? O utilizador não poderá iniciar sessão.</>
              )}
              {confirmModal.type === 'unban' && (
                <>Queres remover o ban de <strong>{confirmModal.email}</strong>? O utilizador poderá iniciar sessão novamente.</>
              )}
              {confirmModal.type === 'delete' && (
                <>Tens a certeza que queres eliminar permanentemente a conta <strong>{confirmModal.email}</strong>? Esta ação é irreversível.</>
              )}
            </p>
            {confirmModal.type !== 'unban' && (
              <div className="modal-field">
                <label className="modal-field-label">Reason (required to notify by email):</label>
                <select
                  className="modal-reason-select"
                  value={confirmModal.reason}
                  onChange={(e) => setConfirmModal({ ...confirmModal, reason: e.target.value })}
                >
                  <option value="">-- Select reason --</option>
                  {(confirmModal.type === 'ban' ? banReasons : deleteReasons).map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="modal-actions">
              <button className="modal-cancel" disabled={actionLoading} onClick={() => setConfirmModal(null)}>
                Cancelar
              </button>
              <button
                className={`modal-confirm ${confirmModal.type === 'delete' ? 'danger' : ''}`}
                disabled={actionLoading}
                onClick={() => {
                  if (confirmModal.type === 'ban') handleBan(confirmModal.userId);
                  else if (confirmModal.type === 'unban') handleUnban(confirmModal.userId);
                  else handleDelete(confirmModal.userId);
                }}
              >
                {actionLoading ? (
                  <i className="fa-solid fa-spinner fa-spin"></i>
                ) : (
                  <i className={`fa-solid ${
                    confirmModal.type === 'ban' ? 'fa-ban' :
                    confirmModal.type === 'unban' ? 'fa-lock-open' : 'fa-trash'
                  }`}></i>
                )}
                {confirmModal.type === 'ban' && 'Banir'}
                {confirmModal.type === 'unban' && 'Desbanir'}
                {confirmModal.type === 'delete' && 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* ═══ EDIT NAME MODAL ═══ */}
      {editModal && (
        <div className="modal-overlay" onClick={() => !actionLoading && setEditModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>
              <i className="fa-solid fa-pen"></i>
              Editar Nome
            </h3>
            <p className="modal-desc">
              Alterar o nome de <strong>{editModal.email}</strong>:
            </p>
            <div className="modal-field">
              <input
                type="text"
                value={editModal.newName}
                onChange={(e) => setEditModal({ ...editModal, newName: e.target.value })}
                placeholder="Novo nome"
                autoFocus
              />
            </div>
            <div className="modal-field">
              <label className="modal-field-label">Reason (required to notify by email):</label>
              <select
                className="modal-reason-select"
                value={editModal.reason}
                onChange={(e) => setEditModal({ ...editModal, reason: e.target.value })}
              >
                <option value="">-- Select reason --</option>
                {editReasons.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <div className="modal-actions">
              <button className="modal-cancel" disabled={actionLoading} onClick={() => setEditModal(null)}>
                Cancelar
              </button>
              <button
                className="modal-confirm"
                disabled={actionLoading || !editModal.newName.trim()}
                onClick={handleEditName}
              >
                {actionLoading ? (
                  <i className="fa-solid fa-spinner fa-spin"></i>
                ) : (
                  <i className="fa-solid fa-check"></i>
                )}
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
