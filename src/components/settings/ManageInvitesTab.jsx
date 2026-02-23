import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { base44 } from "@/api/base44Client";
import { normalizeAppRole } from "@/components/utils/appRoles";
import { Borrower } from "@/entities/all";

const STATUS_COLORS = {
  pending: "bg-amber-100 text-amber-800 border-amber-200",
  sent: "bg-blue-100 text-blue-800 border-blue-200",
  rejected: "bg-red-100 text-red-800 border-red-200",
};

const DATE_FILTERS = [
  { value: "all", label: "Any time" },
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "365", label: "Last 12 months" },
];

const SENDER_FILTERS = [
  { value: "all", label: "All senders" },
  { value: "admin_lo", label: "Admin / Loan Officer" },
  { value: "administrator", label: "Administrator" },
  { value: "loan_officer", label: "Loan Officer" },
  { value: "broker", label: "Broker" },
];

const getSentAtLabel = (value) => {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleDateString();
};

const getRequesterRole = (request) => {
  const normalized = normalizeAppRole(request?.requested_by_role || "");
  if (normalized) return normalized;
  return request?.requested_by_role || "Unknown";
};

const getRequesterName = (request) => {
  return request?.requested_by_name || request?.requested_by_email || "Unknown";
};

const isInternalRequest = (request) => {
  const role = getRequesterRole(request);
  return request?.source !== "broker" && role !== "Broker";
};

const matchesSenderFilter = (request, senderFilter) => {
  if (senderFilter === "all") return true;
  const role = getRequesterRole(request);
  if (senderFilter === "broker") return role === "Broker" || request?.source === "broker";
  if (senderFilter === "administrator") return role === "Administrator";
  if (senderFilter === "loan_officer") return role === "Loan Officer";
  if (senderFilter === "admin_lo") return ["Administrator", "Loan Officer"].includes(role);
  return true;
};

const matchesDateFilter = (request, dateFilter) => {
  if (dateFilter === "all") return true;
  const days = Number(dateFilter);
  if (!days || !request?.created_date) return true;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const sentAt = new Date(request.created_date);
  if (Number.isNaN(sentAt.getTime())) return true;
  return sentAt >= cutoff;
};

const InviteTable = ({ rows, emptyLabel }) => {
  if (!rows.length) {
    return <div className="text-sm text-slate-500">{emptyLabel}</div>;
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Borrower</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Sent By</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Sent On</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((request) => {
            const status = (request.status || "pending").toLowerCase();
            const badgeClass = STATUS_COLORS[status] || "bg-slate-100 text-slate-700 border-slate-200";
            const borrowerName = `${request.requested_first_name || ""} ${request.requested_last_name || ""}`.trim();
            return (
              <TableRow key={request.id}>
                <TableCell className="font-medium text-slate-900">
                  {borrowerName || "Unknown Borrower"}
                </TableCell>
                <TableCell className="text-slate-600">{request.requested_email || "No email"}</TableCell>
                <TableCell className="text-slate-600">{getRequesterName(request)}</TableCell>
                <TableCell className="text-slate-600">{getRequesterRole(request)}</TableCell>
                <TableCell className="text-slate-500">{getSentAtLabel(request.created_date)}</TableCell>
                <TableCell>
                  <Badge className={`text-xs border ${badgeClass}`}>{status}</Badge>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};

export default function ManageInvitesTab({ currentUser }) {
  const [requests, setRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [senderFilter, setSenderFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("30");

  const loadRequests = async () => {
    setIsLoading(true);
    try {
      const all = await base44.entities.BorrowerInviteRequest.list("-created_date");
      const allRequests = all || [];

      const borrowerIds = allRequests
        .map((request) => request?.borrower_id)
        .filter(Boolean);

      if (!borrowerIds.length) {
        setRequests(allRequests);
        setIsLoading(false);
        return;
      }

      let borrowers = [];
      try {
        borrowers = await Borrower.list("-created_date");
      } catch (borrowerError) {
        console.error("Error loading borrowers for invite cleanup:", borrowerError);
      }

      const borrowerMap = new Map((borrowers || []).map((borrower) => [borrower.id, borrower]));
      const pendingRequests = allRequests.filter((request) => {
        if (!request?.borrower_id) return true;
        const borrower = borrowerMap.get(request.borrower_id);
        if (!borrower) return true;
        return borrower.is_invite_temp === true;
      });

      setRequests(pendingRequests);
    } catch (error) {
      console.error("Error loading borrower invite requests:", error);
      setRequests([]);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    if (currentUser) {
      loadRequests();
    }
  }, [currentUser]);

  const filteredRequests = useMemo(() => {
    return (requests || [])
      .filter((request) => matchesSenderFilter(request, senderFilter))
      .filter((request) => matchesDateFilter(request, dateFilter));
  }, [requests, senderFilter, dateFilter]);

  const internalRequests = useMemo(
    () => filteredRequests.filter((request) => isInternalRequest(request)),
    [filteredRequests]
  );
  const brokerRequests = useMemo(
    () => filteredRequests.filter((request) => !isInternalRequest(request)),
    [filteredRequests]
  );

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <CardTitle>Manage Invites</CardTitle>
        <CardDescription>
          Review all borrower invitations sent by administrators, loan officers, and brokers.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <div className="w-full md:w-56">
              <Select value={senderFilter} onValueChange={setSenderFilter}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Who sent" />
                </SelectTrigger>
                <SelectContent>
                  {SENDER_FILTERS.map((filter) => (
                    <SelectItem key={filter.value} value={filter.value}>
                      {filter.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-full md:w-48">
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="When sent" />
                </SelectTrigger>
                <SelectContent>
                  {DATE_FILTERS.map((filter) => (
                    <SelectItem key={filter.value} value={filter.value}>
                      {filter.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="text-sm text-slate-500">Loading invite requests...</div>
        ) : (
          <div className="space-y-8">
            <div className="space-y-3">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Admin / Loan Officer Invites</h3>
                <p className="text-sm text-slate-500">Invitations sent by internal team members.</p>
              </div>
              <InviteTable rows={internalRequests} emptyLabel="No internal invites found for this filter." />
            </div>

            <div className="space-y-3">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Broker Invites</h3>
                <p className="text-sm text-slate-500">Invitations initiated by brokers.</p>
              </div>
              <InviteTable rows={brokerRequests} emptyLabel="No broker invites found for this filter." />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
