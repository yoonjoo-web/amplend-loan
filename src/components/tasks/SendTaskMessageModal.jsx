import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { User, Message } from "@/entities/all";
import { useToast } from "@/components/ui/use-toast";
import { Users, Hash } from "lucide-react";
import MultiSelect from "../ui/MultiSelect";

import { createPageUrl } from "@/utils";
import { usePermissions } from "@/components/hooks/usePermissions";

export default function SendTaskMessageModal({ isOpen, onClose, task, loan, currentUser }) {
  const { toast } = useToast();
  const { permissions } = usePermissions();
  
  const [messageType, setMessageType] = useState('direct'); // 'direct' or 'loan_channel'
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [teamMembers, setTeamMembers] = useState([]);
  const [existingLoanChannels, setExistingLoanChannels] = useState([]);
  
  // Determine if current user is a borrower or loan partner
  const isBorrowerOrPartner = permissions?.isBorrower || permissions?.isLoanPartner;

  useEffect(() => {
    if (isOpen && loan) {
      loadTeamMembers();
      loadExistingLoanChannels();
      setMessageText(`I need to discuss the task: "${task.item_name}"\n\nLoan: ${loan.loan_number || loan.primary_loan_id}`);
    }
  }, [isOpen, loan, task]);

  const loadExistingLoanChannels = async () => {
    try {
      // Check if there's an existing loan channel that includes the current user
      const messages = await Message.filter({ 
        conversation_type: 'loan_channel',
        loan_id: loan.id
      });
      
      // Check if current user is a participant in any of these channels
      const userChannels = messages.filter(m => 
        m.participant_ids && m.participant_ids.includes(currentUser.id)
      );
      
      setExistingLoanChannels(userChannels);
    } catch (error) {
      console.error('Error loading loan channels:', error);
      setExistingLoanChannels([]);
    }
  };

  const loadTeamMembers = async () => {
    try {
      console.log('[SendTaskMessageModal] Loading team members...');
      console.log('[SendTaskMessageModal] isBorrowerOrPartner:', isBorrowerOrPartner);
      console.log('[SendTaskMessageModal] loan:', loan);
      console.log('[SendTaskMessageModal] loan.loan_officer_ids:', loan?.loan_officer_ids);
      
      // Load all users first
      let allUsers = [];
      try {
        allUsers = await User.list();
        console.log('[SendTaskMessageModal] All users loaded:', allUsers.length);
        console.log('[SendTaskMessageModal] Users with Loan Officer role:', allUsers.filter(u => u.app_role === 'Loan Officer').map(u => ({ id: u.id, name: `${u.first_name} ${u.last_name}`, role: u.app_role })));
      } catch (error) {
        console.log('[SendTaskMessageModal] Cannot load all users via User.list():', error);
      }

      // Get all team member IDs based on user role
      let team = [];
      
      if (isBorrowerOrPartner) {
        // Borrowers and loan partners can only message loan officers
        // Get all users with Loan Officer role
        const loanOfficers = allUsers.filter(u => u.app_role === 'Loan Officer' && u.id !== currentUser.id);
        console.log('[SendTaskMessageModal] Loan officers found:', loanOfficers.length);
        team = loanOfficers.map(u => ({
          ...u,
          first_name: u.first_name || '',
          last_name: u.last_name || ''
        }));
      } else {
        // Staff can message anyone on the loan
        const memberIds = new Set();
        (loan.loan_officer_ids || []).forEach(id => memberIds.add(id));
        (loan.borrower_ids || []).forEach(id => memberIds.add(id));
        (loan.guarantor_ids || []).forEach(id => memberIds.add(id));
        (loan.referrer_ids || []).forEach(id => memberIds.add(id));
        
        // Remove current user
        memberIds.delete(currentUser.id);
        
        memberIds.forEach(id => {
          const user = allUsers.find(u => u.id === id);
          if (user) {
            team.push({
              ...user,
              first_name: user.first_name || '',
              last_name: user.last_name || ''
            });
          }
        });
      }

      console.log('[SendTaskMessageModal] Final team members:', team.map(u => ({ id: u.id, name: `${u.first_name} ${u.last_name}` })));
      setTeamMembers(team);
    } catch (error) {
      console.error('[SendTaskMessageModal] Error loading team members:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load team members.",
      });
    }
  };

  const handleSend = async () => {
    if (!messageText.trim()) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please enter a message.",
      });
      return;
    }

    if (messageType === 'direct' && selectedUsers.length === 0) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please select at least one recipient.",
      });
      return;
    }

    setIsSending(true);

    try {
      // Create a clickable link that opens the loan detail page and focuses on the specific task.
      // Assumes the application's base URL and a 'createPageUrl' utility to get the path for 'LoanDetail'.
      const taskViewUrl = `${window.location.origin}${createPageUrl('LoanDetail')}?id=${loan.id}&openTask=${task.id}`;
      const messageContent = `${messageText}\n\n[View Task Details](${taskViewUrl})`;

      if (messageType === 'loan_channel') {
        // Send to loan channel
        const conversationId = `loan_${loan.id}`;
        const allParticipants = [
          currentUser.id,
          ...(loan.loan_officer_ids || []),
          ...(loan.borrower_ids || []),
          ...(loan.guarantor_ids || []),
          ...(loan.referrer_ids || [])
        ];

        await Message.create({
          conversation_id: conversationId,
          conversation_type: 'loan_channel',
          sender_id: currentUser.id,
          sender_name: `${currentUser.first_name} ${currentUser.last_name}`,
          participant_ids: [...new Set(allParticipants)],
          content: messageContent,
          loan_id: loan.id,
          loan_number: loan.loan_number || loan.primary_loan_id,
          read_by: [currentUser.id],
          task_reference: {
            task_id: task.id,
            task_name: task.item_name,
            loan_id: loan.id,
            loan_number: loan.loan_number || loan.primary_loan_id
          }
        });
      } else {
        // Send direct messages
        for (const userId of selectedUsers) {
          const conversationId = [currentUser.id, userId].sort().join('_');
          
          await Message.create({
            conversation_id: conversationId,
            conversation_type: 'direct',
            sender_id: currentUser.id,
            sender_name: `${currentUser.first_name} ${currentUser.last_name}`,
            participant_ids: [currentUser.id, userId],
            content: messageContent,
            loan_id: loan.id,
            loan_number: loan.loan_number || loan.primary_loan_id,
            read_by: [currentUser.id],
            task_reference: {
              task_id: task.id,
              task_name: task.item_name,
              loan_id: loan.id,
              loan_number: loan.loan_number || loan.primary_loan_id
            }
          });
        }
      }

      toast({
        title: "Message Sent",
        description: `Your message about "${task.item_name}" has been sent.`,
      });

      onClose();
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to send message. Please try again.",
      });
    }

    setIsSending(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Send Message About Task</DialogTitle>
          <DialogDescription>
            Send a message to team members about: <strong>{task?.item_name}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Message Type */}
          <div className="space-y-2">
            <Label>Send To</Label>
            <RadioGroup value={messageType} onValueChange={setMessageType}>
              <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-slate-50 cursor-pointer">
                <RadioGroupItem value="direct" id="direct" />
                <label htmlFor="direct" className="flex items-center gap-2 cursor-pointer flex-1">
                  <Users className="w-4 h-4" />
                  <div>
                    <div className="font-medium">Direct Message</div>
                    <div className="text-sm text-slate-500">
                      {isBorrowerOrPartner ? 'Send to loan officers' : 'Send to specific team members'}
                    </div>
                  </div>
                </label>
              </div>
              
              {/* Only show Loan Channel option if user is staff OR if borrower/partner is already in a channel */}
              {(!isBorrowerOrPartner || existingLoanChannels.length > 0) && (
                <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-slate-50 cursor-pointer">
                  <RadioGroupItem value="loan_channel" id="loan_channel" />
                  <label htmlFor="loan_channel" className="flex items-center gap-2 cursor-pointer flex-1">
                    <Hash className="w-4 h-4" />
                    <div>
                      <div className="font-medium">Loan Channel</div>
                      <div className="text-sm text-slate-500">
                        Send to entire loan team ({loan?.loan_number || loan?.primary_loan_id})
                      </div>
                    </div>
                  </label>
                </div>
              )}
            </RadioGroup>
          </div>

          {/* Recipient Selection (for direct messages) */}
          {messageType === 'direct' && (
            <div className="space-y-2">
              <Label>Recipients</Label>
              <MultiSelect
                options={teamMembers.map(u => ({
                  label: `${u.first_name} ${u.last_name}`,
                  value: u.id
                }))}
                value={selectedUsers}
                onChange={setSelectedUsers}
                placeholder="Select team members..."
              />
            </div>
          )}

          {/* Message Content */}
          <div className="space-y-2">
            <Label>Message</Label>
            <Textarea
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              rows={6}
              placeholder="Enter your message..."
            />
            <p className="text-xs text-slate-500">
              A link to view task details will be automatically included in the message.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={isSending}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={isSending}>
            {isSending ? 'Sending...' : 'Send Message'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}