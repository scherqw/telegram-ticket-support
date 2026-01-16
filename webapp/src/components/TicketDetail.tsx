import React, { useEffect, useState, useRef } from 'react';
import { apiClient } from '../api/client';
import { MessageList } from './MessageList';

interface TicketDetailProps {
  ticketId: string;
  onBack: () => void;
}

export function TicketDetail({ ticketId, onBack }: TicketDetailProps) {
  const [ticket, setTicket] = useState<any>(null);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    loadTicket();
  }, [ticketId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [ticket?.messages]);

  async function loadTicket() {
    try {
      const { ticket } = await apiClient.getTicket(ticketId);
      setTicket(ticket);
      
      if (ticket.hasUnreadMessages) {
        await apiClient.markAsRead(ticketId);
      }
    } catch (error) {
      console.error('Failed to load ticket:', error);
    }
  }

  async function sendMessage() {
    if (!message.trim() || sending) return;

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

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const caption = prompt('Add a caption (optional):') || '';

    try {
      setSending(true);
      await apiClient.uploadMedia(ticketId, file, caption);
      await loadTicket();
      e.target.value = '';
    } catch (error) {
      console.error('Failed to upload file:', error);
      alert('Failed to upload file');
    } finally {
      setSending(false);
    }
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm'
      });

      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const audioFile = new File([audioBlob], 'voice.webm', { type: 'audio/webm' });
        
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
      alert('Cannot access microphone');
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  }

  async function closeTicket() {
    const categoriesInput = prompt('Enter categories (comma-separated, optional):');
    const categories = categoriesInput 
      ? categoriesInput.split(',').map(c => c.trim()).filter(Boolean)
      : [];
    
    if (!confirm('Are you sure you want to close this ticket?')) return;

    try {
      setSending(true);
      await apiClient.closeTicket(ticketId, categories);
      onBack();
    } catch (error) {
      console.error('Failed to close ticket:', error);
      alert('Failed to close ticket');
    } finally {
      setSending(false);
    }
  }

  if (!ticket) {
    return (
      <div className="p-4 flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b p-4 sticky top-0 z-10 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <button onClick={onBack} className="text-blue-600 font-medium">
            ← Back
          </button>
          <span className="font-semibold text-gray-800">{ticket.ticketId}</span>
          {ticket.status !== 'closed' && (
            <button 
              onClick={closeTicket}
              disabled={sending}
              className="text-red-600 text-sm font-medium disabled:opacity-50"
            >
              Close
            </button>
          )}
        </div>
        <div className="text-sm text-gray-600">
          👤 {ticket.firstName} {ticket.lastName || ''}
          {ticket.username && ` (@${ticket.username})`}
        </div>
        {ticket.assignedToName && (
          <div className="text-xs text-gray-500 mt-1">
            Assigned to: {ticket.assignedToName}
          </div>
        )}
      </div>

      {/* Messages */}
      <MessageList messages={ticket.messages} userFirstName={ticket.firstName} />
      <div ref={messagesEndRef} />

      {/* Input Area */}
      {ticket.status !== 'closed' && (
        <div className="bg-white border-t p-4 sticky bottom-16 shadow-lg">
          <div className="max-w-4xl mx-auto flex items-end gap-2">
            <input
              type="file"
              id="file-upload"
              className="hidden"
              onChange={handleFileUpload}
              accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
            />
            <label 
              htmlFor="file-upload"
              className="p-2 text-gray-600 hover:bg-gray-100 rounded cursor-pointer transition"
            >
              📎
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
              className="flex-1 border rounded-lg px-3 py-2 resize-none max-h-32 focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={1}
              disabled={sending}
            />

            {recording ? (
              <button
                onClick={stopRecording}
                className="p-2 bg-red-500 text-white rounded-full w-10 h-10 flex items-center justify-center animate-pulse"
              >
                ⏹
              </button>
            ) : message.trim() ? (
              <button
                onClick={sendMessage}
                disabled={sending}
                className="p-2 bg-blue-500 text-white rounded-full w-10 h-10 flex items-center justify-center disabled:opacity-50 hover:bg-blue-600 transition"
              >
                ➤
              </button>
            ) : (
              <button
                onClick={startRecording}
                className="p-2 bg-blue-500 text-white rounded-full w-10 h-10 flex items-center justify-center hover:bg-blue-600 transition"
              >
                🎤
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}