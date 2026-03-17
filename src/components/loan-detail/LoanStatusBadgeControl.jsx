import React, { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Badge, badgeVariants } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/ui/use-toast";
import { base44 } from "@/api/base44Client";
import { cn } from "@/lib/utils";
import { normalizeAppRole } from "@/components/utils/appRoles";
import UpdateProfilesFromLoanModal from "../shared/UpdateProfilesFromLoanModal";
import { LOAN_STATUS_OPTIONS, getLoanStatusMeta } from "./loanStatusConfig";

export default function LoanStatusBadgeControl({
  loan,
  currentUser,
  onUpdate,
  onRefresh,
}) {
  const { toast } = useToast();
  const [isUpdating, setIsUpdating] = useState(false);
  const [showUpdateProfilesModal, setShowUpdateProfilesModal] = useState(false);
  const [pendingStatusChange, setPendingStatusChange] = useState(null);

  const normalizedRole = normalizeAppRole(currentUser?.app_role);
  const canManage = currentUser && (
    currentUser.role === "admin" ||
    ["Administrator", "Loan Officer"].includes(normalizedRole)
  );

  const currentStatus = getLoanStatusMeta(loan.status);

  const applyStatusChange = async (nextStatus) => {
    setIsUpdating(true);
    try {
      await onUpdate({ status: nextStatus });
      if (onRefresh) {
        await onRefresh();
      }
    } catch (error) {
      console.error("Error updating status:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error?.message || "Failed to update loan status.",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleStatusChange = async (nextStatus) => {
    if (!nextStatus || nextStatus === loan.status || isUpdating) {
      return;
    }

    if (loan.status === "underwriting" && nextStatus === "processing") {
      setPendingStatusChange(nextStatus);
      setShowUpdateProfilesModal(true);
      return;
    }

    await applyStatusChange(nextStatus);
  };

  const handleUpdateProfilesFromLoan = async () => {
    setIsUpdating(true);
    try {
      await base44.functions.invoke("updateProfileFromLoan", {
        loan_id: loan.id,
      });
      await onUpdate({ status: pendingStatusChange });

      toast({
        title: "Profiles Updated",
        description:
          "Borrower/entity profiles have been updated with loan data.",
      });

      if (onRefresh) {
        await onRefresh();
      }
    } catch (error) {
      console.error("Error updating profiles:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description:
          error?.message || "Failed to update profiles. Please try again.",
      });
    } finally {
      setIsUpdating(false);
      setShowUpdateProfilesModal(false);
      setPendingStatusChange(null);
    }
  };

  const handleSkipProfileUpdate = async () => {
    if (!pendingStatusChange) {
      setShowUpdateProfilesModal(false);
      return;
    }

    await applyStatusChange(pendingStatusChange);
    setShowUpdateProfilesModal(false);
    setPendingStatusChange(null);
  };

  if (!canManage) {
    return (
      <Badge className={`${currentStatus.color} border-0`}>
        {currentStatus.label}
      </Badge>
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild disabled={isUpdating}>
          <button
            type="button"
            className="rounded-full focus:outline-none focus:ring-2 focus:ring-slate-300"
          >
            <span
              className={cn(
                badgeVariants(),
                currentStatus.color,
                "inline-flex border-0 gap-1.5 pr-2"
              )}
            >
              <span>{currentStatus.label}</span>
              <ChevronDown className="h-3 w-3" />
            </span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-[220px]">
          {LOAN_STATUS_OPTIONS.map((status) => (
            <DropdownMenuItem
              key={status.value}
              onSelect={() => handleStatusChange(status.value)}
              className="flex items-center justify-between gap-3"
            >
              <span>{status.label}</span>
              {status.value === loan.status ? (
                <span className="h-2 w-2 rounded-full bg-slate-900" />
              ) : null}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <UpdateProfilesFromLoanModal
        isOpen={showUpdateProfilesModal}
        onClose={() => {
          setShowUpdateProfilesModal(false);
          setPendingStatusChange(null);
        }}
        onUpdateProfiles={handleUpdateProfilesFromLoan}
        onSkipUpdate={handleSkipProfileUpdate}
      />
    </>
  );
}
