import React, { useEffect, useState, useRef } from 'react';
import { apiClient } from '../api/client';
import { MessageList } from './MessageList';
import { CategoryModal } from './CategoryModal';

interface TicketDetailProps {
  ticketId: string;
  onBack: () => void;
}

export function TicketDetail({ ticketId, onBack }: TicketDetailProps) {
  const [ticket, setTicket] = useState<any>(null);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingMimeTypeRef = useRef<string>('');

  // 1. Initial Load & Polling (Every 3 seconds)
  useEffect(() => {
    loadTicket();
    const intervalId = setInterval(() => {
      loadTicket();
    }, 3000);

    return () => clearInterval(intervalId);
  }, [ticketId]);

  // 2. Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [ticket?.messages?.length]);

  async function loadTicket() {
    try {
      const { ticket } = await apiClient.getTicket(ticketId);
      setTicket(ticket);

      // Mark as read if needed
      if (ticket.hasUnreadMessages) {
        await apiClient.markAsRead(ticketId);
      }
    } catch (error) {
      console.error('Failed to load ticket:', error);
    }
  }

  // --- ESCALATION LOGIC ---
  async function handleEscalate(reasonInput?: string) {
    const reason = reasonInput || prompt('Enter reason for escalation:');
    if (!reason) return;

    try {
      setSending(true);
      await apiClient.escalateTicket(ticketId, reason);
      alert('✅ Ticket escalated and assigned to Level 2');
      await loadTicket();
    } catch (error) {
      console.error('Escalation failed:', error);
      alert('Failed to escalate ticket');
    } finally {
      setSending(false);
    }
  }

  // --- MESSAGING LOGIC ---
  async function sendMessage() {
    if (!message.trim() || sending) return;

    // Check for Command: /escalate
    if (message.toLowerCase().startsWith('/escalate')) {
      const reason = message.substring(9).trim();
      setMessage('');
      await handleEscalate(reason || undefined);
      return;
    }

    setSending(true);
    try {
      await apiClient.sendReply(ticketId, message);
      setMessage('');
      await loadTicket();
    } catch (error) {
      console.error('Failed to send message:', error);
      alert('Failed to send message');
    } finally {
      setSending(false);
    }
  }

  // --- FILE UPLOAD LOGIC ---
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const caption = prompt('Add a caption (optional):') || '';

    try {
      setSending(true);
      await apiClient.uploadMedia(ticketId, file, caption);
      await loadTicket();
      e.target.value = ''; // Reset input
    } catch (error) {
      console.error('Failed to upload file:', error);
      alert('Failed to upload file');
    } finally {
      setSending(false);
    }
  }

  // --- VOICE RECORDING LOGIC ---
  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Detect supported MIME type (Fix for iOS/Safari)
      let mimeType = 'audio/webm';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/mp4';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = ''; // Browser default
        }
      }

      recordingMimeTypeRef.current = mimeType;

      const options = mimeType ? { mimeType } : undefined;
      const mediaRecorder = new MediaRecorder(stream, options);

      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const finalMimeType = recordingMimeTypeRef.current || 'audio/webm';
        const fileExtension = finalMimeType.includes('mp4') ? 'm4a' : 'webm';

        const audioBlob = new Blob(audioChunksRef.current, { type: finalMimeType });
        const audioFile = new File([audioBlob], `voice.${fileExtension}`, { type: finalMimeType });

        stream.getTracks().forEach(track => track.stop());

        try {
          setSending(true);
          await apiClient.uploadMedia(ticketId, audioFile);
          await loadTicket();
        } catch (error) {
          console.error('Failed to send voice:', error);
          alert('Failed to send voice message');
        } finally {
          setSending(false);
        }
      };

      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setRecording(true);
    } catch (error) {
      console.error('Failed to access microphone:', error);
      alert('Cannot access microphone. Ensure you are using HTTPS.');
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  }

  // --- CLOSE TICKET LOGIC ---
  function initiateCloseTicket() {
    setShowCategoryModal(true);
  }

  async function confirmCloseTicket(categories: string[]) {
    try {
      setSending(true);
      await apiClient.closeTicket(ticketId, categories);
      setShowCategoryModal(false);
      onBack();
    } catch (error) {
      console.error('Failed to close ticket:', error);
      alert('Failed to close ticket');
      setSending(false);
    }
  }

  if (!ticket) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-gray-500 animate-pulse">Loading ticket...</div>
      </div>
    );
  }

  return (
    // 1. MAIN CONTAINER: Full Screen, Fixed Overlay (No outer scroll)
    <div className="fixed inset-0 flex flex-col bg-gray-50 z-50">

      {/* 2. HEADER: Fixed Height (flex-none) */}
      <div className="flex-none bg-white border-b p-4 shadow-sm z-10">
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={onBack}
            className="text-blue-600 font-medium flex items-center gap-1 hover:text-blue-700 transition"
          >
            <span>←</span> Back
          </button>

          <div className="flex gap-2">
            {ticket.status !== 'closed' && (
              <button
                onClick={initiateCloseTicket}
                disabled={sending}
                className="text-red-600 text-sm font-medium hover:bg-red-50 px-3 py-1 rounded transition disabled:opacity-50"
              >
                Close
              </button>
            )}
          </div>
        </div>

        <div className="flex justify-between items-start">
          <div>
            <span className="font-bold text-gray-900 block text-lg">{ticket.ticketId}</span>
            <div className="text-sm text-gray-500 flex items-center gap-1">
              👤 {ticket.firstName} {ticket.lastName || ''}
            </div>
          </div>
          {/* Status Badges */}
          <div className="flex gap-1">
            {ticket.status === 'escalated' && (
              <span className="bg-amber-100 text-amber-800 text-xs px-2 py-1 rounded-full font-bold border border-amber-200">
                Escalated
              </span>
            )}
            {ticket.status === 'in_progress' && (
              <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full font-medium border border-blue-200">
                In Progress
              </span>
            )}
            {ticket.status === 'closed' && (
              <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-full font-medium border border-gray-200">
                Closed
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 3. MESSAGES: Flexible Height, Scrollable (flex-1) */}
      <div
        className="flex-1 overflow-y-auto p-4 scroll-smooth bg-gray-50"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <div className="max-w-4xl mx-auto">
          <MessageList messages={ticket.messages} userFirstName={ticket.firstName} />
          {/* Invisible div to scroll to bottom */}
          <div ref={messagesEndRef} className="h-2" />
        </div>
      </div>

      {/* 4. FOOTER (Input): Fixed Height (flex-none) */}
      {ticket.status !== 'closed' && (
        <div className="flex-none bg-white border-t p-3 pb-safe-area shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-10">
          <div className="max-w-4xl mx-auto flex items-center gap-2">

            <input
              type="file"
              id="file-upload"
              className="hidden"
              onChange={handleFileUpload}
              accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
            />
            <label
              htmlFor="file-upload"
              className="p-3 text-gray-500 hover:bg-gray-100 rounded-full cursor-pointer transition active:bg-gray-200 flex items-center justify-center"
            >
              <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#000000"><path d="M720-330q0 104-73 177T470-80q-104 0-177-73t-73-177v-370q0-75 52.5-127.5T400-880q75 0 127.5 52.5T580-700v350q0 46-32 78t-78 32q-46 0-78-32t-32-78v-370h80v370q0 13 8.5 21.5T470-320q13 0 21.5-8.5T500-350v-350q-1-42-29.5-71T400-800q-42 0-71 29t-29 71v370q-1 71 49 120.5T470-160q70 0 119-49.5T640-330v-390h80v390Z"/></svg>
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Type a message..."
              className="flex-1 border-0 bg-gray-100 rounded-2xl px-4 py-3 resize-none max-h-32 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm sm:text-base"
              rows={1}
              disabled={sending}
            />

            {recording ? (
              <button
                onClick={stopRecording}
                className="p-3 bg-red-500 text-white rounded-full flex items-center justify-center animate-pulse"
              >
                <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#e3e3e3"><path d="M240-240v-480h480v480H240Z"/></svg>
              </button>
            ) : message.trim() ? (
              <button
                onClick={sendMessage}
                disabled={sending}
                className="p-3 bg-blue-500 text-white rounded-full flex items-center justify-center disabled:opacity-50 hover:bg-blue-600 transition"
              >
                <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#e3e3e3"><path d="M120-160v-240l320-80-320-80v-240l760 320-760 320Z"/></svg>
              </button>
            ) : (
              <button
                onClick={startRecording}
                className="p-3 bg-blue-500 text-white rounded-full flex items-center justify-center hover:bg-blue-600 transition"
              >
                <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#e3e3e3"><path d="M480-400q-50 0-85-35t-35-85v-240q0-50 35-85t85-35q50 0 85 35t35 85v240q0 50-35 85t-85 35Zm-40 280v-123q-104-14-172-93t-68-184h80q0 83 58.5 141.5T480-320q83 0 141.5-58.5T680-520h80q0 105-68 184t-172 93v123h-80Z"/></svg>              
              </button>
            )}
          </div>
        </div>
      )}

      {/* 5. MODALS (Overlay) */}
      <CategoryModal
        isOpen={showCategoryModal}
        onClose={() => setShowCategoryModal(false)}
        onConfirm={confirmCloseTicket}
        isSending={sending}
      />
    </div>
  );
}