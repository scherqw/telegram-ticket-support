import { useEffect, useState } from 'react';
import { apiClient } from '../api/client';

interface Stats {
  open: number;
  inProgress: number;
  unread: number;
  closedToday: number;
}

export function Dashboard() {
  const [stats, setStats] = useState<Stats>({
    open: 0,
    inProgress: 0,
    unread: 0,
    closedToday: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();

    const intervalId = setInterval(() => {
      loadStats();
    }, 1000);

    return () => clearInterval(intervalId)
  }, []);

  async function loadStats() {
    try {
      const { tickets } = await apiClient.getOpenTickets();
      
      const open = tickets.filter((t: any) => t.status === 'open').length;
      const inProgress = tickets.filter((t: any) => t.status === 'in_progress').length;
      const unread = tickets.filter((t: any) => t.hasUnreadMessages).length;

      setStats({ open, inProgress, unread, closedToday: 0 });
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="p-4 flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-4 pb-24">
      <h1 className="text-2xl font-bold mb-6 text-gray-800">Dashboard</h1>
      
      <div className="grid grid-cols-2 gap-4">
        <StatCard 
          icon="🟢" 
          label="Open" 
          value={stats.open} 
          color="text-green-600" 
        />
        <StatCard 
          icon="🟡" 
          label="In Progress" 
          value={stats.inProgress} 
          color="text-yellow-600" 
        />
        <StatCard 
          icon="🔴" 
          label="Unread" 
          value={stats.unread} 
          color="text-red-600" 
        />
        <StatCard 
          icon="✅" 
          label="Closed Today" 
          value={stats.closedToday} 
          color="text-gray-600" 
        />
      </div>

      {/* <div className="mt-8 bg-blue-50 rounded-lg p-4">
        <h2 className="font-semibold text-blue-900 mb-2">💡 Quick Tips</h2>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Click on any ticket to view details and reply</li>
          <li>• Unread messages are marked with a red badge</li>
          <li>• Use the media buttons to send photos or voice messages</li>
        </ul>
      </div> */}
    </div>
  );
}

function StatCard({ icon, label, value, color }: any) {
  return (
    <div className="bg-white rounded-lg shadow p-4 hover:shadow-md transition">
      <div className="text-3xl mb-2">{icon}</div>
      <div className="text-sm text-gray-600">{label}</div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
    </div>
  );
}