import React, { useEffect, useMemo, useState } from "react";
import { Loan, LoanApplication, LoanPartner } from "@/entities/all";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { usePermissions } from "@/components/hooks/usePermissions";
import { normalizeAppRole } from "@/components/utils/appRoles";

const roleColors = {
  "Servicer": "bg-blue-100 text-blue-800",
  "Referral Partner": "bg-emerald-100 text-emerald-800",
  "Broker": "bg-amber-100 text-amber-800",
  "Title Company": "bg-pink-100 text-pink-800",
  "Insurance Company": "bg-cyan-100 text-cyan-800",
  "Liaison": "bg-indigo-100 text-indigo-800"
};

const coBorrowerMatches = (coBorrowers, borrowerAccessIds) => {
  if (!Array.isArray(coBorrowers) || coBorrowers.length === 0) return false;
  return coBorrowers.some((cb) =>
    borrowerAccessIds.includes(cb.user_id) || borrowerAccessIds.includes(cb.borrower_id)
  );
};

const normalizeDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const resolvePartnerName = (partner, fallbackId) => {
  const name = partner?.name || partner?.contact_person;
  const email = partner?.email;
  return [name, email, fallbackId].find(Boolean) || 'Unknown Partner';
};

const resolvePartnerRole = (partner) => {
  return normalizeAppRole(partner?.app_role || partner?.type || '') || 'Loan Partner';
};

export default function MyPartners() {
  const { currentUser, permissions, isLoading: permissionsLoading } = usePermissions();
  const [loading, setLoading] = useState(true);
  const [partners, setPartners] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');

  useEffect(() => {
    if (!permissionsLoading && currentUser && permissions.isBorrower) {
      loadData();
    }
    if (!permissionsLoading && (!currentUser || !permissions.isBorrower)) {
      setLoading(false);
    }
  }, [permissionsLoading, currentUser?.id, permissions.isBorrower]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [loanPartnersData, loansData, applicationsData] = await Promise.all([
        LoanPartner.list('-created_date').catch(() => []),
        Loan.list('-created_date').catch(() => []),
        LoanApplication.list('-created_date').catch(() => [])
      ]);

      const borrowerAccessIds = permissions.borrowerAccessIds || [currentUser.id];
      const relevantLoans = (loansData || []).filter((loan) =>
        (loan.borrower_ids || []).some((id) => borrowerAccessIds.includes(id))
      );
      const relevantApplications = (applicationsData || []).filter((app) =>
        borrowerAccessIds.includes(app.primary_borrower_id) || coBorrowerMatches(app.co_borrowers, borrowerAccessIds)
      );

      const partnerById = new Map();
      (loanPartnersData || []).forEach((partner) => {
        if (partner?.id) partnerById.set(partner.id, partner);
        if (partner?.user_id) partnerById.set(partner.user_id, partner);
      });

      const statsMap = new Map();

      const registerPartner = (partnerId, source, activityDate) => {
        if (!partnerId) return;
        const partner = partnerById.get(partnerId);
        const key = partner?.id || partnerId;
        const existing = statsMap.get(key) || {
          id: key,
          partner,
          name: resolvePartnerName(partner, partnerId),
          role: resolvePartnerRole(partner),
          email: partner?.email || null,
          phone: partner?.phone || null,
          loanCount: 0,
          applicationCount: 0,
          sources: new Set(),
          lastActivity: null
        };

        if (source === 'loan') {
          existing.loanCount += 1;
        } else if (source === 'application') {
          existing.applicationCount += 1;
        }
        existing.sources.add(source);

        const normalized = normalizeDate(activityDate);
        if (normalized && (!existing.lastActivity || normalized > existing.lastActivity)) {
          existing.lastActivity = normalized;
        }

        statsMap.set(key, existing);
      };

      relevantLoans.forEach((loan) => {
        const ids = Array.from(new Set(loan.referrer_ids || []));
        const dateValue = loan.updated_date || loan.created_date;
        ids.forEach((id) => registerPartner(id, 'loan', dateValue));
      });

      relevantApplications.forEach((app) => {
        const ids = Array.from(new Set(app.referrer_ids || []));
        const dateValue = app.updated_date || app.created_date;
        ids.forEach((id) => registerPartner(id, 'application', dateValue));
      });

      const results = Array.from(statsMap.values());
      setPartners(results);
    } catch (error) {
      console.error('Error loading partners:', error);
      setPartners([]);
    }
    setLoading(false);
  };

  const roleOptions = useMemo(() => {
    const set = new Set();
    partners.forEach((partner) => set.add(partner.role));
    return ['all', ...Array.from(set).sort()];
  }, [partners]);

  const filteredPartners = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    return partners
      .filter((partner) => {
        if (sourceFilter === 'loans' && partner.loanCount === 0) return false;
        if (sourceFilter === 'applications' && partner.applicationCount === 0) return false;
        if (roleFilter !== 'all' && partner.role !== roleFilter) return false;
        if (!needle) return true;
        return [
          partner.name,
          partner.email,
          partner.phone,
          partner.role
        ].some((value) => String(value || '').toLowerCase().includes(needle));
      })
      .sort((a, b) => {
        const aTime = a.lastActivity ? a.lastActivity.getTime() : 0;
        const bTime = b.lastActivity ? b.lastActivity.getTime() : 0;
        return bTime - aTime;
      });
  }, [partners, roleFilter, searchTerm, sourceFilter]);

  const totals = useMemo(() => {
    return {
      partners: partners.length,
      loans: partners.filter((partner) => partner.loanCount > 0).length,
      applications: partners.filter((partner) => partner.applicationCount > 0).length
    };
  }, [partners]);

  if (permissionsLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900"></div>
      </div>
    );
  }

  if (!permissions.isBorrower) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
        <div className="max-w-4xl mx-auto">
          <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-lg font-bold text-slate-900">My Partners</CardTitle>
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
            My Partners
          </h1>
          <p className="text-slate-600">
            Loan partners who have been involved in your applications or loans.
          </p>
        </motion.div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
            <CardContent className="p-4">
              <p className="text-sm text-slate-500">Total Partners</p>
              <p className="text-2xl font-semibold text-slate-900">{totals.partners}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
            <CardContent className="p-4">
              <p className="text-sm text-slate-500">From Loans</p>
              <p className="text-2xl font-semibold text-slate-900">{totals.loans}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
            <CardContent className="p-4">
              <p className="text-sm text-slate-500">From Applications</p>
              <p className="text-2xl font-semibold text-slate-900">{totals.applications}</p>
            </CardContent>
          </Card>
        </div>

        <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
          <CardContent className="p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex-1">
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search partners..."
                  className="bg-white"
                />
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Select value={sourceFilter} onValueChange={setSourceFilter}>
                  <SelectTrigger className="w-[180px] bg-white">
                    <SelectValue placeholder="All sources" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All sources</SelectItem>
                    <SelectItem value="loans">Loans only</SelectItem>
                    <SelectItem value="applications">Applications only</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger className="w-[200px] bg-white">
                    <SelectValue placeholder="All roles" />
                  </SelectTrigger>
                  <SelectContent>
                    {roleOptions.map((role) => (
                      <SelectItem key={role} value={role}>
                        {role === 'all' ? 'All roles' : role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {filteredPartners.length === 0 ? (
            <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
              <CardContent className="p-8 text-center text-slate-600">
                No partners found yet.
              </CardContent>
            </Card>
          ) : (
            filteredPartners.map((partner) => (
              <Card key={partner.id} className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
                <CardContent className="p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold text-slate-900">
                          {partner.name}
                        </h3>
                        <Badge className={`${roleColors[partner.role] || 'bg-slate-100 text-slate-800'} font-medium`}>
                          {partner.role}
                        </Badge>
                      </div>
                      <div className="text-sm text-slate-500">
                        {[partner.email, partner.phone].filter(Boolean).join(' • ') || 'No contact details'}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-6 text-sm text-slate-600">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-slate-400">Loans</p>
                        <p className="text-base font-semibold text-slate-900">{partner.loanCount}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-slate-400">Applications</p>
                        <p className="text-base font-semibold text-slate-900">{partner.applicationCount}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-slate-400">Last Involved</p>
                        <p className="text-base font-semibold text-slate-900">
                          {partner.lastActivity ? format(partner.lastActivity, 'MMM d, yyyy') : 'N/A'}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
