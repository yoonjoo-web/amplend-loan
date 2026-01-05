
import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Reply, Download, Paperclip } from "lucide-react";
import { format } from "date-fns";
import { motion } from "framer-motion"; // Import motion for animations

import ComposeMessageModal from "./ComposeMessageModal";

export default function MessageThreadModal({ isOpen, onClose, thread, currentUser, onReply }) {
  const [showReplyModal, setShowReplyModal] = useState(false);

  if (!thread || thread.length === 0) return null;

  const firstMessage = thread[0];

  const handleReplyClose = () => {
    setShowReplyModal(false);
    // After replying, we want to refresh the thread, so call onReply
    onReply();
  };

  // Helper function to render an individual message in a chat-like bubble
  const renderMessage = (message) => {
    const isOwnMessage = message.sender_id === currentUser?.id;
    // Using message.sender_name directly as it's available in the existing message object
    const senderName = message.sender_name;

    return (
      <motion.div
        key={message.id}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} mb-4`}
      >
        <div className={`max-w-[70%] ${isOwnMessage ? 'items-end' : 'items-start'} flex flex-col`}>
          {!isOwnMessage && (
            // Display sender name above the message bubble for others
            <span className="text-xs text-slate-500 mb-1 px-3">{senderName}</span>
          )}
          <div
            className={`rounded-2xl px-4 py-2 ${
              isOwnMessage
                ? 'bg-blue-100 text-slate-900' // Your message style
                : 'bg-slate-100 text-slate-900' // Other's message style
            }`}
          >
            {/* Message Body */}
            <div className="text-slate-700 whitespace-pre-wrap">
              {message.body}
            </div>

            {/* Attachments */}
            {message.attachments && message.attachments.length > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-200">
                <p className="text-sm font-semibold text-slate-700 mb-2">
                  Attachments ({message.attachments.length})
                </p>
                <div className="space-y-2">
                  {message.attachments.map((file, fileIndex) => (
                    <a
                      key={fileIndex}
                      href={file.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      <Paperclip className="w-4 h-4" />
                      {file.file_name}
                      <Download className="w-3 h-3" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
          {/* Timestamp below the bubble */}
          <div className={`mt-1 text-xs text-slate-500 ${isOwnMessage ? 'text-right' : 'text-left'} px-3`}>
            {format(new Date(message.created_date), 'MMM d, yyyy h:mm a')}
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto flex flex-col">
          <DialogHeader className="sticky top-0 bg-white z-10 pt-6 pb-4 border-b">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <DialogTitle className="text-2xl mb-2">{firstMessage.subject}</DialogTitle>
                {firstMessage.loan_number && (
                  <Badge variant="outline">Loan: {firstMessage.loan_number}</Badge>
                )}
              </div>
              <Button onClick={() => setShowReplyModal(true)}>
                <Reply className="w-4 h-4 mr-2" />
                Reply
              </Button>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto py-4 pr-2 -mr-2"> {/* Added flex-1 and overflow-y-auto here for scrollable messages */}
            {thread.map((message) => renderMessage(message))}
          </div>
        </DialogContent>
      </Dialog>

      <ComposeMessageModal
        isOpen={showReplyModal}
        onClose={handleReplyClose}
        currentUser={currentUser}
        onSent={handleReplyClose}
        replyTo={firstMessage}
      />
    </>
  );
}
