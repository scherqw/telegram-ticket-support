import { useState, useEffect } from 'react';
import { Navigation } from './components/Navigation';
import { Dashboard } from './components/Dashboard';
import { OpenTickets } from './components/OpenTickets';
import { ArchivedTickets } from './components/ArchivedTickets';
import { Login } from './components/Login';
import { TicketDetail } from './components/TicketDetail';
import { useAuth } from './hooks/useAuth';
import { LinkingModal } from './components/LinkingModal';

type View = 'dashboard' | 'open' | 'archived';

export function App() {
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const { isAuthenticated, isLoading, login, logout, user, updateSession } = useAuth();
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ticketParam = params.get('startapp') || params.get('ticket'); 
    
    if (ticketParam && ticketParam.startsWith('TICK-')) {
      setSelectedTicketId(ticketParam);
    }
  }, []);

  const handleBack = () => {
    setSelectedTicketId(null);
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

  // ID 0 is the default "Web Admin" ID from backend
  const isWebAdmin = user?.id === 0;

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b shadow-sm p-4 flex justify-between items-center max-w-4xl mx-auto w-full z-10">
        <div>
          <h1 className="font-bold text-gray-800 leading-tight">Support Desk</h1>
          {/* User Status / Link Button */}
          <div className="text-xs mt-0.5">
            {isWebAdmin ? (
              <button 
                onClick={() => setIsLinkModalOpen(true)}
                className="text-blue-600 hover:text-blue-800 hover:underline flex items-center"
              >
                <span>⚠️ Connect Telegram</span>
              </button>
            ) : (
              <span className="text-green-700 bg-green-50 px-2 py-0.5 rounded-full flex items-center font-medium border border-green-100">
                <span className="relative flex h-2 w-2 mr-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                Connected as {user?.first_name}
              </span>
            )}
          </div>
        </div>

        <button 
          onClick={handleLogout}
          className="text-sm text-red-600 hover:text-red-800 font-medium px-2 py-1"
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

      {/* Linking Modal */}
      <LinkingModal 
        isOpen={isLinkModalOpen}
        onClose={() => setIsLinkModalOpen(false)}
        onSuccess={(token, newUser) => {
          updateSession(token, newUser);
        }}
      />
    </div>
  );
}