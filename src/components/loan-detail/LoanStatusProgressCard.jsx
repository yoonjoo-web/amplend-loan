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
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/components/ui/use-toast";
import { base44 } from "@/api/base44Client";
import { normalizeAppRole } from "@/components/utils/appRoles";
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
  const progressValue =
    progressIndex >= 0
      ? ((progressIndex + 1) / LOAN_PROGRESS_STATUS_OPTIONS.length) * 100
      : 100;

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
              <CardTitle className="text-lg text-slate-900">
                Loan Status
              </CardTitle>
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
          <Progress value={progressValue} className="h-3 bg-slate-200 [&>*]:bg-slate-900" />
          <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
            {LOAN_PROGRESS_STATUS_OPTIONS.map((status, index) => {
              const isComplete = progressIndex >= index || progressIndex === -1;
              const isCurrent = loan.status === status.value;

              return (
                <div
                  key={status.value}
                  className={`rounded-xl border p-3 transition-colors ${
                    isCurrent
                      ? "border-slate-900 bg-slate-900 text-white"
                      : isComplete
                        ? "border-slate-300 bg-slate-50 text-slate-900"
                        : "border-slate-200 bg-white text-slate-400"
                  }`}
                >
                  <p className="text-xs uppercase tracking-[0.16em] opacity-70">
                    Step {index + 1}
                  </p>
                  <p className="mt-1 text-sm">{status.label}</p>
                </div>
              );
            })}
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
