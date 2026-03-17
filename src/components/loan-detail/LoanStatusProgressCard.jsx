import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { base44 } from "@/api/base44Client";
import { normalizeAppRole } from "@/components/utils/appRoles";
import { Check } from "lucide-react";
import UpdateProfilesFromLoanModal from "../shared/UpdateProfilesFromLoanModal";
import {
  LOAN_PROGRESS_STATUS_OPTIONS,
  LOAN_STATUS_OPTIONS,
} from "./loanStatusConfig";

export default function LoanStatusProgressCard({
  loan,
  currentUser,
  onUpdate,
  onRefresh,
}) {
  const { toast } = useToast();
  const [isUpdating, setIsUpdating] = useState(false);
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState(loan.status);
  const [showUpdateProfilesModal, setShowUpdateProfilesModal] = useState(false);
  const [pendingStatusChange, setPendingStatusChange] = useState(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const normalizedRole = normalizeAppRole(currentUser?.app_role);
  const canManage = currentUser && (
    currentUser.role === "admin" ||
    ["Administrator", "Loan Officer"].includes(normalizedRole)
  );

  const progressIndex = LOAN_PROGRESS_STATUS_OPTIONS.findIndex(
    (status) => status.value === loan.status
  );

  const formatCompactDate = (value) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;

    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const year = String(date.getFullYear()).slice(-2);
    return `${month}/${day}/${year}`;
  };

  const visibleStatuses = isExpanded
    ? LOAN_PROGRESS_STATUS_OPTIONS
    : LOAN_PROGRESS_STATUS_OPTIONS.slice(0, 5);

  const applyStatusChange = async (nextStatus) => {
    setIsUpdating(true);
    try {
      await onUpdate({ status: nextStatus });
      if (onRefresh) {
        await onRefresh();
      }
      setShowStatusDialog(false);
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
    if (!nextStatus || nextStatus === loan.status) {
      setShowStatusDialog(false);
      return;
    }

    if (loan.status === "underwriting" && nextStatus === "processing") {
      setPendingStatusChange(nextStatus);
      setShowStatusDialog(false);
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

  return (
    <>
      <Card className="border-slate-200 bg-white">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-4">
            <CardTitle className="text-[14px] font-normal leading-5 tracking-[-0.5px] text-black">
              Progress
            </CardTitle>
            <p className="text-[12px] font-normal leading-4 tracking-[-0.5px] text-neutral-500">
              Step {Math.max(progressIndex + 1, 1)} of {LOAN_PROGRESS_STATUS_OPTIONS.length}
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 px-4 pb-4 pt-0">
          <div className="flex gap-2">
            {visibleStatuses.map((status) => {
              const originalIndex = LOAN_PROGRESS_STATUS_OPTIONS.findIndex(
                (item) => item.value === status.value
              );
              const isFilled = progressIndex >= originalIndex || progressIndex === -1;

              return (
                <div
                  key={status.value}
                  className={`h-2 flex-1 rounded-full ${
                    isFilled ? "bg-black" : "bg-[#E5E5E5]"
                  }`}
                />
              );
            })}
          </div>

          <div className={isExpanded ? "overflow-x-auto pb-1" : ""}>
            <div className={`flex ${isExpanded ? "min-w-max gap-4" : "gap-4"}`}>
              {visibleStatuses.map((status) => {
                const originalIndex = LOAN_PROGRESS_STATUS_OPTIONS.findIndex(
                  (item) => item.value === status.value
                );
                const isCompleted = progressIndex > originalIndex || progressIndex === -1;
                const isCurrent = progressIndex === originalIndex;
                const createdDate = originalIndex === 0 && isCompleted
                  ? formatCompactDate(loan.created_date || loan.updated_date)
                  : null;

                return (
                  <div
                    key={status.value}
                    className={isExpanded ? "min-w-[140px] flex-1" : "min-w-0 flex-1"}
                  >
                    <div className="flex items-start gap-[6px]">
                      <div className="flex items-center py-[2px]">
                        {isCompleted ? (
                          <Check className="h-[12px] w-[10.5px] text-black stroke-[2.25]" />
                        ) : (
                          <div
                            className={`mt-[3px] h-[6px] w-[6px] rounded-full border ${
                              isCurrent
                                ? "border-black bg-black"
                                : "border-[#A3A3A3] bg-white"
                            }`}
                          />
                        )}
                      </div>
                      <div className="flex flex-col justify-center">
                        <p
                          className={`text-[12px] font-normal leading-4 tracking-[-0.5px] ${
                            isCurrent ? "text-black" : "text-[#525252]"
                          }`}
                        >
                          {status.label}
                        </p>
                        {createdDate && (
                          <p className="text-[12px] font-normal leading-4 tracking-[-0.627px] text-[#525252]">
                            {createdDate}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 pt-1">
            {canManage && (
              <Button
                onClick={() => {
                  setSelectedStatus(loan.status);
                  setShowStatusDialog(true);
                }}
                className="bg-slate-900 hover:bg-slate-800"
              >
                Change Status
              </Button>
            )}
            {LOAN_PROGRESS_STATUS_OPTIONS.length > 5 && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsExpanded((value) => !value)}
                className="h-auto px-0 text-[12px] font-normal leading-4 tracking-[-0.5px] text-neutral-500 hover:bg-transparent hover:text-black"
              >
                {isExpanded ? "Collapse" : `${LOAN_PROGRESS_STATUS_OPTIONS.length - 5} more`}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={showStatusDialog} onOpenChange={setShowStatusDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Change Loan Status</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Select
              value={selectedStatus}
              onValueChange={setSelectedStatus}
              disabled={isUpdating}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a status" />
              </SelectTrigger>
              <SelectContent>
                {LOAN_STATUS_OPTIONS.map((status) => (
                  <SelectItem key={status.value} value={status.value}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setShowStatusDialog(false)}
                disabled={isUpdating}
              >
                Cancel
              </Button>
              <Button
                onClick={() => handleStatusChange(selectedStatus)}
                disabled={isUpdating || selectedStatus === loan.status}
                className="bg-slate-900 hover:bg-slate-800"
              >
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
