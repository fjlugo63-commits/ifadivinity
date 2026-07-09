import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, TABLES, DBMessage } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Send,
  MessageSquare,
  User,
  Loader2,
  Users,
} from 'lucide-react';

interface ConversationPartner {
  partner_id: string;
  partner_name: string;
  partner_avatar: string | null;
  partner_role: string;
  last_message: DBMessage;
  unread_count?: number;
}

const AwoMessages = () => {
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
      
      // Get unread counts per conversation
      const convs = data.conversations || [];
      const enriched = convs.map((conv: ConversationPartner) => ({
        ...conv,
        unread_count: conv.last_message?.receiver_id === user.id && !conv.last_message?.read_at ? 1 : 0,
      }));
      
      setConversations(enriched);
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
      }, 10000);
    }
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [selectedPartner, fetchThread]);

  // Load assigned clients as potential conversations
  useEffect(() => {
    const loadClients = async () => {
      if (!user || conversations.length > 0) return;
      try {
        const { data: clients } = await supabase
          .from(TABLES.clients)
          .select('id, name, email')
          .eq('awo_id', user.id)
          .eq('status', 'active');

        if (clients && clients.length > 0) {
          // Check if any clients have auth accounts by looking up profiles by email
          const clientEmails = clients.map(c => c.email).filter(Boolean);
          const profileMap: Record<string, string> = {};
          
          if (clientEmails.length > 0) {
            const { data: profiles } = await supabase
              .from(TABLES.profiles)
              .select('id, email')
              .in('email', clientEmails);
            
            if (profiles) {
              for (const p of profiles) {
                if (p.email) profileMap[p.email] = p.id;
              }
            }
          }

          const clientConversations: ConversationPartner[] = clients
            .filter(c => c.email && profileMap[c.email])
            .map(c => ({
              partner_id: profileMap[c.email!],
              partner_name: c.name || c.email || 'Client',
              partner_avatar: null,
              partner_role: 'client',
              last_message: {} as DBMessage,
            }));

          if (clientConversations.length > 0) {
            setConversations(clientConversations);
          }
        }
      } catch (err) {
        console.error('Failed to load clients:', err);
      }
    };
    loadClients();
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <p className="text-gray-600">Please log in to view messages.</p>
            <Button className="mt-4" onClick={() => navigate('/auth')}>
              Log In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
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
              <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                <User className="h-4 w-4 text-amber-700" />
              </div>
              <div>
                <h1 className="font-semibold text-gray-900">{selectedPartner.partner_name}</h1>
                <p className="text-xs text-gray-500 capitalize">{selectedPartner.partner_role}</p>
              </div>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/awo/dashboard')}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <Users className="h-5 w-5 text-indigo-600" />
              <h1 className="font-semibold text-gray-900">Client Messages</h1>
              {conversations.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {conversations.length} client{conversations.length !== 1 ? 's' : ''}
                </Badge>
              )}
            </>
          )}
        </div>
      </header>

      <div className="max-w-5xl mx-auto flex h-[calc(100vh-57px)]">
        {/* Conversation List */}
        <div className={`w-full md:w-80 md:border-r border-gray-200 bg-white ${selectedPartner ? 'hidden md:block' : 'block'}`}>
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="p-6 text-center">
              <Users className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">No client messages yet</p>
              <p className="text-gray-400 text-xs mt-1">
                Messages from your clients will appear here
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {conversations.map((conv) => (
                <button
                  key={conv.partner_id}
                  onClick={() => setSelectedPartner(conv)}
                  className={`w-full p-4 text-left hover:bg-gray-50 transition-colors ${
                    selectedPartner?.partner_id === conv.partner_id ? 'bg-indigo-50' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                      <User className="h-5 w-5 text-amber-700" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-gray-900 truncate">{conv.partner_name}</p>
                        <div className="flex items-center gap-1">
                          {conv.last_message?.created_at && (
                            <span className="text-xs text-gray-400">
                              {formatTime(conv.last_message.created_at)}
                            </span>
                          )}
                          {conv.unread_count && conv.unread_count > 0 && (
                            <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] flex items-center justify-center">
                              {conv.unread_count}
                            </span>
                          )}
                        </div>
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
                <p className="text-gray-400">Select a client conversation to reply</p>
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
                      <p className="text-gray-400 text-sm">No messages yet with this client.</p>
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
                              ? 'bg-gray-200 text-gray-900 rounded-br-md'
                              : 'bg-indigo-600 text-white rounded-bl-md'
                          }`}
                        >
                          <p className="text-sm whitespace-pre-wrap break-words">{msg.message_text}</p>
                          <p
                            className={`text-[10px] mt-1 ${
                              isOwn ? 'text-gray-500' : 'text-indigo-200'
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
              <div className="border-t border-gray-200 p-3 bg-white">
                <div className="flex items-center gap-2">
                  <Input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={handleKeyPress}
                    placeholder="Reply to client..."
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

export default AwoMessages;