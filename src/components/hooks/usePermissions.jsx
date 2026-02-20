import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { normalizeAppRole } from '@/components/utils/appRoles';
import { getBorrowerAccessIds } from '@/components/utils/borrowerAccess';

const defaultPermissions = {
  // Role identification
  isPlatformAdmin: false,
  isAdministrator: false,
  isLoanOfficer: false,
  isBorrower: false,
  isBroker: false,
  isLoanPartner: false,
  borrowerType: null,
  isBorrowerLiaison: false,
  
  // Application permissions
  canCreateApplication: false,
  canViewAnyApplication: false,
  canManageOwnApplications: false,
  canReviewApplication: false,
  canManageApplications: false,
  canReassignLoanOfficer: false,
  canSignApplication: false,
  canSubmitApplication: false,
  
  // Loan permissions
  canViewAllLoans: false,
  canCreateLoan: false,
  canManageLoans: false,
  
  // Contact management (Borrowers, Entities, Loan Partners)
  canManageContacts: false,
  canViewContactDetails: false,
  canViewContactsPage: false,
  
  // User & Settings management
  canManageUsers: false,
  canAccessSettings: false,
  canManageNotifications: false,
  canManageChecklist: false,
  
  // Profile management
  canViewMyProfile: false,
  canEditMyProfile: false,
  canEditMyEmailPreferences: false,
  canViewOwnedEntityProfile: false,
  canEditOwnedEntity: false,
  canRequestCoOwnerInvite: false,
  
  // Checklist permissions
  canManageChecklists: false,
  canViewActionChecklist: false,
  canViewDocumentChecklist: false,
  
  // Loan Officer Queue
  canViewLoanOfficerQueue: false,
  canManageLoanOfficerQueue: false,
  
  // Messaging
  canCreateDirectMessage: false,
  canCreateLoanChannel: false,
  canMessageAnyUser: false,
  canMessageOnlyLoanOfficers: false,
  
  // Dashboard
  canViewDashboard: false,
  borrowerAccessIds: [],
};

export const usePermissions = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const [permissions, setPermissions] = useState(defaultPermissions);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadUserAndSetPermissions = async () => {
      setIsLoading(true);
      try {
        const user = await base44.auth.me();
        setCurrentUser(user);

        const p = { ...defaultPermissions };

        // --- Role Identification ---
        p.isPlatformAdmin = user.role === 'admin';
        const normalizedRole = normalizeAppRole(user.app_role);
        p.isAdministrator = normalizedRole === 'Administrator';
        p.isLoanOfficer = normalizedRole === 'Loan Officer';
        p.isBorrower = normalizedRole === 'Borrower' || normalizedRole === 'Liaison';
        p.isBroker = normalizedRole === 'Broker';
        p.isLoanPartner = ['Broker', 'Referral Partner', 'Title Company', 'Insurance Company', 'Servicer'].includes(normalizedRole);
        p.isBorrowerLiaison = normalizedRole === 'Liaison';

        // --- Rule 1: Administrator = Platform Admin ---
        const isAdmin = p.isPlatformAdmin || p.isAdministrator;

        // --- Applications (Rule 2 - UPDATED) ---
        if (isAdmin) {
          p.canCreateApplication = true;
          p.canViewAnyApplication = true;
          p.canReviewApplication = true;
          p.canManageApplications = true;
          p.canReassignLoanOfficer = true;
        } else if (p.isLoanOfficer) {
          // UPDATED: Loan Officers can now MANAGE all applications (not just view)
          p.canCreateApplication = true;
          p.canViewAnyApplication = true;
          p.canReviewApplication = true;
          p.canManageApplications = true;
          p.canReassignLoanOfficer = true;
        } else if (p.isBorrower) {
          p.canCreateApplication = true;
          p.canViewAnyApplication = false;
          p.canManageOwnApplications = true;
          p.canReviewApplication = false;
          p.canManageApplications = false;
          p.canReassignLoanOfficer = false;
        } else if (p.isBroker) {
          p.canCreateApplication = true;
          p.canViewAnyApplication = false;
          p.canManageOwnApplications = false;
          p.canReviewApplication = false;
          p.canManageApplications = false;
          p.canReassignLoanOfficer = false;
          p.canSignApplication = false;
          p.canSubmitApplication = false;
        }

        if (p.isBorrower) {
          p.canSignApplication = !p.isBorrowerLiaison;
          p.canSubmitApplication = !p.isBorrowerLiaison;
        }

        // --- Loans (Rule 3 - UPDATED) ---
        if (isAdmin) {
          p.canViewAllLoans = true;
          p.canCreateLoan = true;
          p.canManageLoans = true;
        } else if (p.isLoanOfficer) {
          // UPDATED: Loan Officers can MANAGE all loans (not just their own)
          p.canViewAllLoans = true;
          p.canCreateLoan = true;
          p.canManageLoans = true;
        } else if (p.isBorrower || p.isLoanPartner) {
          p.canViewAllLoans = false;
          p.canCreateLoan = false;
          p.canManageLoans = false;
        }

        // --- Contacts (Rules 4, 5, 10) ---
        if (isAdmin || p.isLoanOfficer) {
          p.canManageContacts = true;
          p.canViewContactDetails = true;
          p.canViewContactsPage = true;
        } else if (p.isBorrower || p.isLoanPartner) {
          p.canManageContacts = false;
          p.canViewContactDetails = false;
          p.canViewContactsPage = false;
        }

        // --- My Profile (Rules 6, 7, 8, 9) ---
        if (p.isBorrower || p.isLoanPartner) {
          p.canViewMyProfile = true;
          p.canEditMyProfile = false;
          p.canEditMyEmailPreferences = true;
        } else {
          p.canViewMyProfile = false;
          p.canEditMyProfile = false;
        }

        if (p.isBorrower) {
          p.canViewOwnedEntityProfile = true;
          p.canEditOwnedEntity = false;
          p.canRequestCoOwnerInvite = true;
        }

        // --- Settings (Rule 11) ---
        if (isAdmin) {
          p.canAccessSettings = true;
          p.canManageUsers = true;
          p.canManageNotifications = true;
          p.canManageChecklist = true;
        } else if (p.isLoanOfficer) {
          p.canAccessSettings = true;
          p.canManageUsers = false;
          p.canManageNotifications = false; // Loan officers cannot access notifications tab
          p.canManageChecklist = true;
        }

        // --- Messaging (Rule 12) ---
        if (isAdmin || p.isLoanOfficer) {
          p.canCreateDirectMessage = true;
          p.canCreateLoanChannel = true;
          p.canMessageAnyUser = true;
        } else {
          p.canCreateDirectMessage = true;
          p.canCreateLoanChannel = false;
          p.canMessageOnlyLoanOfficers = true;
        }

        // --- Checklists (Rule 13) ---
        if (isAdmin || p.isLoanOfficer) {
          p.canManageChecklists = true;
          p.canViewActionChecklist = true;
          p.canViewDocumentChecklist = true;
        } else {
          p.canManageChecklists = false;
          p.canViewActionChecklist = false;
          p.canViewDocumentChecklist = true;
        }

        // --- Loan Officer Queue (Rule 14) ---
        if (isAdmin || p.isLoanOfficer) {
          p.canViewLoanOfficerQueue = true;
          p.canManageLoanOfficerQueue = true;
        }

        // --- Dashboard ---
        p.canViewDashboard = true;

        if (p.isBorrower) {
          p.borrowerAccessIds = await getBorrowerAccessIds(base44, user);
        } else {
          p.borrowerAccessIds = [user.id].filter(Boolean);
        }

        if (normalizedRole === 'Borrower') {
          try {
            await base44.functions.invoke('activateBorrowerInvite');
          } catch (error) {
            console.error('Error activating borrower invite:', error);
          }
        }

        setPermissions(p);
      } catch (error) {
        console.error('Error loading user permissions:', error);
        setCurrentUser(null);
        setPermissions(defaultPermissions);
      }
      setIsLoading(false);
    };

    loadUserAndSetPermissions();
  }, []);

  return {
    currentUser,
    permissions,
    isLoading
  };
};
