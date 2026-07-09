import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, TABLES, DBMessage } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Send,
  MessageSquare,
  User,
  Loader2,
} from 'lucide-react';

interface ConversationPartner {
  partner_id: string;
  partner_name: string;
  partner_avatar: string | null;
  partner_role: string;
  last_message: DBMessage;
}

const ClientMessages = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<ConversationPartner[]>([]);
  const [selectedPartner, setSelectedPartner] = useState<ConversationPartner | null>(null);
  const [messages, setMessages] = useState<DBMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [loadingThread, setLoadingThread] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Fetch conversations list
  const fetchConversations = useCallback(async () => {
    if (!user) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/app_messaging?action=conversations`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) throw new Error('Failed to fetch conversations');
      const data = await response.json();
      setConversations(data.conversations || []);
    } catch (err) {
      console.error('Failed to fetch conversations:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Fetch thread messages
  const fetchThread = useCallback(async (partnerId: string) => {
    if (!user) return;
    setLoadingThread(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/app_messaging?action=thread&partner_id=${partnerId}`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) throw new Error('Failed to fetch messages');
      const data = await response.json();
      setMessages(data.messages || []);

      // Mark messages as read
      await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/app_messaging?action=mark-read`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ partner_id: partnerId }),
        }
      );
    } catch (err) {
      console.error('Failed to fetch thread:', err);
      toast.error('Failed to load messages');
    } finally {
      setLoadingThread(false);
    }
  }, [user]);

  // Send message
  const sendMessage = async () => {
    if (!user || !selectedPartner || !newMessage.trim()) return;
    setSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/app_messaging?action=send`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            receiver_id: selectedPartner.partner_id,
            message_text: newMessage.trim(),
          }),
        }
      );

      if (!response.ok) throw new Error('Failed to send message');
      const data = await response.json();
      
      setMessages(prev => [...prev, data.message]);
      setNewMessage('');
      toast.success('Message sent');
      setTimeout(scrollToBottom, 100);
    } catch (err) {
      console.error('Failed to send message:', err);
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Auto-scroll when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Poll for new messages when in a thread
  useEffect(() => {
    if (selectedPartner) {
      fetchThread(selectedPartner.partner_id);
      pollIntervalRef.current = setInterval(() => {
        fetchThread(selectedPartner.partner_id);
      }, 10000); // Poll every 10 seconds
    }
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [selectedPartner, fetchThread]);

  // Also check if client has an assigned Awo but no conversations yet
  useEffect(() => {
    const checkAssignedAwo = async () => {
      if (!user || conversations.length > 0) return;
      try {
        // Check if the client has an assigned Awo via the clients table
        const { data: clientRecord } = await supabase
          .from(TABLES.clients)
          .select('awo_id')
          .eq('email', user.email)
          .single();

        if (clientRecord?.awo_id) {
          // Get Awo profile
          const { data: awoProfile } = await supabase
            .from(TABLES.profiles)
            .select('id, full_name, avatar_url, role')
            .eq('id', clientRecord.awo_id)
            .single();

          if (awoProfile) {
            setConversations([{
              partner_id: awoProfile.id,
              partner_name: awoProfile.full_name || 'Your Awo',
              partner_avatar: awoProfile.avatar_url,
              partner_role: awoProfile.role || 'awo',
              last_message: {} as DBMessage,
            }]);
          }
        }
      } catch (err) {
        console.error('Failed to check assigned Awo:', err);
      }
    };
    checkAssignedAwo();
  }, [user, conversations.length]);

  const formatTime = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return `Yesterday ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + 
      ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center py-20">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <p className="text-gray-600">Please log in to view messages.</p>
            <Button className="mt-4" onClick={() => navigate('/client/auth')}>
              Log In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      {/* Sub-header for conversation context */}
      <div className="bg-white border-b border-amber-100 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          {selectedPartner ? (
            <>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedPartner(null)}
                className="md:hidden"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                <User className="h-4 w-4 text-indigo-600" />
              </div>
              <div>
                <h1 className="font-semibold text-gray-900">{selectedPartner.partner_name}</h1>
                <p className="text-xs text-gray-500 capitalize">{selectedPartner.partner_role}</p>
              </div>
            </>
          ) : (
            <>
              <MessageSquare className="h-5 w-5 text-indigo-600" />
              <h1 className="font-semibold text-gray-900">Messages</h1>
            </>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto flex h-[calc(100vh-120px)]">
        {/* Conversation List - shown on mobile only when no partner selected */}
        <div className={`w-full md:w-80 md:border-r border-amber-100 bg-white ${selectedPartner ? 'hidden md:block' : 'block'}`}>
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="p-6 text-center">
              <MessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">No conversations yet</p>
              <p className="text-gray-400 text-xs mt-1">
                Messages with your Awo will appear here
              </p>
            </div>
          ) : (
            <div className="divide-y divide-amber-50">
              {conversations.map((conv) => (
                <button
                  key={conv.partner_id}
                  onClick={() => setSelectedPartner(conv)}
                  className={`w-full p-4 text-left hover:bg-amber-50/50 transition-colors ${
                    selectedPartner?.partner_id === conv.partner_id ? 'bg-indigo-50' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                      <User className="h-5 w-5 text-indigo-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-gray-900 truncate">{conv.partner_name}</p>
                        {conv.last_message?.created_at && (
                          <span className="text-xs text-gray-400">
                            {formatTime(conv.last_message.created_at)}
                          </span>
                        )}
                      </div>
                      {conv.last_message?.message_text && (
                        <p className="text-sm text-gray-500 truncate mt-0.5">
                          {conv.last_message.sender_id === user.id ? 'You: ' : ''}
                          {conv.last_message.message_text}
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Chat Thread */}
        <div className={`flex-1 flex flex-col bg-white ${!selectedPartner ? 'hidden md:flex' : 'flex'}`}>
          {!selectedPartner ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <MessageSquare className="h-16 w-16 text-gray-200 mx-auto mb-4" />
                <p className="text-gray-400">Select a conversation to start messaging</p>
              </div>
            </div>
          ) : (
            <>
              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {loadingThread ? (
                  <div className="flex items-center justify-center h-40">
                    <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex items-center justify-center h-40">
                    <div className="text-center">
                      <MessageSquare className="h-10 w-10 text-gray-200 mx-auto mb-2" />
                      <p className="text-gray-400 text-sm">No messages yet. Start the conversation!</p>
                    </div>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isOwn = msg.sender_id === user.id;
                    return (
                      <div
                        key={msg.id}
                        className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                            isOwn
                              ? 'bg-indigo-600 text-white rounded-br-md'
                              : 'bg-gray-100 text-gray-900 rounded-bl-md'
                          }`}
                        >
                          <p className="text-sm whitespace-pre-wrap break-words">{msg.message_text}</p>
                          <p
                            className={`text-[10px] mt-1 ${
                              isOwn ? 'text-indigo-200' : 'text-gray-400'
                            }`}
                          >
                            {formatTime(msg.created_at)}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Composer */}
              <div className="border-t border-amber-100 p-3 bg-white">
                <div className="flex items-center gap-2">
                  <Input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={handleKeyPress}
                    placeholder="Type a message..."
                    className="flex-1 rounded-full border-gray-200 focus:border-indigo-300 focus:ring-indigo-200"
                    disabled={sending}
                  />
                  <Button
                    onClick={sendMessage}
                    disabled={!newMessage.trim() || sending}
                    size="icon"
                    className="rounded-full bg-indigo-600 hover:bg-indigo-700 h-10 w-10 flex-shrink-0"
                  >
                    {sending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClientMessages;