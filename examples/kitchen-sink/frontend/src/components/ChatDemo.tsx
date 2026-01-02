import React, { useEffect, useState, useRef } from 'react';
import {
  ChatMessage,
  ServerStatus,
  UserJoined,
  UserLeft,
  createChatSocket,
  ChatSocket,
} from '../generated/api';

interface ChatEvent {
  type: 'message' | 'join' | 'leave' | 'status';
  data: ChatMessage | UserJoined | UserLeft | ServerStatus;
  timestamp: Date;
}

const ChatDemo: React.FC = () => {
  const [username, setUsername] = useState('');
  const [isJoined, setIsJoined] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [message, setMessage] = useState('');
  const [events, setEvents] = useState<ChatEvent[]>([]);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [serverStatus, setServerStatus] = useState<ServerStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const socketRef = useRef<ChatSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events]);

  useEffect(() => {
    return () => {
      if (socketRef.current?.isConnected) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  const connect = () => {
    if (!username.trim()) {
      setError('Please enter a username');
      return;
    }
    
    setError(null);
    const socket = createChatSocket();
    socketRef.current = socket;
    
    socket.onConnect(() => {
      setIsConnected(true);
      socket.sendJoin({
        user: username,
        timestamp: new Date().toISOString(),
      });
    });
    
    socket.onDisconnect(() => {
      setIsConnected(false);
      setIsJoined(false);
    });
    
    socket.onError(() => {
      setError('Connection error');
      setIsConnected(false);
    });
    
    socket.onChatMessage((data) => {
      setEvents(prev => [...prev, { type: 'message', data, timestamp: new Date() }]);
    });

    socket.onUserJoined((data) => {
      setIsJoined(true);
      setEvents(prev => [...prev, { type: 'join', data, timestamp: new Date() }]);
    });
    
    socket.onUserLeft((data) => {
      setEvents(prev => [...prev, { type: 'leave', data, timestamp: new Date() }]);
    });
    
    socket.onTyping((data) => {
      if (data.user !== username) {
        setTypingUsers(prev => {
          const next = new Set(prev);
          if (data.isTyping) {
            next.add(data.user);
          } else {
            next.delete(data.user);
          }
          return next;
        });
      }
    });
    
    socket.onStatus((data) => {
      setServerStatus(data);
      setEvents(prev => [...prev, { type: 'status', data, timestamp: new Date() }]);
    });
    
    socket.connect();
  };

  const disconnect = () => {
    if (socketRef.current?.isConnected) {
      socketRef.current.sendLeave({
        user: username,
        timestamp: new Date().toISOString(),
      });
      setTimeout(() => socketRef.current?.disconnect(), 100);
    }
    setIsJoined(false);
    setIsConnected(false);
  };

  const sendMessage = () => {
    if (!message.trim() || !socketRef.current?.isConnected) return;
    
    socketRef.current.sendChatMessage({
      user: username,
      text: message,
      timestamp: new Date().toISOString(),
    });
    
    setMessage('');
    sendTypingIndicator(false);
  };

  const sendTypingIndicator = (typing: boolean) => {
    if (!socketRef.current?.isConnected) return;
    
    socketRef.current.sendTyping({
      user: username,
      isTyping: typing,
    });
  };

  const handleMessageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessage(e.target.value);
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    if (e.target.value) {
      sendTypingIndicator(true);
      typingTimeoutRef.current = window.setTimeout(() => {
        sendTypingIndicator(false);
      }, 2000);
    } else {
      sendTypingIndicator(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatUptime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${h}h ${m}m ${s}s`;
  };

  const renderEvent = (event: ChatEvent, index: number) => {
    switch (event.type) {
      case 'message': {
        const msg = event.data as ChatMessage;
        const isOwn = msg.user === username;
        return (
          <div key={index} style={{ ...styles.messageRow, justifyContent: isOwn ? 'flex-end' : 'flex-start' }}>
            <div style={{ ...styles.messageBubble, ...(isOwn ? styles.ownMessage : styles.otherMessage) }}>
              {!isOwn && <span style={styles.messageUser}>{msg.user}</span>}
              <p style={styles.messageText}>{msg.text}</p>
              <span style={styles.messageTime}>
                {new Date(msg.timestamp).toLocaleTimeString()}
              </span>
            </div>
          </div>
        );
      }
      case 'join': {
        const data = event.data as UserJoined;
        return (
          <div key={index} style={styles.systemMessage}>
            👋 <strong>{data.user}</strong> joined the chat
          </div>
        );
      }
      case 'leave': {
        const data = event.data as UserLeft;
        return (
          <div key={index} style={styles.systemMessage}>
            👋 <strong>{data.user}</strong> left the chat
          </div>
        );
      }
      case 'status': {
        const data = event.data as ServerStatus;
        return (
          <div key={index} style={styles.statusMessage}>
            📊 Server: {data.connectedUsers} user(s) connected • Uptime: {formatUptime(data.uptimeSeconds)}
          </div>
        );
      }
    }
  };

  return (
    <div>
      <h2 style={styles.heading}>💬 Real-time Chat</h2>
      <p style={styles.description}>
        WebSocket-powered chat with typed messages, typing indicators, and presence events.
      </p>
      
      {error && <div style={styles.error}>{error}</div>}
      
      {!isJoined ? (
        <div style={styles.joinForm}>
          <input
            type="text"
            placeholder="Enter your username..."
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && connect()}
            style={styles.usernameInput}
          />
          <button onClick={connect} style={styles.joinButton}>
            Join Chat
          </button>
        </div>
      ) : (
        <div style={styles.chatContainer}>
          <div style={styles.chatHeader}>
            <div style={styles.connectionStatus}>
              <span style={{ ...styles.statusDot, background: isConnected ? '#27ae60' : '#e74c3c' }} />
              {isConnected ? 'Connected' : 'Disconnected'} as <strong>{username}</strong>
            </div>
            {serverStatus && (
              <div style={styles.serverInfo}>
                {serverStatus.connectedUsers} online
              </div>
            )}
            <button onClick={disconnect} style={styles.leaveButton}>
              Leave
            </button>
          </div>
          
          <div style={styles.messagesContainer}>
            {events.length === 0 ? (
              <p style={styles.placeholder}>No messages yet. Say hello!</p>
            ) : (
              events.map(renderEvent)
            )}
            <div ref={messagesEndRef} />
          </div>
          
          {typingUsers.size > 0 && (
            <div style={styles.typingIndicator}>
              {Array.from(typingUsers).join(', ')} {typingUsers.size === 1 ? 'is' : 'are'} typing...
            </div>
          )}
          
          <div style={styles.inputContainer}>
            <input
              type="text"
              placeholder="Type a message..."
              value={message}
              onChange={handleMessageChange}
              onKeyPress={handleKeyPress}
              style={styles.messageInput}
            />
            <button onClick={sendMessage} style={styles.sendButton} disabled={!message.trim()}>
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  heading: {
    marginBottom: '10px',
    color: '#2c3e50',
  },
  description: {
    color: '#7f8c8d',
    marginBottom: '20px',
  },
  error: {
    background: '#fee',
    color: '#c00',
    padding: '10px 15px',
    borderRadius: '4px',
    marginBottom: '15px',
  },
  joinForm: {
    display: 'flex',
    gap: '10px',
    maxWidth: '400px',
  },
  usernameInput: {
    flex: 1,
    padding: '12px 16px',
    fontSize: '14px',
    border: '2px solid #e0e0e0',
    borderRadius: '8px',
    outline: 'none',
  },
  joinButton: {
    padding: '12px 24px',
    fontSize: '14px',
    background: '#9b59b6',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: 'bold',
  },
  chatContainer: {
    border: '1px solid #e0e0e0',
    borderRadius: '12px',
    overflow: 'hidden',
  },
  chatHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '15px',
    padding: '12px 16px',
    background: '#f8f9fa',
    borderBottom: '1px solid #e0e0e0',
  },
  connectionStatus: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flex: 1,
  },
  statusDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
  },
  serverInfo: {
    color: '#7f8c8d',
    fontSize: '13px',
  },
  leaveButton: {
    padding: '6px 16px',
    fontSize: '13px',
    background: '#e74c3c',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  messagesContainer: {
    height: '350px',
    overflowY: 'auto',
    padding: '16px',
    background: '#fafafa',
  },
  placeholder: {
    textAlign: 'center',
    color: '#999',
    padding: '40px',
  },
  messageRow: {
    display: 'flex',
    marginBottom: '12px',
  },
  messageBubble: {
    maxWidth: '70%',
    padding: '10px 14px',
    borderRadius: '16px',
  },
  ownMessage: {
    background: '#9b59b6',
    color: '#fff',
    borderBottomRightRadius: '4px',
  },
  otherMessage: {
    background: '#fff',
    border: '1px solid #e0e0e0',
    borderBottomLeftRadius: '4px',
  },
  messageUser: {
    fontSize: '12px',
    fontWeight: 'bold',
    color: '#9b59b6',
    display: 'block',
    marginBottom: '4px',
  },
  messageText: {
    margin: 0,
    wordBreak: 'break-word',
  },
  messageTime: {
    fontSize: '10px',
    opacity: 0.7,
    display: 'block',
    marginTop: '4px',
    textAlign: 'right',
  },
  systemMessage: {
    textAlign: 'center',
    color: '#7f8c8d',
    fontSize: '13px',
    padding: '8px 0',
  },
  statusMessage: {
    textAlign: 'center',
    color: '#9b59b6',
    fontSize: '12px',
    padding: '8px 0',
    background: '#f3e5f5',
    borderRadius: '8px',
    marginBottom: '12px',
  },
  typingIndicator: {
    padding: '8px 16px',
    fontSize: '13px',
    color: '#7f8c8d',
    fontStyle: 'italic',
    background: '#f8f9fa',
    borderTop: '1px solid #e0e0e0',
  },
  inputContainer: {
    display: 'flex',
    gap: '10px',
    padding: '12px 16px',
    background: '#fff',
    borderTop: '1px solid #e0e0e0',
  },
  messageInput: {
    flex: 1,
    padding: '12px 16px',
    fontSize: '14px',
    border: '2px solid #e0e0e0',
    borderRadius: '24px',
    outline: 'none',
  },
  sendButton: {
    padding: '12px 24px',
    fontSize: '14px',
    background: '#9b59b6',
    color: '#fff',
    border: 'none',
    borderRadius: '24px',
    cursor: 'pointer',
    fontWeight: 'bold',
  },
};

export default ChatDemo;

