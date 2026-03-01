import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePermissions } from "@/components/hooks/usePermissions";
import { motion } from "framer-motion";
import { Search } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function MyPartners() {
  const { currentUser, permissions, isLoading: permissionsLoading } = usePermissions();
  const [loading, setLoading] = useState(true);
  const [partners, setPartners] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (!permissionsLoading && currentUser && permissions.canViewMyPartners) {
      loadPartners();
    } else if (!permissionsLoading) {
      setLoading(false);
    }
  }, [permissionsLoading, currentUser?.id]);

  const loadPartners = async () => {
    setLoading(true);
    try {
      // Get the borrower record linked to this user
      let borrowerId = null;
      const borrowersByUserId = await base44.entities.Borrower.filter({ user_id: currentUser.id }).catch(() => []);
      if (borrowersByUserId.length > 0) {
        borrowerId = borrowersByUserId[0].id;
      } else if (currentUser.email) {
        const borrowersByEmail = await base44.entities.Borrower.filter({ email: currentUser.email }).catch(() => []);
        if (borrowersByEmail.length > 0) borrowerId = borrowersByEmail[0].id;
      }

      const accessIds = [currentUser.id, borrowerId].filter(Boolean);

      // Fetch all applications and loans, then filter for ones involving this borrower
      const [allApplications, allLoans, allLoanPartners] = await Promise.all([
        base44.entities.LoanApplication.list('-created_date').catch(() => []),
        base44.entities.Loan.list('-created_date').catch(() => []),
        base44.entities.LoanPartner.list().catch(() => []),
      ]);

      // Find applications where this borrower is the primary borrower or co-borrower
      const myApplications = allApplications.filter((app) => {
        if (accessIds.includes(app.primary_borrower_id)) return true;
        if (accessIds.includes(app.created_by)) return true;
        const coBorrowers = app.co_borrowers || [];
        return coBorrowers.some((cb) => accessIds.includes(cb.user_id) || accessIds.includes(cb.id));
      });

      // Find loans where this borrower is in borrower_ids
      const myLoans = allLoans.filter((loan) =>
        (loan.borrower_ids || []).some((id) => accessIds.includes(id))
      );

      // Collect all partner IDs from my applications and loans
      const partnerIdSet = new Set();

      myApplications.forEach((app) => {
        [app.broker_id, app.referrer_id, app.liaison_id].filter(Boolean).forEach((id) => partnerIdSet.add(id));
        (app.broker_ids || []).forEach((id) => partnerIdSet.add(id));
        (app.referrer_ids || []).forEach((id) => partnerIdSet.add(id));
        (app.liaison_ids || []).forEach((id) => partnerIdSet.add(id));
        if (app.broker_id || app.broker_user_id) partnerIdSet.add(app.broker_id || app.broker_user_id);
      });

      myLoans.forEach((loan) => {
        [loan.broker_id, loan.referrer_id, loan.liaison_id].filter(Boolean).forEach((id) => partnerIdSet.add(id));
        (loan.broker_ids || []).forEach((id) => partnerIdSet.add(id));
        (loan.referrer_ids || []).forEach((id) => partnerIdSet.add(id));
        (loan.liaison_ids || []).forEach((id) => partnerIdSet.add(id));
        (loan.title_company_ids || []).forEach((id) => partnerIdSet.add(id));
        (loan.insurance_company_ids || []).forEach((id) => partnerIdSet.add(id));
        (loan.servicer_ids || []).forEach((id) => partnerIdSet.add(id));
      });

      // Also capture partners from loan_partners (name/email based)
      const contactBasedPartners = [];
      myLoans.forEach((loan) => {
        const contacts = loan.loan_partners || {};
        Object.entries(contacts).forEach(([role, contact]) => {
          if (!contact || typeof contact !== 'object') return;
          if (!contact.name && !contact.email) return;
          // Only add if not already matched by ID
          const matched = allLoanPartners.find(
            (p) => (contact.email && p.email === contact.email) || partnerIdSet.has(p.id)
          );
          if (!matched && (contact.name || contact.email)) {
            contactBasedPartners.push({
              id: `contact-${role}-${loan.id}`,
              name: contact.name || contact.contact_person || '-',
              email: contact.email || '-',
              phone: contact.phone || '-',
              app_role: role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
              company: contact.company || '-',
            });
          }
        });
      });

      // Filter LoanPartner records by collected IDs
      const matchedPartners = allLoanPartners.filter((p) => partnerIdSet.has(p.id));

      // Deduplicate contact-based by email
      const emailsSeen = new Set(matchedPartners.map((p) => p.email).filter(Boolean));
      const uniqueContactBased = contactBasedPartners.filter((p) => {
        if (emailsSeen.has(p.email)) return false;
        emailsSeen.add(p.email);
        return true;
      });

      setPartners([...matchedPartners, ...uniqueContactBased]);
    } catch (error) {
      console.error('Error loading partners:', error);
    }
    setLoading(false);
  };

  const filteredPartners = useMemo(() => {
    const normalize = (value) => String(value || "").toLowerCase().trim();
    const needle = normalize(searchTerm);
    if (!needle) return partners;
    return (partners || []).filter((partner) =>
      [
        partner.name,
        partner.app_role,
        partner.email,
        partner.phone,
        partner.company,
        partner.contact_person
      ].some((field) => normalize(field).includes(needle))
    );
  }, [partners, searchTerm]);

  if (permissionsLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900"></div>
      </div>
    );
  }

  if (!permissions.canViewMyPartners) {
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
      <div className="max-w-7xl mx-auto space-y-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6"
        >
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">My Partners</h1>
        </motion.div>

        <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
          <CardHeader className="pb-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="relative" data-tour="search">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search partners..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-7">
            {filteredPartners.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-slate-500 mb-4">No partners found for your applications or loans.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Company</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPartners.map((partner) => (
                    <TableRow key={partner.id} className="hover:bg-slate-50">
                      <TableCell className="px-2 py-3 font-medium align-middle [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px] text-slate-900">
                        {partner.name || '-'}
                      </TableCell>
                      <TableCell className="px-2 py-3 font-medium align-middle [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px] text-slate-700">
                        {partner.app_role || '-'}
                      </TableCell>
                      <TableCell className="px-2 py-3 font-medium align-middle [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px] text-slate-700">
                        {partner.email || '-'}
                      </TableCell>
                      <TableCell className="px-2 py-3 font-medium align-middle [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px] text-slate-700">
                        {partner.phone || '-'}
                      </TableCell>
                      <TableCell className="px-2 py-3 font-medium align-middle [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px] text-slate-700">
                        {partner.company || partner.contact_person || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
