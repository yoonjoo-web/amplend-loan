import React, { useState, useEffect } from "react";
import { Loan, LoanApplication, ChecklistItem } from "@/entities/all";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Plus,
  ArrowRight,
  CheckSquare,
  Clock,
  Users,
  Calendar
} from "lucide-react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format, formatDistanceToNow } from "date-fns";
import InviteBorrowerModal from "../components/dashboard/InviteBorrowerModal";
import InviteTeamModal from "../components/dashboard/InviteTeamModal";
import InviteLoanPartnerModal from "../components/dashboard/InviteLoanPartnerModal";
import BorrowerInviteRequests from "../components/shared/BorrowerInviteRequests";
import PrivateTicketsWidget from "../components/dashboard/PrivateTicketsWidget";
import { useToast } from "@/components/ui/use-toast";
import { usePermissions } from "@/components/hooks/usePermissions";
import { normalizeAppRole } from "@/components/utils/appRoles";
import { base44 } from "@/api/base44Client";
import { isUserOnApplicationTeam, isUserOnLoanTeam } from "@/components/utils/teamAccess";

const statusColors = {
  pending: "bg-amber-100 text-amber-800",
  active: "bg-blue-100 text-blue-800",
  approved: "bg-emerald-100 text-emerald-800",
  draft: "bg-slate-100 text-slate-800",
  submitted: "bg-purple-100 text-purple-800",
  under_review: "bg-orange-100 text-orange-800",
  not_started: "bg-slate-100 text-slate-800",
  in_progress: "bg-blue-100 text-blue-800",
  completed: "bg-emerald-100 text-emerald-800",
  flagged: "bg-red-100 text-red-800",
  application_submitted: 'bg-blue-100 text-blue-800',
  underwriting: 'bg-purple-100 text-purple-800',
  processing: 'bg-amber-100 text-amber-800',
  on_hold: 'bg-slate-100 text-slate-800',
  preclosed_review: 'bg-sky-100 text-sky-800',
  term_sheet_sent: 'bg-cyan-100 text-cyan-800',
  conditional_approval: 'bg-yellow-100 text-yellow-800',
  final_approval: 'bg-emerald-100 text-emerald-800',
  clear_to_close: 'bg-green-100 text-green-800',
  closing_scheduled: 'bg-teal-100 text-teal-800',
  loan_funded: 'bg-indigo-100 text-indigo-800',
  loan_sold: 'bg-violet-100 text-violet-800',
  in_house_servicing: 'bg-blue-100 text-blue-800',
  draws_underway: 'bg-orange-100 text-orange-800',
  draws_fully_released: 'bg-lime-100 text-lime-800',
  archived: 'bg-gray-100 text-gray-800',
  dead: 'bg-gray-100 text-gray-800'
};

const STATUS_DESCRIPTIONS = {
  application_submitted: "Application Submitted",
  underwriting: "Underwriting",
  processing: "Processing",
  on_hold: "On Hold",
  preclosed_review: "Preclosed Review",
  term_sheet_sent: "Term Sheet Sent (Post-Appraisal)",
  conditional_approval: "Conditional Approval",
  final_approval: "Final Approval",
  clear_to_close: "Clear to Close (CTC)",
  closing_scheduled: "Closing Scheduled",
  loan_funded: "Loan Funded",
  loan_sold: "Loan Sold",
  in_house_servicing: "In-House Servicing",
  draws_underway: "Draws Underway",
  draws_fully_released: "Draws Fully Released",
  archived: "Archived",
  dead: "Dead"
};

const LoanApplicationItem = ({ item, type }) => {
  const isLoan = type === 'loan';

  const formatLoanStatus = (status) => {
    if (isLoan && STATUS_DESCRIPTIONS[status]) {
      return STATUS_DESCRIPTIONS[status];
    }
    return status ? status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'N/A';
  };

  return (
    <Link
      to={isLoan ? createPageUrl("LoanDetail") + `?id=${item.id}` : createPageUrl("NewApplication") + `?id=${item.id}&action=view`}
      className="block hover:bg-slate-50 p-4 rounded-lg transition-colors border border-slate-100"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-xs font-mono text-slate-500">
              {isLoan ? item.loan_number : item.application_number}
            </span>
            {item.status && (
              <Badge className={`${statusColors[item.status]} text-xs font-medium`}>
                {formatLoanStatus(item.status)}
              </Badge>
            )}
          </div>
          <div className="space-y-1">
            <p className="font-medium text-slate-900">
              {isLoan
                ? item.borrower_entity_name || 'Loan'
                : `${item.borrower_first_name || ''} ${item.borrower_last_name || ''}`.trim() || 'Application'}
            </p>
            <p className="text-slate-600 text-base font-medium">
              {isLoan
                ? [item.property_address, item.property_city, item.property_state].filter(Boolean).join(', ') || 'No property address'
                : [item.property_address_street, item.property_address_city, item.property_address_state].filter(Boolean).join(', ') || 'No property address'}
            </p>
          </div>
          {item.created_date && (
            <p className="text-xs text-slate-400 mt-2">
              Started: {format(new Date(item.created_date), 'MMM d, yyyy')}
            </p>
          )}
        </div>
        <ArrowRight className="w-4 h-4 text-slate-400 mt-1 flex-shrink-0" />
      </div>
    </Link>
  );
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { currentUser, permissions, isLoading: permissionsLoading } = usePermissions();
  
  const [activeLoans, setActiveLoans] = useState([]);
  const [activeApplications, setActiveApplications] = useState([]);
  const [myTasks, setMyTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInviteBorrowerModal, setShowInviteBorrowerModal] = useState(false);
  const [showInviteTeamModal, setShowInviteTeamModal] = useState(false);
  const [showInviteLoanPartnerModal, setShowInviteLoanPartnerModal] = useState(false);
  const [myBorrowersSummary, setMyBorrowersSummary] = useState(null);
  const isStaffUser = permissions.isPlatformAdmin || permissions.isAdministrator || permissions.isLoanOfficer;
  const canShowQuickActions = isStaffUser || permissions.isBroker;


  useEffect(() => {
    if (!permissionsLoading && currentUser) {
      loadDashboardData();
    }
  }, [permissionsLoading, currentUser]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // First load loans and applications
      const [loansData, applications] = await Promise.all([
        Loan.list('-created_date'),
        LoanApplication.list('-created_date')
      ]);
      
      const loans = loansData || [];
      console.log('[Dashboard] All loans loaded:', loans.length);

      const borrowerAccessIds = permissions.borrowerAccessIds || [currentUser.id];

      // Filter loans based on user role
      let userLoans = loans;
      if (permissions.isLoanOfficer) {
        userLoans = loans.filter(l => l.loan_officer_ids?.includes(currentUser.id));
      } else if (permissions.isBorrower) {
        if (permissions.isBorrowerLiaison) {
          userLoans = loans.filter((l) => isUserOnLoanTeam(l, currentUser, permissions));
        } else {
          userLoans = loans.filter(l => l.borrower_ids?.some((id) => borrowerAccessIds.includes(id)));
        }
      } else if (permissions.isLoanPartner) {
        userLoans = loans.filter((l) => isUserOnLoanTeam(l, currentUser, permissions));
      }

      const userRecentLoans = userLoans.slice(0, 5);
      setActiveLoans(userRecentLoans);

      // Filter applications based on user role
      let userApps = applications || [];
      if (permissions.isLoanOfficer) {
        userApps = userApps.filter(a => a.assigned_loan_officer_id === currentUser.id);
      } else if (permissions.isBorrower) {
        if (permissions.isBorrowerLiaison) {
          userApps = userApps.filter((a) => isUserOnApplicationTeam(a, currentUser, permissions));
        } else {
          userApps = userApps.filter(a => {
            const isPrimary = borrowerAccessIds.includes(a.primary_borrower_id);
            const isCoBorrower = a.co_borrowers && a.co_borrowers.some(cb =>
              borrowerAccessIds.includes(cb.user_id) || borrowerAccessIds.includes(cb.borrower_id)
            );
            return isPrimary || isCoBorrower;
          });
        }
      } else if (permissions.isLoanPartner) {
        userApps = userApps.filter((a) => isUserOnApplicationTeam(a, currentUser, permissions));
      }

      const userRecentApps = userApps.slice(0, 5);
      setActiveApplications(userRecentApps);

      // Get loan IDs for user's loans to fetch tasks
      const userLoanIds = userLoans.map(l => l.id);
      console.log('[Dashboard] User loan IDs:', userLoanIds.length);

      // Load tasks only for user's loans
      let allTasks = [];
      if (userLoanIds.length > 0) {
        const taskPromises = userLoanIds.map(loanId => 
          ChecklistItem.filter({ loan_id: loanId })
        );
        const taskResults = await Promise.all(taskPromises);
        allTasks = taskResults.flat();
      }
      console.log('[Dashboard] Tasks from user loans:', allTasks.length);
      
      // Filter tasks assigned to current user (exclude completed, approved, approved_with_condition, rejected)
      const excludedStatuses = ['completed', 'approved', 'approved_with_condition', 'rejected'];
      const userTasks = allTasks.filter(task => {
        if (!task.assigned_to) return false;
        if (excludedStatuses.includes(task.status)) return false;
        const assignedTo = Array.isArray(task.assigned_to) ? task.assigned_to : [task.assigned_to];
        return assignedTo.includes(currentUser.id);
      });
      
      console.log('[Dashboard] Filtered tasks assigned to user:', userTasks.length);
      
      // Enrich tasks with loan number
      const enrichedTasks = userTasks.map(task => {
        if (!task.loan_number && task.loan_id) {
          const loan = loans.find(l => l.id === task.loan_id);
          if (loan) {
            return { ...task, loan_number: loan.loan_number };
          }
        }
        return task;
      }).slice(0, 10);
      
      setMyTasks(enrichedTasks);

      // My Borrowers summary for broker/referral partner (exclude liaison)
      const normalizedRole = normalizeAppRole(currentUser?.app_role || currentUser?.role || '');
      const canViewMyBorrowersSummary = ['Broker', 'Referral Partner'].includes(normalizedRole);
      if (canViewMyBorrowersSummary) {
        const [borrowersData, inviteRequestsData] = await Promise.all([
          base44.entities.Borrower.list().catch(() => []),
          normalizedRole === 'Broker'
            ? base44.entities.BorrowerInviteRequest.list('-created_date').catch(() => [])
            : Promise.resolve([])
        ]);

        const loansOnTeam = loans.filter((loan) => isUserOnLoanTeam(loan, currentUser, permissions));
        const borrowerIdSet = new Set();
        loansOnTeam.forEach((loan) => {
          (loan.borrower_ids || []).forEach((id) => borrowerIdSet.add(id));
        });

        const borrowerMap = new Map();
        borrowersData.forEach((borrower) => {
          if (borrower?.id) borrowerMap.set(borrower.id, borrower);
          if (borrower?.user_id) borrowerMap.set(borrower.user_id, borrower);
        });

        const teamBorrowers = Array.from(borrowerIdSet)
          .map((id) => borrowerMap.get(id))
          .filter(Boolean)
          .filter((borrower, index, arr) => arr.findIndex((b) => b.id === borrower.id) === index);

        if (normalizedRole === 'Broker') {
          const brokerRequests = (inviteRequestsData || []).filter(
            (req) => req.source === 'broker' && req.requested_by_user_id === currentUser?.id
          );

          const invitedOnboarded = (borrowersData || []).filter((borrower) => {
            if (borrower.invited_by_user_id !== currentUser?.id) return false;
            if (borrower.invite_request_status === 'rejected') return false;
            return borrower.is_invite_temp !== true;
          });

          const onboardedMap = new Map();
          [...teamBorrowers, ...invitedOnboarded].forEach((borrower) => {
            if (borrower?.id) onboardedMap.set(borrower.id, borrower);
          });
          const onboardedBorrowers = Array.from(onboardedMap.values());
          const onboardedIds = new Set(onboardedBorrowers.map((b) => b.id));

          const invitedRequests = brokerRequests.filter((req) => {
            const status = (req.status || 'pending').toLowerCase();
            if (status === 'rejected') return false;
            if (req.borrower_id && onboardedIds.has(req.borrower_id)) return false;
            return true;
          });

          const rejectedRequests = brokerRequests.filter(
            (req) => (req.status || '').toLowerCase() === 'rejected'
          );

          setMyBorrowersSummary({
            role: normalizedRole,
            total: onboardedBorrowers.length,
            invited: invitedRequests.length,
            rejected: rejectedRequests.length,
          });
        } else {
          setMyBorrowersSummary({
            role: normalizedRole,
            total: teamBorrowers.length,
          });
        }
      } else {
        setMyBorrowersSummary(null);
      }

    } catch (error) {
      console.error('Error loading dashboard data:', error);
    }
    setLoading(false);
  };

  const getStatusColor = (status) => {
    return statusColors[status] || "bg-slate-100 text-slate-800";
  };

  const formatStatus = (status) => {
    return status ? status.replace(/_/g, ' ') : '';
  };

  const getLastUpdateInfo = (item) => {
    const dates = [];

    if (item.updated_date) {
      dates.push(new Date(item.updated_date));
    }

    if (item.notes && item.notes.length > 0) {
      const lastNote = item.notes[item.notes.length - 1];
      if (lastNote && lastNote.timestamp) {
        dates.push(new Date(lastNote.timestamp));
      }
    }

    if (item.uploaded_files && item.uploaded_files.length > 0) {
      const lastFile = item.uploaded_files[item.uploaded_files.length - 1];
      if (lastFile && lastFile.uploaded_date) {
        dates.push(new Date(lastFile.uploaded_date));
      }
    }

    if (dates.length === 0) return 'never';

    const validDates = dates.filter(d => !isNaN(d));
    if (validDates.length === 0) return 'never';

    const mostRecent = new Date(Math.max(...validDates));
    return formatDistanceToNow(mostRecent, { addSuffix: true });
  };

  const handleInviteSubmitted = () => {
    toast({
      title: "Invitation Sent!",
      description: "Your invitation has been successfully sent.",
    });
  };

  const handleNewApplication = async () => {
    if (!permissions.canCreateApplication) {
      toast({
        variant: "destructive",
        title: "Permission Denied",
        description: "You do not have permission to create new applications."
      });
      return;
    }

    try {
      const appNumber = `APP-${Date.now()}`;

      const applicationData = {
        application_number: appNumber,
        status: 'draft',
        current_step: 1,
        borrower_type: 'individual',
        has_coborrowers: 'no'
      };

      if (permissions.isBorrower) {
        applicationData.primary_borrower_id = currentUser.id;
      }

      const response = await base44.functions.invoke('createLoanApplication', {
        application_data: applicationData
      });
      const newApp = response?.data?.application || response?.application;
      if (!newApp?.id) {
        throw new Error('Failed to create application.');
      }
      navigate(createPageUrl("NewApplication") + `?id=${newApp.id}`);
    } catch (error) {
      console.error('Error creating application:', error);
      toast({
        variant: "destructive",
        title: "Failed to Create Application",
        description: "An error occurred while creating the application. Please try again."
      });
    }
  };

  if (permissionsLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900"></div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight mb-2">
            Welcome back, {currentUser?.first_name || currentUser?.full_name || 'User'}!
          </h1>
        </motion.div>

        {/* Quick Actions */}
        {canShowQuickActions && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="flex gap-3"
            data-tour="quick-actions"
          >
            <Button className="bg-slate-700 hover:bg-slate-800" onClick={handleNewApplication}>
              <Plus className="w-4 h-4 mr-2" />
              New Application
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowInviteBorrowerModal(true)}
              className="border-slate-300 hover:bg-slate-50"
            >
              <Users className="w-4 h-4 mr-2" />
              Invite Borrower
            </Button>
            {isStaffUser && (
              <Button
                variant="outline"
                onClick={() => setShowInviteTeamModal(true)}
                className="border-emerald-300 hover:bg-emerald-50"
              >
                <Users className="w-4 h-4 mr-2" />
                Invite Team
              </Button>
            )}
            {isStaffUser && (
              <Button
                variant="outline"
                onClick={() => setShowInviteLoanPartnerModal(true)}
                className="border-amber-300 hover:bg-amber-50"
              >
                <Users className="w-4 h-4 mr-2" />
                Invite Loan Partner
              </Button>
            )}
          </motion.div>
        )}

        {/* Borrower Invite Requests */}

        {/* My Borrowers Summary */}
        {myBorrowersSummary && myBorrowersSummary.role !== 'Broker' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.05 }}
          >
            <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
              <CardHeader className="border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-bold text-slate-900">
                    My Borrowers
                  </CardTitle>
                  <Link to={createPageUrl("MyBorrowers")}>
                    <Button variant="ghost" size="sm">
                      View All
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <p className="text-2xl font-bold text-slate-900">{myBorrowersSummary.total}</p>
                  <p className="text-sm text-slate-600 mt-1">Borrowers on Your Team</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Combined Stats */}
        <div className="bg-white rounded-xl shadow-lg p-6 border border-slate-200" data-tour="stats">
          <div className="flex items-center justify-around">
            <div className="text-center">
              <p className="text-3xl font-bold text-slate-900">{activeLoans.length}</p>
              <p className="text-slate-600 mt-1 text-base">Active Loans</p>
            </div>
            <div className="h-12 w-px bg-slate-200"></div>
            <div className="text-center">
              <p className="text-3xl font-bold text-slate-900">{activeApplications.length}</p>
              <p className="text-slate-600 mt-1 text-base">Active Applications</p>
            </div>
          </div>
        </div>

        {/* Private Tickets Widget - Only for Loan Officers */}
        {currentUser?.app_role === 'Loan Officer' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.05 }}
          >
            <PrivateTicketsWidget currentUser={currentUser} />
          </motion.div>
        )}

        {/* Recent Activity and Tasks */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" data-tour="recent-loans">
          {/* Your Loans */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm h-full">
              <CardHeader className="border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-bold text-slate-900">
                    Your Loans
                  </CardTitle>
                  <Link to={createPageUrl("Loans")}>
                    <Button variant="ghost" size="sm">
                      View All
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                {activeLoans.length > 0 ? (
                  <div className="space-y-3">
                    {activeLoans.map((loan) => (
                      <LoanApplicationItem key={loan.id} item={loan} type="loan" />
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-slate-500">
                    <FileText className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                    <p className="text-sm">No active loans</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Your Applications */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
          >
            <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm h-full">
              <CardHeader className="border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-bold text-slate-900">
                    Your Applications
                  </CardTitle>
                  <Link to={createPageUrl("Applications")}>
                    <Button variant="ghost" size="sm">
                      View All
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                {activeApplications.length > 0 ? (
                  <div className="space-y-3">
                    {activeApplications.map((app) => (
                      <LoanApplicationItem key={app.id} item={app} type="application" />
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-slate-500">
                    <Clock className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                    <p className="text-sm">No active applications</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Right Column - My Tasks */}
          <div className="lg:col-span-1">
            <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm h-full">
              <CardHeader className="border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-lg font-bold text-slate-900">
                    <CheckSquare className="w-5 h-5 text-slate-600" />
                    My Tasks
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(createPageUrl('MyTasks'))}
                  >
                    View All
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                {myTasks.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <CheckSquare className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                    <p className="text-sm">No tasks assigned</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {myTasks.slice(0, 5).map((task) => (
                      <div
                        key={task.id}
                        className="p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer border border-slate-200"
                        onClick={() => {
                          navigate(createPageUrl('LoanDetail') + `?id=${task.loan_id}`);
                        }}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-medium text-sm text-slate-900 flex-1">
                            {task.item_name}
                          </h4>
                          <Badge className={`${getStatusColor(task.status)} text-xs font-medium`}>
                            {formatStatus(task.status)}
                          </Badge>
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs text-slate-600">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-slate-400" />
                              Due: {task.due_date ? format(new Date(task.due_date), 'MMM d') : 'N/A'}
                            </span>
                            <span className="text-slate-500">
                              Updated {getLastUpdateInfo(task)}
                            </span>
                          </div>

                          {task.loan_number && (
                            <p className="text-xs text-slate-500 mt-1">
                              Loan: {task.loan_number}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Modals */}
      <InviteBorrowerModal
        isOpen={showInviteBorrowerModal}
        onClose={() => setShowInviteBorrowerModal(false)}
        onInviteSubmitted={handleInviteSubmitted}
      />

      <InviteTeamModal
        isOpen={showInviteTeamModal}
        onClose={() => setShowInviteTeamModal(false)}
        onInviteSubmitted={handleInviteSubmitted}
      />

      <InviteLoanPartnerModal
        isOpen={showInviteLoanPartnerModal}
        onClose={() => setShowInviteLoanPartnerModal(false)}
        onInviteSubmitted={handleInviteSubmitted}
      />
      </div>
    </>
  );
}
