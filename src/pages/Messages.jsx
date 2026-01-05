import React, { useState, useEffect, useRef, useCallback } from "react";
import { Message, User } from "@/entities/all";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Send,
  Paperclip,
  Hash,
  X,
  MoreVertical,
  Loader2,
  FileIcon,
  Users as UsersIcon,
  Info,
  Building2,
  MessageSquare,
  MessageSquarePlus 
} from "lucide-react";
import { format, isToday, isYesterday } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { base44 } from "@/api/base44Client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useToast } from "@/components/ui/use-toast";
import ReactMarkdown from 'react-markdown';
import { usePermissions } from "@/components/hooks/usePermissions";

import NewConversationModal from "../components/messages/NewConversationModal";
import ConversationInfoModal from "../components/messages/ConversationInfoModal";
import ParticipantsModal from "../components/messages/ParticipantsModal";


export default function Messages() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { currentUser, permissions, isLoading: permissionsLoading } = usePermissions();
  
  const [messages, setMessages] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [activeMessages, setActiveMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showNewConversationModal, setShowNewConversationModal] = useState(false); 
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState([]);
  const [showConversationInfo, setShowConversationInfo] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [loadingConversations, setLoadingConversations] = useState(true); 
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  // Helper function to get user name by ID
  const getUserName = useCallback((userId) => {
    if (!userId) return 'Unknown';
    if (userId === currentUser?.id) {
      return currentUser.first_name && currentUser.last_name 
        ? `${currentUser.first_name} ${currentUser.last_name}`
        : currentUser.full_name || currentUser.email || 'You';
    }
    
    const user = allUsers.find(u => u.id === userId);
    if (user) {
      return user.first_name && user.last_name 
        ? `${user.first_name} ${user.last_name}`
        : user.full_name || user.email || 'Unknown';
    }
    
    return 'Unknown';
  }, [currentUser, allUsers]);

  // Helper function to fetch and process all messages, users, and conversations
  // without directly setting component state. This allows for better separation of concerns.
  const _fetchAndProcessData = useCallback(async (currentUserId) => {
    if (!currentUserId) {
      // If current user is not available, return empty data
      return { allMessages: [], allUsers: [], conversationsMap: {} };
    }

    const allMessages = await Message.list('-created_date');

    let users = [];
    try {
      // Try to load all users if possible (admin)
      users = await User.list();
    } catch (error) {
      // If not admin or error, derive users from message senders
      console.log('Cannot load all users (non-admin), will use message sender info instead', error);
      const userMap = new Map();
      allMessages.forEach(msg => {
        if (msg.sender_id && msg.sender_name) {
          userMap.set(msg.sender_id, {
            id: msg.sender_id,
            full_name: msg.sender_name,
            first_name: msg.sender_name.split(' ')[0] || '',
            last_name: msg.sender_name.split(' ').slice(1).join(' ') || '',
            email: ''
          });
        }
      });
      users = Array.from(userMap.values());
    }

    // Group messages into conversations
    const convMap = {};
    allMessages.forEach(msg => {
      // Only include messages relevant to the current user
      if (!msg.participant_ids.includes(currentUserId)) return;

      if (!convMap[msg.conversation_id]) {
        convMap[msg.conversation_id] = {
          id: msg.conversation_id,
          type: msg.conversation_type,
          participants: msg.participant_ids,
          loan_id: msg.loan_id,
          loan_number: msg.loan_number,
          last_message: msg,
          unread_count: 0
        };
      }

      // Update last message if newer
      if (new Date(msg.created_date) > new Date(convMap[msg.conversation_id].last_message.created_date)) {
        convMap[msg.conversation_id].last_message = msg;
      }

      // Count unread messages for the current user
      if (!msg.read_by.includes(currentUserId) && msg.sender_id !== currentUserId) {
        convMap[msg.conversation_id].unread_count++;
      }
    });

    return { allMessages, allUsers: users, conversationsMap: convMap };
  }, []); // _fetchAndProcessData itself has no dependencies that would cause it to re-create

  // Main function to load conversations and related data into component state
  const loadConversations = useCallback(async (showLoading = true) => {
    if (!currentUser) return; // Ensure currentUser is loaded before attempting to fetch

    if (showLoading) {
      setLoadingConversations(true);
    }
    
    try {
      const { allMessages, allUsers: fetchedUsers, conversationsMap } = await _fetchAndProcessData(currentUser.id);

      setMessages(allMessages); // Update global messages state
      setAllUsers(fetchedUsers); // Update global users state
      
      const convList = Object.values(conversationsMap).sort((a, b) =>
        new Date(b.last_message.created_date) - new Date(a.last_message.created_date)
      );
      setConversations(convList); // Update global conversations state

    } catch (error) {
      console.error('Error loading conversations:', error);
      toast({
        variant: "destructive",
        title: "Loading Error",
        description: "Failed to load conversations. Please try refreshing.",
      });
    } finally {
      if (showLoading) {
        setLoadingConversations(false);
      }
    }
  }, [currentUser, _fetchAndProcessData, toast]); // Dependencies for useCallback

  // Effect to load data initially and set up polling
  useEffect(() => {
    if (!permissionsLoading && currentUser) {
      loadConversations(true); // Initial load with loading state
      // Poll for new messages every 10 seconds (background refresh without loading state)
      const interval = setInterval(() => {
        loadConversations(false); // Background refresh
      }, 10000);
      return () => clearInterval(interval);
    }
  }, [permissionsLoading, currentUser, loadConversations]);

  // Effect to load messages for the active conversation and mark them as read
  useEffect(() => {
    // Only proceed if an active conversation is selected, messages are loaded, and currentUser is available
    if (activeConversation && messages.length > 0 && currentUser) {
      const convMessages = messages
        .filter(msg => msg.conversation_id === activeConversation.id)
        .sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
      
      setActiveMessages(convMessages);
      markAsRead(activeConversation.id);
    }
  }, [activeConversation?.id, messages, currentUser]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };



  const markAsRead = async (conversationId) => {
    const unreadMessages = messages.filter(msg =>
      msg.conversation_id === conversationId &&
      !msg.read_by.includes(currentUser.id) &&
      msg.sender_id !== currentUser.id
    );

    if (unreadMessages.length === 0) return;

    for (const msg of unreadMessages) {
      try {
        // Update each unread message to include current user's ID in read_by array
        await Message.update(msg.id, {
          read_by: [...msg.read_by, currentUser.id]
        });
      } catch (error) {
        console.error('Error marking message as read:', error);
      }
    }
    // Don't reload here - let the polling interval handle it
  };

  const handleSendMessage = async () => {
    if ((!newMessage.trim() && pendingAttachments.length === 0) || !activeConversation || isSending) return;

    const messageContent = newMessage.trim() || '📎 Sent an attachment';
    const attachments = [...pendingAttachments];

    setNewMessage('');
    setPendingAttachments([]);
    setIsSending(true);

    // Optimistic update for immediate UI feedback
    const optimisticMessage = {
      id: `temp-${Date.now()}`,
      conversation_id: activeConversation.id,
      conversation_type: activeConversation.type,
      sender_id: currentUser.id,
      sender_name: currentUser.first_name && currentUser.last_name 
        ? `${currentUser.first_name} ${currentUser.last_name}`
        : currentUser.full_name || currentUser.email,
      participant_ids: activeConversation.participants,
      content: messageContent,
      loan_id: activeConversation.loan_id || null,
      loan_number: activeConversation.loan_number || null,
      read_by: [currentUser.id], // Assume current user has read it
      attachments: attachments,
      mentions: [],
      created_date: new Date().toISOString(),
      sending: true // Custom flag for optimistic message
    };

    setActiveMessages(prev => [...prev, optimisticMessage]);
    scrollToBottom();

    try {
      await Message.create({
        conversation_id: activeConversation.id,
        conversation_type: activeConversation.type,
        sender_id: currentUser.id,
        sender_name: currentUser.first_name && currentUser.last_name 
          ? `${currentUser.first_name} ${currentUser.last_name}`
          : currentUser.full_name || currentUser.email,
        participant_ids: activeConversation.participants,
        content: messageContent,
        loan_id: activeConversation.loan_id || null,
        loan_number: activeConversation.loan_number || null,
        read_by: [currentUser.id],
        attachments: attachments,
        mentions: []
      });

      // After successful send, trigger a full reload to get the actual message from the server,
      // update conversation list (last message, unread counts), and update activeMessages.
      await loadConversations(false);
    } catch (error) {
      console.error('Error sending message:', error);
      // Revert optimistic update if send fails
      setActiveMessages(prev => prev.filter(m => m.id !== optimisticMessage.id));
      setNewMessage(messageContent); // Restore message content to input
      setPendingAttachments(attachments); // Restore attachments
      toast({
        variant: "destructive",
        title: "Send Failed",
        description: "Failed to send message. Please try again.",
      });
    }
    setIsSending(false);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !activeConversation) return;

    setIsUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });

      setPendingAttachments(prev => [...prev, {
        file_url,
        file_name: file.name,
        file_type: file.type,
        file_size: file.size
      }]);
    } catch (error) {
      console.error('Error uploading file:', error);
      toast({
        variant: "destructive",
        title: "Upload Failed",
        description: "Failed to upload file. Please try again.",
      });
    }
    setIsUploading(false);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveAttachment = (index) => {
    setPendingAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const getConversationName = (conv) => {
    if (conv.type === 'loan_channel') {
      return `Loan: ${conv.loan_number || 'N/A'}`;
    }

    // Direct message - show other participant's name
    const otherParticipantId = conv.participants.find(id => id !== currentUser?.id);
    if (!otherParticipantId) return 'You (DM)';
    
    return getUserName(otherParticipantId);
  };

  const getConversationAvatar = (conv) => {
    if (conv.type === 'loan_channel') {
      return 'LN';
    }

    const title = getConversationName(conv);
    return title.substring(0, 2).toUpperCase();
  };

  const formatMessageTime = (date) => {
    const msgDate = new Date(date);
    if (isToday(msgDate)) {
      return format(msgDate, 'h:mm a');
    } else if (isYesterday(msgDate)) {
      return 'Yesterday';
    } else {
      return format(msgDate, 'MMM d');
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const filteredConversations = conversations.filter(conv => {
    if (!searchTerm) return true;
    const title = getConversationName(conv).toLowerCase();
    const lastMsgContent = conv.last_message?.content?.toLowerCase() || '';
    return title.includes(searchTerm.toLowerCase()) || lastMsgContent.includes(searchTerm.toLowerCase());
  });

  const getConversationParticipants = () => {
    if (!activeConversation || !allUsers || allUsers.length === 0) return [];

    const participantMap = new Map();
    
    activeConversation.participants.forEach(pId => {
      const user = allUsers.find(u => u.id === pId);
      if (user) {
        participantMap.set(pId, {
          id: pId,
          name: user.first_name && user.last_name 
            ? `${user.first_name} ${user.last_name}`
            : user.full_name || user.email || 'Unknown',
          email: user.email || ''
        });
      } else if (pId === currentUser?.id) {
        participantMap.set(pId, {
          id: pId,
          name: currentUser.first_name && currentUser.last_name 
            ? `${currentUser.first_name} ${currentUser.last_name}`
            : currentUser.full_name || currentUser.email || 'You',
          email: currentUser.email || ''
        });
      } else {
        // Fallback for participants not found in allUsers (e.g., deleted users)
        participantMap.set(pId, {
          id: pId,
          name: `User ${pId.substring(0, 8)}...`,
          email: ''
        });
      }
    });

    return Array.from(participantMap.values());
  };

  const handleViewLoanDetails = () => {
    if (activeConversation?.loan_id) {
      navigate(createPageUrl(`LoanDetail?id=${activeConversation.loan_id}`));
    }
  };

  const isSystemMessage = (message) => {
    return message.sender_id === 'system' || message.sender_name === 'System';
  };

  // Callback for when a new conversation is successfully created from the modal
  const handleConversationCreated = useCallback((newConv) => {
    toast({
      title: "Conversation Created",
      description: "Your new conversation has been successfully created.",
    });
    loadConversations(false); // Refresh the list of conversations to include the new one
    setActiveConversation(newConv); // Set the newly created conversation as active
    setShowNewConversationModal(false); // Close the modal
  }, [loadConversations, toast]); // Dependencies for useCallback

  // Display loading spinner while permissions or conversations are loading
  if (permissionsLoading || loadingConversations) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto space-y-8"> 
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-6"
        >
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
              Messages
            </h1>
          </div>
        </motion.div>

        {/* NEW SECTION: "New Message" button as per outline */}
        <div className="flex justify-end gap-3">
          {permissions.canCreateDirectMessage && ( 
            <Button
              data-tour="new-message-btn"
              onClick={() => setShowNewConversationModal(true)} 
              className="bg-blue-600 hover:bg-blue-700 text-white" 
            >
              <MessageSquarePlus className="w-4 h-4 mr-2" /> 
              New Message
            </Button>
          )}
        </div>

        <div className="flex-1 flex bg-white rounded-lg shadow-lg overflow-hidden" style={{ height: 'calc(100vh - 160px)' }}>
            {/* Sidebar */}
            <div className="w-80 bg-white border-r border-slate-200 flex flex-col">
              <div className="p-4 border-b border-slate-200">
                <div className="relative" data-tour="search-conversations">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder="Search conversations..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-2" data-tour="conversation-list">
                {filteredConversations.map((conv) => {
                  const isActive = activeConversation?.id === conv.id;
                  const title = getConversationName(conv);

                  return (
                    <motion.div
                      key={conv.id}
                      onClick={() => setActiveConversation(conv)}
                      className={`p-4 rounded-lg cursor-pointer transition-colors ${
                        isActive
                          ? 'bg-blue-50 border-2 border-blue-500'
                          : 'bg-white hover:bg-slate-50 border-2 border-transparent'
                      }`}
                      whileHover={{ x: 4 }}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center
                          ${conv.type === 'loan_channel' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                          {conv.type === 'loan_channel' ? (
                            <Building2 className="w-5 h-5" />
                          ) : (
                            <MessageSquare className="w-5 h-5" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <h3 className="font-semibold text-slate-900 truncate">{title}</h3>
                            <span className="text-xs text-slate-500">
                              {conv.last_message ? formatMessageTime(conv.last_message.created_date) : ''}
                            </span>
                          </div>

                          <div className="flex items-center justify-between">
                            <p className="text-sm text-slate-600 truncate">
                              {conv.last_message?.sender_id === currentUser?.id && 'You: '}
                              {conv.last_message?.content}
                            </p>
                            {conv.unread_count > 0 && (
                              <Badge className="bg-blue-600 text-white text-xs ml-2">
                                {conv.unread_count}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}

                {filteredConversations.length === 0 && (
                  <div className="p-8 text-center text-slate-500">
                    <p>No conversations found</p>
                  </div>
                )}
              </div>
            </div>

            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col">
              {activeConversation ? (
                <>
                  {/* Chat Header */}
                  <div className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className={`w-10 h-10 ${activeConversation.type === 'loan_channel' ? 'bg-purple-100' : 'bg-blue-100'}`}>
                        <AvatarFallback className={activeConversation.type === 'loan_channel' ? 'text-purple-700' : 'text-blue-700'}>
                          {getConversationAvatar(activeConversation)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h2 className="font-semibold text-slate-900">
                          {getConversationName(activeConversation)}
                        </h2>
                      </div>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="w-5 h-5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setShowConversationInfo(true)}>
                          <Info className="w-4 h-4 mr-2" />
                          Conversation Info
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setShowParticipants(true)}>
                          <UsersIcon className="w-4 h-4 mr-2" />
                          View Participants ({getConversationParticipants().length})
                        </DropdownMenuItem>
                        {activeConversation.type === 'loan_channel' && (
                          <DropdownMenuItem onClick={handleViewLoanDetails}>
                            <Hash className="w-4 h-4 mr-2" />
                            View Loan Details
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    <AnimatePresence>
                      {activeMessages.map((msg, index) => {
                        const isOwn = msg.sender_id === currentUser?.id;
                        const isSystem = isSystemMessage(msg);
                        
                        if (isSystem) {
                          return (
                            <motion.div
                              key={msg.id}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="flex justify-center my-6"
                            >
                              <div className="max-w-md">
                                <div className="bg-gradient-to-r from-slate-50 to-slate-100 border border-slate-200 rounded-xl px-6 py-3 shadow-sm">
                                  <div className="flex items-center justify-center gap-2 mb-2">
                                    <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center">
                                      <span className="text-xs font-bold text-slate-600">i</span>
                                    </div>
                                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                      System Message
                                    </span>
                                  </div>
                                  <div className="text-sm text-slate-700 text-center leading-relaxed prose prose-sm max-w-none">
                                    <ReactMarkdown
                                      components={{
                                        a: ({ node, ...props }) => (
                                          <a {...props} className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer" />
                                        ),
                                        p: ({ node, ...props }) => <p {...props} className="m-0" />
                                      }}
                                    >
                                      {msg.content}
                                    </ReactMarkdown>
                                  </div>
                                  <p className="text-xs text-slate-400 text-center mt-2">
                                    {format(new Date(msg.created_date), 'MMM d, yyyy \'at\' h:mm a')}
                                  </p>
                                </div>
                              </div>
                            </motion.div>
                          );
                        }

                        const prevMsg = activeMessages[index - 1];
                        const showAvatar = index === 0 || 
                                           (prevMsg && (prevMsg.sender_id !== msg.sender_id || isSystemMessage(prevMsg)));

                        const showTimestampGroup = index === 0 ||
                          (new Date(msg.created_date).getTime() - (prevMsg ? new Date(prevMsg.created_date).getTime() : 0) > 300000) ||
                          isSystemMessage(prevMsg);

                        return (
                          <React.Fragment key={msg.id}>
                            {showTimestampGroup && (
                              <div className="flex justify-center my-4">
                                <span className="text-xs text-slate-500 bg-white px-3 py-1 rounded-full border border-slate-200">
                                  {format(new Date(msg.created_date), 'EEEE, MMMM d, yyyy • h:mm a')}
                                </span>
                              </div>
                            )}

                            <motion.div
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className={`flex items-end gap-2 ${isOwn ? 'flex-row-reverse' : ''}`}
                            >
                              {showAvatar ? (
                                <Avatar className={`w-8 h-8 ${isOwn ? 'bg-blue-500' : 'bg-slate-300'}`}>
                                  <AvatarFallback className={isOwn ? 'text-white' : 'text-slate-700'}>
                                    {getUserName(msg.sender_id).substring(0, 2).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                              ) : (
                                <div className="w-8" />
                              )}

                              <div className={`flex flex-col max-w-md ${isOwn ? 'items-end' : 'items-start'}`}>
                                <span className={`text-xs font-semibold mb-1 px-3 ${isOwn ? 'text-blue-700' : 'text-slate-700'}`}>
                                  {getUserName(msg.sender_id)}
                                </span>

                                <div
                                  className={`px-4 py-2 rounded-2xl ${
                                    isOwn
                                      ? 'bg-blue-500 text-white'
                                      : 'bg-slate-200 text-slate-900'
                                  } ${msg.sending ? 'opacity-70' : ''}`}
                                >
                                  <div className={`text-sm whitespace-pre-wrap break-words prose prose-sm max-w-none ${isOwn ? 'prose-invert' : ''}`}>
                                    <ReactMarkdown
                                      components={{
                                        a: ({ node, ...props }) => (
                                          <a 
                                            {...props} 
                                            className={`underline hover:no-underline ${isOwn ? 'text-white' : 'text-blue-600'}`}
                                            onClick={(e) => {
                                              const href = props.href;
                                              if (href && href.startsWith(window.location.origin)) {
                                                e.preventDefault();
                                                window.location.href = href;
                                              }
                                            }}
                                          />
                                        ),
                                        p: ({ node, ...props }) => <p {...props} className="m-0" />
                                      }}
                                    >
                                      {msg.content}
                                    </ReactMarkdown>
                                  </div>

                                  {msg.attachments && msg.attachments.length > 0 && (
                                    <div className="mt-2 space-y-1">
                                      {msg.attachments.map((file, idx) => (
                                        <a
                                          key={idx}
                                          href={file.file_url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="flex items-center gap-2 text-xs opacity-90 hover:opacity-100 hover:underline"
                                        >
                                          <FileIcon className="w-3 h-3" />
                                          {file.file_name}
                                        </a>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                <span className="text-xs text-slate-400 mt-1 px-3">
                                  {msg.sending ? 'Sending...' : format(new Date(msg.created_date), 'h:mm a')}
                                  {msg.edited && ' (edited)'}
                                </span>
                              </div>
                            </motion.div>
                          </React.Fragment>
                        );
                      })}
                    </AnimatePresence>
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Message Input */}
                  <div className="bg-white border-t border-slate-200 p-4">
                    {pendingAttachments.length > 0 && (
                      <div className="mb-3 space-y-2">
                        {pendingAttachments.map((file, index) => (
                          <div key={index} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg border border-slate-200">
                            <FileIcon className="w-4 h-4 text-slate-500" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-900 truncate">{file.file_name}</p>
                              <p className="text-xs text-slate-500">{formatFileSize(file.file_size)}</p>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveAttachment(index)}
                              className="h-6 w-6"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex items-end gap-2">
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                      >
                        {isUploading ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <Paperclip className="w-5 h-5" />
                        )}
                      </Button>

                      <div className="flex-1 bg-slate-50 border border-slate-200 rounded-lg flex items-end">
                        <textarea
                          value={newMessage}
                          onChange={(e) => setNewMessage(e.target.value)}
                          onKeyPress={handleKeyPress}
                          placeholder="Type a message..."
                          className="flex-1 bg-transparent px-4 py-3 outline-none resize-none max-h-32"
                          rows={1}
                        />
                      </div>

                      <Button
                        onClick={handleSendMessage}
                        disabled={(!newMessage.trim() && pendingAttachments.length === 0) || isSending}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        {isSending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-slate-400">
                  <div className="text-center">
                    <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Search className="w-10 h-10" />
                    </div>
                    <p className="text-lg font-medium">Select a conversation</p>
                    <p className="text-sm mt-1">Choose a conversation from the sidebar to start chatting</p>
                  </div>
                </div>
              )}
            </div>
          </div>
      </div>

      {/* Modals */}
      <NewConversationModal
        isOpen={showNewConversationModal} 
        onClose={() => setShowNewConversationModal(false)}
        onCreated={handleConversationCreated} 
        currentUser={currentUser}
        permissions={permissions}
      />

      {activeConversation && (
        <>
          <ConversationInfoModal
            isOpen={showConversationInfo}
            onClose={() => setShowConversationInfo(false)}
            conversation={activeConversation}
          />

          <ParticipantsModal
            isOpen={showParticipants}
            onClose={() => setShowParticipants(false)}
            participants={getConversationParticipants()}
            currentUser={currentUser}
          />
        </>
      )}
    </div>
  );
}