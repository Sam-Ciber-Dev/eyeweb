'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import './ChatWidget.css';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const INTRO_KEY = 'eyeweb_intro_seen';

interface ChatMsg {
  text: string;
  type: 'ew-bot' | 'ew-user';
  isWelcome?: boolean;     // Welcome message — auto-translates via t()
  userPrompt?: string;     // For bot AI responses: the user message that triggered this
  ptText?: string;         // Cached PT translation
  enText?: string;         // Cached EN translation
}

export default function ChatWidget() {
  const pathname = usePathname();

  // Nunca mostrar no painel admin
  if (pathname?.startsWith('/admin')) return null;

  return <ChatWidgetInner />;
}

function ChatWidgetInner() {
  const { t, lang, setLangLocked } = useLanguage();
  const [isVisible, setIsVisible] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [typingText, setTypingText] = useState('');
  const [cooldown, setCooldown] = useState(false);
  
  const historyRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const cooldownTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const typingTextRef = useRef('');
  const prevLangRef = useRef(lang);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  // ═══ Helper — texto a mostrar por mensagem ═══
  const getDisplayText = useCallback((msg: ChatMsg): string => {
    if (msg.isWelcome) return t('chat.welcome');
    if (msg.type === 'ew-user') return msg.text;
    // Bot AI message: preferir cache no idioma atual
    const cached = lang === 'pt' ? msg.ptText : msg.enText;
    return cached || msg.text;
  }, [lang, t]);

  // ═══ VISIBILIDADE — Só aparece depois do splash screen ═══
  useEffect(() => {
    if (sessionStorage.getItem(INTRO_KEY) === 'true') {
      setIsVisible(true);
      return;
    }
    const interval = setInterval(() => {
      if (sessionStorage.getItem(INTRO_KEY) === 'true') {
        clearInterval(interval);
        setTimeout(() => setIsVisible(true), 2000);
      }
    }, 300);
    return () => clearInterval(interval);
  }, []);

  // ═══ PERSISTENCIA — carregar do sessionStorage no mount ═══
  useEffect(() => {
    const saved = sessionStorage.getItem('ewChatHistory');
    if (saved) {
      try {
        const parsed: ChatMsg[] = JSON.parse(saved);
        if (parsed.length > 0) {
          setMessages(parsed);
          return;
        }
      } catch {}
    }
    // Primeira vez — mensagem de boas-vindas (auto-traduz via isWelcome)
    setMessages([{ text: '', type: 'ew-bot', isWelcome: true }]);
  }, []); // Só no mount

  // Guardar historico sempre que muda
  useEffect(() => {
    if (messages.length > 0) {
      sessionStorage.setItem('ewChatHistory', JSON.stringify(messages));
    }
  }, [messages]);

  // ═══ TRADUÇÃO — quando o idioma muda, traduzir respostas do bot ═══
  useEffect(() => {
    if (prevLangRef.current === lang) return;
    prevLangRef.current = lang;

    const currentMessages = messagesRef.current;
    const langKey = lang === 'pt' ? 'ptText' : 'enText';

    // Encontrar mensagens do bot que precisam de tradução
    const toTranslate: { idx: number; userPrompt: string }[] = [];
    currentMessages.forEach((msg, idx) => {
      if (msg.type === 'ew-bot' && !msg.isWelcome && msg.userPrompt && !msg[langKey]) {
        toTranslate.push({ idx, userPrompt: msg.userPrompt });
      }
    });

    if (toTranslate.length === 0) return;

    let cancelled = false;
    (async () => {
      for (const item of toTranslate) {
        if (cancelled) break;
        try {
          const res = await fetch(`${API_URL}/api/user/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: item.userPrompt, lang }),
          });
          const data = await res.json();
          if (!cancelled && data.response) {
            setMessages(prev => prev.map((msg, i) => {
              if (i === item.idx && msg.type === 'ew-bot' && msg.userPrompt === item.userPrompt) {
                return { ...msg, [langKey]: data.response };
              }
              return msg;
            }));
          }
        } catch {
          // Falha silenciosa — mantém texto no idioma anterior
        }
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  // ═══ SCROLL ═══
  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      if (historyRef.current) {
        historyRef.current.scrollTop = historyRef.current.scrollHeight;
      }
    });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, typingText, scrollToBottom]);

  // ═══ TYPEWRITER (bloqueia troca de idioma enquanto escreve) ═══
  const typeWriter = useCallback((text: string, onComplete: () => void) => {
    typingTextRef.current = '';
    setTypingText('');
    setIsTyping(true);
    setLangLocked(true);

    let i = 0;
    const type = () => {
      if (i < text.length) {
        typingTextRef.current += text[i];
        setTypingText(typingTextRef.current);
        i++;
        typingTimeoutRef.current = setTimeout(type, 15);
      } else {
        setIsTyping(false);
        setLangLocked(false);
        setTypingText('');
        typingTextRef.current = '';
        onComplete();
      }
    };

    typingTimeoutRef.current = setTimeout(type, 50);
  }, [setLangLocked]);

  // ═══ COOLDOWN ═══
  const applyCooldown = useCallback(() => {
    setCooldown(true);
    if (cooldownTimeoutRef.current) clearTimeout(cooldownTimeoutRef.current);
    cooldownTimeoutRef.current = setTimeout(() => {
      setCooldown(false);
    }, 1500);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (cooldownTimeoutRef.current) clearTimeout(cooldownTimeoutRef.current);
      setLangLocked(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ═══ ENVIAR MENSAGEM ═══
  const sendMessage = async () => {
    const text = input.trim();
    if (!text || isTyping || cooldown) return;

    const userMsg: ChatMsg = { text, type: 'ew-user' };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setCooldown(true);

    try {
      const res = await fetch(`${API_URL}/api/user/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, lang }),
      });
      const data = await res.json();
      const botText = data.response || t('chat.error');

      // Guardar resposta com cache no idioma atual + referência à pergunta do user
      const botMsg: ChatMsg = {
        text: botText,
        type: 'ew-bot',
        userPrompt: text,
      };
      if (lang === 'pt') botMsg.ptText = botText;
      else botMsg.enText = botText;

      typeWriter(botText, () => {
        setMessages(prev => [...prev, botMsg]);
        applyCooldown();
      });
    } catch {
      const errText = t('chat.serverError');
      typeWriter(errText, () => {
        setMessages(prev => [...prev, { text: errText, type: 'ew-bot' }]);
        applyCooldown();
      });
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isTyping && !cooldown) {
      sendMessage();
    }
  };

  // ═══ ABRIR / FECHAR COM ANIMAÇÃO ═══
  const openChat = () => {
    setIsClosing(false);
    setIsOpen(true);
    setTimeout(() => {
      scrollToBottom();
      if (!isTyping && !cooldown) inputRef.current?.focus();
    }, 100);
  };

  const closeChat = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsOpen(false);
      setIsClosing(false);
    }, 200);
  };

  const toggleChat = () => {
    if (isOpen) {
      closeChat();
    } else {
      openChat();
    }
  };

  // Não renderizar nada antes do splash acabar
  if (!isVisible) return null;

  const isDisabled = isTyping || cooldown;

  return (
    <div className="ew-widget">
      {/* Chat Box */}
      {isOpen && (
        <div className={`ew-box ${isClosing ? 'closing' : 'active'} ${isExpanded ? 'expanded' : ''}`}>
          {/* Header */}
          <div className="ew-header">
            <strong>EyeWeb Agent</strong>
            <div className="ew-header-actions">
              <span className="ew-resize" onClick={() => setIsExpanded(prev => !prev)} title={isExpanded ? t('chat.reduce') : t('chat.expand')}>
                {isExpanded ? (
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>
                )}
              </span>
              <span className="ew-close" onClick={closeChat}>&times;</span>
            </div>
          </div>

          {/* Historico */}
          <div className="ew-history" ref={historyRef}>
            {messages.map((msg, i) => (
              <div key={i} className={`ew-msg ${msg.type}`}>
                {getDisplayText(msg)}
              </div>
            ))}
            {/* Typewriter ativo */}
            {isTyping && (
              <div className="ew-msg ew-bot">
                <span className="typewriter-text">{typingText}</span>
                <span className="typewriter-cursor"></span>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="ew-input-area">
            <input
              ref={inputRef}
              type="text"
              placeholder={isDisabled ? t('chat.waitPlaceholder') : t('chat.placeholder')}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyPress}
              disabled={isDisabled}
            />
            <button
              className="ew-send-btn"
              onClick={sendMessage}
              disabled={isDisabled || !input.trim()}
            >
              <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
            </button>
          </div>
        </div>
      )}

      {/* Launcher Button */}
      <div className="ew-launcher" onClick={toggleChat}>
        <svg viewBox="0 0 24 24">
          <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
        </svg>
      </div>
    </div>
  );
}
