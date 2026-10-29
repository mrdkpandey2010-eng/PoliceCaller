import React, { useState, useEffect, useRef } from 'react';
import { Avatar, ChatBubble, Button, Modal, Input } from '@police-directory/ui';
import {
  Send,
  Users,
  ArrowLeft,
  Plus,
  MessageSquare,
  MessageSquarePlus,
  Info,
  LogOut,
  Search,
  Check,
  Trash2,
} from 'lucide-react';
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

  // Modals
  const [showNewDirectModal, setShowNewDirectModal] = useState(false);
  const [showNewGroupModal, setShowNewGroupModal] = useState(false);
  const [showGroupInfoModal, setShowGroupInfoModal] = useState(false);
  const [groupMembers, setGroupMembers] = useState<any[]>([]);

  // Directory contacts for picker
  const [contacts, setContacts] = useState<any[]>([]);
  const [contactSearch, setContactSearch] = useState('');
  const [newGroupTitle, setNewGroupTitle] = useState('');
  const [selectedGroupMemberIds, setSelectedGroupMemberIds] = useState<string[]>([]);

  // Presence & Typing state
  const [isCounterpartyOnline, setIsCounterpartyOnline] = useState<boolean | null>(null);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const lastTypingBroadcastRef = useRef<number>(0);

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
    // Heartbeat for presence
    api.pingPresence().catch(() => {});
    const heartbeatTimer = setInterval(() => {
      api.pingPresence().catch(() => {});
    }, 25000);
    return () => clearInterval(heartbeatTimer);
  }, []);

  // Keyboard Escape listener to go back
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && activeConversation) {
        setActiveConversation(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeConversation]);

  // Load directory contacts for new chat / new group modals
  useEffect(() => {
    if (showNewDirectModal || showNewGroupModal) {
      api.getContacts({ limit: 100 }).then((res) => {
        // Exclude current user from contact picker
        const filtered = (res.contacts || []).filter((c: any) => c.id !== user?.id);
        setContacts(filtered);
      }).catch(() => {});
    }
  }, [showNewDirectModal, showNewGroupModal, user?.id]);

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

  // Fetch messages and presence when active conversation changes
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

      // If group, load members
      if (activeConversation.type === 'GROUP') {
        api.getConversationMembers(activeConversation.id).then((res) => {
          setGroupMembers(res.members || []);
        }).catch(() => {});
      } else if (activeConversation.counterpartyId) {
        api.getUserPresence(activeConversation.counterpartyId).then((res) => {
          setIsCounterpartyOnline(res.isOnline);
        }).catch(() => {});
      }
    }
  }, [activeConversation?.id]);

  // Poll typing indicators and refresh messages periodically
  useEffect(() => {
    if (!activeConversation?.id) return;

    const interval = setInterval(() => {
      // Check typing
      api.getTypingUsers(activeConversation.id).then((res) => {
        setTypingUsers(res.typingUsers || []);
      }).catch(() => {});

      // Refresh presence if direct
      if (activeConversation.counterpartyId) {
        api.getUserPresence(activeConversation.counterpartyId).then((res) => {
          setIsCounterpartyOnline(res.isOnline);
        }).catch(() => {});
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [activeConversation?.id, activeConversation?.counterpartyId]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
    const now = Date.now();
    if (activeConversation?.id && now - lastTypingBroadcastRef.current > 2000) {
      lastTypingBroadcastRef.current = now;
      api.broadcastTyping(activeConversation.id).catch(() => {});
    }
  };

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
      setMessages((prev) => [...prev, { ...res.message, status: 'sent' }]);
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

  const handleDeleteConversationForMe = async (
    e: React.MouseEvent,
    conversationId: string,
    displayName: string
  ) => {
    e.stopPropagation();
    if (
      !window.confirm(
        `Delete conversation "${displayName}" for you? (Messages will not be deleted for other participants).`
      )
    ) {
      return;
    }
    try {
      await api.deleteConversationForMe(conversationId);
      if (activeConversation?.id === conversationId) {
        setActiveConversation(null);
        setMessages([]);
      }
      await fetchConversations();
    } catch (err: any) {
      alert(err.message || 'Failed to delete conversation');
    }
  };

  const handleStartDirectChat = async (participantId: string) => {
    try {
      const res = await api.createConversation({
        type: 'DIRECT',
        participantId,
      });
      setShowNewDirectModal(false);
      setContactSearch('');
      await fetchConversations();
      const match = conversations.find((c) => c.id === res.conversationId);
      setActiveConversation(match || { id: res.conversationId, counterpartyId: participantId, type: 'DIRECT' });
    } catch (err: any) {
      alert(err.message || 'Failed to start direct conversation');
    }
  };

  const handleCreateGroup = async () => {
    if (!newGroupTitle.trim() || newGroupTitle.trim().length < 2) return;
    try {
      const res = await api.createConversation({
        type: 'GROUP',
        groupTitle: newGroupTitle.trim(),
        memberIds: selectedGroupMemberIds,
      });
      setShowNewGroupModal(false);
      setNewGroupTitle('');
      setSelectedGroupMemberIds([]);
      await fetchConversations();
      setActiveConversation({ id: res.conversationId, title: newGroupTitle.trim(), type: 'GROUP' });
    } catch (err: any) {
      alert(err.message || 'Failed to create group');
    }
  };

  const handleLeaveGroup = async () => {
    if (!activeConversation?.id) return;
    if (!window.confirm('Are you sure you want to leave this departmental group?')) return;
    try {
      await api.leaveConversation(activeConversation.id);
      setShowGroupInfoModal(false);
      setActiveConversation(null);
      await fetchConversations();
    } catch (err: any) {
      alert(err.message || 'Failed to leave group');
    }
  };

  const toggleGroupMember = (memberId: string) => {
    setSelectedGroupMemberIds((prev) =>
      prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId]
    );
  };

  const filteredContacts = contacts.filter((c) => {
    const q = contactSearch.toLowerCase();
    return (
      c.fullName.toLowerCase().includes(q) ||
      c.pno.includes(q) ||
      (c.designationName && c.designationName.toLowerCase().includes(q)) ||
      (c.districtName && c.districtName.toLowerCase().includes(q))
    );
  });

  return (
    <div className="max-w-6xl mx-auto px-2 sm:px-4 py-2 sm:py-4 pb-20 md:pb-6 h-[calc(100vh-5rem)]">
      <div className="grid grid-cols-1 md:grid-cols-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm h-full">
        {/* Left Pane: Conversation List */}
        <div
          className={`flex flex-col border-r border-slate-200 dark:border-slate-800 h-full ${
            activeConversation ? 'hidden md:flex' : 'flex'
          }`}
        >
          {/* Header with New Direct Chat & New Group buttons */}
          <div className="p-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/40">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                {language === 'hi' ? 'विभागीय संदेश' : 'Departmental Messages'}
              </h2>
              <p className="text-[11px] text-slate-500">Secure TLS & At-Rest Encryption</p>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowNewDirectModal(true)}
                aria-label={language === 'hi' ? 'नया संदेश प्रारंभ करें' : 'Start new direct chat'}
                className="w-9 h-9 min-w-[36px] min-h-[36px] rounded-full text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 p-0"
                title="New Direct Chat"
              >
                <MessageSquarePlus className="w-4 h-4" />
              </Button>
              <Button
                variant="teal"
                size="icon"
                onClick={() => setShowNewGroupModal(true)}
                aria-label={language === 'hi' ? 'नया समूह बनाएं' : 'Create new group conversation'}
                className="w-9 h-9 min-w-[36px] min-h-[36px] rounded-full p-0"
                title="New Group"
              >
                <Users className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Conversation List */}
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
                  Tap New Chat above or message any contact in Directory.
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
                    <div className="flex items-center gap-1.5 shrink-0">
                      {conv.unreadCount > 0 && (
                        <span className="w-5 h-5 rounded-full bg-[#147D84] text-white text-[10px] font-bold flex items-center justify-center">
                          {conv.unreadCount}
                        </span>
                      )}
                      <button
                        onClick={(e) =>
                          handleDeleteConversationForMe(e, conv.id, conv.displayName || 'Chat')
                        }
                        aria-label={`Delete conversation ${conv.displayName} for me`}
                        title="Delete for me"
                        className="p-1.5 text-slate-400 hover:text-red-500 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
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
              {/* Chat Top Bar with Accessible Back Button */}
              <div className="p-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <button
                    onClick={() => setActiveConversation(null)}
                    aria-label={language === 'hi' ? 'चैट सूची में वापस' : 'Back to chats'}
                    title={language === 'hi' ? 'चैट सूची में वापस' : 'Back to chats'}
                    className="p-1.5 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <Avatar
                    src={activeConversation.displayPhoto}
                    name={activeConversation.displayName || 'Chat'}
                    size="sm"
                    isOnline={isCounterpartyOnline ?? undefined}
                  />
                  <div className="min-w-0">
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                      {activeConversation.displayName}
                    </h3>
                    <div className="flex items-center gap-1.5">
                      {activeConversation.type === 'GROUP' ? (
                        <span className="text-[10px] text-slate-400 font-medium">
                          Departmental Group
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[10px] font-medium">
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isCounterpartyOnline ? 'bg-emerald-500' : 'bg-slate-400'
                            }`}
                          />
                          <span className={isCounterpartyOnline ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}>
                            {isCounterpartyOnline ? 'Online' : 'Offline'}
                          </span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Action: Group Info */}
                {activeConversation.type === 'GROUP' && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      api.getConversationMembers(activeConversation.id).then((res) => {
                        setGroupMembers(res.members || []);
                        setShowGroupInfoModal(true);
                      });
                    }}
                    aria-label="View group details"
                    title="Group Details"
                    className="w-8 h-8 rounded-full text-slate-500 hover:text-slate-800 p-0"
                  >
                    <Info className="w-4 h-4" />
                  </Button>
                )}
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
                      status={m.status || (m.senderId === user?.id ? 'sent' : undefined)}
                      onDeleteForMe={handleDeleteForMe}
                    />
                  ))
                )}
              </div>

              {/* Typing Banner */}
              {typingUsers.length > 0 && (
                <div className="px-4 py-1 text-[11px] text-emerald-600 dark:text-emerald-400 bg-white/70 dark:bg-slate-900/70 italic flex items-center gap-1.5 border-t border-slate-100 dark:border-slate-800">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {typingUsers.join(', ')} {language === 'hi' ? 'टाइप कर रहे हैं...' : 'is typing...'}
                </div>
              )}

              {/* Message Input Bar (Supports Hindi text and emojis) */}
              <form
                onSubmit={handleSendMessage}
                className="p-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2"
              >
                <input
                  type="text"
                  value={inputText}
                  onChange={handleInputChange}
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
                Choose a conversation from the left pane or start a new direct or group chat above.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* New Direct Chat Modal */}
      <Modal
        isOpen={showNewDirectModal}
        onClose={() => {
          setShowNewDirectModal(false);
          setContactSearch('');
        }}
        title="Start New Direct Chat"
        maxWidth="md"
      >
        <div className="space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              value={contactSearch}
              onChange={(e) => setContactSearch(e.target.value)}
              placeholder="Search by officer name, PNO, rank, or district..."
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#17324F]"
            />
          </div>

          <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
            {filteredContacts.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">No matching police officers found.</p>
            ) : (
              filteredContacts.map((c) => (
                <div
                  key={c.id}
                  onClick={() => handleStartDirectChat(c.id)}
                  className="flex items-center justify-between p-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 rounded-xl cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Avatar src={c.photoUrl} name={c.fullName} size="sm" />
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white">{c.fullName}</h4>
                      <p className="text-[11px] text-slate-500">
                        {c.designationName} • {c.districtName} (PNO: {c.pno})
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Message ${c.fullName}`}
                    className="text-xs font-semibold text-[#147D84]"
                  >
                    Message
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      </Modal>

      {/* New Group Modal */}
      <Modal
        isOpen={showNewGroupModal}
        onClose={() => {
          setShowNewGroupModal(false);
          setNewGroupTitle('');
          setSelectedGroupMemberIds([]);
        }}
        title="Create Departmental Group"
        maxWidth="md"
        footer={
          <div className="flex items-center justify-between w-full">
            <span className="text-xs font-medium text-slate-500">
              {selectedGroupMemberIds.length} member(s) selected
            </span>
            <div className="flex items-center gap-2">
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
                disabled={!newGroupTitle.trim() || newGroupTitle.trim().length < 2}
                aria-label="Confirm create group"
                className="bg-[#17324F]"
              >
                Create Group
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          <Input
            label="Group Subject / Title"
            value={newGroupTitle}
            onChange={(e) => setNewGroupTitle(e.target.value)}
            placeholder="e.g. Crime Branch Sector 4 Taskforce"
            englishOnlyNotice
            required
          />

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Select Group Members
            </label>
            <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">
              {contacts.map((c) => {
                const isSelected = selectedGroupMemberIds.includes(c.id);
                return (
                  <div
                    key={c.id}
                    onClick={() => toggleGroupMember(c.id)}
                    className="flex items-center justify-between p-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <Avatar src={c.photoUrl} name={c.fullName} size="sm" />
                      <div>
                        <h5 className="text-xs font-semibold text-slate-900 dark:text-white">{c.fullName}</h5>
                        <p className="text-[10px] text-slate-400">
                          {c.designationName} • {c.districtName}
                        </p>
                      </div>
                    </div>
                    <div
                      className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                        isSelected
                          ? 'bg-[#17324F] border-[#17324F] text-white'
                          : 'border-slate-300 dark:border-slate-600'
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </Modal>

      {/* Group Info Modal */}
      <Modal
        isOpen={showGroupInfoModal}
        onClose={() => setShowGroupInfoModal(false)}
        title="Departmental Group Details"
        maxWidth="md"
        footer={
          <div className="flex items-center justify-between w-full">
            <Button
              variant="danger"
              size="sm"
              aria-label="Leave Group"
              onClick={handleLeaveGroup}
              icon={<LogOut className="w-3.5 h-3.5" />}
            >
              Leave Group
            </Button>
            <Button
              variant="ghost"
              aria-label="Close group details"
              onClick={() => setShowGroupInfoModal(false)}
            >
              Close
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              {activeConversation?.displayName}
            </h4>
            <p className="text-xs text-slate-500">
              Total Personnel: {groupMembers.length}
            </p>
          </div>

          <div>
            <h5 className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
              Group Members
            </h5>
            <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">
              {groupMembers.map((m) => (
                <div key={m.userId} className="flex items-center justify-between p-2.5">
                  <div className="flex items-center gap-2.5">
                    <Avatar src={m.photoUrl} name={m.fullName} size="sm" />
                    <div>
                      <h6 className="text-xs font-bold text-slate-900 dark:text-white">
                        {m.fullName} {m.userId === user?.id ? '(You)' : ''}
                      </h6>
                      <p className="text-[10px] text-slate-400">
                        {m.designationName} • {m.districtName}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      m.memberRole === 'ADMIN'
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                    }`}
                  >
                    {m.memberRole}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};
