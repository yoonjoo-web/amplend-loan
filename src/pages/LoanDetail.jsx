import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
import { createPageUrl } from "@/utils";
import { useToast } from "@/components/ui/use-toast";
import { base44 } from "@/api/base44Client";
import { getBorrowerAccessIds } from "@/components/utils/borrowerAccess";
import { getLoanPartnerAccessIds } from "@/components/utils/loanPartnerAccess";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import LoanOverviewTab from "../components/loan-detail/LoanOverviewTab";
import LoanSidebar from "../components/loan-detail/LoanSidebar";
import LoanSummaryHeader from "../components/loan-detail/LoanSummaryHeader";
import LoanDetailPlaceholderView from "../components/loan-detail/LoanDetailPlaceholderView";
import {
  DEFAULT_LOAN_DETAIL_TAB,
  getLoanDetailSubpage,
  getLoanDetailTabUrl,
  isValidLoanDetailTab,
  loanDetailSubpages,
} from "../components/loan-detail/loanDetailSubpages";


export default function LoanDetail() {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const searchParams = new URLSearchParams(location.search);
  const loanId = searchParams.get('id');
  const requestedTab = searchParams.get('tab');
  const openTask = searchParams.get('openTask');
  const fallbackTab = openTask ? 'checklist' : DEFAULT_LOAN_DETAIL_TAB;
  const activeTab = isValidLoanDetailTab(requestedTab) ? requestedTab : fallbackTab;
  const activeSubpage = getLoanDetailSubpage(activeTab);
  const [loan, setLoan] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [allLoanOfficers, setAllLoanOfficers] = useState([]);

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
    if (!loanId) {
      return;
    }

    if (requestedTab !== activeTab) {
      navigate(getLoanDetailTabUrl(loanId, activeTab, openTask ? { openTask } : {}), {
        replace: true,
      });
    }
  }, [activeTab, loanId, navigate, openTask, requestedTab]);

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
            marginRight: sidebarCollapsed ? '64px' : '320px',
            width: sidebarCollapsed ? 'calc(100% - 64px)' : 'calc(100% - 320px)'
          }}
        >
          <div className="p-6">
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="mb-6">
                <Button
                  variant="outline"
                  onClick={() => navigate(createPageUrl("Loans"))}
                  className="flex items-center gap-2 mb-4"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Loans
                </Button>
                
                <h1 className="text-3xl font-bold text-slate-900">
                  {loan.loan_number || loan.primary_loan_id || 'Loan Details'}
                </h1>
              </div>

              <div className="grid gap-6 xl:grid-cols-[249px_minmax(0,1fr)]">
                <aside>
                  <Card className="overflow-hidden border-0 bg-white/90 shadow-xl shadow-slate-200/70 backdrop-blur-sm">
                    <div className="border-b border-slate-100 px-5 py-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                        Loan Workspace
                      </p>
                      <p className="mt-1 text-lg font-semibold text-slate-900">
                        {loan.loan_number || loan.primary_loan_id || 'Loan'}
                      </p>
                    </div>

                    <div className="p-3" data-tour="loan-tabs">
                      {loanDetailSubpages.map((subpage) => {
                        const Icon = subpage.icon;
                        const isActive = subpage.key === activeTab;

                        return (
                          <button
                            key={subpage.key}
                            type="button"
                            onClick={() => navigate(getLoanDetailTabUrl(loan.id, subpage.key, openTask ? { openTask } : {}))}
                            className={cn(
                              "flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-[15px] font-medium transition-all",
                              isActive
                                ? "bg-slate-700 text-white shadow-lg shadow-slate-300/80"
                                : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                            )}
                          >
                            <Icon className={cn("h-5 w-5", isActive ? "text-white" : "text-slate-900")} />
                            <span>{subpage.title}</span>
                          </button>
                        );
                      })}
                    </div>
                  </Card>
                </aside>

                <section className="min-w-0 space-y-6">
                  {activeTab === 'overview' ? (
                    <>
                      <div>
                        <LoanSummaryHeader loan={loan} />
                      </div>
                      <LoanOverviewTab 
                        loan={loan} 
                        onUpdate={handleLoanUpdate}
                        currentUser={currentUser}
                        allLoanOfficers={allLoanOfficers}
                        onLoanChange={() => {}}
                      />
                    </>
                  ) : (
                    <LoanDetailPlaceholderView
                      title={activeSubpage.title}
                      description={activeSubpage.description}
                      icon={activeSubpage.icon}
                    />
                  )}
                </section>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Sidebar */}
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
      </div>
    </div>
  );
}
