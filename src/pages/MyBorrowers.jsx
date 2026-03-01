import React, { useEffect, useMemo, useState } from "react";
import { Borrower, Loan } from "@/entities/all";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { usePermissions } from "@/components/hooks/usePermissions";
import { normalizeAppRole } from "@/components/utils/appRoles";
import { isUserOnLoanTeam } from "@/components/utils/teamAccess";
import { Button } from "@/components/ui/button";
import InviteBorrowerModal from "@/components/dashboard/InviteBorrowerModal";
import { Search, Users } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function MyBorrowers() {
  const { currentUser, permissions, isLoading: permissionsLoading } = usePermissions();
  const [borrowers, setBorrowers] = useState([]);
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showInviteBorrowerModal, setShowInviteBorrowerModal] = useState(false);

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
      const [borrowersData, loansData] = await Promise.all([
        Borrower.list('-created_date').catch(() => []),
        Loan.list('-created_date').catch(() => [])
      ]);
      setBorrowers(borrowersData || []);
      setLoans(loansData || []);
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
      <div className="max-w-7xl mx-auto space-y-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6"
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
          <CardHeader className="pb-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="relative" data-tour="search">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search borrowers..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-7">
            {(() => {
              const list = filteredOnboardedBorrowers;
              if (!list.length) {
                return (
                  <div className="text-center py-12">
                    <p className="text-slate-500 mb-4">No borrowers found</p>
                  </div>
                );
              }

              return (
                <Table data-tour="borrowers-table">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Borrower</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Loans</TableHead>
                      <TableHead>Last Activity</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                  {list.map((borrower) => {
                    const lastActivity = getBorrowerLastActivity(borrower);
                    return (
                      <TableRow
                        key={borrower.id}
                        className="hover:bg-slate-50"
                      >
                        <TableCell className="px-2 py-3 font-medium align-middle [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px] text-slate-900">
                          {getBorrowerName(borrower)}
                        </TableCell>
                        <TableCell className="px-2 py-3 font-medium align-middle [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px] text-slate-700">
                          {borrower.email || '-'}
                        </TableCell>
                        <TableCell className="px-2 py-3 font-medium align-middle [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px] text-slate-700">
                          {borrower.phone || '-'}
                        </TableCell>
                        <TableCell className="px-2 py-3 font-medium align-middle [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px] text-slate-700">
                          {getBorrowerLoanCount(borrower)}
                        </TableCell>
                        <TableCell className="px-2 py-3 font-medium align-middle [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px] text-slate-700">
                          {lastActivity ? format(lastActivity, 'MMM d, yyyy') : 'N/A'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  </TableBody>
                </Table>
              );
            })()}
          </CardContent>
        </Card>

      </div>
      <InviteBorrowerModal
        isOpen={showInviteBorrowerModal}
        onClose={() => setShowInviteBorrowerModal(false)}
        onInviteSubmitted={handleInviteSubmitted}
      />
    </div>
  );
}
