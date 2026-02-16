import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Loan, LoanDocument } from "@/entities/all";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, FileText, CheckSquare, Folder, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";
import { createPageUrl } from "@/utils";
import { useToast } from "@/components/ui/use-toast";
import { base44 } from "@/api/base44Client";

import LoanOverviewTab from "../components/loan-detail/LoanOverviewTab";
import LoanDocumentsTab from "../components/loan-detail/LoanDocumentsTab";
import LoanChecklistTab from "../components/loan-detail/LoanChecklistTab";
import LoanDrawsTab from "../components/loan-detail/LoanDrawsTab";
import LoanSidebar from "../components/loan-detail/LoanSidebar";
import LoanSummaryHeader from "../components/loan-detail/LoanSummaryHeader";


export default function LoanDetail() {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loan, setLoan] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [allLoanOfficers, setAllLoanOfficers] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [openTaskId, setOpenTaskId] = useState(null);
  const [isLoanPartner, setIsLoanPartner] = useState(false);

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
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const taskId = params.get('openTask');
    if (taskId) {
      setActiveTab('checklist');
      setOpenTaskId(taskId);
    }
  }, [location.search]);

  const loadLoan = async () => {
    setIsLoading(true);
    try {
      const user = await base44.auth.me();
      setCurrentUser(user);
      setIsLoanPartner(['Referrer', 'Broker', 'Title Company'].includes(user.app_role));

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

      const params = new URLSearchParams(location.search);
      const loanId = params.get('id');

      if (!loanId) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Loan ID is missing.",
        });
        navigate(createPageUrl("Loans"));
        return;
      }

      const loanData = await Loan.get(loanId);

      if (!loanData) {
        toast({
          variant: "destructive",
          title: "Loan Not Found",
          description: "The requested loan could not be found.",
        });
        navigate(createPageUrl("Loans"));
        return;
      }

      const canViewLoan = 
        user.role === 'admin' || 
        user.app_role === 'Administrator' ||
        user.app_role === 'Loan Officer' ||
        loanData.borrower_ids?.includes(user.id) ||
        loanData.liaison_ids?.includes(user.id) ||
        loanData.referrer_ids?.includes(user.id);

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

      const loanDocuments = await LoanDocument.filter({ loan_id: loanId });
      setDocuments(loanDocuments || []);
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

      await Loan.update(loan.id, dataToUpdate);
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
    }
  };

  const handleSaveLoan = async () => {
    if (!hasUnsavedChanges) return;
    
    setIsSaving(true);
    try {
      await handleLoanUpdate(loan);
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Error saving loan:', error);
    }
    setIsSaving(false);
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

              {/* Summary Header */}
              <div className="mb-6">
                <LoanSummaryHeader loan={loan} />
              </div>

              <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <TabsList data-tour="loan-tabs" className={isLoanPartner ? "grid w-full grid-cols-1 lg:w-auto lg:inline-grid" : "grid w-full grid-cols-4 lg:w-auto lg:inline-grid"}>
                  <TabsTrigger value="overview" className="flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Overview
                  </TabsTrigger>
                  {!isLoanPartner && (
                    <>
                      <TabsTrigger value="documents" className="flex items-center gap-2">
                        <Folder className="w-4 h-4" />
                        Documents
                      </TabsTrigger>
                      <TabsTrigger value="checklist" className="flex items-center gap-2">
                        <CheckSquare className="w-4 h-4" />
                        Checklist
                      </TabsTrigger>
                      <TabsTrigger value="draws" className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4" />
                        Draws
                      </TabsTrigger>
                    </>
                  )}
                </TabsList>

                <TabsContent value="overview" className="space-y-6">
                  <LoanOverviewTab 
                    loan={loan} 
                    onUpdate={handleLoanUpdate}
                    currentUser={currentUser}
                    allLoanOfficers={allLoanOfficers}
                    onLoanChange={() => setHasUnsavedChanges(true)}
                  />
                </TabsContent>

                {!isLoanPartner && (
                  <>
                    <TabsContent value="documents" className="space-y-6">
                      <LoanDocumentsTab 
                        loanId={loan.id}
                        documents={documents}
                        onDocumentsChange={loadLoan}
                        currentUser={currentUser}
                      />
                    </TabsContent>

                    <TabsContent value="checklist" className="space-y-6">
                      <LoanChecklistTab 
                        loan={loan}
                        onUpdate={handleLoanUpdate}
                        openTaskId={openTaskId}
                        onTaskOpened={() => setOpenTaskId(null)}
                      />
                    </TabsContent>

                    <TabsContent value="draws" className="space-y-6">
                      <LoanDrawsTab 
                        loan={loan}
                        onUpdate={handleLoanUpdate}
                        currentUser={currentUser}
                      />
                    </TabsContent>
                    
                  </>
                )}
              </Tabs>
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
