import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { base44 } from "@/api/base44Client";
import { normalizeAppRole } from "@/components/utils/appRoles";
import { Borrower, User } from "@/entities/all";
import { resolveBorrowerInviteFields } from "@/components/utils/borrowerInvitationFields";

const STATUS_COLORS = {
  pending: "bg-amber-100 text-amber-800 border-amber-200",
  sent: "bg-blue-100 text-blue-800 border-blue-200",
  activated: "bg-emerald-100 text-emerald-800 border-emerald-200",
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

const STATUS_FILTERS = [
  { value: "active", label: "Active invites" },
  { value: "past", label: "Past invites" },
  { value: "all", label: "All invites" }
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
  const rawRole = request?.requested_by_role || "";
  if (rawRole.toLowerCase() === "admin") return "Administrator";
  return rawRole || "Unknown";
};

const getInviteTypeLabel = (request) => {
  const raw = request?.invite_type || request?.email_type || "invite";
  return raw
    .replace(/^invite_/, "")
    .replace(/^request_/, "request_")
    .replace(/_/g, " ");
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
            <TableHead>Invitee</TableHead>
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
  const [statusFilter, setStatusFilter] = useState("active");
  const [page, setPage] = useState(1);

  const normalizeEmail = (email) => (email || "").trim().toLowerCase();

  const loadRequests = async () => {
    setIsLoading(true);
    try {
      const [inviteRequests, borrowers, users, inviteTokens] = await Promise.all([
        base44.entities.BorrowerInviteRequest.list("-created_date"),
        Borrower.list("-created_date").catch(() => []),
        User.list().catch(() => []),
        base44.entities.BorrowerInviteToken.list().catch(() => [])
      ]);

      const userById = new Map((users || []).map((user) => [user.id, user]));
      const tokenById = new Map((inviteTokens || []).map((token) => [token.id, token]));
      const userByEmail = new Map(
        (users || [])
          .filter((user) => user.email)
          .map((user) => [normalizeEmail(user.email), user])
      );
      const borrowerById = new Map((borrowers || []).map((borrower) => [borrower.id, borrower]));

      const normalizedRequests = (inviteRequests || []).map((request) => {
        const inviter = request?.requested_by_user_id
          ? userById.get(request.requested_by_user_id)
          : null;
        const requestedEmail = request.requested_email || request.recipient_email;
        const emailKey = normalizeEmail(requestedEmail);
        const tokenRecord = request?.invite_token_id ? tokenById.get(request.invite_token_id) : null;
        const tokenUsed = (tokenRecord?.status || "").toLowerCase() === "used";
        const onboardedByEmail = emailKey && userByEmail.has(emailKey);
        const onboardedByBorrower = request.borrower_id
          ? borrowerById.get(request.borrower_id)?.is_invite_temp !== true
          : false;
        const isActivated = tokenUsed || onboardedByEmail || onboardedByBorrower || (request.status || "").toLowerCase() === "activated";
        return {
          ...request,
          created_date: request.sent_at || request.created_date,
          requested_email: requestedEmail,
          invite_type: request.invite_type || request.email_type,
          requested_by_role: request.requested_by_role || inviter?.app_role || inviter?.role,
          requested_by_name: request.requested_by_name || inviter?.full_name || inviter?.email,
          _token_used: tokenUsed,
          _onboarded: Boolean(isActivated)
        };
      });

      const requestEmailSet = new Set(
        normalizedRequests
          .map((request) => normalizeEmail(request.requested_email))
          .filter(Boolean)
      );

      const derivedBorrowerInvites = (borrowers || [])
        .map((borrower) => {
          const { dateField, statusField } = resolveBorrowerInviteFields(borrower);
          const statusValue = statusField ? borrower?.[statusField] : null;
          const dateValue = dateField ? borrower?.[dateField] : null;

          if (!statusValue && !dateValue) return null;

          const invitedEmail = borrower.email || "";
          if (!invitedEmail) return null;
          if (borrower.user_id) return null;
          if (userByEmail.has(normalizeEmail(invitedEmail))) return null;
          if (requestEmailSet.has(normalizeEmail(invitedEmail))) return null;

          const inviter = borrower.invited_by_user_id
            ? userById.get(borrower.invited_by_user_id)
            : null;
          const requestedByName = inviter?.full_name || inviter?.email || "Unknown";
          const requestedByRole = borrower.invited_by_role || inviter?.app_role || inviter?.role || "Unknown";
          const source = normalizeAppRole(requestedByRole) === "Broker" ? "broker" : "internal";
          const tokenRecord = borrower.invite_token_id ? tokenById.get(borrower.invite_token_id) : null;
          const tokenUsed = (tokenRecord?.status || "").toLowerCase() === "used";

          return {
            id: `borrower-${borrower.id}`,
            borrower_id: borrower.id,
            requested_email: invitedEmail,
            requested_first_name: borrower.first_name || "",
            requested_last_name: borrower.last_name || "",
            requested_by_user_id: borrower.invited_by_user_id || null,
            requested_by_role: requestedByRole,
            requested_by_name: requestedByName,
            created_date: dateValue || borrower.updated_date || borrower.created_date,
            status: tokenUsed ? "activated" : (statusValue || "sent"),
            source,
            invite_type: "invite_borrower",
            _token_used: tokenUsed,
            _onboarded: tokenUsed
          };
        })
        .filter(Boolean);

      const allRequests = [...normalizedRequests, ...derivedBorrowerInvites];

      setRequests(allRequests);
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

  const normalizedRequests = useMemo(() => {
    const ensureStatus = (request) => ({
      ...request,
      status:
        (request.status || "").toLowerCase() === "rejected"
          ? "rejected"
          : (request._onboarded || request._token_used)
            ? "activated"
            : (request.status || "sent").toLowerCase()
    });

    return (requests || [])
      .map(ensureStatus)
      .filter((request) => matchesSenderFilter(request, senderFilter))
      .filter((request) => matchesDateFilter(request, dateFilter));
  }, [requests, senderFilter, dateFilter]);

  const filteredRequests = useMemo(() => {
    const filtered = normalizedRequests.filter((request) => {
      if (statusFilter === "all") return true;
      const onboarded = request._onboarded === true;
      const rejected = request.status === "rejected";
      const isPast = onboarded || rejected;
      return statusFilter === "past" ? isPast : !isPast;
    });
    return filtered;
  }, [normalizedRequests, statusFilter]);

  const paginatedRequests = useMemo(() => {
    const startIndex = (page - 1) * 10;
    return filteredRequests.slice(startIndex, startIndex + 10);
  }, [filteredRequests, page]);

  const totalPages = Math.max(1, Math.ceil(filteredRequests.length / 10));

  useEffect(() => {
    setPage(1);
  }, [senderFilter, dateFilter, statusFilter]);

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <CardTitle>Manage Invites</CardTitle>
        <CardDescription>
          Review invitations sent from across the platform.
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
            <div className="w-full md:w-48">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_FILTERS.map((filter) => (
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
          <div className="space-y-4">
            <InviteTable rows={paginatedRequests} emptyLabel="No invites found for this filter." />
            <div className="flex items-center justify-between text-sm text-slate-500">
              <div>
                Showing {paginatedRequests.length ? (page - 1) * 10 + 1 : 0}-
                {(page - 1) * 10 + paginatedRequests.length} of {filteredRequests.length}
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="px-3 py-1 border rounded-md text-slate-600 disabled:text-slate-300 disabled:border-slate-200"
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  disabled={page === 1}
                >
                  Previous
                </button>
                <span>
                  Page {page} of {totalPages}
                </span>
                <button
                  className="px-3 py-1 border rounded-md text-slate-600 disabled:text-slate-300 disabled:border-slate-200"
                  onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={page === totalPages}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
