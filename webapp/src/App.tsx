import { useState, useEffect } from 'react';
import { Navigation } from './components/Navigation';
import { Dashboard } from './components/Dashboard';
import { OpenTickets } from './components/OpenTickets';
import { ArchivedTickets } from './components/ArchivedTickets';
import { useTelegram } from './hooks/useTelegram';
import { apiClient } from './api/client';
import { TicketDetail } from './components/TicketDetail';

type View = 'dashboard' | 'open' | 'archived';

export function App() {
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const { user, initData, isReady, startParam } = useTelegram();

  useEffect(() => {
    if (isReady && initData) {
      apiClient.setInitData(initData);

      if (startParam && startParam.startsWith('TICK-')) {
        setSelectedTicketId(startParam);
      }

    }
  }, [isReady, initData, startParam]);

  const handleBack = () => {
    setSelectedTicketId(null);
    window.history.replaceState({}, document.title, window.location.pathname);
  };

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

  // if (selectedTicketId) {
  //   return (
  //     <div className="min-h-screen bg-gray-50">
  //       <div className="max-w-4xl mx-auto">
  //         <TicketDetail 
  //           ticketId={selectedTicketId} 
  //           onBack={handleBack} 
  //         />
  //       </div>
  //     </div>
  //   );
  // }
  if (selectedTicketId) {
    return (
      <TicketDetail 
        ticketId={selectedTicketId} 
        onBack={handleBack} 
      />
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gray-50">
    
      <div className="flex-1 overflow-y-auto scroll-smooth">
        <div className="max-w-4xl mx-auto min-h-full">
          {currentView === 'dashboard' && <Dashboard />}
          {currentView === 'open' && <OpenTickets />}
          {currentView === 'archived' && <ArchivedTickets />}
        </div>
      </div>
      
      <div className="flex-none z-10 bg-white border-t shadow-lg max-w-4xl mx-auto w-full">
        <Navigation 
          currentView={currentView} 
          onViewChange={setCurrentView} 
        />
      </div>
    </div>
  );
}
