import React, { useEffect, useMemo, useState } from "react";
import { Borrower, Loan } from "@/entities/all";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { usePermissions } from "@/components/hooks/usePermissions";
import { normalizeAppRole } from "@/components/utils/appRoles";
import { base44 } from "@/api/base44Client";
import { isUserOnLoanTeam } from "@/components/utils/teamAccess";
import { Button } from "@/components/ui/button";
import InviteBorrowerModal from "@/components/dashboard/InviteBorrowerModal";
import { Users } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function MyBorrowers() {
  const { currentUser, permissions, isLoading: permissionsLoading } = usePermissions();
  const [borrowers, setBorrowers] = useState([]);
  const [loans, setLoans] = useState([]);
  const [inviteRequests, setInviteRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [requestsView, setRequestsView] = useState('none');
  const [showInviteBorrowerModal, setShowInviteBorrowerModal] = useState(false);

  const normalizedRole = normalizeAppRole(currentUser?.app_role || currentUser?.role || '');
  const isBroker = normalizedRole === 'Broker';
  const isReferralPartner = normalizedRole === 'Referral Partner';
  const isLiaison = normalizedRole === 'Liaison';
  const isBorrower = normalizedRole === 'Borrower';
  const canView = isBroker || isReferralPartner || isLiaison || isBorrower;

  useEffect(() => {
    if (!permissionsLoading && currentUser && canView) {
      loadData();
    }
    if (!permissionsLoading && !canView) {
      setLoading(false);
    }
  }, [permissionsLoading, currentUser?.id, canView]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [borrowersData, loansData, inviteRequestsData] = await Promise.all([
        Borrower.list('-created_date').catch(() => []),
        Loan.list('-created_date').catch(() => []),
        isBroker
          ? base44.entities.BorrowerInviteRequest.list('-created_date').catch(() => [])
          : Promise.resolve([])
      ]);
      setBorrowers(borrowersData || []);
      setLoans(loansData || []);
      setInviteRequests(inviteRequestsData || []);
    } catch (error) {
      console.error('Error loading borrowers data:', error);
    }
    setLoading(false);
  };

  const handleInviteSubmitted = () => {
    loadData();
  };

  const borrowerMap = useMemo(() => {
    const map = new Map();
    borrowers.forEach((borrower) => {
      if (borrower?.id) map.set(borrower.id, borrower);
      if (borrower?.user_id) map.set(borrower.user_id, borrower);
    });
    return map;
  }, [borrowers]);

  const loansOnTeam = useMemo(() => {
    if (!currentUser) return [];
    return (loans || []).filter((loan) => isUserOnLoanTeam(loan, currentUser, permissions));
  }, [loans, currentUser]);

  const teamBorrowers = useMemo(() => {
    const uniqueBorrowers = new Map();
    loansOnTeam.forEach((loan) => {
      (loan.borrower_ids || []).forEach((id) => {
        const borrower = borrowerMap.get(id);
        if (borrower?.id) {
          uniqueBorrowers.set(borrower.id, borrower);
        }
      });
    });
    return Array.from(uniqueBorrowers.values());
  }, [loansOnTeam, borrowerMap]);

  const brokerRequests = useMemo(() => {
    if (!isBroker) return [];
    return (inviteRequests || []).filter(
      (req) => req.source === 'broker' && req.requested_by_user_id === currentUser?.id
    );
  }, [inviteRequests, isBroker, currentUser?.id]);

  const onboardedBorrowers = useMemo(() => {
    if (!isBroker) return teamBorrowers;
    const invitedOnboarded = (borrowers || []).filter((borrower) => {
      if (borrower.invited_by_user_id !== currentUser?.id) return false;
      if (borrower.invite_request_status === 'rejected') return false;
      return borrower.is_invite_temp !== true;
    });
    const onboardedMap = new Map();
    [...teamBorrowers, ...invitedOnboarded].forEach((borrower) => {
      if (borrower?.id) onboardedMap.set(borrower.id, borrower);
    });
    return Array.from(onboardedMap.values());
  }, [borrowers, currentUser?.id, isBroker, teamBorrowers]);

  const onboardedIds = useMemo(() => new Set(onboardedBorrowers.map((b) => b.id)), [onboardedBorrowers]);

  const invitedRequests = useMemo(() => {
    if (!isBroker) return [];
    return brokerRequests.filter((req) => {
      const status = (req.status || 'pending').toLowerCase();
      if (status === 'rejected') return false;
      if (req.borrower_id && onboardedIds.has(req.borrower_id)) return false;
      return true;
    });
  }, [brokerRequests, isBroker, onboardedIds]);

  const rejectedRequests = useMemo(() => {
    if (!isBroker) return [];
    return brokerRequests.filter((req) => (req.status || '').toLowerCase() === 'rejected');
  }, [brokerRequests, isBroker]);

  const getBorrowerName = (borrower) => {
    if (!borrower) return 'Unknown Borrower';
    const name = [borrower.first_name, borrower.last_name].filter(Boolean).join(' ').trim();
    return name || borrower.email || 'Unknown Borrower';
  };

  const getBorrowerLoanCount = (borrower) => {
    if (!borrower) return 0;
    const ids = [borrower.id, borrower.user_id].filter(Boolean);
    return loansOnTeam.filter((loan) => (loan.borrower_ids || []).some((id) => ids.includes(id))).length;
  };

  const getBorrowerLastActivity = (borrower) => {
    if (!borrower) return null;
    const ids = [borrower.id, borrower.user_id].filter(Boolean);
    const relatedLoans = loansOnTeam.filter((loan) => (loan.borrower_ids || []).some((id) => ids.includes(id)));
    const dates = relatedLoans.map((loan) => loan.updated_date || loan.created_date).filter(Boolean);
    if (!dates.length) return null;
    const mostRecent = new Date(Math.max(...dates.map((d) => new Date(d).getTime()).filter((t) => !isNaN(t))));
    if (isNaN(mostRecent)) return null;
    return mostRecent;
  };

  const normalizeText = (value) => String(value || '').toLowerCase().trim();

  const matchesSearch = (fields) => {
    if (!searchTerm) return true;
    const needle = normalizeText(searchTerm);
    return fields.some((field) => normalizeText(field).includes(needle));
  };

  const filteredOnboardedBorrowers = onboardedBorrowers.filter((borrower) =>
    matchesSearch([getBorrowerName(borrower), borrower.email, borrower.phone])
  );

  const filteredInvitedRequests = invitedRequests.filter((req) =>
    matchesSearch([req.requested_first_name, req.requested_last_name, req.requested_email])
  );

  const filteredRejectedRequests = rejectedRequests.filter((req) =>
    matchesSearch([req.requested_first_name, req.requested_last_name, req.requested_email])
  );

  if (permissionsLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900"></div>
      </div>
    );
  }

  if (!permissions.canViewMyBorrowers || !canView) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
        <div className="max-w-4xl mx-auto">
          <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-lg font-bold text-slate-900">My Borrowers</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-slate-600">
              You do not have permission to view this page.
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between"
        >
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight mb-2">
              My Borrowers
            </h1>
            {isBroker && (
              <p className="text-slate-600">
                Track your invited borrowers and everyone who has onboarded.
              </p>
            )}
          </div>
          {isBroker && (
            <Button
              variant="outline"
              onClick={() => setShowInviteBorrowerModal(true)}
              className="border-slate-300 hover:bg-slate-50"
            >
              <Users className="w-4 h-4 mr-2" />
              Invite Borrower
            </Button>
          )}
        </motion.div>

        <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
          <CardContent className="p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex-1">
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search borrowers by name, email, or phone"
                />
              </div>
              {isBroker && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={requestsView === 'invited' ? "default" : "outline"}
                    onClick={() => setRequestsView(requestsView === 'invited' ? 'none' : 'invited')}
                  >
                    View Invite Requests
                  </Button>
                  <Button
                    variant={requestsView === 'rejected' ? "default" : "outline"}
                    onClick={() => setRequestsView(requestsView === 'rejected' ? 'none' : 'rejected')}
                  >
                    View Rejected Invite Requests
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
          <CardContent className="p-4">
            {(() => {
              const list = filteredOnboardedBorrowers;
              if (!list.length) {
                return <div className="text-sm text-slate-500">No borrowers found.</div>;
              }

              return (
                <div className="divide-y divide-slate-200" data-tour="borrowers-table">
                  <div className="grid grid-cols-1 gap-2 px-2 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 md:grid-cols-12">
                    <div className="md:col-span-4">Borrower</div>
                    <div className="md:col-span-3">Email</div>
                    <div className="md:col-span-2">Phone</div>
                    <div className="md:col-span-1">Loans</div>
                    <div className="md:col-span-2">Last Activity</div>
                  </div>
                  {list.map((borrower) => {
                    const lastActivity = getBorrowerLastActivity(borrower);
                    return (
                      <div
                        key={borrower.id}
                        className="grid grid-cols-1 gap-2 px-2 py-3 text-sm text-slate-700 hover:bg-slate-50 md:grid-cols-12"
                      >
                        <div className="font-medium text-slate-900 md:col-span-4">
                          {getBorrowerName(borrower)}
                        </div>
                        <div className="md:col-span-3">
                          {borrower.email || '-'}
                        </div>
                        <div className="md:col-span-2">
                          {borrower.phone || '-'}
                        </div>
                        <div className="md:col-span-1">
                          {getBorrowerLoanCount(borrower)}
                        </div>
                        <div className="md:col-span-2">
                          {lastActivity ? format(lastActivity, 'MMM d, yyyy') : 'N/A'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </CardContent>
        </Card>

        {isBroker && requestsView !== 'none' && (
          <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
            <CardHeader className="border-b border-slate-100">
              <CardTitle className="text-lg font-bold text-slate-900">
                {requestsView === 'invited' ? "Invite Requests" : "Rejected Invite Requests Archive"}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {requestsView === 'invited' ? (
                filteredInvitedRequests.length ? (
                  <Table data-tour="borrower-invite-requests">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Borrower</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Invited On</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredInvitedRequests.map((req) => {
                        const displayName = `${req.requested_first_name || ''} ${req.requested_last_name || ''}`.trim() || req.requested_email || 'Unknown';
                        const status = (req.status || 'pending').toLowerCase();
                        return (
                          <TableRow key={req.id} className="hover:bg-slate-50">
                            <TableCell className="px-2 py-3 font-medium text-slate-900">
                              {displayName}
                            </TableCell>
                            <TableCell className="px-2 py-3 text-slate-700">
                              {req.requested_email || '-'}
                            </TableCell>
                            <TableCell className="px-2 py-3 text-slate-700 capitalize">
                              {status}
                            </TableCell>
                            <TableCell className="px-2 py-3 text-slate-700">
                              {req.created_date ? format(new Date(req.created_date), 'MMM d, yyyy') : 'N/A'}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-sm text-slate-500">No invite requests found.</div>
                )
              ) : filteredRejectedRequests.length ? (
                <Table data-tour="borrower-rejected-requests">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Borrower</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Rejected On</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRejectedRequests.map((req) => {
                      const displayName = `${req.requested_first_name || ''} ${req.requested_last_name || ''}`.trim() || req.requested_email || 'Unknown';
                      return (
                        <TableRow key={req.id} className="hover:bg-slate-50">
                          <TableCell className="px-2 py-3 font-medium text-slate-900">
                            {displayName}
                          </TableCell>
                          <TableCell className="px-2 py-3 text-slate-700">
                            {req.requested_email || '-'}
                          </TableCell>
                          <TableCell className="px-2 py-3 text-slate-700">
                            {req.rejected_at ? format(new Date(req.rejected_at), 'MMM d, yyyy') : 'N/A'}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-sm text-slate-500">No rejected invite requests found.</div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
      <InviteBorrowerModal
        isOpen={showInviteBorrowerModal}
        onClose={() => setShowInviteBorrowerModal(false)}
        onInviteSubmitted={handleInviteSubmitted}
      />
    </div>
  );
}