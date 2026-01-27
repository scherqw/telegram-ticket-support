import { useState, useEffect } from 'react';
import { Navigation } from './components/Navigation';
import { Dashboard } from './components/Dashboard';
import { OpenTickets } from './components/OpenTickets';
import { ArchivedTickets } from './components/ArchivedTickets';
import { Login } from './components/Login';
import { TicketDetail } from './components/TicketDetail';
import { useAuth } from './hooks/useAuth';

type View = 'dashboard' | 'open' | 'archived';

export function App() {
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const { isAuthenticated, isLoading, login, logout } = useAuth();

  useEffect(() => {
    // Handle URL parameters for direct ticket access (Deep linking)
    const params = new URLSearchParams(window.location.search);
    const ticketParam = params.get('startapp') || params.get('ticket'); // Support both standard web and Telegram params
    
    if (ticketParam && ticketParam.startsWith('TICK-')) {
      setSelectedTicketId(ticketParam);
    }
  }, []);

  const handleBack = () => {
    setSelectedTicketId(null);
    // Clean URL
    const url = new URL(window.location.href);
    url.searchParams.delete('startapp');
    url.searchParams.delete('ticket');
    window.history.replaceState({}, '', url);
  };

  const handleLogout = () => {
    logout();
    setCurrentView('dashboard');
    setSelectedTicketId(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-bounce">⏳</div>
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login onLogin={login} />;
  }

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
      <div className="bg-white border-b shadow-sm p-4 flex justify-between items-center max-w-4xl mx-auto w-full z-10">
        <h1 className="font-bold text-gray-800">Support Desk</h1>
        <button 
          onClick={handleLogout}
          className="text-sm text-red-600 hover:text-red-800 font-medium"
        >
          Logout
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scroll-smooth">
        <div className="max-w-4xl mx-auto min-h-full py-4">
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