import { useState, useEffect } from 'react';
import { Navigation } from './components/Navigation';
import { Dashboard } from './components/Dashboard';
import { OpenTickets } from './components/OpenTickets';
import { ArchivedTickets } from './components/ArchivedTickets';
import { useTelegram } from './hooks/useTelegram';
import { apiClient } from './api/client';

type View = 'dashboard' | 'open' | 'archived';

export function App() {
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const { user, initData, isReady } = useTelegram();

  useEffect(() => {
    if (isReady && initData) {
      apiClient.setInitData(initData);
    }
  }, [isReady, initData]);

  if (!user || !isReady) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="text-4xl mb-4">⏳</div>
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto">
        {currentView === 'dashboard' && <Dashboard />}
        {currentView === 'open' && <OpenTickets />}
        {currentView === 'archived' && <ArchivedTickets />}
        
        <Navigation 
          currentView={currentView} 
          onViewChange={setCurrentView} 
        />
      </div>
    </div>
  );
}
