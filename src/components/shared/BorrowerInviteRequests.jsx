import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { base44 } from "@/api/base44Client";

const STATUS_COLORS = {
  pending: "bg-amber-100 text-amber-800 border-amber-200",
  sent: "bg-blue-100 text-blue-800 border-blue-200",
  rejected: "bg-red-100 text-red-800 border-red-200",
};

export default function BorrowerInviteRequests({
  currentUser,
  scope = "broker",
  limit = null,
  showReject = false,
  title = "Borrower Invite Requests",
  description = "Track borrower invite requests.",
}) {
  const [requests, setRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRejecting, setIsRejecting] = useState(null);

  const loadRequests = async () => {
    setIsLoading(true);
    try {
      const all = await base44.entities.BorrowerInviteRequest.list("-created_date");
      const filtered = (all || []).filter((req) => {
        if (scope === "broker") {
          return req.source === "broker" && req.requested_by_user_id === currentUser?.id;
        }
        if (scope === "admin") {
          return req.source === "broker";
        }
        return true;
      });
      setRequests(filtered);
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

  const visibleRequests = useMemo(() => {
    if (!Array.isArray(requests)) return [];
    if (!limit) return requests;
    return requests.slice(0, limit);
  }, [requests, limit]);

  const handleReject = async (request) => {
    if (!request?.id || isRejecting) return;
    setIsRejecting(request.id);
    try {
      await base44.entities.BorrowerInviteRequest.update(request.id, {
        status: "rejected",
        rejected_by_user_id: currentUser?.id || null,
        rejected_at: new Date().toISOString(),
      });
      if (request.invite_token_id) {
        try {
          await base44.entities.BorrowerInviteToken.update(request.invite_token_id, {
            status: "inactive",
            deactivated_by_user_id: currentUser?.id || null,
            deactivated_at: new Date().toISOString(),
          });
        } catch (updateError) {
          console.error("Error deactivating invite token:", updateError);
        }
      }
      if (request.borrower_id) {
        try {
          await base44.entities.Borrower.update(request.borrower_id, {
            invite_request_status: "rejected",
            is_invite_temp: true,
          });
        } catch (updateError) {
          console.error("Error updating borrower invite status:", updateError);
        }
      }
      await loadRequests();
    } catch (error) {
      console.error("Error rejecting invite request:", error);
    }
    setIsRejecting(null);
  };

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-sm text-slate-500">Loading...</div>
        ) : visibleRequests.length > 0 ? (
          <div className="space-y-3">
            {visibleRequests.map((req) => {
              const status = (req.status || "pending").toLowerCase();
              const badgeClass = STATUS_COLORS[status] || "bg-slate-100 text-slate-700 border-slate-200";
              const displayName = `${req.requested_first_name || ""} ${req.requested_last_name || ""}`.trim() || req.requested_email;
              return (
                <div key={req.id} className="border rounded-lg p-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{displayName || "Unknown Borrower"}</p>
                    <p className="text-xs text-slate-500">{req.requested_email || "No email"}</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Requested {req.created_date ? new Date(req.created_date).toLocaleDateString() : "N/A"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge className={`text-xs border ${badgeClass}`}>{status}</Badge>
                    {showReject && status === "pending" && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isRejecting === req.id}
                        onClick={() => handleReject(req)}
                      >
                        {isRejecting === req.id ? "Rejecting..." : "Reject"}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-sm text-slate-500">No invite requests found.</div>
        )}
      </CardContent>
    </Card>
  );
}
