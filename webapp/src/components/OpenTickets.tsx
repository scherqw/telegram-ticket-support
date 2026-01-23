import { useEffect, useState } from 'react';
import { apiClient } from '../api/client';
import { TicketDetail } from './TicketDetail';

export function OpenTickets() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTickets();

    const intervalId = setInterval(() => {
      loadTickets();
    }, 3000);

    return () => clearInterval(intervalId)
  }, []);

  async function loadTickets() {
    try {
      const { tickets } = await apiClient.getOpenTickets();
      setTickets(tickets);
    } catch (error) {
      console.error('Failed to load tickets:', error);
    } finally {
      setLoading(false);
    }
  }

  if (selectedTicket) {
    return (
      <TicketDetail 
        ticketId={selectedTicket} 
        onBack={() => {
          setSelectedTicket(null);
          loadTickets();
        }} 
      />
    );
  }

  if (loading) {
    return (
      <div className="p-4 flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Loading tickets...</div>
      </div>
    );
  }

  return (
    <div className="p-4 pb-24">
      <h1 className="text-2xl font-bold mb-4 text-gray-800">Open Tickets</h1>
      
      {tickets.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <div className="text-4xl mb-2">✅</div>
          <p>No open tickets!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map((ticket) => (
            <TicketCard 
              key={ticket._id} 
              ticket={ticket} 
              onClick={() => setSelectedTicket(ticket.ticketId)} 
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TicketCard({ ticket, onClick }: any) {
  const statusColors = {
    open: 'bg-green-100 text-green-800',
    in_progress: 'bg-yellow-100 text-yellow-800'
  };

  return (
    <div 
      onClick={onClick}
      className="bg-white rounded-lg shadow p-4 cursor-pointer hover:shadow-md transition"
    >
      <div className="flex items-start justify-between mb-2">
        <div>
          <span className="font-semibold text-blue-600">{ticket.ticketId}</span>
          {ticket.hasUnreadMessages && (
            <span className="ml-2 text-xs bg-red-500 text-white px-2 py-1 rounded-full">
              New
            </span>
          )}
        </div>
        <span className={`text-xs px-2 py-1 rounded ${statusColors[ticket.status as keyof typeof statusColors]}`}>
          {ticket.status.replace('_', ' ')}
        </span>
      </div>
      
      <div className="text-sm text-gray-600 mb-2">
        👤 {ticket.firstName} {ticket.lastName || ''}
        {ticket.username && <span className="ml-1">(@{ticket.username})</span>}
      </div>
      
      <div className="text-sm text-gray-800 line-clamp-2">
        {ticket.initialMessage}
      </div>
      
      <div className="text-xs text-gray-500 mt-2">
        {new Date(ticket.createdAt).toLocaleString()}
      </div>
    </div>
  );
}