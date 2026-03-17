import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Check, Circle } from "lucide-react";
import UpdateProfilesFromLoanModal from "../shared/UpdateProfilesFromLoanModal";
import {
  LOAN_PROGRESS_STATUS_OPTIONS,
  LOAN_STATUS_OPTIONS,
  getLoanStatusMeta,
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

  const normalizedRole = normalizeAppRole(currentUser?.app_role);
  const canManage = currentUser && (
    currentUser.role === "admin" ||
    ["Administrator", "Loan Officer"].includes(normalizedRole)
  );

  const currentStatus = useMemo(
    () => getLoanStatusMeta(loan.status),
    [loan.status]
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
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <CardTitle className="text-lg text-slate-900">Progress</CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={`${currentStatus.color} border-0`}>
                  {currentStatus.label}
                </Badge>
                <span className="text-sm text-slate-500">
                  {currentStatus.description}
                </span>
              </div>
            </div>
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
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between gap-4 text-sm">
            <p className="text-sm text-slate-900">Progress</p>
            <p className="text-xs text-neutral-500">
              Step {Math.max(progressIndex + 1, 1)} of {LOAN_PROGRESS_STATUS_OPTIONS.length}
            </p>
          </div>

          <div className="flex gap-2">
            {LOAN_PROGRESS_STATUS_OPTIONS.map((status, index) => {
              const isFilled = progressIndex >= index || progressIndex === -1;
              return (
                <div
                  key={status.value}
                  className={`h-2 flex-1 rounded-full ${
                    isFilled ? "bg-black" : "bg-neutral-200"
                  }`}
                />
              );
            })}
          </div>

          <div className="overflow-x-auto pb-1">
            <div className="flex min-w-max gap-4">
              {LOAN_PROGRESS_STATUS_OPTIONS.map((status, index) => {
                const isCompleted = progressIndex > index || progressIndex === -1;
                const isCurrent = progressIndex === index;
                const showCreatedDate = index === 0 && isCompleted;
                const createdDate = showCreatedDate
                  ? formatCompactDate(loan.created_date || loan.updated_date)
                  : null;

                return (
                  <div key={status.value} className="min-w-[128px] flex-1">
                    <div className="flex items-start gap-1.5">
                      <div className="pt-[2px]">
                        {isCompleted ? (
                          <Check className="h-3.5 w-3.5 text-black" />
                        ) : (
                          <Circle
                            className={`h-3.5 w-3.5 ${
                              isCurrent ? "fill-black text-black" : "text-neutral-300"
                            }`}
                          />
                        )}
                      </div>
                      <div className="space-y-0.5">
                        <p className={`text-xs leading-4 ${isCurrent ? "text-black" : "text-neutral-600"}`}>
                          {status.label}
                        </p>
                        {createdDate && (
                          <p className="text-xs leading-4 text-neutral-500">
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
