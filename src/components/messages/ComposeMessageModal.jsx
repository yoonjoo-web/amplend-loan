import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { User, Loan, Message } from "@/entities/all";
import { Send, Upload, X, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function ComposeMessageModal({ isOpen, onClose, currentUser, onSent, replyTo = null }) {
  const [users, setUsers] = useState([]);
  const [loans, setLoans] = useState([]);
  const [selectedRecipients, setSelectedRecipients] = useState([]);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [selectedLoan, setSelectedLoan] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [isSending, setIsSending] = useState(false);
  const [showRecipientPicker, setShowRecipientPicker] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadUsers();
      loadLoans();
      
      if (replyTo) {
        setSelectedRecipients([{
          id: replyTo.sender_id,
          name: replyTo.sender_name,
          email: replyTo.sender_email
        }]);
        setSubject(`Re: ${replyTo.subject}`);
      } else {
        resetForm();
      }
    }
  }, [isOpen, replyTo]);

  const loadUsers = async () => {
    try {
      const allUsers = await User.list();
      setUsers(allUsers);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const loadLoans = async () => {
    try {
      const allLoans = await Loan.list();
      setLoans(allLoans);
    } catch (error) {
      console.error('Error loading loans:', error);
    }
  };

  const resetForm = () => {
    setSelectedRecipients([]);
    setSubject('');
    setBody('');
    setSelectedLoan('');
    setAttachments([]);
  };

  const handleAddRecipient = (user) => {
    if (!selectedRecipients.find(r => r.id === user.id)) {
      setSelectedRecipients([...selectedRecipients, {
        id: user.id,
        name: user.full_name || user.email,
        email: user.email
      }]);
    }
    setShowRecipientPicker(false);
  };

  const handleRemoveRecipient = (userId) => {
    setSelectedRecipients(selectedRecipients.filter(r => r.id !== userId));
  };

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    setIsSending(true);
    
    try {
      const uploadedFiles = await Promise.all(
        files.map(async (file) => {
          const { file_url } = await base44.integrations.Core.UploadFile({ file });
          return {
            file_url,
            file_name: file.name,
            uploaded_date: new Date().toISOString()
          };
        })
      );
      setAttachments([...attachments, ...uploadedFiles]);
    } catch (error) {
      console.error('Error uploading files:', error);
      alert('Failed to upload files. Please try again.');
    }
    setIsSending(false);
  };

  const handleRemoveAttachment = (index) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  const handleSend = async () => {
    if (!selectedRecipients.length || !subject.trim() || !body.trim()) {
      alert('Please fill in all required fields');
      return;
    }

    setIsSending(true);
    try {
      const threadId = replyTo ? (replyTo.thread_id || replyTo.id) : `thread_${Date.now()}`;
      const selectedLoanData = loans.find(l => l.id === selectedLoan);

      await Message.create({
        thread_id: threadId,
        sender_id: currentUser.id,
        sender_name: currentUser.full_name || currentUser.email,
        sender_email: currentUser.email,
        recipient_ids: selectedRecipients.map(r => r.id),
        recipient_names: selectedRecipients.map(r => r.name),
        subject: subject,
        body: body,
        loan_id: selectedLoan || null,
        loan_number: selectedLoanData?.loan_number || null,
        attachments: attachments,
        read_by: [],
        is_reply: !!replyTo,
        parent_message_id: replyTo?.id || null
      });

      onSent();
      onClose();
      resetForm();
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Failed to send message. Please try again.');
    }
    setIsSending(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{replyTo ? 'Reply to Message' : 'Compose New Message'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Recipients */}
          <div className="space-y-2">
            <Label>To *</Label>
            <div className="flex flex-wrap gap-2 mb-2">
              {selectedRecipients.map((recipient) => (
                <Badge key={recipient.id} variant="secondary" className="flex items-center gap-1">
                  {recipient.name}
                  <button
                    onClick={() => handleRemoveRecipient(recipient.id)}
                    className="ml-1 hover:bg-slate-300 rounded-full"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <Popover open={showRecipientPicker} onOpenChange={setShowRecipientPicker}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start">
                  Add Recipients...
                </Button>
              </PopoverTrigger>
              <PopoverContent className="p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search users..." />
                  <CommandList>
                    <CommandEmpty>No users found.</CommandEmpty>
                    <CommandGroup>
                      {users
                        .filter(u => u.id !== currentUser?.id)
                        .map((user) => (
                        <CommandItem
                          key={user.id}
                          onSelect={() => handleAddRecipient(user)}
                          className="cursor-pointer"
                        >
                          <div>
                            <p className="font-semibold">{user.full_name || user.email}</p>
                            <p className="text-xs text-slate-500">{user.app_role}</p>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Related Loan */}
          <div className="space-y-2">
            <Label>Related Loan (Optional)</Label>
            <Select value={selectedLoan} onValueChange={setSelectedLoan}>
              <SelectTrigger>
                <SelectValue placeholder="Select a loan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>None</SelectItem>
                {loans.map((loan) => (
                  <SelectItem key={loan.id} value={loan.id}>
                    {loan.loan_number || loan.primary_loan_id} - {loan.borrower_entity_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Subject */}
          <div className="space-y-2">
            <Label>Subject *</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Enter message subject"
            />
          </div>

          {/* Body */}
          <div className="space-y-2">
            <Label>Message *</Label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Type your message here..."
              rows={8}
            />
          </div>

          {/* Attachments */}
          <div className="space-y-2">
            <Label>Attachments</Label>
            {attachments.length > 0 && (
              <div className="space-y-2 mb-2">
                {attachments.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-slate-50 rounded">
                    <span className="text-sm">{file.file_name}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveAttachment(index)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <label htmlFor="file-upload">
              <Button variant="outline" className="w-full" asChild>
                <span>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Attachments
                </span>
              </Button>
            </label>
            <input
              id="file-upload"
              type="file"
              multiple
              className="hidden"
              onChange={handleFileUpload}
              disabled={isSending}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={onClose} disabled={isSending}>
              Cancel
            </Button>
            <Button onClick={handleSend} disabled={isSending}>
              {isSending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Send Message
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}