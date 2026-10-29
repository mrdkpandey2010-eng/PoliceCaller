import React, { useState, useEffect } from 'react';
import { Avatar, ChatBubble, Button, Modal, Input } from '@police-directory/ui';
import { Send, Users, ArrowLeft, Plus, MessageSquare } from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

export interface MessengerProps {
  initialRecipientId?: string | null;
  onClearInitialRecipient?: () => void;
}

export const Messenger: React.FC<MessengerProps> = ({
  initialRecipientId,
  onClearInitialRecipient,
}) => {
  const { user } = useAuth();
  const { language } = useLanguage();

  const [conversations, setConversations] = useState<any[]>([]);
  const [activeConversation, setActiveConversation] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [loadingConv, setLoadingConv] = useState(true);
  const [loadingMsg, setLoadingMsg] = useState(false);
  const [sending, setSending] = useState(false);

  // New Group Modal
  const [showNewGroupModal, setShowNewGroupModal] = useState(false);
  const [newGroupTitle, setNewGroupTitle] = useState('');

  const fetchConversations = async () => {
    try {
      const res = await api.getConversations();
      setConversations(res.conversations || []);
    } finally {
      setLoadingConv(false);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, []);

  // Handle open conversation if initialRecipientId provided
  useEffect(() => {
    if (initialRecipientId) {
      api.createConversation({ type: 'DIRECT', participantId: initialRecipientId }).then((res) => {
        fetchConversations().then(() => {
          setActiveConversation({ id: res.conversationId });
        });
        if (onClearInitialRecipient) onClearInitialRecipient();
      });
    }
  }, [initialRecipientId]);

  // Fetch messages when active conversation changes
  useEffect(() => {
    if (activeConversation?.id) {
      setLoadingMsg(true);
      api
        .getMessages(activeConversation.id)
        .then((res) => {
          setMessages(res.messages || []);
        })
        .finally(() => {
          setLoadingMsg(false);
        });
    }
  }, [activeConversation?.id]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !activeConversation?.id || sending) return;

    const text = inputText.trim();
    setInputText('');
    setSending(true);

    try {
      const res = await api.sendMessage({
        conversationId: activeConversation.id,
        content: text,
      });
      setMessages((prev) => [...prev, res.message]);
      fetchConversations();
    } catch (err: any) {
      alert(err.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleDeleteForMe = async (messageId: string) => {
    try {
      await api.deleteForMe(messageId);
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    } catch (err: any) {
      alert(err.message || 'Failed to delete message');
    }
  };

  const handleCreateGroup = async () => {
    if (!newGroupTitle.trim()) return;
    try {
      const res = await api.createConversation({
        type: 'GROUP',
        groupTitle: newGroupTitle.trim(),
      });
      setShowNewGroupModal(false);
      setNewGroupTitle('');
      await fetchConversations();
      setActiveConversation({ id: res.conversationId, title: newGroupTitle.trim(), type: 'GROUP' });
    } catch (err: any) {
      alert(err.message || 'Failed to create group');
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-2 sm:px-4 py-2 sm:py-4 pb-20 md:pb-6 h-[calc(100vh-4rem)]">
      <div className="grid grid-cols-1 md:grid-cols-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm h-full">
        {/* Left Pane: Conversation List */}
        <div
          className={`flex flex-col border-r border-slate-200 dark:border-slate-800 h-full ${
            activeConversation ? 'hidden md:flex' : 'flex'
          }`}
        >
          {/* Header */}
          <div className="p-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/40">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                {language === 'hi' ? 'विभागीय संदेश' : 'Departmental Messages'}
              </h2>
              <p className="text-[11px] text-slate-500">Secure TLS & At-Rest Encryption</p>
            </div>
            <Button
              variant="teal"
              size="icon"
              onClick={() => setShowNewGroupModal(true)}
              aria-label="Create new group conversation"
              className="w-9 h-9 min-w-[36px] min-h-[36px] rounded-full p-0"
              title="New Group"
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60">
            {loadingConv ? (
              <div className="flex items-center justify-center h-48">
                <span className="w-6 h-6 border-2 border-[#17324F] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : conversations.length === 0 ? (
              <div className="text-center py-16 px-4">
                <MessageSquare className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  {language === 'hi' ? 'कोई वार्तालाप नहीं' : 'No active conversations'}
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Tap message on any contact in Directory to start a chat.
                </p>
              </div>
            ) : (
              conversations.map((conv) => {
                const isSelected = activeConversation?.id === conv.id;
                return (
                  <div
                    key={conv.id}
                    onClick={() => setActiveConversation(conv)}
                    className={`flex items-center gap-3 p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors ${
                      isSelected ? 'bg-slate-100/80 dark:bg-slate-800' : ''
                    }`}
                  >
                    <Avatar
                      src={conv.displayPhoto}
                      name={conv.displayName || 'Group'}
                      size="md"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                          {conv.displayName}
                        </h4>
                        {conv.updatedAt && (
                          <span className="text-[10px] text-slate-400 shrink-0">
                            {new Date(conv.updatedAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {conv.lastMessageContent || 'No messages yet'}
                      </p>
                    </div>
                    {conv.unreadCount > 0 && (
                      <span className="w-5 h-5 rounded-full bg-[#147D84] text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                        {conv.unreadCount}
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Pane: Active Chat Window */}
        <div
          className={`md:col-span-2 flex flex-col h-full bg-slate-50/30 dark:bg-slate-950/20 ${
            !activeConversation ? 'hidden md:flex' : 'flex'
          }`}
        >
          {activeConversation ? (
            <>
              {/* Chat Top Bar */}
              <div className="p-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <button
                    onClick={() => setActiveConversation(null)}
                    aria-label="Back to conversations list"
                    className="md:hidden p-1.5 text-slate-500 hover:text-slate-800 dark:hover:text-white rounded-full"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <Avatar
                    src={activeConversation.displayPhoto}
                    name={activeConversation.displayName || 'Chat'}
                    size="sm"
                  />
                  <div className="min-w-0">
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                      {activeConversation.displayName}
                    </h3>
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                      Official Departmental Channel
                    </p>
                  </div>
                </div>
              </div>

              {/* Message List */}
              <div className="flex-1 p-4 overflow-y-auto space-y-2">
                {loadingMsg ? (
                  <div className="flex items-center justify-center h-full">
                    <span className="w-6 h-6 border-2 border-[#17324F] border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 text-xs">
                    {language === 'hi'
                      ? 'वार्तालाप शुरू करें। संदेश सुरक्षित रूप से संग्रहीत होते हैं।'
                      : 'Send a message to start conversation. Messages are persistently stored.'}
                  </div>
                ) : (
                  messages.map((m) => (
                    <ChatBubble
                      key={m.id}
                      id={m.id}
                      content={m.content}
                      senderName={m.senderName}
                      senderRank={m.senderRank}
                      isSelf={m.senderId === user?.id}
                      timestamp={new Date(m.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                      status="read"
                      onDeleteForMe={handleDeleteForMe}
                    />
                  ))
                )}
              </div>

              {/* Message Input Bar (Supports Hindi text and emojis) */}
              <form
                onSubmit={handleSendMessage}
                className="p-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2"
              >
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={
                    language === 'hi' ? 'संदेश लिखें (हिंदी / English)...' : 'Type a message...'
                  }
                  className="flex-1 min-h-[44px] px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-full text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#17324F]"
                />
                <Button
                  type="submit"
                  variant="primary"
                  size="icon"
                  disabled={!inputText.trim() || sending}
                  aria-label="Send message"
                  className="w-10 h-10 min-w-[40px] min-h-[40px] rounded-full bg-[#17324F] hover:bg-[#10243B] text-white p-0 shadow-sm"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </form>
            </>
          ) : (
            <div className="hidden md:flex flex-col items-center justify-center h-full text-center p-8">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-3">
                <Users className="w-8 h-8" />
              </div>
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">
                Select a conversation
              </h3>
              <p className="text-xs text-slate-400 max-w-xs mt-1">
                Choose a conversation from the left pane or initiate a chat from the directory.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* New Group Modal */}
      <Modal
        isOpen={showNewGroupModal}
        onClose={() => setShowNewGroupModal(false)}
        title="Create Departmental Group"
        maxWidth="sm"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button
              variant="ghost"
              onClick={() => setShowNewGroupModal(false)}
              aria-label="Cancel group creation"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleCreateGroup}
              disabled={!newGroupTitle.trim()}
              aria-label="Confirm create group"
            >
              Create Group
            </Button>
          </div>
        }
      >
        <Input
          label="Group Title / Subject"
          value={newGroupTitle}
          onChange={(e) => setNewGroupTitle(e.target.value)}
          placeholder="e.g. Crime Branch Sector 4"
          required
        />
      </Modal>
    </div>
  );
};
