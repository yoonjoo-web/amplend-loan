import React, { useState, useEffect, useCallback, useMemo } from "react";
import { LoanApplication, User } from "@/entities/all";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, ArrowRight, Check, Save, Loader2, CheckCircle2, Handshake } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { base44 } from "@/api/base44Client";
import { usePermissions } from "@/components/hooks/usePermissions";
import { hasBrokerOnApplication, wasInvitedByBroker } from "@/components/utils/brokerVisibility";

import LoanTypeStep from "../components/application-steps/LoanTypeStep";
import BorrowerInfoStep from "../components/application-steps/BorrowerInfoStep";
import CoBorrowerStep from "../components/application-steps/CoBorrowerStep";
import CoBorrowerSummaryView from "../components/application-steps/CoBorrowerSummaryView";
import EntityInformationStep from "../components/application-steps/EntityInformationStep";
import PropertyInfoStep from "../components/application-steps/PropertyInfoStep";
import ConsentStep from "../components/application-steps/ConsentStep";
import ReviewActions from "../components/application-review/ReviewActions";
import FieldCommentModal from "../components/application-review/FieldCommentModal";
import LoanOfficerReassignModal from "../components/applications/LoanOfficerReassignModal";
import DynamicFormRenderer from "../components/forms/DynamicFormRenderer";
import UpdateProfileModal from "../components/shared/UpdateProfileModal";
import { mapLoanApplicationToBorrower, mapLoanApplicationToBorrowerEntity } from "@/components/utils/entitySyncHelper";

const allSteps = [
  { id: 1, title: 'Loan Type', component: LoanTypeStep, description: 'Select the type of loan you need' },
  { id: 2, title: 'Borrower Information', component: BorrowerInfoStep, description: 'Provide your personal details' },
  { id: 3, title: 'Entity Information', component: EntityInformationStep, description: 'Provide entity details if applicable', conditional: true, condition: (data) => data?.borrower_type === 'entity'},
  { id: 4, title: 'Co-Borrowers', component: CoBorrowerStep, description: 'Add details for any co-borrowers', conditional: true, condition: (data) => data?.has_coborrowers === 'yes' },
  { id: 5, title: 'Property Information', component: PropertyInfoStep, description: 'Tell us about the property'},
  { id: 6, title: 'Consent & E-Sign', component: ConsentStep, description: 'Review and sign the application' }
];

export default function NewApplication() {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, permissions, isLoading: permissionsLoading } = usePermissions();
  const borrowerAccessIds = permissions.borrowerAccessIds || [currentUser?.id].filter(Boolean);
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSavingOnExit, setIsSavingOnExit] = useState(false);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [currentCommentField, setCurrentCommentField] = useState(null);
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [allLoanOfficers, setAllLoanOfficers] = useState([]);
  const [overallReviewComment, setOverallReviewComment] = useState('');
  const [primaryBorrowerUser, setPrimaryBorrowerUser] = useState(null);
  const [showProceedContactSyncModal, setShowProceedContactSyncModal] = useState(false);
  const [hideLoanOfficerDetails, setHideLoanOfficerDetails] = useState(false);
  const [liaisonPartners, setLiaisonPartners] = useState([]);

  const { toast } = useToast();

  const getVisibleSteps = useCallback((formData, userIsCoBorrower = false) => {
    return allSteps.filter(step => {
      // Hide borrower info step for co-borrowers
      if (userIsCoBorrower && step.hiddenForCoBorrower) return false;
      if (!step.conditional) return true;
      if (step.condition) return step.condition(formData);
      return true;
    });
  }, []);

  // Determine if current user is a co-borrower on this application
  const userIsCoBorrower = useMemo(() => {
    if (!formData || !currentUser) return false;
    return formData.co_borrowers?.some(cb =>
      borrowerAccessIds.includes(cb.user_id) || borrowerAccessIds.includes(cb.borrower_id)
    ) || false;
  }, [formData, currentUser, borrowerAccessIds]);

  const visibleSteps = useMemo(() => {
    return getVisibleSteps(formData, userIsCoBorrower);
  }, [formData, getVisibleSteps, userIsCoBorrower]);

  const getCurrentStepIndex = useCallback(() => {
    return visibleSteps.findIndex(s => s.id === currentStep);
  }, [visibleSteps, currentStep]);

  const getDisplayStepNumber = useCallback((stepId) => {
    return visibleSteps.findIndex(s => s.id === stepId) + 1;
  }, [visibleSteps]);

  const getBorrowerNames = useCallback(() => {
    const fallbackFirstName = formData?.borrower_first_name || 'Borrower';
    const firstName = primaryBorrowerUser?.first_name || fallbackFirstName;
    const lastName = primaryBorrowerUser?.last_name || formData?.borrower_last_name || '';
    const fullName = `${firstName} ${lastName}`.trim();

    return {
      borrowerName: firstName,
      borrowerFullName: fullName || firstName
    };
  }, [formData, primaryBorrowerUser]);

  const loadApplication = useCallback(async () => {
    setIsLoading(true);
    const searchParams = new URLSearchParams(location.search);
    const id = searchParams.get('id');
    const action = searchParams.get('action');

    if (!id) {
      navigate(createPageUrl("Applications"));
      setIsLoading(false);
      return;
    }

    let shouldBeReadOnly = false;

    try {
      let appData;
      let accessDenied = false;
      
      try {
        const response = await base44.functions.invoke('getApplicationWithAccess', {
          application_id: id
        });
        
        if (response && response.data && response.data.application) {
          appData = response.data.application;
        } else {
          throw new Error('Invalid response from function or application not found via function.');
        }
      } catch (funcError) {
        console.log('Function call failed, trying direct entity access:', funcError.message);
        
        try {
          appData = await base44.entities.LoanApplication.get(id);
          
          if (!appData) {
            // Application truly doesn't exist
            toast({
              variant: "destructive",
              title: "Application Not Found",
              description: "The application you're looking for doesn't exist or may have been deleted.",
            });
            navigate(createPageUrl("Applications"));
            setIsLoading(false);
            return;
          }
          
          const isPrimaryBorrower = borrowerAccessIds.includes(appData.primary_borrower_id);
          const isCoBorrower = appData.co_borrowers?.some(cb =>
            borrowerAccessIds.includes(cb.user_id) || borrowerAccessIds.includes(cb.borrower_id)
          );
          const createdById = typeof appData.created_by === 'object' ? appData.created_by?.id : appData.created_by;
          const isCreator = createdById === currentUser.id;
          
          const isBrokerOwner = appData.broker_user_id && appData.broker_user_id === currentUser.id;
          if (!permissions.canManageApplications && !permissions.canManageOwnApplications && !isPrimaryBorrower && !isCoBorrower && !isCreator && !isBrokerOwner) {
            accessDenied = true;
            throw new Error('You do not have permission to access this application');
          }
        } catch (entityError) {
          // Check if it's a "not found" error vs permission error
          const errorMessage = entityError.message || '';
          if (errorMessage.includes('not found') || errorMessage.includes('Not found') || errorMessage.includes('does not exist')) {
            toast({
              variant: "destructive",
              title: "Application Not Found",
              description: "The application you're looking for doesn't exist or may have been deleted.",
            });
          } else if (accessDenied || errorMessage.includes('permission')) {
            toast({
              variant: "destructive",
              title: "Access Denied",
              description: "You do not have permission to view this application.",
            });
          } else {
            console.error('Unexpected error loading application:', entityError);
            toast({
              variant: "destructive",
              title: "Error Loading Application",
              description: errorMessage || "An unexpected error occurred while loading the application.",
            });
          }

          navigate(createPageUrl("Applications"));
          setIsLoading(false);
          return;
        }
      }

      if (!appData) {
        toast({
          variant: "destructive",
          title: "Application Not Found",
          description: "Unable to load application data.",
        });
        navigate(createPageUrl("Applications"));
        setIsLoading(false);
        return;
      }

      let allUsers = [];
      try {
        if (permissions.isLoanOfficer || permissions.isAdministrator || permissions.isPlatformAdmin) {
          const usersResponse = await base44.functions.invoke('getAllUsers');
          allUsers = usersResponse?.data?.users || [];
        } else if (permissions.isBroker) {
          const officersResponse = await base44.functions.invoke('getLoanOfficers');
          allUsers = officersResponse?.data?.users || [];
        } else {
          allUsers = await User.list();
        }
      } catch (error) {
        console.error('Error fetching visible users:', error);
      }

      const loanOfficerUsers = allUsers.filter(u => u.app_role === 'Loan Officer');
      setAllLoanOfficers(loanOfficerUsers || []);

      // Loan officer assignment now occurs at creation time on the backend.

      // Load primary borrower user if linked
      if (appData.primary_borrower_id) {
        try {
          const borrowerUser = await User.get(appData.primary_borrower_id);
          setPrimaryBorrowerUser(borrowerUser);
        } catch (error) {
          console.error('Error loading primary borrower user:', error);
          setPrimaryBorrowerUser(null);
        }
      } else {
        setPrimaryBorrowerUser(null);
      }

      const allPartners = await base44.entities.LoanPartner.list().catch(() => []);

      if (permissions.isBorrower) {
        try {
          const borrowersByUserId = await base44.entities.Borrower.filter({ user_id: currentUser.id }).catch(() => []);
          const borrowerRecord = borrowersByUserId?.[0] || (
            currentUser.email
              ? (await base44.entities.Borrower.filter({ email: currentUser.email }).catch(() => []))?.[0]
              : null
          );
          const invitedByBroker = wasInvitedByBroker(borrowerRecord);
          setHideLoanOfficerDetails(invitedByBroker || hasBrokerOnApplication(appData, allPartners));
        } catch (error) {
          console.error('Error checking broker partners:', error);
          setHideLoanOfficerDetails(false);
        }
      } else {
        setHideLoanOfficerDetails(false);
      }

      // Resolve liaison names for the indicator
      const liaisonIds = appData.liaison_ids || [];
      if (liaisonIds.length > 0) {
        const resolved = liaisonIds.map((id) => {
          const match = allPartners.find((p) => p.id === id || p.user_id === id);
          return match ? (match.name || match.contact_person || match.email || id) : id;
        }).filter(Boolean);
        setLiaisonPartners(resolved);
      } else {
        setLiaisonPartners([]);
      }

      if (appData.status === 'rejected') {
        appData.esignature = '';
        appData.esignature_date = null;
        appData.acknowledgement_agreed = false;
        appData.authorization_agreed = false;
        appData.rejection_reason = null;
      }

      const isPrimaryBorrower = borrowerAccessIds.includes(appData.primary_borrower_id);
      const isCoBorrower = appData.co_borrowers?.some(cb =>
        borrowerAccessIds.includes(cb.user_id) || borrowerAccessIds.includes(cb.borrower_id)
      );
      
      console.log('DEBUG - Before readonly logic:', {
        shouldBeReadOnly: shouldBeReadOnly,
        isBorrower: permissions.isBorrower,
        isLoanOfficer: permissions.isLoanOfficer,
        status: appData.status
      });
      
      // Set read-only if application is approved or rejected
      if (appData.status === 'approved' || appData.status === 'rejected') {
        shouldBeReadOnly = true;
        console.log('DEBUG - Set readonly because status is approved/rejected');
      }

      console.log('DEBUG - Final Reassign Button Visibility:', {
        isLoanOfficer: permissions.isLoanOfficer,
        canReassignLoanOfficer: permissions.canReassignLoanOfficer,
        applicationStatus: appData.status,
        isReadOnly: shouldBeReadOnly
      });

      setIsReadOnly(shouldBeReadOnly);
      setFormData(appData);
      setOverallReviewComment(appData.overall_review_comment || '');
      
      const userIsCoBorrowerOnApp = appData.co_borrowers?.some(cb =>
        borrowerAccessIds.includes(cb.user_id) || borrowerAccessIds.includes(cb.borrower_id)
      ) || false;
      const initialVisibleSteps = getVisibleSteps(appData, userIsCoBorrowerOnApp);
      const loadedStepId = appData.current_step || 1;
      if (initialVisibleSteps.some(step => step.id === loadedStepId)) {
        setCurrentStep(loadedStepId);
      } else {
        setCurrentStep(initialVisibleSteps[0]?.id || 1);
      }
    } catch (error) {
      console.error("Failed to load application:", error);
      // This catch is for unexpected errors not handled above
      toast({
        variant: "destructive",
        title: "Unexpected Error",
        description: "An unexpected error occurred. Please try again or contact support.",
      });
      navigate(createPageUrl("Applications"));
    } finally {
      setIsLoading(false);
    }
  }, [navigate, location.search, getVisibleSteps, toast, currentUser, permissions]);

  useEffect(() => {
    if (!permissionsLoading && currentUser) {
      loadApplication();
    }
  }, [permissionsLoading, currentUser, loadApplication]);

  useEffect(() => {
    if (formData && visibleSteps.length > 0 && !visibleSteps.some(step => step.id === currentStep)) {
      setCurrentStep(visibleSteps[0]?.id || 1);
    }
  }, [formData, visibleSteps, currentStep]);

  useEffect(() => {
   if (!formData) return;
   const liaisonIds = formData.liaison_ids || [];
   if (liaisonIds.length === 0) {
     setLiaisonPartners([]);
     return;
   }

   const resolveNames = async () => {
     try {
       const allPartners = await base44.entities.LoanPartner.list().catch(() => []);
       const resolved = liaisonIds.map((id) => {
         if (!id) return null;
         const match = allPartners.find((p) => p.id === id || p.user_id === id);
         if (match) {
           return match.name || match.contact_person || match.email || id;
         }
         // If no match found, still return the ID (liaison may be in another system)
         return id;
       }).filter(Boolean);
       console.log('DEBUG - Resolved liaison names:', { liaisonIds, resolved, allPartners });
       setLiaisonPartners(resolved);
     } catch (error) {
       console.error('Error resolving liaison names:', error);
       setLiaisonPartners(liaisonIds.filter(Boolean));
     }
   };

   resolveNames();
  }, [formData?.liaison_ids]);

  const canManage = permissions?.canManageApplications;
  const canReview = permissions?.canReviewApplication && formData && ['submitted', 'under_review', 'review_completed'].includes(formData.status);
  
  const cleanFormDataForSaving = (data) => {
    const cleanedData = { ...data };
    
    const numericFields = [
      'borrower_annual_gross_income',
      'borrower_liquidity_amount',
      'borrower_rehabs_done_36_months',
      'borrower_rentals_owned_36_months',
      'borrower_credit_score',
      'number_of_units',
      'number_of_leased_units',
      'purchase_price',
      'estimated_value',
      'after_repair_value',
      'rehab_budget',
      'completed_improvements',
      'estimated_monthly_rent',
      'monthly_property_tax',
      'monthly_insurance',
      'monthly_hoa_fees',
      'desired_loan_amount',
      'existing_mortgage_balance'
    ];

    numericFields.forEach(field => {
      if (cleanedData[field] === '' || cleanedData[field] === null || cleanedData[field] === undefined) {
        cleanedData[field] = null;
      } else if (typeof cleanedData[field] === 'string') {
        const numValue = parseFloat(cleanedData[field]);
        cleanedData[field] = isNaN(numValue) ? null : numValue;
      }
    });

    // Fields that must never be nulled out (they are identity/access fields)
    const preserveFields = ['broker_user_id', 'broker_ids', 'referrer_ids', 'liaison_ids', 'referral_broker', 'loan_contacts'];

    Object.keys(cleanedData).forEach(key => {
      if (preserveFields.includes(key)) return;
      if (cleanedData[key] === '') {
        cleanedData[key] = null;
      }
    });

    if (cleanedData.co_borrowers && Array.isArray(cleanedData.co_borrowers)) {
      cleanedData.co_borrowers = cleanedData.co_borrowers.map(coBorrower => {
        const cleanedCoBorrower = { ...coBorrower };
        
        const coBorrowerNumericFields = ['annual_gross_income', 'liquidity_amount', 'rehabs_done_36_months', 'rentals_owned_36_months', 'credit_score'];
        coBorrowerNumericFields.forEach(field => {
          if (cleanedCoBorrower[field] === '' || cleanedCoBorrower[field] === undefined) {
            cleanedCoBorrower[field] = null;
          } else if (typeof cleanedCoBorrower[field] === 'string') {
            const numValue = parseFloat(cleanedCoBorrower[field]);
            cleanedCoBorrower[field] = isNaN(numValue) ? null : numValue;
          }
        });

        Object.keys(cleanedCoBorrower).forEach(key => {
          if (cleanedCoBorrower[key] === '') {
            cleanedCoBorrower[key] = null;
          }
        });

        return cleanedCoBorrower;
      });
    }

    if (cleanedData.entity_owners && Array.isArray(cleanedData.entity_owners)) {
      cleanedData.entity_owners = cleanedData.entity_owners.map(owner => {
        const cleanedOwner = { ...owner };
        if (cleanedOwner.ownership_percentage === '' || cleanedOwner.ownership_percentage === undefined) {
          cleanedOwner.ownership_percentage = null;
        } else if (typeof cleanedOwner.ownership_percentage === 'string') {
          const numValue = parseFloat(cleanedOwner.ownership_percentage);
          cleanedOwner.ownership_percentage = isNaN(numValue) ? null : numValue;
        }
        Object.keys(cleanedOwner).forEach(key => {
          if (cleanedOwner[key] === '') {
            cleanedOwner[key] = null;
          }
        });
        return cleanedOwner;
      });
    }

    return cleanedData;
  };

  const saveProgress = async (stepToSave, dataOverrides = {}) => {
    if (isReadOnly) return;
    setIsProcessing(true);
    try {
      const dataToSave = cleanFormDataForSaving({
        ...formData,
        ...dataOverrides,
        current_step: stepToSave || currentStep
      });

      await base44.functions.invoke('saveApplicationProgress', {
        application_id: formData.id,
        data: dataToSave
      });
    } catch (error) {
      console.error('Error saving application:', error);
      toast({
        variant: "destructive",
        title: "Save Error",
        description: "Failed to save application progress. Please try again.",
      });
    }
    setIsProcessing(false);
  };

  const handleNext = async () => {
    const currentIndex = getCurrentStepIndex();
    if (currentIndex < visibleSteps.length - 1) {
      await saveProgress();
      const nextStepId = visibleSteps[currentIndex + 1].id;
      setCurrentStep(nextStepId);
      await saveProgress(nextStepId);
      
      // Scroll to top of page
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePrevious = async () => {
    await saveProgress();
    const currentIndex = getCurrentStepIndex();
    if (currentIndex > 0) {
      const prevStepId = visibleSteps[currentIndex - 1].id;
      setCurrentStep(prevStepId);
    }
  };

  const handleStepDataChange = useCallback((stepData) => {
    if (isReadOnly) return;
    setFormData(prev => {
      const newData = { ...prev, ...stepData };
      
      // If application is in 'review_completed' status and borrower makes changes,
      // change status back to 'draft' to prevent loan officer from proceeding without noticing
      if (prev.status === 'review_completed' && !permissions.canManageApplications) {
        newData.status = 'draft';
      }
      
      return newData;
    });
  }, [isReadOnly, permissions.canManageApplications]);

  const handleStartReview = async () => {
    setIsProcessing(true);
    try {
      await base44.functions.invoke('updateApplicationStatus', {
        application_id: formData.id,
        updates: { status: 'under_review' }
      });
      
      // Email is sent by updateApplicationStatus to avoid duplicate notifications.

      toast({
        title: "Review Started",
        description: "Application status updated to 'Under Review'.",
      });

      await loadApplication();
    } catch (error) {
      console.error('Error starting review:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to start review. Please try again.",
      });
    }
    setIsProcessing(false);
  };

  const handleFinishReview = async () => {
    setIsProcessing(true);
    try {
      await base44.functions.invoke('updateApplicationStatus', {
        application_id: formData.id,
        updates: { status: 'review_completed' }
      });
      
      // Email is sent by updateApplicationStatus to avoid duplicate notifications.

      toast({
        title: "Review Completed",
        description: "Application review has been marked as complete. The borrower can now review and resubmit.",
      });

      await loadApplication();
    } catch (error) {
      console.error('Error finishing review:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to finish review. Please try again.",
      });
    }
    setIsProcessing(false);
  };

  const proceedToLoan = async () => {
    setIsProcessing(true);
    try {
      console.error('[handleProceedToLoan] fired');
      try {
        localStorage.setItem('handleProceedToLoanFired', new Date().toISOString());
      } catch (storageError) {
        console.error('[handleProceedToLoan] Failed to store fired timestamp:', storageError);
      }
      try {
        localStorage.setItem('createLoanFromApplicationAttempt', new Date().toISOString());
      } catch (storageError) {
        console.error('[createLoanFromApplication] Failed to store attempt timestamp:', storageError);
      }
      const response = await base44.functions.invoke('createLoanFromApplication', {
        application_id: formData.id
      });
      const { data } = response || {};
      console.error('[createLoanFromApplication] full response:', response);
      console.error('[createLoanFromApplication] response data:', data);
      try {
        localStorage.setItem('createLoanFromApplicationResponse', JSON.stringify(data));
        localStorage.setItem('createLoanFromApplicationFullResponse', JSON.stringify(response));
      } catch (storageError) {
        console.error('[createLoanFromApplication] Failed to store response in localStorage:', storageError);
      }

      if (data.success && data.loan) {
        toast({
          title: "Loan Created",
          description: `Loan #${data.loan.loan_number} successfully created.`,
        });
        
        // Immediately navigate and unmount this component
        window.location.href = createPageUrl("LoanDetail") + `?id=${data.loan.id}`;
        return;
      } else {
        throw new Error('Failed to create loan');
      }
    } catch (error) {
      try {
        localStorage.setItem('createLoanFromApplicationError', JSON.stringify({
          message: error?.message || String(error),
          time: new Date().toISOString()
        }));
      } catch (storageError) {
        console.error('[createLoanFromApplication] Failed to store error in localStorage:', storageError);
      }
      console.error('Error creating loan:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to create loan. Please try again.",
      });
      setIsProcessing(false);
    }
  };

  const handleReject = async (rejectionReason) => {
    setIsProcessing(true);
    try {
      await base44.functions.invoke('updateApplicationStatus', {
        application_id: formData.id,
        updates: { 
          status: 'rejected',
          rejection_reason: rejectionReason
        }
      });
      
      const { borrowerName } = getBorrowerNames();

      try {
        await base44.integrations.Core.SendEmail({
          to: formData.borrower_email,
          subject: 'Loan Application Decision',
          body: `Hello ${borrowerName},\n\nWe regret to inform you that your loan application #${formData.application_number} has not been approved at this time.\n\nReason: ${rejectionReason}\n\nIf you have questions or would like to discuss this decision, please contact us.\n\nThank you.`
        });
      } catch (emailError) {
        console.log('Could not send email notification:', emailError);
      }

      toast({
        title: "Application Rejected",
        description: "Application has been marked as rejected.",
      });
      navigate(createPageUrl("Applications"));
    } catch (error) {
      console.error('Error rejecting application:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to reject application. Please try again.",
      });
    }
    setIsProcessing(false);
  };

  const handleAddComment = (fieldName) => {
    setCurrentCommentField(fieldName);
    setShowCommentModal(true);
  };

  const handleSaveComment = async (commentData) => {
    if (!currentCommentField) return;

    const updatedComments = {
      ...formData.field_comments,
      [currentCommentField]: {
        ...commentData,
        commented_by: currentUser.email,
        commented_date: new Date().toISOString()
      }
    };

    setFormData(prev => ({ ...prev, field_comments: updatedComments }));
    
    try {
      await LoanApplication.update(formData.id, { field_comments: updatedComments });
      toast({
        title: "Comment Saved",
        description: "Field comment saved successfully.",
      });
    } catch (error) {
      console.error('Error saving comment:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save field comment. Please try again.",
      });
    }
  };

  const handleSaveReview = async () => {
    if (!formData) return;
    
    setIsProcessing(true);
    try {
      await base44.functions.invoke('updateApplicationStatus', {
        application_id: formData.id,
        updates: {
          field_comments: formData.field_comments || {}
        }
      });
      
      toast({
        title: "Review Saved",
        description: "Review comments saved successfully.",
      });
    } catch (error) {
      console.error('Error saving review:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save review. Please try again.",
      });
    }
    setIsProcessing(false);
  };

  const handleSaveOverallComment = async () => {
    if (!formData || !canReview) return;
    
    setIsProcessing(true);
    try {
      await base44.functions.invoke('updateApplicationStatus', {
        application_id: formData.id,
        updates: {
          overall_review_comment: overallReviewComment
        }
      });
      
      toast({
        title: "Comment Saved",
        description: "Overall review comment saved successfully.",
      });
      setFormData(prev => ({ ...prev, overall_review_comment: overallReviewComment }));
    } catch (error) {
      console.error('Error saving overall comment:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save comment. Please try again.",
      });
    }
    setIsProcessing(false);
  };

  const submitApplication = async (submitType) => {
    if (isReadOnly) return;

    if (permissions?.isBroker) {
      toast({
        variant: "destructive",
        title: "Submission Blocked",
        description: "Brokers cannot sign or submit applications. Please contact the borrower.",
      });
      return;
    }

    const isLiaisonBorrower = permissions?.isBorrowerLiaison;
    if (isLiaisonBorrower) {
      toast({
        variant: "destructive",
        title: "Submission Blocked",
        description: "Liaisons cannot sign or submit applications. Please contact the primary borrower.",
      });
      return;
    }

    // TEMPORARY: Allow staff to bypass co-borrower signature check
    const isStaff = permissions?.isLoanOfficer || permissions?.isAdministrator || permissions?.isPlatformAdmin;

    const hasCoBorrowers = formData.has_coborrowers === 'yes' && 
                           formData.co_borrowers && 
                           formData.co_borrowers.length > 0;

    // Check if all co-borrowers have signed their consent (skip check for staff)
    if (hasCoBorrowers && !isStaff) {
      const allCoBorrowersSigned = formData.co_borrowers.every(cb => cb.esignature && cb.esignature.trim() !== '');
      
      if (!allCoBorrowersSigned) {
        toast({
          variant: "destructive",
          title: "Submission Blocked",
          description: "All co-borrowers must complete their consent and sign before final submission.",
        });
        return;
      }
    }

    setIsProcessing(true);
    try {
      const finalStatus = submitType === 'review' ? 'in_review' : 'submitted';
      const newSubmissionCount = (formData.submission_count || 0) + 1;

      // Create snapshot of current data
      const dataSnapshot = JSON.parse(JSON.stringify(formData));
      delete dataSnapshot.submission_snapshots;
      delete dataSnapshot.id;
      delete dataSnapshot.created_date;
      delete dataSnapshot.updated_date;
      delete dataSnapshot.created_by;

      const submissionSnapshots = formData.submission_snapshots || [];
      submissionSnapshots.push({
        submission_number: newSubmissionCount,
        submission_date: new Date().toISOString(),
        data_snapshot: dataSnapshot
      });

      const finalData = cleanFormDataForSaving({
        ...formData,
        status: finalStatus,
        current_step: allSteps.length,
        submission_count: newSubmissionCount,
        borrower_completion_status: 'completed',
        submission_snapshots: submissionSnapshots
      });

      await base44.functions.invoke('saveApplicationProgress', {
        application_id: formData.id,
        data: finalData
      });
      
      try {
        const { borrowerFullName } = getBorrowerNames();

        await base44.functions.invoke('emailService', {
          email_type: 'application_status_update',
          recipient_email: formData.borrower_email,
          recipient_name: borrowerFullName,
          data: {
            status_subject: 'Your Loan Application Has Been Submitted',
            status_title: 'Application Submitted',
            status_message: `Your loan application #${formData.application_number} has been submitted successfully (Submission #${newSubmissionCount}).`,
            status_description: 'We will review it shortly.',
            application_number: formData.application_number,
            borrower_name: borrowerFullName,
            status: 'submitted',
            application_id: formData.id
          }
        });
      } catch (emailError) {
        console.log('Could not send submission email notification:', emailError);
      }

      toast({
        title: "Application Submitted",
        description: `Application #${formData.application_number} submitted successfully!`,
      });
      navigate(createPageUrl("Applications"));
    } catch (error) {
      console.error('Error submitting application:', error);
      toast({
        variant: "destructive",
        title: "Submission Error",
        description: "Failed to submit application. Please try again.",
      });
    }
    setIsProcessing(false);
  };

  const handleSubmit = async (submitType) => {
    if (isReadOnly) return;
    await submitApplication(submitType);
  };

  const getOverriddenFieldFilter = () => {
    const overriddenFields = formData?.overridden_fields || [];
    return overriddenFields.filter((fieldName) => typeof fieldName === 'string' && !fieldName.includes('['));
  };

  const resolveBorrowerId = async () => {
    if (formData?.primary_borrower_id) {
      const borrowers = await base44.entities.Borrower.filter({ user_id: formData.primary_borrower_id });
      if (borrowers && borrowers.length > 0) return borrowers[0].id;
    }

    if (formData?.borrower_email) {
      const borrowersByEmail = await base44.entities.Borrower.filter({ email: formData.borrower_email });
      if (borrowersByEmail && borrowersByEmail.length > 0) return borrowersByEmail[0].id;
    }

    return null;
  };

  const updateContactFromOverrides = async (target) => {
    const overriddenFieldFilter = getOverriddenFieldFilter();
    if (overriddenFieldFilter.length === 0) {
      return true;
    }

    try {
      if (target === 'borrower' || target === 'both') {
        const borrowerUpdates = mapLoanApplicationToBorrower(formData, overriddenFieldFilter);
        if (Object.keys(borrowerUpdates).length > 0) {
          const borrowerId = await resolveBorrowerId();
          if (!borrowerId) {
            toast({
              variant: "destructive",
              title: "Contact Not Found",
              description: "Could not find the borrower contact to update.",
            });
            return false;
          }
          await base44.entities.Borrower.update(borrowerId, borrowerUpdates);
        }
      }

      if (target === 'entity' || target === 'both') {
        const entityUpdates = mapLoanApplicationToBorrowerEntity(formData, overriddenFieldFilter);
        if (Object.keys(entityUpdates).length > 0) {
          if (!formData?.borrower_entity_id) {
            toast({
              variant: "destructive",
              title: "Contact Not Found",
              description: "Could not find the entity contact to update.",
            });
            return false;
          }
          await base44.entities.BorrowerEntity.update(formData.borrower_entity_id, entityUpdates);
        }
      }
    } catch (error) {
      console.error('Error updating contact from overrides:', error);
      toast({
        variant: "destructive",
        title: "Contact Update Failed",
        description: "Could not update the selected contact. Please try again.",
      });
      return false;
    }

    return true;
  };

  const handleProceedToLoan = () => {
    setShowProceedContactSyncModal(true);
  };

  const handleProceedToLoanWithContactUpdate = async (target) => {
    setShowProceedContactSyncModal(false);
    if (target) {
      setIsProcessing(true);
      const didUpdate = await updateContactFromOverrides(target);
      if (!didUpdate) {
        setIsProcessing(false);
        return;
      }
    }
    await proceedToLoan();
  };

  const handleBackNavigation = () => {
    if (isReadOnly) {
      navigate(createPageUrl("Applications"));
      return;
    }
    (async () => {
      setIsSavingOnExit(true);
      await saveProgress();
      setIsSavingOnExit(false);
      navigate(createPageUrl("Applications"));
    })();
  };

  const getApplicationTitle = () => {
    if (!primaryBorrowerUser) {
      return formData.application_number;
    }

    if (formData.borrower_type === 'entity' && formData.entity_name) {
      return `${formData.entity_name}'s Application`;
    }

    if (primaryBorrowerUser.first_name && primaryBorrowerUser.last_name) {
      return `${primaryBorrowerUser.first_name} ${primaryBorrowerUser.last_name}'s Application`;
    }

    return formData.application_number;
  };

  // Determine user role in this application
  const isPrimaryBorrowerViewing = formData && currentUser && borrowerAccessIds.includes(formData.primary_borrower_id);
  const isCoBorrowerViewing = formData && currentUser && formData.co_borrowers?.some(cb =>
    borrowerAccessIds.includes(cb.user_id) || borrowerAccessIds.includes(cb.borrower_id)
  );
  const isStaffViewing = canManage || permissions?.canReviewApplication;

  // Get read-only status for specific steps based on user role
  const getStepReadOnlyStatus = useCallback((stepId) => {
    if (isReadOnly) return true;
    if (isStaffViewing) return false;
    
    // Co-borrowers can edit all steps except the primary borrower info page.
    if (isCoBorrowerViewing && stepId === 2) return true;
    
    // Primary borrower: all editable except they don't edit co-borrower details
    return false;
  }, [isReadOnly, isStaffViewing, isCoBorrowerViewing]);

  const renderStepContent = useCallback(() => {
    const currentStepObj = visibleSteps.find(s => s.id === currentStep);
    if (!currentStepObj) {
      console.warn("Current step object not found for ID:", currentStep);
      return null; 
    }

    // Determine step-specific read-only status
    const stepIsReadOnly = getStepReadOnlyStatus(currentStepObj.id);

    if (currentStepObj.usesDynamic) {
      return (
        <>
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-slate-900 mb-2">{currentStepObj.title}</h2>
            <p className="text-slate-600">{currentStepObj.description}</p>
          </div>
          <DynamicFormRenderer
            context="application"
            data={formData}
            onChange={handleStepDataChange}
            isReadOnly={stepIsReadOnly}
            onAddComment={handleAddComment}
            fieldComments={formData.field_comments || {}}
            canManage={canManage}
            categoryFilter={currentStepObj.category}
            applicationStatus={formData.status}
            showTabs={false}
          />
        </>
      );
    }

    const StepComponent = currentStepObj.component;

    // Special handling for Borrower Info Step (step 2)
    if (currentStepObj.id === 2 && StepComponent === BorrowerInfoStep) {
      return (
        <BorrowerInfoStep
          applicationData={{
            ...formData,
            onAddComment: handleAddComment,
            fieldComments: formData.field_comments || {},
            canManage,
            status: formData.status
          }}
          onUpdate={handleStepDataChange}
          isReadOnly={stepIsReadOnly}
          onNext={handleNext}
          onBack={handlePrevious}
        />
      );
    }

    // Special handling for Co-Borrower Step (step 4)
    if (currentStepObj.id === 4 && StepComponent === CoBorrowerStep) {
      // Primary borrower sees summary view - who's participating and their status
      if (isPrimaryBorrowerViewing) {
        return (
          <CoBorrowerSummaryView 
            coBorrowers={formData.co_borrowers || []}
            applicationStatus={formData.status}
          />
        );
      }
      
      // Co-borrower sees their own editable form
      if (isCoBorrowerViewing) {
        const currentCoBorrowerIndex = formData.co_borrowers?.findIndex(cb =>
          borrowerAccessIds.includes(cb.user_id) || borrowerAccessIds.includes(cb.borrower_id)
        );
        const currentCoBorrower = currentCoBorrowerIndex >= 0 ? formData.co_borrowers[currentCoBorrowerIndex] : null;
        
        if (currentCoBorrower) {
          return (
            <CoBorrowerStep
              data={formData}
              onChange={handleStepDataChange}
              isReadOnly={stepIsReadOnly}
              currentUser={currentUser}
              canManage={canManage}
              onAddComment={handleAddComment}
              fieldComments={formData.field_comments || {}}
              singleCoBorrowerMode={true}
              coBorrowerIndex={currentCoBorrowerIndex}
            />
          );
        }
      }
      
      // Staff sees full co-borrower management
      return (
        <CoBorrowerStep
          data={formData}
          onChange={handleStepDataChange}
          isReadOnly={stepIsReadOnly}
          currentUser={currentUser}
          canManage={canManage}
          onAddComment={handleAddComment}
          fieldComments={formData.field_comments || {}}
        />
      );
    }

    const props = {
      data: formData,
      onChange: handleStepDataChange,
      isReadOnly: stepIsReadOnly,
      currentUser,
      permissions,
      canManage,
      onAddComment: handleAddComment,
      fieldComments: formData.field_comments || {},
    };

    if (StepComponent === ConsentStep) {
        props.borrowerData = formData;
        props.onSubmit = handleSubmit;
        props.isProcessing = isProcessing;
        props.canManage = canManage;
        props.canSignApplication = permissions?.canSignApplication ?? true;
        props.canSubmitApplication = permissions?.canSubmitApplication ?? true;
        
        // For co-borrowers, they sign their own consent
        if (isCoBorrowerViewing) {
          props.isCoBorrowerConsent = true;
          props.coBorrowerUserId = currentUser.id;
        }
    }

    if (StepComponent === LoanTypeStep) {
        props.onAddLiaisonSave = saveProgress;
    }

    return (
        <StepComponent {...props} />
    );
  }, [currentStep, visibleSteps, formData, handleStepDataChange, isReadOnly, currentUser, canManage, handleAddComment, handleSubmit, isProcessing, handleNext, handlePrevious, getStepReadOnlyStatus, isPrimaryBorrowerViewing, isCoBorrowerViewing, isStaffViewing]);

  if (isLoading || !formData || permissionsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-12 h-12 animate-spin text-slate-500" />
      </div>
    );
  }

  const currentStepDisplayNumber = getDisplayStepNumber(currentStep);
  const totalVisibleSteps = visibleSteps.length;
  const progressPercentage = (currentStepDisplayNumber / totalVisibleSteps) * 100;
  const currentStepObj = visibleSteps.find(s => s.id === currentStep);
  const brokerDisplayName = formData?.referrer_name
    || formData?.referral_broker?.name
    || formData?.loan_contacts?.broker?.name
    || formData?.referral_broker?.email
    || '';
  const showBrokerName = permissions?.isBorrower && hideLoanOfficerDetails;
  const showAssignmentCard = formData && (canManage || permissions?.isBroker || showBrokerName);

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
        <div className="max-w-4xl mx-auto space-y-8">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
                    {getApplicationTitle()}
                  </h1>
                  {formData.submission_count > 0 && (
                    <Badge variant="outline" className="text-sm">
                      {formData.submission_count === 1 ? '1st' : formData.submission_count === 2 ? '2nd' : formData.submission_count === 3 ? '3rd' : `${formData.submission_count}th`} Submission
                    </Badge>
                  )}
                </div>
                {formData.status === 'review_completed' && !isReadOnly && (
                  <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-800 font-medium">
                      📋 Review completed! Please review the loan officer's comments below, make any necessary changes, and resubmit your application.
                    </p>
                  </div>
                )}
              </div>
              <Button
                variant="outline"
                onClick={handleBackNavigation}
                className="flex items-center gap-2"
                disabled={isSavingOnExit}
              >
                {isSavingOnExit ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <ArrowLeft className="w-4 h-4" />
                    Back to Applications
                  </>
                )}
              </Button>
            </div>

            {showAssignmentCard && (
              <Card className="border-blue-200 bg-blue-50 mb-6">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-blue-900">
                        {showBrokerName ? 'Assigned Broker' : 'Assigned Loan Officer'}
                      </p>
                      <p className="text-sm text-blue-700">
                        {showBrokerName ? (
                          brokerDisplayName || 'Broker'
                        ) : (
                          formData.assigned_loan_officer_id ? (
                            (() => {
                              if (hideLoanOfficerDetails) {
                                return 'Loan Officer';
                              }
                              const officer = allLoanOfficers.find(u => u.id === formData.assigned_loan_officer_id);
                              if (!officer) {
                                return isLoading ? 'Loading...' : 'Loan Officer';
                              }
                              return officer.first_name && officer.last_name 
                                ? `${officer.first_name} ${officer.last_name}`
                                : officer.full_name || officer.email || 'Officer';
                            })()
                          ) : (
                            'Not assigned'
                          )
                        )}
                      </p>
                    </div>
                    {!showBrokerName && !isReadOnly && permissions.canReassignLoanOfficer && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowReassignModal(true)}
                        className="border-blue-300 hover:bg-blue-100"
                      >
                        {formData.assigned_loan_officer_id ? 'Reassign' : 'Assign'} Loan Officer
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {liaisonPartners.length > 0 && (
              <Card className="border-slate-200 bg-slate-50 mb-6">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <Handshake className="w-4 h-4 text-slate-600 shrink-0" />
                    <p className="text-sm font-semibold text-slate-800">Assigned Liaison{liaisonPartners.length > 1 ? 's' : ''}:</p>
                    <p className="text-sm text-slate-600">{liaisonPartners.join(', ')}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
              <CardContent className="p-6">
                <div className="mb-6">
                  <div className="flex justify-between items-center mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">
                        Step {currentStepDisplayNumber} of {totalVisibleSteps}: {currentStepObj?.title}
                      </h3>
                      {!isReadOnly && (
                        <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Form auto-saves as you type
                        </p>
                      )}
                    </div>
                    <span className="text-sm text-slate-500">
                      {Math.round(progressPercentage)}% Complete
                    </span>
                  </div>
                  <Progress value={progressPercentage} className="h-2" />
                </div>

                <div className="grid gap-4 mb-8" style={{ gridTemplateColumns: `repeat(${totalVisibleSteps}, minmax(0, 1fr))` }}>
                  {visibleSteps.map((step, index) => (
                    <button
                      key={step.id}
                      onClick={() => setCurrentStep(step.id)}
                      disabled={step.id > (formData.current_step || 0) && !isReadOnly}
                      className={`flex items-center gap-3 p-3 rounded-lg transition-all text-left ${
                        step.id === currentStep
                          ? 'bg-slate-900 text-white'
                          : step.id <= (formData.current_step || 0)
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-100 text-slate-500'
                      } ${ (step.id > (formData.current_step || 0) && !isReadOnly) ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                    >
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                        step.id === currentStep
                          ? 'bg-white text-slate-900'
                          : step.id <= (formData.current_step || 0)
                          ? 'bg-emerald-500 text-white'
                          : 'bg-slate-300 text-slate-600'
                      }`}>
                        {step.id <= (formData.current_step || 0) && step.id !== currentStep ? <Check className="w-3 h-3" /> : index + 1}
                      </div>
                      <span className="font-medium text-xs truncate">{step.title}</span>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {canReview && (
            <Card className="border-2 border-blue-200 bg-blue-50/50 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-blue-600" />
                  Application Review
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <ReviewActions
                  applicationStatus={formData.status}
                  onStartReview={handleStartReview}
                  onFinishReview={handleFinishReview}
                  onProceedToLoan={handleProceedToLoan}
                  onReject={handleReject}
                  onSaveReview={handleSaveReview}
                  isProcessing={isProcessing}
                />

                {['submitted', 'under_review', 'review_completed'].includes(formData.status) && (
                  <Card className="border border-slate-200 bg-white mt-4">
                    <CardHeader className="py-3 px-4">
                      <CardTitle className="text-base font-semibold text-slate-900">
                        Overall Review Comments
                      </CardTitle>
                      <p className="text-xs text-slate-500 mt-1">Internal comments visible only to loan officers and administrators</p>
                    </CardHeader>
                    <CardContent className="px-4 pb-4">
                      <div className="space-y-3">
                        <Textarea
                          value={overallReviewComment}
                          onChange={(e) => setOverallReviewComment(e.target.value)}
                          placeholder="Add overall comments about this application (visible to loan officers and admins only)..."
                          className="h-32 resize-none"
                        />
                        <div className="flex justify-end">
                          <Button
                            onClick={handleSaveOverallComment}
                            disabled={isProcessing}
                            variant="outline"
                            size="sm"
                          >
                            {isProcessing ? (
                              <>
                                <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                                Saving...
                              </>
                            ) : (
                              <>
                                <Save className="w-3 h-3 mr-2" />
                                Save Comment
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </CardContent>
            </Card>
          )}

          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              {renderStepContent()}
            </motion.div>
          </AnimatePresence>

          {!isReadOnly && (
            <div className="flex justify-between items-center">
              <Button
                variant="outline"
                onClick={handlePrevious}
                disabled={getCurrentStepIndex() === 0 || isProcessing}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Previous
              </Button>

              <div className="flex items-center gap-3">
                {getCurrentStepIndex() < visibleSteps.length - 1 ? (
                  <Button
                    onClick={handleNext}
                    disabled={isProcessing}
                    className="bg-slate-900 hover:bg-slate-800 flex items-center gap-2"
                  >
                    Next
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                ) : null}
              </div>
            </div>
          )}
        </div>

        <FieldCommentModal
          isOpen={showCommentModal}
          onClose={() => setShowCommentModal(false)}
          field={currentCommentField}
          currentComment={formData.field_comments?.[currentCommentField]}
          onSave={handleSaveComment}
        />

        <UpdateProfileModal
          isOpen={showProceedContactSyncModal}
          onClose={() => setShowProceedContactSyncModal(false)}
          title="Proceed to Loan"
          description="Select a contact to update before creating the loan (optional)."
          options={[
            { value: "borrower", label: "Update Borrower Contact" },
            { value: "entity", label: "Update Entity Contact" },
          ]}
          submitLabel="Proceed to Loan"
          onSubmitOption={(option) => {
            handleProceedToLoanWithContactUpdate(option);
          }}
        />

        {showReassignModal && formData && (
          <LoanOfficerReassignModal
            isOpen={showReassignModal}
            onClose={() => setShowReassignModal(false)}
            applicationId={formData.id}
            currentOfficerId={formData.assigned_loan_officer_id}
            allLoanOfficers={allLoanOfficers}
            onRefresh={loadApplication}
          />
        )}
      </div>
    </>
  );
}
