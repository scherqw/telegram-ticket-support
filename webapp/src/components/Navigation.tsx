
interface NavigationProps {
  currentView: 'dashboard' | 'open' | 'archived';
  onViewChange: (view: 'dashboard' | 'open' | 'archived') => void;
}

export function Navigation({ currentView, onViewChange }: NavigationProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
      <div className="max-w-4xl mx-auto flex justify-around">
        <button
          onClick={() => onViewChange('dashboard')}
          className={`flex-1 py-3 text-center transition ${
            currentView === 'dashboard' 
              ? 'text-blue-600 border-t-2 border-blue-600' 
              : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          <div className="text-xl">📊</div>
          <div className="text-xs mt-1">Dashboard</div>
        </button>
        
        <button
          onClick={() => onViewChange('open')}
          className={`flex-1 py-3 text-center transition ${
            currentView === 'open' 
              ? 'text-blue-600 border-t-2 border-blue-600' 
              : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          <div className="text-xl">🎫</div>
          <div className="text-xs mt-1">Open Tickets</div>
        </button>
        
        <button
          onClick={() => onViewChange('archived')}
          className={`flex-1 py-3 text-center transition ${
            currentView === 'archived' 
              ? 'text-blue-600 border-t-2 border-blue-600' 
              : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          <div className="text-xl">📦</div>
          <div className="text-xs mt-1">Archive</div>
        </button>
      </div>
    </nav>
  );
}