import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle, Users, History, ChevronRight, ChevronLeft, Mail, Phone, MessageSquare, Copy } from "lucide-react";
import { base44 } from "@/api/base44Client"; // Updated import
import { Message } from "@/entities/all";

import TeamManagementModal from "./TeamManagementModal";
import VersionHistoryModal from "./VersionHistoryModal";
import LoanContactsSection from "./LoanContactsSection";
import UpdateProfilesFromLoanModal from "../shared/UpdateProfilesFromLoanModal";
import { useToast } from "@/components/ui/use-toast";

const STATUS_DESCRIPTIONS = {
  application_submitted: {
    label: "Application Submitted",
    description: "The borrower has submitted a loan application and the official loan process has begun.",
    color: "bg-blue-100 text-blue-800"
  },
  underwriting: {
    label: "Underwriting",
    description: "The lender is evaluating the borrower's financial information, credit history, experience, and other relevant factors for risk assessment.",
    color: "bg-purple-100 text-purple-800"
  },
  processing: {
    label: "Processing",
    description: "The lender sent a list of required items and reviews the delivered documents for completeness and accuracy.",
    color: "bg-amber-100 text-amber-800"
  },
  on_hold: {
    label: "On Hold",
    description: "The loan is being placed on hold until further notice.",
    color: "bg-slate-100 text-slate-800"
  },
  term_sheet_sent: {
    label: "Term Sheet Sent (Post-Appraisal)",
    description: "The post-appraisal term sheet is sent along with a completed appraisal report.",
    color: "bg-cyan-100 text-cyan-800"
  },
  conditional_approval: {
    label: "Conditional Approval",
    description: "The lender issued a conditional approval contingent upon the satisfaction of specific conditions by the borrower.",
    color: "bg-yellow-100 text-yellow-800"
  },
  final_approval: {
    label: "Final Approval",
    description: "Once all conditions are met, the lender grants final approval for the loan.",
    color: "bg-emerald-100 text-emerald-800"
  },
  clear_to_close: {
    label: "Clear to Close (CTC)",
    description: "Clear-to-Close approval has been obtained from Title, Lender Attorney, Borrower, and Seller.",
    color: "bg-green-100 text-green-800"
  },
  closing_scheduled: {
    label: "Closing Scheduled",
    description: "A closing date and time are scheduled for the borrower to sign the loan documents and finalize the transaction.",
    color: "bg-teal-100 text-teal-800"
  },
  loan_funded: {
    label: "Loan Funded",
    description: "The approved loan amount has been disbursed to the Title/Borrower.",
    color: "bg-indigo-100 text-indigo-800"
  },
  loan_sold: {
    label: "Loan Sold",
    description: "The funded loan has been sold to a loan buyer in the secondary market.",
    color: "bg-violet-100 text-violet-800"
  },
  in_house_servicing: {
    label: "In-House Servicing",
    description: "The lender continues to manage the loan account, including processing payments, managing escrow accounts (if applicable), and providing customer service support.",
    color: "bg-blue-100 text-blue-800"
  },
  draws_underway: {
    label: "Draws Underway",
    description: "Either a rehab or construction project is progressing and the draw holdback amount still remains.",
    color: "bg-orange-100 text-orange-800"
  },
  draws_fully_released: {
    label: "Draws Fully Released",
    description: "Financed budget amount is fully drawn and the loan is waiting to be repaid.",
    color: "bg-lime-100 text-lime-800"
  },
  archived: {
    label: "Archived",
    description: "The loan is fully paid off and thus closed.",
    color: "bg-gray-100 text-gray-800"
  },
  dead: {
    label: "Dead",
    description: "The loan is permanently closed with no possibility of revival.",
    color: "bg-gray-100 text-gray-800"
  }
};

export default function LoanSidebar({ loan, onUpdate, currentUser, collapsed, onToggleCollapse, onRefresh, allLoanOfficers }) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [teamMembers, setTeamMembers] = useState([]);
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [modificationHistory, setModificationHistory] = useState([]);
  const [fieldConfigMap, setFieldConfigMap] = useState({});
  const [showUpdateProfilesModal, setShowUpdateProfilesModal] = useState(false);
  const [pendingStatusChange, setPendingStatusChange] = useState(null);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [messageRecipient, setMessageRecipient] = useState(null);
  const [messageText, setMessageText] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    console.log('LoanSidebar - useEffect triggered');
    console.log('loan.borrower_ids:', loan.borrower_ids);
    console.log('loan.loan_officer_ids:', loan.loan_officer_ids);
    console.log('loan.guarantor_ids:', loan.guarantor_ids);
    console.log('loan.referrer_ids:', loan.referrer_ids);
    loadTeamMembers();
    loadModificationHistory();
    loadFieldConfigs();
  }, [loan.id, loan.borrower_ids, loan.loan_officer_ids, loan.guarantor_ids, loan.referrer_ids, loan.modification_history]); // Added modification_history to dependencies to ensure history reloads

  const loadFieldConfigs = async () => {
    try {
      const configs = await base44.entities.FieldConfiguration.filter({ context: 'loan' });
      const map = {};
      configs.forEach(config => {
        map[config.field_name] = config.field_label;
      });
      setFieldConfigMap(map);
    } catch (error) {
      console.error('Error loading field configurations:', error);
    }
  };

  const getFieldDisplayName = (fieldName) => {
    if (fieldConfigMap[fieldName]) {
      return fieldConfigMap[fieldName];
    }

    return fieldName
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ')
      .trim();
  };

  const loadModificationHistory = () => {
    const history = loan.modification_history || [];
    const recentHistory = history.slice(-3).reverse();
    setModificationHistory(recentHistory);
  };

  const loadTeamMembers = async () => {
    console.log('LoanSidebar - loadTeamMembers called');
    try {
      let allUsers = [];
      let allBorrowers = [];
      let allLoanPartners = [];
      
      try {
        allUsers = await base44.entities.User.list();
      } catch (error) {
        console.error('LoanSidebar - Error fetching users:', error);
      }
      
      try {
        allBorrowers = await base44.entities.Borrower.list();
      } catch (error) {
        console.error('LoanSidebar - Error fetching borrowers:', error);
      }
      
      try {
        allLoanPartners = await base44.entities.LoanPartner.list();
      } catch (error) {
        console.error('LoanSidebar - Error fetching loan partners:', error);
      }

      const team = [];

      // Add borrowers (look in users)
      if (loan.borrower_ids && Array.isArray(loan.borrower_ids) && loan.borrower_ids.length > 0) {
        console.log('Processing borrowers:', loan.borrower_ids);
        loan.borrower_ids.forEach(id => {
          const user = allUsers.find(u => u.id === id);
          if (user) {
            team.push({
              id: user.id,
              email: user.email,
              phone: user.phone,
              role: 'Borrower',
              messageUserId: user.id,
              displayName: user.first_name && user.last_name
                ? `${user.first_name} ${user.last_name}`
                : user.email || 'Unknown User'
            });
          }
        });
      }

      // Add loan officers (look in users)
      if (loan.loan_officer_ids && Array.isArray(loan.loan_officer_ids) && loan.loan_officer_ids.length > 0) {
        console.log('Processing loan officers:', loan.loan_officer_ids);
        loan.loan_officer_ids.forEach(id => {
          const user = allUsers.find(u => u.id === id);
          if (user) {
            team.push({
              id: user.id,
              email: user.email,
              phone: user.phone,
              role: 'Loan Officer',
              messageUserId: user.id,
              displayName: user.first_name && user.last_name
                ? `${user.first_name} ${user.last_name}`
                : user.email || 'Unknown User'
            });
          }
        });
      }

      // Add guarantors (look in borrowers)
      if (loan.guarantor_ids && Array.isArray(loan.guarantor_ids) && loan.guarantor_ids.length > 0) {
        console.log('Processing guarantors:', loan.guarantor_ids);
        loan.guarantor_ids.forEach(id => {
          const borrower = allBorrowers.find(b => b.id === id);
          if (borrower) {
            team.push({
              id: borrower.id,
              email: borrower.email,
              phone: borrower.phone,
              role: 'Guarantor',
              messageUserId: borrower.user_id || null,
              displayName: borrower.first_name && borrower.last_name
                ? `${borrower.first_name} ${borrower.last_name}`
                : borrower.email || 'Unknown Contact'
            });
          }
        });
      }

      // Add referrers (look in loan partners)
      if (loan.referrer_ids && Array.isArray(loan.referrer_ids) && loan.referrer_ids.length > 0) {
        console.log('Processing referrers:', loan.referrer_ids);
        loan.referrer_ids.forEach(id => {
          const partner = allLoanPartners.find(p => p.id === id);
          if (partner) {
            team.push({
              id: partner.id,
              email: partner.email,
              phone: partner.phone,
              role: 'Referrer',
              messageUserId: partner.user_id || null,
              displayName: partner.name || 'Unknown Partner'
            });
          }
        });
      }

      console.log('LoanSidebar - Final team members:', team);
      setTeamMembers(team);
    } catch (error) {
      console.error('LoanSidebar - Error in loadTeamMembers:', error);
      setTeamMembers([]);
    }
  };

  const handleStatusChange = async (newStatus) => {
    // Check if moving from underwriting to processing
    if (loan.status === 'underwriting' && newStatus === 'processing') {
      setPendingStatusChange(newStatus);
      setShowUpdateProfilesModal(true);
      return;
    }
    
    // Otherwise just update status
    setIsUpdating(true);
    try {
      await onUpdate({ status: newStatus });
      if (onRefresh) {
        await onRefresh();
      }
    } catch (error) {
      console.error("Error updating status:", error);
    }
    setIsUpdating(false);
  };

  const handleUpdateProfilesFromLoan = async () => {
    console.log('[LoanSidebar] handleUpdateProfilesFromLoan called');
    console.log('[LoanSidebar] Loan ID:', loan.id);
    console.log('[LoanSidebar] Pending status change:', pendingStatusChange);
    
    setIsUpdating(true);
    try {
      console.log('[LoanSidebar] Calling backend function...');
      const response = await base44.functions.invoke('updateProfileFromLoan', {
        loan_id: loan.id
      });
      console.log('[LoanSidebar] Backend response:', response);
      
      // Update loan status
      console.log('[LoanSidebar] Updating loan status...');
      await onUpdate({ status: pendingStatusChange });
      
      toast({
        title: "Profiles Updated",
        description: "Borrower/entity profiles have been updated with loan data.",
      });
      
      if (onRefresh) {
        console.log('[LoanSidebar] Refreshing...');
        await onRefresh();
      }
      console.log('[LoanSidebar] Update complete');
    } catch (error) {
      console.error("[LoanSidebar] Error updating profiles:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update profiles. Please try again.",
      });
    }
    setIsUpdating(false);
    setShowUpdateProfilesModal(false);
    setPendingStatusChange(null);
  };

  const handleSkipProfileUpdate = async () => {
    setIsUpdating(true);
    try {
      await onUpdate({ status: pendingStatusChange });
      if (onRefresh) {
        await onRefresh();
      }
    } catch (error) {
      console.error("Error updating status:", error);
    }
    setIsUpdating(false);
    setShowUpdateProfilesModal(false);
    setPendingStatusChange(null);
  };

  const canManage = currentUser && (
    currentUser.role === 'admin' ||
    ['Administrator', 'Loan Officer'].includes(currentUser.app_role)
  );

  const currentStatus = STATUS_DESCRIPTIONS[loan.status] || {
    label: "Unknown Status",
    description: "This loan has an unrecognized status.",
    color: "bg-gray-100 text-gray-800"
  };

  const restrictedMessengerRoles = ['Borrower', 'Referrer', 'Broker', 'Guarantor', 'Title Company'];
  const isRestrictedMessenger = currentUser && restrictedMessengerRoles.includes(currentUser.app_role);

  const canMessageMember = (member) => {
    if (!currentUser || !member?.messageUserId) return false;
    if (member.messageUserId === currentUser.id) return false;
    if (!isRestrictedMessenger) return true;
    return member.role === 'Loan Officer';
  };

  const getMessageDisabledReason = (member) => {
    if (!currentUser) return "Sign in to message";
    if (!member?.messageUserId) return "No linked user account";
    if (member.messageUserId === currentUser.id) return "You can't message yourself";
    if (isRestrictedMessenger && member.role !== 'Loan Officer') {
      return "Borrowers and partners can only message loan officers";
    }
    return "Send in-app message";
  };

  const handleCopy = async (value, label) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      toast({
        title: "Copied",
        description: `${label} copied to clipboard.`
      });
    } catch (error) {
      console.error('Error copying value:', error);
      toast({
        variant: "destructive",
        title: "Copy failed",
        description: "Unable to copy to clipboard. Please try again."
      });
    }
  };

  const handleOpenMessage = (member) => {
    setMessageRecipient(member);
    setMessageText('');
    setShowMessageModal(true);
  };

  const handleSendMessage = async () => {
    if (!currentUser) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "You must be signed in to send messages."
      });
      return;
    }
    if (!messageRecipient?.messageUserId || !messageText.trim() || isSendingMessage) return;
    setIsSendingMessage(true);

    try {
      const conversationId = [currentUser.id, messageRecipient.messageUserId].sort().join('_');
      const senderNameParts = [currentUser.first_name, currentUser.last_name].filter(Boolean);
      const senderName = senderNameParts.length > 0
        ? senderNameParts.join(' ')
        : currentUser.full_name || currentUser.email;

      await Message.create({
        conversation_id: conversationId,
        conversation_type: 'direct',
        sender_id: currentUser.id,
        sender_name: senderName,
        participant_ids: [currentUser.id, messageRecipient.messageUserId],
        content: messageText.trim(),
        loan_id: loan.id,
        loan_number: loan.loan_number || loan.primary_loan_id,
        read_by: [currentUser.id],
        mentions: [],
        attachments: []
      });

      toast({
        title: "Message sent",
        description: `Message sent to ${messageRecipient.displayName}.`
      });
      setShowMessageModal(false);
      setMessageRecipient(null);
      setMessageText('');
    } catch (error) {
      console.error("Error sending message:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error?.message || "Failed to send message. Please try again."
      });
    }

    setIsSendingMessage(false);
  };

  if (collapsed) {
    return (
      <div className="w-16 bg-white border-l border-slate-200 h-full flex items-start justify-center pt-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleCollapse}
          className="hover:bg-slate-100"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="w-80 bg-white border-l border-slate-200 overflow-y-auto h-full" style={{scrollbarWidth: 'none', msOverflowStyle: 'none'}}>
      <style>{`
        div::-webkit-scrollbar {
          display: none;
        }
      `}</style>

      <div className="sticky top-0 bg-white z-10 border-b border-slate-200 p-4 flex items-center justify-between">
        <h3 className="font-semibold text-slate-900">Loan Details</h3>
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleCollapse}
          className="hover:bg-slate-100"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      <div className="p-6 space-y-6">
        {/* Loan Status */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-slate-600" />
              Loan Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {canManage ? (
              <Select
                value={loan.status}
                onValueChange={handleStatusChange}
                disabled={isUpdating}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_DESCRIPTIONS).map(([value, { label }]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Badge className={`${currentStatus.color} border-0 text-sm px-3 py-1`}>
                {currentStatus.label}
              </Badge>
            )}
          </CardContent>
        </Card>

        {/* Team */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="w-5 h-5 text-slate-600" />
                Team
              </CardTitle>
              {canManage && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowReassignModal(true)}
                >
                  Manage
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {teamMembers.length > 0 ? (
                teamMembers.map((member, index) => (
                  <div key={`${member.id}-${member.role}-${index}`} className="text-sm border-b pb-3 last:border-b-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="font-semibold text-slate-900">{member.displayName}</p>
                        <Badge className="text-xs mt-1" variant="outline">{member.role}</Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleOpenMessage(member)}
                        disabled={!canMessageMember(member)}
                        title={getMessageDisabledReason(member)}
                        aria-label={`Message ${member.displayName}`}
                      >
                        <MessageSquare className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="mt-2 space-y-1">
                      {member.phone && member.role !== 'Loan Officer' && (
                        <div className="flex items-center gap-1 text-slate-600">
                          <Phone className="w-3 h-3" />
                          <span className="text-xs">{member.phone}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 p-0"
                            onClick={() => handleCopy(member.phone, "Phone number")}
                            aria-label={`Copy ${member.displayName} phone`}
                            title="Copy phone number"
                          >
                            <Copy className="w-3 h-3" />
                          </Button>
                        </div>
                      )}
                      {member.email && (
                        <div className="flex items-center gap-1 text-slate-600">
                          <Mail className="w-3 h-3" />
                          <span className="text-xs">{member.email}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 p-0"
                            onClick={() => handleCopy(member.email, "Email")}
                            aria-label={`Copy ${member.displayName} email`}
                            title="Copy email"
                          >
                            <Copy className="w-3 h-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">No team members found</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Loan Contacts */}
        <LoanContactsSection loan={loan} onUpdate={onUpdate} />

        {/* Version History */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <History className="w-5 h-5 text-slate-600" />
              Recent Changes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {modificationHistory.length > 0 ? (
                modificationHistory.map((mod, index) => {
                  // Create summary of what changed with display names
                  const hasFieldChanges = mod.field_changes && mod.field_changes.length > 0;
                  const changeSummary = hasFieldChanges
                    ? mod.field_changes.map(ch => getFieldDisplayName(ch.field_name)).join(', ')
                    : mod.fields_changed?.map(f => getFieldDisplayName(f)).join(', ') || 'loan data';

                  const changeCount = hasFieldChanges
                    ? mod.field_changes.length
                    : mod.fields_changed?.length || 0;

                  return (
                    <div key={index} className="text-sm border-l-2 border-blue-500 pl-3 py-2">
                      <p className="font-semibold text-slate-900">{mod.modified_by_name || 'System'}</p>
                      <p className="text-xs text-slate-600 mt-1">
                        Updated {changeCount} field{changeCount !== 1 ? 's' : ''}: {changeSummary}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        {new Date(mod.timestamp).toLocaleString()}
                      </p>
                    </div>
                  );
                })
              ) : (
                <div className="text-sm text-slate-600 bg-slate-50 p-3 rounded-lg">
                  <p className="font-semibold text-slate-900">Last Modified</p>
                  <p className="text-xs">{new Date(loan.updated_date).toLocaleString()}</p>
                </div>
              )}

              <Button
                variant="ghost"
                className="w-full justify-between text-sm"
                onClick={() => setShowHistoryModal(true)}
              >
                View Full History
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <TeamManagementModal
        isOpen={showReassignModal}
        onClose={() => setShowReassignModal(false)}
        loan={loan}
        onUpdate={onUpdate}
        onRefresh={() => {
          onRefresh();
          loadTeamMembers(); // Reload team members after reassign
        }}
      />

      <VersionHistoryModal
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        loan={loan}
      />

      <UpdateProfilesFromLoanModal
        isOpen={showUpdateProfilesModal}
        onClose={() => {
          setShowUpdateProfilesModal(false);
          setPendingStatusChange(null);
        }}
        onUpdateProfiles={handleUpdateProfilesFromLoan}
        onSkipUpdate={handleSkipProfileUpdate}
      />

      <Dialog
        open={showMessageModal}
        onOpenChange={(open) => {
          setShowMessageModal(open);
          if (!open) {
            setMessageRecipient(null);
            setMessageText('');
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {messageRecipient ? `Message ${messageRecipient.displayName}` : "Message"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Textarea
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Type your message..."
              rows={4}
            />
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => setShowMessageModal(false)}
                disabled={isSendingMessage}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSendMessage}
                disabled={!messageText.trim() || isSendingMessage}
              >
                {isSendingMessage ? "Sending..." : "Send Message"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
