import { useEffect, useState } from 'react';

interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

interface TelegramWebApp {
  initData: string;
  initDataUnsafe: {
    user?: TelegramUser;
    start_param?: string;
  };
  ready: () => void;
  close: () => void;
  expand: () => void;
  MainButton: {
    text: string;
    show: () => void;
    hide: () => void;
    onClick: (callback: () => void) => void;
  };
}

declare global {
  interface Window {
    Telegram?: {
      WebApp: TelegramWebApp;
    };
  }
}

export function useTelegram() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (tg) {
      tg.ready();
      tg.expand();
      setIsReady(true);
    }
  }, []);

  return {
    tg: window.Telegram?.WebApp,
    user: window.Telegram?.WebApp.initDataUnsafe.user,
    startParam: window.Telegram?.WebApp.initDataUnsafe.start_param,
    initData: window.Telegram?.WebApp.initData || '',
    initDataUnsafe: window.Telegram?.WebApp.initDataUnsafe,
    isReady
  };
}
