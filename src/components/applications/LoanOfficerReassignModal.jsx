import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { base44 } from "@/api/base44Client";

export default function LoanOfficerReassignModal({ isOpen, onClose, applicationId, currentOfficerId, allLoanOfficers, onRefresh }) {
  const { toast } = useToast();
  const [selectedOfficer, setSelectedOfficer] = useState(currentOfficerId || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSelectedOfficer(currentOfficerId || '');
    }
  }, [isOpen, currentOfficerId]);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await base44.functions.invoke('updateApplicationStatus', {
        application_id: applicationId,
        updates: { assigned_loan_officer_id: selectedOfficer }
      });

      toast({
        title: "Loan Officer Assigned",
        description: "The loan officer has been assigned successfully.",
      });
      
      if (onRefresh) await onRefresh();
      onClose();
    } catch (error) {
      console.error('Error reassigning loan officer:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to assign loan officer. Please try again.",
      });
    }
    setIsSubmitting(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reassign Loan Officer</DialogTitle>
          <DialogDescription>
            Select a loan officer to assign to this application
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="loan-officer-select">Loan Officer</Label>
            <Select value={selectedOfficer} onValueChange={setSelectedOfficer}>
              <SelectTrigger id="loan-officer-select">
                <SelectValue placeholder="Select loan officer..." />
              </SelectTrigger>
              <SelectContent>
                {allLoanOfficers
                  .filter(officer => officer.role !== 'administrator')
                  .map(officer => (
                    <SelectItem key={officer.id} value={officer.id}>
                      {officer.first_name && officer.last_name
                        ? `${officer.first_name} ${officer.last_name}`
                        : officer.full_name || officer.email}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !selectedOfficer}>
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}