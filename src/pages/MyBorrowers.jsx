import React, { useEffect, useMemo, useState } from "react";
import { Borrower, Loan } from "@/entities/all";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { usePermissions } from "@/components/hooks/usePermissions";
import { normalizeAppRole } from "@/components/utils/appRoles";
import { base44 } from "@/api/base44Client";
import { isUserOnLoanTeam } from "@/components/utils/teamAccess";

const INVITE_STATUS_COLORS = {
  pending: "bg-amber-100 text-amber-800 border-amber-200",
  sent: "bg-blue-100 text-blue-800 border-blue-200",
  rejected: "bg-red-100 text-red-800 border-red-200",
};

export default function MyBorrowers() {
  const { currentUser, permissions, isLoading: permissionsLoading } = usePermissions();
  const [borrowers, setBorrowers] = useState([]);
  const [loans, setLoans] = useState([]);
  const [inviteRequests, setInviteRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [listFilter, setListFilter] = useState('all');

  const normalizedRole = normalizeAppRole(currentUser?.app_role || currentUser?.role || '');
  const isBroker = normalizedRole === 'Broker';
  const isReferralPartner = normalizedRole === 'Referral Partner';
  const isLiaison = normalizedRole === 'Liaison';
  const canView = isBroker || isReferralPartner || isLiaison;

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
    return (loans || []).filter((loan) => isUserOnLoanTeam(loan, currentUser));
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
        >
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight mb-2">
            My Borrowers
          </h1>
          <p className="text-slate-600">
            {isBroker
              ? "Track your invited borrowers and everyone who has onboarded."
              : "Borrowers who are on loans where you are part of the team."}
          </p>
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
                <div className="w-full md:w-56">
                  <Select value={listFilter} onValueChange={setListFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Filter list" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Lists</SelectItem>
                      <SelectItem value="onboarded">Onboarded</SelectItem>
                      <SelectItem value="invited">Invited</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
          <CardHeader className="border-b border-slate-100">
            <CardTitle className="text-lg font-bold text-slate-900">
              {isBroker ? "All Borrowers" : "Borrowers on Your Team"}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {(() => {
              if (!isBroker) {
                const list = filteredOnboardedBorrowers;
                if (!list.length) {
                  return <div className="text-sm text-slate-500">No borrowers found.</div>;
                }
                return (
                  <div className="space-y-3">
                    {list.map((borrower) => {
                      const lastActivity = getBorrowerLastActivity(borrower);
                      return (
                        <div key={borrower.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="text-base font-semibold text-slate-900">{getBorrowerName(borrower)}</p>
                              <p className="text-sm text-slate-600">{borrower.email || '-'}</p>
                              <p className="text-sm text-slate-500">{borrower.phone || '-'}</p>
                            </div>
                          </div>
                          <div className="mt-3 text-xs text-slate-500 space-y-1">
                            <p>Loans: {getBorrowerLoanCount(borrower)}</p>
                            <p>
                              Last activity: {lastActivity ? format(lastActivity, 'MMM d, yyyy') : 'N/A'}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              }

              const items = [
                ...(listFilter === 'all' || listFilter === 'onboarded'
                  ? filteredOnboardedBorrowers.map((borrower) => ({
                      key: borrower.id,
                      type: 'onboarded',
                      borrower,
                    }))
                  : []),
                ...(listFilter === 'all' || listFilter === 'invited'
                  ? filteredInvitedRequests.map((req) => ({
                      key: req.id,
                      type: 'invited',
                      request: req,
                    }))
                  : []),
                ...(listFilter === 'all' || listFilter === 'rejected'
                  ? filteredRejectedRequests.map((req) => ({
                      key: req.id,
                      type: 'rejected',
                      request: req,
                    }))
                  : []),
              ];

              if (!items.length) {
                return <div className="text-sm text-slate-500">No borrowers found.</div>;
              }

              return (
                <div className="space-y-3">
                  {items.map((item) => {
                    if (item.type === 'onboarded') {
                      const borrower = item.borrower;
                      const lastActivity = getBorrowerLastActivity(borrower);
                      return (
                        <div key={item.key} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="text-base font-semibold text-slate-900">{getBorrowerName(borrower)}</p>
                              <p className="text-sm text-slate-600">{borrower.email || '-'}</p>
                              <p className="text-sm text-slate-500">{borrower.phone || '-'}</p>
                            </div>
                          </div>
                          <div className="mt-3 text-xs text-slate-500 space-y-1">
                            <p>Loans: {getBorrowerLoanCount(borrower)}</p>
                            <p>
                              Last activity: {lastActivity ? format(lastActivity, 'MMM d, yyyy') : 'N/A'}
                            </p>
                          </div>
                        </div>
                      );
                    }

                    const req = item.request;
                    const status = item.type;
                    const badgeClass = INVITE_STATUS_COLORS[status] || "bg-slate-100 text-slate-700 border-slate-200";
                    const displayName = `${req.requested_first_name || ''} ${req.requested_last_name || ''}`.trim() || req.requested_email || 'Unknown';
                    const activityDate = status === 'rejected' ? req.rejected_at : req.created_date;
                    return (
                      <div key={item.key} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-base font-semibold text-slate-900">{displayName}</p>
                            <p className="text-sm text-slate-600">{req.requested_email || '-'}</p>
                          </div>
                          <Badge className={`text-xs border ${badgeClass}`}>{status}</Badge>
                        </div>
                        <div className="mt-3 text-xs text-slate-500 space-y-1">
                          <p>Loans: 0</p>
                          <p>
                            Last activity: {activityDate ? format(new Date(activityDate), 'MMM d, yyyy') : 'N/A'}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
