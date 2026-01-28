import React, { useEffect, useState } from 'react';
import { apiClient } from '../api/client';

interface LinkingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (token: string, user: any) => void;
}

export const LinkingModal: React.FC<LinkingModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [code, setCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes

  useEffect(() => {
    if (isOpen) {
      generateCode();
    }
  }, [isOpen]);

  // Polling for link status
  useEffect(() => {
    if (!code || !isOpen) return;

    const interval = setInterval(async () => {
      try {
        const data = await apiClient.checkLinkStatus(code);
        if (data.status === 'linked' && data.token && data.user) {
          clearInterval(interval);
          onSuccess(data.token, data.user);
          onClose();
        }
      } catch (error) {
        console.error('Polling error', error);
      }
    }, 2000); // Check every 2 seconds

    // Countdown timer
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => {
      clearInterval(interval);
      clearInterval(timer);
    };
  }, [code, isOpen, onSuccess, onClose]);

  const generateCode = async () => {
    try {
      setLoading(true);
      const data = await apiClient.generateLinkCode();
      setCode(data.code);
      setTimeLeft(data.expires_in || 300);
    } catch (error) {
      console.error('Failed to generate code', error);
      setCode('ERROR');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60]">
      <div className="bg-white rounded-lg p-6 max-w-sm w-full text-center shadow-xl">
        <h2 className="text-xl font-bold mb-4">Link Telegram Account</h2>
        
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <>
            <p className="text-gray-600 mb-4 text-sm">
              Send this code to the <span className="font-bold">Technician Bot</span> to link your account.
            </p>
            
            <div className="bg-gray-100 p-4 rounded-lg mb-4 border border-gray-200">
              <span className="text-3xl font-mono tracking-widest font-bold text-blue-600">
                {code}
              </span>
            </div>

            <p className="text-xs text-gray-500 mb-6">
              Expires in {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
            </p>

            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 underline text-sm"
            >
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  );
};