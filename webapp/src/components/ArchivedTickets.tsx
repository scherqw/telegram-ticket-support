import { useEffect, useState } from 'react';
import { apiClient } from '../api/client';
import { TicketDetail } from './TicketDetail';

export function ArchivedTickets() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    loadTickets();
  }, [page]);

  async function loadTickets() {
    try {
      setLoading(true);
      const { tickets, pagination } = await apiClient.getArchivedTickets(page);
      setTickets(tickets);
      setTotalPages(pagination.totalPages);
    } catch (error) {
      console.error('Failed to load archived tickets:', error);
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

  return (
    <div className="p-4 pb-24">
      <h1 className="text-2xl font-bold mb-4 text-gray-800">Archived Tickets</h1>
      
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-gray-500">Loading...</div>
        </div>
      ) : tickets.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <div className="text-4xl mb-2">📦</div>
          <p>No archived tickets yet</p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {tickets.map((ticket) => (
              <ArchivedTicketCard 
                key={ticket._id} 
                ticket={ticket} 
                onClick={() => setSelectedTicket(ticket.ticketId)} 
              />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-6">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
              >
                Previous
              </button>
              <span className="px-4 py-2">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ArchivedTicketCard({ ticket, onClick }: any) {
  return (
    <div 
      onClick={onClick}
      className="bg-white rounded-lg shadow p-4 cursor-pointer hover:shadow-md transition"
    >
      <div className="flex items-start justify-between mb-2">
        <div>
          <span className="font-semibold text-gray-600">{ticket.ticketId}</span>
          {ticket.rating && (
            <span className="ml-2 text-xs">
              {'⭐'.repeat(ticket.rating.stars)}
            </span>
          )}
        </div>
        <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-800">
          Closed
        </span>
      </div>
      
      <div className="text-sm text-gray-600 mb-2">
        👤 {ticket.firstName} {ticket.lastName || ''}
      </div>
      
      <div className="text-sm text-gray-800 line-clamp-2">
        {ticket.initialMessage}
      </div>
      
      <div className="text-xs text-gray-500 mt-2">
        Closed: {new Date(ticket.closedAt).toLocaleString()}
      </div>
    </div>
  );
}