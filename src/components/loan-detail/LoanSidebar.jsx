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
import ClosingScheduleSection from "./ClosingScheduleSection";
import UpdateProfilesFromLoanModal from "../shared/UpdateProfilesFromLoanModal";
import AddBrokerModal from "../application-steps/AddBrokerModal";
import AddLiaisonModal from "../application-steps/AddLiaisonModal";
import { useToast } from "@/components/ui/use-toast";
import { hasBrokerOnLoan, wasInvitedByBroker } from "@/components/utils/brokerVisibility";
import { normalizeAppRole } from "@/components/utils/appRoles";

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
  preclosed_review: {
    label: "Preclosed Review",
    description: "The loan file is being reviewed before the post-appraisal term sheet is sent.",
    color: "bg-sky-100 text-sky-800"
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
  const [hideLoanOfficerDetails, setHideLoanOfficerDetails] = useState(false);
  const [loanOfficerNameSet, setLoanOfficerNameSet] = useState(new Set());
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
  const [showAddBrokerModal, setShowAddBrokerModal] = useState(false);
  const [showAddLiaisonModal, setShowAddLiaisonModal] = useState(false);
  const { toast } = useToast();
  const normalizedRole = normalizeAppRole(currentUser?.app_role);
  const canManage = currentUser && (
    currentUser.role === 'admin' ||
    ['Administrator', 'Loan Officer'].includes(normalizedRole)
  );

  useEffect(() => {
    console.log('LoanSidebar - useEffect triggered');
    console.log('loan.borrower_ids:', loan.borrower_ids);
    console.log('loan.loan_officer_ids:', loan.loan_officer_ids);
    console.log('loan.referrer_ids:', loan.referrer_ids);
    console.log('loan.liaison_ids:', loan.liaison_ids);
    loadTeamMembers();
    loadModificationHistory();
    loadFieldConfigs();
  }, [
    loan.id,
    loan.borrower_ids,
    loan.borrower_entity_id,
    loan.borrower_entity_name,
    loan.loan_officer_ids,
    loan.liaison_ids,
    loan.referrer_ids,
    loan.modification_history
  ]); // Added modification_history to dependencies to ensure history reloads

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
      let loanOfficerOverrides = [];
      let loanOfficerOverridesById = {};
      let fallbackLoanOfficerUsers = [];
      
      try {
        allUsers = await base44.entities.User.list();
      } catch (error) {
        console.error('LoanSidebar - Error fetching users:', error);
      }

      if (!canManage) {
        try {
          const usersResponse = await base44.functions.invoke('getAllUsers');
          const visibleUsers = usersResponse?.data?.users || usersResponse?.users || [];
          if (Array.isArray(visibleUsers) && visibleUsers.length > 0) {
            allUsers = visibleUsers;
          }
        } catch (error) {
          console.error('LoanSidebar - Error fetching users via getAllUsers:', error);
        }
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

      const normalizedCurrentRole = normalizeAppRole(currentUser?.app_role);
      const isBorrowerRole = ['Borrower', 'Liaison'].includes(normalizedCurrentRole);
      const currentBorrowerRecord = isBorrowerRole
        ? allBorrowers.find(b => b.user_id === currentUser?.id || b.id === currentUser?.id || (currentUser?.email && b.email === currentUser.email))
        : null;
      const invitedByBroker = isBorrowerRole && wasInvitedByBroker(currentBorrowerRecord);
      const brokerOnThisLoan = hasBrokerOnLoan(loan, allLoanPartners);
      const shouldHideLoanOfficerDetails = isBorrowerRole && (invitedByBroker || brokerOnThisLoan);
      setHideLoanOfficerDetails(shouldHideLoanOfficerDetails);

      if (!canManage && loan?.id) {
        try {
          const response = await base44.functions.invoke('getLoanOfficerTeam', {
            loan_id: loan.id
          });
          loanOfficerOverrides = response?.data?.loan_officers || response?.loan_officers || [];
          loanOfficerOverridesById = loanOfficerOverrides.reduce((acc, officer) => {
            if (officer?.id) {
              acc[String(officer.id)] = officer;
            }
            return acc;
          }, {});
        } catch (error) {
          console.error('LoanSidebar - Error fetching loan officers for loan:', error);
        }
      }

      if (!canManage && (!loanOfficerOverrides || loanOfficerOverrides.length === 0)) {
        try {
          const response = await base44.functions.invoke('getLoanOfficers');
          fallbackLoanOfficerUsers = response?.data?.users || response?.users || [];
        } catch (error) {
          console.error('LoanSidebar - Error fetching fallback loan officers:', error);
        }
      }

      const team = [];
      const normalizeEntityId = (value) => {
        if (!value) return null;
        if (typeof value === 'string' || typeof value === 'number') return String(value);
        if (typeof value === 'object') {
          if (value.id) return String(value.id);
          if (value.user_id) return String(value.user_id);
          if (value.loan_officer_id) return String(value.loan_officer_id);
        }
        return null;
      };

      const addBorrowerMember = (borrower) => {
        if (!borrower) return;
        const alreadyAdded = team.some(member => member.id === borrower.id && member.role === 'Borrower');
        if (alreadyAdded) return;
        team.push({
          id: borrower.id,
          email: borrower.email,
          phone: borrower.phone,
          role: 'Borrower',
          messageUserId: borrower.user_id || null,
          displayName: borrower.first_name && borrower.last_name
            ? `${borrower.first_name} ${borrower.last_name}`
            : borrower.email || 'Unknown Contact'
        });
      };

      const addLiaisonMember = (liaison) => {
        if (!liaison) return;
        const liaisonId = liaison.id;
        const alreadyAdded = team.some(member => member.id === liaisonId && member.role === 'Liaison');
        if (alreadyAdded) return;
        const displayName = liaison.first_name && liaison.last_name
          ? `${liaison.first_name} ${liaison.last_name}`
          : liaison.name || liaison.email || 'Unknown Contact';
        const messageUserId = liaison.user_id || liaison.id || null;
        team.push({
          id: liaisonId,
          email: liaison.email,
          phone: liaison.phone,
          role: 'Liaison',
          messageUserId,
          displayName
        });
      };

      const addLoanOfficerMember = (user) => {
        if (!user) return;
        const alreadyAdded = team.some(member => member.id === user.id && member.role === 'Loan Officer');
        if (alreadyAdded) return;
        team.push({
          id: user.id,
          email: shouldHideLoanOfficerDetails ? null : user.email,
          phone: shouldHideLoanOfficerDetails ? null : user.phone,
          role: 'Loan Officer',
          messageUserId: user.id,
          displayName: shouldHideLoanOfficerDetails
            ? 'Loan Officer'
            : (user.first_name && user.last_name
              ? `${user.first_name} ${user.last_name}`
              : user.email || 'Unknown User')
        });
      };

      const resolveLoanOfficer = async (id) => {
        const normalizedId = String(id);
        if (loanOfficerOverridesById[normalizedId]) {
          return loanOfficerOverridesById[normalizedId];
        }
        const user =
          allUsers.find(u => String(u.id) === normalizedId) ||
          (allLoanOfficers || []).find(u => String(u.id) === normalizedId) ||
          (fallbackLoanOfficerUsers || []).find(u => String(u.id) === normalizedId);
        if (user) return user;
        try {
          return await base44.entities.User.get(id);
        } catch (error) {
          console.error('LoanSidebar - Error fetching loan officer by id:', error);
        }

        // Some loans may store LoanOfficerQueue record ids instead of User ids.
        try {
          const queueRecord = await base44.entities.LoanOfficerQueue.get(normalizedId);
          const queueUserId = queueRecord?.loan_officer_id ? String(queueRecord.loan_officer_id) : null;
          if (!queueUserId) return null;
          return (
            allUsers.find(u => String(u.id) === queueUserId) ||
            (allLoanOfficers || []).find(u => String(u.id) === queueUserId) ||
            (fallbackLoanOfficerUsers || []).find(u => String(u.id) === queueUserId) ||
            await base44.entities.User.get(queueUserId)
          );
        } catch (queueError) {
          console.error('LoanSidebar - Error resolving loan officer via queue id:', queueError);
          return null;
        }
      };

      const liaisonUserIds = new Set(
        allUsers
          .filter(u => normalizeAppRole(u.app_role) === 'Liaison')
          .map(u => u.id)
      );
      const liaisonBorrowerIds = new Set(
        allBorrowers
          .filter(b => b.user_id && liaisonUserIds.has(b.user_id))
          .flatMap(b => [b.id, b.user_id].filter(Boolean))
      );

      // Add borrowers (prefer loan.borrower_ids; liaisons stored here are rendered separately)
      if (loan.borrower_ids && Array.isArray(loan.borrower_ids) && loan.borrower_ids.length > 0) {
        console.log('Processing borrowers:', loan.borrower_ids);
        loan.borrower_ids.forEach(id => {
          if (liaisonBorrowerIds.has(id) || liaisonUserIds.has(id)) {
            const liaisonUser = allUsers.find(u => u.id === id);
            const liaisonBorrower = allBorrowers.find(b => b.id === id || b.user_id === id);
            addLiaisonMember(liaisonUser || liaisonBorrower);
            return;
          }
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
            return;
          }

          const borrower = allBorrowers.find(b => b.id === id || b.user_id === id);
          addBorrowerMember(borrower);
        });
      }

      // Fallback: resolve borrowers from individual_information emails (primary + co-borrowers)
      if ((!loan.borrower_ids || loan.borrower_ids.length === 0) && Array.isArray(loan.individual_information)) {
        const normalizedEmails = loan.individual_information
          .map(individual => individual?.individual_email)
          .filter(Boolean)
          .map(email => email.toLowerCase());
        const matchedBorrowers = allBorrowers.filter(borrower =>
          borrower.email && normalizedEmails.includes(borrower.email.toLowerCase())
        );
        matchedBorrowers.forEach(addBorrowerMember);
      }

      const nextLoanOfficerNameSet = new Set();
      const hasResolvedLoanOfficerOverrides = Array.isArray(loanOfficerOverrides) && loanOfficerOverrides.length > 0;

      if (hasResolvedLoanOfficerOverrides) {
        loanOfficerOverrides.forEach((user) => {
          if (user) {
            const fullName = user.first_name && user.last_name
              ? `${user.first_name} ${user.last_name}`.trim()
              : user.full_name;
            [fullName, user.full_name, user.email].filter(Boolean).forEach((name) => {
              nextLoanOfficerNameSet.add(String(name).trim().toLowerCase());
            });
          }
          addLoanOfficerMember(user);
        });
      }

      // Add loan officers (look in users)
      const normalizedLoanOfficerIds = Array.isArray(loan.loan_officer_ids)
        ? loan.loan_officer_ids.map(normalizeEntityId).filter(Boolean)
        : [];
      if (normalizedLoanOfficerIds.length > 0) {
        console.log('Processing loan officers:', normalizedLoanOfficerIds);
        const loanOfficerUsers = await Promise.all(
          normalizedLoanOfficerIds.map(id => resolveLoanOfficer(id))
        );
        loanOfficerUsers.forEach((user, index) => {
          if (user) {
            const fullName = user.first_name && user.last_name
              ? `${user.first_name} ${user.last_name}`.trim()
              : user.full_name;
            [fullName, user.full_name, user.email].filter(Boolean).forEach((name) => {
              nextLoanOfficerNameSet.add(String(name).trim().toLowerCase());
            });
            addLoanOfficerMember(user);
            return;
          }
          const fallbackId = normalizedLoanOfficerIds[index];
          if (hasResolvedLoanOfficerOverrides) return;
          const alreadyAdded = team.some(member => member.id === fallbackId && member.role === 'Loan Officer');
          if (alreadyAdded) return;
          team.push({
            id: fallbackId,
            email: null,
            phone: null,
            role: 'Loan Officer',
            messageUserId: fallbackId,
            displayName: shouldHideLoanOfficerDetails ? 'Loan Officer' : `Loan Officer ${index + 1}`
          });
        });
      }

      if (!team.some(member => member.role === 'Loan Officer') && loanOfficerOverrides.length > 0) {
        loanOfficerOverrides.forEach((user) => {
          if (user) {
            const fullName = user.first_name && user.last_name
              ? `${user.first_name} ${user.last_name}`.trim()
              : user.full_name;
            [fullName, user.full_name, user.email].filter(Boolean).forEach((name) => {
              nextLoanOfficerNameSet.add(String(name).trim().toLowerCase());
            });
          }
          addLoanOfficerMember(user);
        });
      }

      // Add liaisons (look in borrowers)
      if (loan.liaison_ids && Array.isArray(loan.liaison_ids) && loan.liaison_ids.length > 0) {
        console.log('Processing liaisons:', loan.liaison_ids);
        loan.liaison_ids.forEach(id => {
          const user = allUsers.find(u => u.id === id);
          if (user) {
            addLiaisonMember(user);
            return;
          }
          const borrower = allBorrowers.find(b => b.id === id || b.user_id === id);
          addLiaisonMember(borrower);
        });
      }

      // Add loan partners (look in loan partners)
      if (loan.referrer_ids && Array.isArray(loan.referrer_ids) && loan.referrer_ids.length > 0) {
        console.log('Processing referrers:', loan.referrer_ids);
        loan.referrer_ids.forEach(id => {
          const partner = allLoanPartners.find(p => p.id === id);
          if (partner) {
            team.push({
              id: partner.id,
              email: partner.email,
              phone: partner.phone,
              role: normalizeAppRole(partner.app_role || partner.type) || 'Loan Partner',
              messageUserId: partner.user_id || null,
              displayName: partner.name || 'Unknown Partner'
            });
          }
        });
      }

      console.log('LoanSidebar - Final team members:', team);
      setTeamMembers(team);
      setLoanOfficerNameSet(nextLoanOfficerNameSet);
    } catch (error) {
      console.error('LoanSidebar - Error in loadTeamMembers:', error);
      setTeamMembers([]);
      setLoanOfficerNameSet(new Set());
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

  const currentStatus = STATUS_DESCRIPTIONS[loan.status] || {
    label: "Unknown Status",
    description: "This loan has an unrecognized status.",
    color: "bg-gray-100 text-gray-800"
  };

  const restrictedMessengerRoles = ['Borrower', 'Liaison', 'Referral Partner', 'Broker', 'Title Company', 'Insurance Company', 'Servicer'];
  const isBorrowerRole = normalizedRole === 'Borrower';
  const isLiaisonRole = normalizedRole === 'Liaison';
  const isBrokerRole = normalizedRole === 'Broker';
  const isRestrictedMessenger = currentUser && restrictedMessengerRoles.includes(normalizedRole);
  const isBorrowerMessenger = isBorrowerRole || isLiaisonRole;
  const hasBrokerOnTeam = teamMembers.some((member) => member.role === 'Broker');
  const hasLiaisonOnTeam = teamMembers.some((member) => member.role === 'Liaison');
  const canShowSelfServeTeamButtons = !canManage && (isBorrowerRole || isLiaisonRole || isBrokerRole);
  const showAddBrokerButton = canShowSelfServeTeamButtons && !hasBrokerOnTeam && (isBorrowerRole || isLiaisonRole);
  const showAddLiaisonButton = canShowSelfServeTeamButtons && !hasLiaisonOnTeam && (isBorrowerRole || isBrokerRole);
  const hasTeamActionButtons = showAddBrokerButton || showAddLiaisonButton;
  const teamModalPermissions = {
    isPlatformAdmin: currentUser?.role === 'admin',
    isAdministrator: normalizedRole === 'Administrator',
    isLoanOfficer: normalizedRole === 'Loan Officer',
    isBroker: isBrokerRole,
    borrowerAccessIds: Array.isArray(loan?.borrower_ids) ? loan.borrower_ids.filter(Boolean) : [],
    loanPartnerAccessIds: [currentUser?.id].filter(Boolean)
  };

  const canMessageMember = (member) => {
    const borrowerAllowedRoles = new Set([
      'Loan Officer',
      'Broker',
      'Referral Partner',
      'Title Company',
      'Insurance Company',
      'Servicer',
      'Liaison',
      'Loan Partner'
    ]);
    if (!currentUser || !member?.messageUserId) return false;
    if (member.messageUserId === currentUser.id) return false;
    if (!isRestrictedMessenger) return true;
    if (isBorrowerMessenger) {
      return borrowerAllowedRoles.has(member.role);
    }
    return member.role === 'Loan Officer';
  };

  const getMessageDisabledReason = (member) => {
    const borrowerAllowedRoles = new Set([
      'Loan Officer',
      'Broker',
      'Referral Partner',
      'Title Company',
      'Insurance Company',
      'Servicer',
      'Liaison',
      'Loan Partner'
    ]);
    if (!currentUser) return "Sign in to message";
    if (!member?.messageUserId) return "No linked user account";
    if (member.messageUserId === currentUser.id) return "You can't message yourself";
    if (isRestrictedMessenger) {
      if (isBorrowerMessenger) {
        if (!borrowerAllowedRoles.has(member.role)) {
          return "Borrowers can only message loan officers or partners";
        }
      } else if (member.role !== 'Loan Officer') {
        return "Borrowers and partners can only message loan officers";
      }
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
        participant_names: [senderName, messageRecipient.displayName],
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

  const getOverriddenFields = (fields) => {
    return Array.from(new Set([...(loan?.overridden_fields || []), ...fields]));
  };

  const handleAddLiaison = async (liaisonId) => {
    if (!liaisonId) return;
    const normalizedId = String(liaisonId);
    const nextLiaisonIds = Array.from(
      new Set([...(Array.isArray(loan?.liaison_ids) ? loan.liaison_ids : []), normalizedId].filter(Boolean))
    );

    await onUpdate({
      liaison_id: normalizedId,
      liaison_ids: nextLiaisonIds,
      overridden_fields: getOverriddenFields(['liaison_id', 'liaison_ids'])
    });

    if (onRefresh) {
      await onRefresh();
    }
  };

  const handleAddBroker = async (brokerId) => {
    if (!brokerId) return;
    const normalizedId = String(brokerId);
    const nextBrokerIds = Array.from(
      new Set([...(Array.isArray(loan?.broker_ids) ? loan.broker_ids : []), normalizedId].filter(Boolean))
    );
    const nextReferrerIds = Array.from(
      new Set([...(Array.isArray(loan?.referrer_ids) ? loan.referrer_ids : []), normalizedId].filter(Boolean))
    );

    await onUpdate({
      broker_id: normalizedId,
      broker_ids: nextBrokerIds,
      referrer_ids: nextReferrerIds,
      overridden_fields: getOverriddenFields(['broker_id', 'broker_ids', 'referrer_ids'])
    });

    if (onRefresh) {
      await onRefresh();
    }
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
                teamMembers
                  .filter(member => !(hideLoanOfficerDetails && member.role === 'Loan Officer'))
                  .map((member, index) => (
                  <div key={`${member.id}-${member.role}-${index}`} className="text-sm border-b pb-3 last:border-b-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="font-semibold text-slate-900">{member.displayName}</p>
                        <Badge className="text-xs mt-1" variant="outline">{member.role}</Badge>
                      </div>
                      {!(hideLoanOfficerDetails && member.role === 'Loan Officer') && (
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
                      )}
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
            {hasTeamActionButtons && (
              <div className="mt-3 flex flex-wrap gap-2">
                {showAddBrokerButton && (
                  <Button
                    size="sm"
                    className="h-7 px-2 text-xs bg-slate-800 hover:bg-slate-900 text-white"
                    onClick={() => setShowAddBrokerModal(true)}
                  >
                    + Add Broker
                  </Button>
                )}
                {showAddLiaisonButton && (
                  <Button
                    size="sm"
                    className="h-7 px-2 text-xs bg-slate-800 hover:bg-slate-900 text-white"
                    onClick={() => setShowAddLiaisonModal(true)}
                  >
                    + Add Liaison
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <ClosingScheduleSection
          loan={loan}
          onUpdate={onUpdate}
          currentUser={currentUser}
        />

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
                      <p className="font-semibold text-slate-900">
                        {hideLoanOfficerDetails && loanOfficerNameSet.has((mod.modified_by_name || '').trim().toLowerCase())
                          ? 'Loan Officer'
                          : (mod.modified_by_name || 'System')}
                      </p>
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
        onRefresh={onRefresh}
      />

      <VersionHistoryModal
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        loan={loan}
        hideLoanOfficerNames={hideLoanOfficerDetails}
        loanOfficerNameSet={loanOfficerNameSet}
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

      <AddBrokerModal
        isOpen={showAddBrokerModal}
        onClose={() => setShowAddBrokerModal(false)}
        applicationData={loan}
        onAddBroker={handleAddBroker}
        permissions={teamModalPermissions}
        currentUser={currentUser}
      />

      <AddLiaisonModal
        isOpen={showAddLiaisonModal}
        onClose={() => setShowAddLiaisonModal(false)}
        applicationData={loan}
        onAddLiaison={handleAddLiaison}
        permissions={teamModalPermissions}
      />
    </div>
  );
}
