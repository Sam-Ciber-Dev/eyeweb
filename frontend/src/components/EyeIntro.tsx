'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

interface EyeIntroProps {
  onComplete: () => void;
}

const SESSION_KEY = 'eyeweb_intro_seen';

// Função para verificar se já foi visto (fora do componente para evitar re-renders)
function checkIfSeen(): boolean {
  if (typeof window !== 'undefined') {
    return sessionStorage.getItem(SESSION_KEY) === 'true';
  }
  return false;
}

export default function EyeIntro({ onComplete }: EyeIntroProps) {
  // Inicializar como true para evitar flash - o useEffect vai definir o valor correto
  const [isReady, setIsReady] = useState(false);
  const [alreadySeen, setAlreadySeen] = useState(true); // Começa como true para evitar flash
  const [clicked, setClicked] = useState(false);
  const [hidden, setHidden] = useState(true); // Começa escondido
  const [pupilStyle, setPupilStyle] = useState({ transform: 'translate(-50%, -50%)' });
  const { t } = useLanguage();

  // Verificar se já foi visto nesta sessão - apenas no cliente
  useEffect(() => {
    const seen = checkIfSeen();
    setAlreadySeen(seen);
    setHidden(seen);
    setIsReady(true);
    
    if (seen) {
      onComplete();
    }
  }, [onComplete]);

  // Seguir o cursor com a pupila
  const handleMouseMove = useCallback((e: MouseEvent) => {
    const eye = document.querySelector('.eye-container');
    if (!eye || clicked) return;

    const rect = eye.getBoundingClientRect();
    const eyeCenterX = rect.left + rect.width / 2;
    const eyeCenterY = rect.top + rect.height / 2;

    const deltaX = e.clientX - eyeCenterX;
    const deltaY = e.clientY - eyeCenterY;

    const maxMove = 30;
    const distance = Math.sqrt(deltaX ** 2 + deltaY ** 2);
    const factor = Math.min(distance / 200, 1);

    const moveX = (deltaX / distance) * maxMove * factor || 0;
    const moveY = (deltaY / distance) * maxMove * factor || 0;

    setPupilStyle({
      transform: `translate(calc(-50% + ${moveX}px), calc(-50% + ${moveY}px))`,
    });
  }, [clicked]);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [handleMouseMove]);

  const handleClick = () => {
    setClicked(true);
    
    // Guardar em sessionStorage que já foi visto
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(SESSION_KEY, 'true');
    }
    
    // Após a animação, esconder e chamar onComplete
    setTimeout(() => {
      setHidden(true);
      onComplete();
    }, 1500);
  };

  // Se já foi visto ou ainda não está pronto, não renderizar nada
  if (!isReady || alreadySeen) {
    return null;
  }

  return (
    <div className={`eye-screen ${hidden ? 'hidden' : ''}`}>
      <div 
        className={`eye-container ${clicked ? 'clicked' : ''}`}
        onClick={handleClick}
        title={t('eye.clickToEnter')}
      >
        <div className="eye">
          <div className="pupil" style={pupilStyle}></div>
        </div>
      </div>
    </div>
  );
}
