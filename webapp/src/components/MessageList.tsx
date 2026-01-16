import { VoicePlayer } from './VoicePlayer';

interface Message {
  from: 'user' | 'technician';
  text: string;
  timestamp: string;
  technicianName?: string;
  hasMedia?: boolean;
  mediaType?: string;
  s3Url?: string;
}

interface MessageListProps {
  messages: Message[];
  userFirstName: string;
}

export function MessageList({ messages, userFirstName }: MessageListProps) {
  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-3">
      {messages.map((msg, idx) => (
        <MessageBubble 
          key={idx} 
          message={msg} 
          isFromUser={msg.from === 'user'}
          userFirstName={userFirstName}
        />
      ))}
    </div>
  );
}

function MessageBubble({ message, isFromUser, }: any) {
  const timestamp = new Date(message.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <div className={`flex ${isFromUser ? 'justify-start' : 'justify-end'}`}>
      <div className={`max-w-xs lg:max-w-md ${
        isFromUser 
          ? 'bg-white' 
          : 'bg-blue-500 text-white'
      } rounded-lg p-3 shadow`}>
        {!isFromUser && message.technicianName && (
          <div className="text-xs opacity-75 mb-1 font-medium">
            {message.technicianName}
          </div>
        )}

        {message.hasMedia && message.mediaType === 'voice' && message.s3Url ? (
          <VoicePlayer audioUrl={message.s3Url} />
        ) : message.hasMedia && message.mediaType === 'photo' && message.s3Url ? (
          <img src={message.s3Url} alt="Photo" className="rounded max-w-full mb-2" />
        ) : message.hasMedia && message.s3Url ? (
          <a 
            href={message.s3Url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-sm underline block mb-2"
          >
            📎 View {message.mediaType}
          </a>
        ) : null}

        {message.text && message.text !== '[Media message]' && (
          <div className="whitespace-pre-wrap break-words">{message.text}</div>
        )}

        <div className={`text-xs mt-1 ${isFromUser ? 'text-gray-500' : 'opacity-75'}`}>
          {timestamp}
        </div>
      </div>
    </div>
  );
}