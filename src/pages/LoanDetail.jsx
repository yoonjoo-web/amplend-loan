import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { createPageUrl } from "@/utils";
import { useToast } from "@/components/ui/use-toast";
import { base44 } from "@/api/base44Client";
import { getBorrowerAccessIds } from "@/components/utils/borrowerAccess";
import { getLoanPartnerAccessIds } from "@/components/utils/loanPartnerAccess";

import LoanOverviewTab from "../components/loan-detail/LoanOverviewTab";
import LoanDocumentsTab from "../components/loan-detail/LoanDocumentsTab";
import LoanChecklistTab from "../components/loan-detail/LoanChecklistTab";
import LoanDrawsTab from "../components/loan-detail/LoanDrawsTab";
import LoanSidebar from "../components/loan-detail/LoanSidebar";
import LoanSummaryHeader from "../components/loan-detail/LoanSummaryHeader";
import LoanStatusBadgeControl from "../components/loan-detail/LoanStatusBadgeControl";
import LoanStatusProgressCard from "../components/loan-detail/LoanStatusProgressCard";
import LoanDetailPlaceholderView from "../components/loan-detail/LoanDetailPlaceholderView";
import {
  getDefaultLoanDetailFallbackTab,
  getLoanDetailSubpage,
  getLoanDetailTabUrl,
  isValidLoanDetailTab,
} from "../components/loan-detail/loanDetailSubpages";
import {
  DEFAULT_LOAN_OVERVIEW_SECTION,
  getLoanOverviewSection,
  isValidLoanOverviewSection,
} from "../components/loan-detail/loanOverviewSections";


export default function LoanDetail() {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const searchParams = new URLSearchParams(location.search);
  const loanId = searchParams.get('id');
  const requestedTab = searchParams.get('tab');
  const openTask = searchParams.get('openTask');
  const requestedSection = searchParams.get('section');
  const [loan, setLoan] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [allLoanOfficers, setAllLoanOfficers] = useState([]);
  const [borrowerAccessIds, setBorrowerAccessIds] = useState([]);
  const fallbackTab = getDefaultLoanDetailFallbackTab(currentUser, { openTask: Boolean(openTask) });
  const activeTab = isValidLoanDetailTab(requestedTab, currentUser) ? requestedTab : fallbackTab;
  const activeSubpage = getLoanDetailSubpage(activeTab, currentUser);
  const activeSection =
    activeTab === "details" && isValidLoanOverviewSection(requestedSection, currentUser)
      ? requestedSection
      : getLoanOverviewSection(DEFAULT_LOAN_OVERVIEW_SECTION, currentUser)?.key || DEFAULT_LOAN_OVERVIEW_SECTION;
  const showLoanSidebar = activeTab === 'dashboard';

  const normalizeDateValue = (value) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toISOString().split('T')[0];
  };

  useEffect(() => {
    loadLoan();
    
    window.refreshLoanDocuments = () => {
      loadLoan();
    };
    
    return () => {
      delete window.refreshLoanDocuments;
    };
  }, [loanId]);

  useEffect(() => {
    if (!loanId || !currentUser) {
      return;
    }

    const targetUrl = getLoanDetailTabUrl(
      loanId,
      activeTab,
      activeTab === "details"
        ? { ...(openTask ? { openTask } : {}), section: activeSection }
        : openTask
          ? { openTask }
          : {}
    );

    const currentUrl = `${location.pathname}?${searchParams.toString()}`;

    if (currentUrl !== targetUrl) {
      navigate(targetUrl, {
        replace: true,
      });
    }
  }, [activeSection, activeTab, currentUser, loanId, location.pathname, navigate, openTask, requestedTab, searchParams]);

  const loadLoan = async () => {
    setIsLoading(true);
    try {
      const user = await base44.auth.me();
      setCurrentUser(user);

      // Only fetch loan officers if user has permission (admins and loan officers)
      if (user.role === 'admin' || user.app_role === 'Administrator' || user.app_role === 'Loan Officer') {
        try {
          const loanOfficers = await base44.entities.User.filter({
            app_role: 'Loan Officer'
          });
          setAllLoanOfficers(loanOfficers || []);
        } catch (error) {
          console.error('Error fetching loan officers:', error);
          setAllLoanOfficers([]);
        }
      } else {
        setAllLoanOfficers([]);
      }

      if (!loanId) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Loan ID is missing.",
        });
        navigate(createPageUrl("Loans"));
        return;
      }

      const loanData = await base44.entities.Loan.get(loanId);

      if (!loanData) {
        toast({
          variant: "destructive",
          title: "Loan Not Found",
          description: "The requested loan could not be found.",
        });
        navigate(createPageUrl("Loans"));
        return;
      }

      const resolvedBorrowerAccessIds = await getBorrowerAccessIds(base44, user);
      const resolvedLoanPartnerAccessIds = await getLoanPartnerAccessIds(base44, user);
      setBorrowerAccessIds(resolvedBorrowerAccessIds);

      const toIdArray = (singleValue, legacyList) => {
        if (singleValue) return [String(singleValue)];
        if (Array.isArray(legacyList)) return legacyList.map(String).filter(Boolean);
        return [];
      };

      const matchesTeamIds = (values) =>
        Array.isArray(values) &&
        values.some((id) => String(id) === String(user.id) || resolvedLoanPartnerAccessIds.includes(String(id)));

      const canViewLoan = 
        user.role === 'admin' || 
        user.app_role === 'Administrator' ||
        user.app_role === 'Loan Officer' ||
        loanData.borrower_ids?.some((id) => resolvedBorrowerAccessIds.includes(id)) ||
        matchesTeamIds(toIdArray(loanData.liaison_id, loanData.liaison_ids)) ||
        matchesTeamIds(toIdArray(loanData.referrer_id, loanData.referrer_ids)) ||
        matchesTeamIds(toIdArray(loanData.broker_id, loanData.broker_ids));

      if (!canViewLoan) {
        toast({
          variant: "destructive",
          title: "Access Denied",
          description: "You do not have permission to view this loan.",
        });
        navigate(createPageUrl("Loans"));
        return;
      }

      setLoan(loanData);
    } catch (error) {
      console.error('Error loading loan:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load loan details.",
      });
    }
    setIsLoading(false);
  };

  const handleLoanUpdate = async (updatedFields) => {
    try {
      const normalizedActualClosingDate = normalizeDateValue(updatedFields.actual_closing_date);
      const normalizedExistingClosingDate = normalizeDateValue(loan.actual_closing_date);
      const shouldScheduleClosing = normalizedActualClosingDate && normalizedActualClosingDate !== normalizedExistingClosingDate;
      const mergedUpdates = shouldScheduleClosing
        ? { ...updatedFields, status: 'closing_scheduled' }
        : updatedFields;

      console.log('[LoanDetail] handleLoanUpdate called with:', mergedUpdates);
      console.log('[LoanDetail] Previous status:', loan.status);
      console.log('[LoanDetail] New status:', mergedUpdates.status);
      
      const userName = currentUser.first_name && currentUser.last_name
        ? `${currentUser.first_name} ${currentUser.last_name}`
        : currentUser.full_name || currentUser.email;

      const changedFields = Object.keys(mergedUpdates).filter(key => {
        if (key === 'modification_history' || key === 'overridden_fields') return false;
        return JSON.stringify(loan[key]) !== JSON.stringify(mergedUpdates[key]);
      });

      const modificationHistory = loan.modification_history ? [...loan.modification_history] : [];
      modificationHistory.push({
        timestamp: new Date().toISOString(),
        modified_by: currentUser.id,
        modified_by_name: userName,
        description: `Loan updated`,
        fields_changed: changedFields.length > 0 ? changedFields : ['loan_data']
      });

      const dataToUpdate = {
        ...mergedUpdates,
        modification_history: modificationHistory,
        overridden_fields: mergedUpdates.overridden_fields || loan.overridden_fields || []
      };

      if (mergedUpdates.status && mergedUpdates.status !== loan.status) {
        console.log('[LoanDetail] Status changed, checking for profile updates...');
        
        // Check if moving from underwriting to processing
        if (loan.status === 'underwriting' && mergedUpdates.status === 'processing') {
          console.log('[LoanDetail] Moving from underwriting to processing - should show update profiles modal');
          // TODO: Show UpdateProfilesFromLoanModal here
        }
        
        const loanOfficerIds = loan.loan_officer_ids || [];
        if (loanOfficerIds.length > 0) {
          try {
            await base44.functions.invoke('createNotification', {
              user_ids: loanOfficerIds,
              message: `Loan ${loan.loan_number || loan.primary_loan_id} status changed to: ${mergedUpdates.status}`,
              type: 'status_change',
              entity_type: 'Loan',
              entity_id: loan.id,
              link_url: `/LoanDetail?id=${loan.id}`,
              priority: 'high'
            });
          } catch (notifError) {
            console.error('Error creating status change notification:', notifError);
          }
        }
      }

      await base44.entities.Loan.update(loan.id, dataToUpdate);
      setLoan(prevLoan => ({ ...prevLoan, ...dataToUpdate }));

      toast({
        title: "Loan Updated",
        description: "Loan has been updated successfully.",
      });
    } catch (error) {
      console.error("Error updating loan:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update loan.",
      });
      throw error;
    }
  };

  const handleTaskOpened = () => {
    const params = new URLSearchParams(location.search);
    params.delete('openTask');
    const query = params.toString();
    navigate(query ? `${location.pathname}?${query}` : location.pathname, { replace: true });
  };

  if (isLoading || !loan) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="flex">
        {/* Main Content */}
        <div 
          className="flex-1 transition-all duration-300"
          style={{ 
            marginRight: showLoanSidebar ? (sidebarCollapsed ? '64px' : '320px') : '0px',
            width: showLoanSidebar
              ? (sidebarCollapsed ? 'calc(100% - 64px)' : 'calc(100% - 320px)')
              : '100%'
          }}
        >
          <div className="p-6">
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="mb-6">
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-3xl text-slate-900">
                    {loan.loan_number || loan.primary_loan_id || 'Loan Details'}
                  </h1>
                  <LoanStatusBadgeControl
                    loan={loan}
                    currentUser={currentUser}
                    onUpdate={handleLoanUpdate}
                    onRefresh={loadLoan}
                  />
                </div>
              </div>

              <section className="min-w-0 space-y-6" data-tour="loan-tabs">
                {activeTab === 'dashboard' ? (
                  <div className="space-y-6">
                    <LoanSummaryHeader loan={loan} />
                    <LoanStatusProgressCard
                      loan={loan}
                    />
                  </div>
                ) : activeTab === 'details' ? (
                  <LoanOverviewTab 
                    loan={loan} 
                    onUpdate={handleLoanUpdate}
                    currentUser={currentUser}
                    activeSection={activeSection}
                  />
                ) : activeTab === 'documents' ? (
                  <LoanDocumentsTab
                    loan={loan}
                    currentUser={currentUser}
                  />
                ) : activeTab === 'checklist' ? (
                  <LoanChecklistTab
                    loan={loan}
                    onUpdate={handleLoanUpdate}
                    openTaskId={openTask}
                    onTaskOpened={handleTaskOpened}
                  />
                ) : activeTab === 'draws' ? (
                  <LoanDrawsTab
                    loan={loan}
                    onUpdate={handleLoanUpdate}
                    currentUser={currentUser}
                    borrowerAccessIds={borrowerAccessIds}
                  />
                ) : (
                  <LoanDetailPlaceholderView
                    title={activeSubpage.title}
                    description={activeSubpage.description}
                    icon={activeSubpage.icon}
                  />
                )}
              </section>
            </motion.div>
          </div>
        </div>

        {showLoanSidebar && (
          <div 
            data-tour="loan-sidebar"
            className="fixed right-0 transition-all duration-300 bg-white border-l border-slate-200 shadow-lg"
            style={{ 
              width: sidebarCollapsed ? '64px' : '320px',
              top: '64px',
              height: 'calc(100vh - 64px)',
              zIndex: 10
            }}
          >
            <LoanSidebar 
              loan={loan}
              onUpdate={handleLoanUpdate}
              currentUser={currentUser}
              collapsed={sidebarCollapsed}
              onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
              onRefresh={loadLoan}
              allLoanOfficers={allLoanOfficers}
            />
          </div>
        )}
      </div>
    </div>
  );
}
