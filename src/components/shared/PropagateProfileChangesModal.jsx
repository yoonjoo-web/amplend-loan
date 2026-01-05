import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { FileText, Loader2 } from 'lucide-react';

export default function PropagateProfileChangesModal({ 
  isOpen, 
  onClose, 
  onUpdateRecords, 
  applications = [], 
  loans = [],
  isProcessing = false
}) {
  const [selectedApplications, setSelectedApplications] = useState(() => 
    applications.map(app => app.id)
  );
  const [selectedLoans, setSelectedLoans] = useState(() => 
    loans.map(loan => loan.id)
  );

  const toggleApplication = (appId) => {
    setSelectedApplications(prev =>
      prev.includes(appId) ? prev.filter(id => id !== appId) : [...prev, appId]
    );
  };

  const toggleLoan = (loanId) => {
    setSelectedLoans(prev =>
      prev.includes(loanId) ? prev.filter(id => id !== loanId) : [...prev, loanId]
    );
  };

  const handleSubmit = () => {
    console.log('[PropagateProfileChangesModal] handleSubmit called');
    console.log('[PropagateProfileChangesModal] Selected applications:', selectedApplications);
    console.log('[PropagateProfileChangesModal] Selected loans:', selectedLoans);
    console.log('[PropagateProfileChangesModal] Calling onUpdateRecords...');
    onUpdateRecords({
      applicationIds: selectedApplications,
      loanIds: selectedLoans
    });
  };

  const totalSelected = selectedApplications.length + selectedLoans.length;
  const totalRecords = applications.length + loans.length;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Propagate Profile Changes</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">
            This profile has ongoing applications/loans. Select which records should receive these updated profile values.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto py-4 space-y-4">
          {applications.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Applications ({applications.length})
              </h3>
              <div className="space-y-2">
                {applications.map((app) => (
                  <div
                    key={app.id}
                    className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
                  >
                    <Checkbox
                      checked={selectedApplications.includes(app.id)}
                      onCheckedChange={() => toggleApplication(app.id)}
                      disabled={isProcessing}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900">
                        #{app.application_number}
                      </p>
                      <p className="text-xs text-slate-600">
                        {app.loan_type?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {app.status?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {loans.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Loans ({loans.length})
              </h3>
              <div className="space-y-2">
                {loans.map((loan) => (
                  <div
                    key={loan.id}
                    className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
                  >
                    <Checkbox
                      checked={selectedLoans.includes(loan.id)}
                      onCheckedChange={() => toggleLoan(loan.id)}
                      disabled={isProcessing}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900">
                        {loan.loan_number || loan.primary_loan_id}
                      </p>
                      <p className="text-xs text-slate-600">
                        {loan.loan_product?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {loan.status?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 border-t pt-4">
          <div className="flex-1 text-xs text-slate-600">
            {totalSelected} of {totalRecords} selected
          </div>
          <Button 
            variant="outline" 
            onClick={onClose}
            disabled={isProcessing}
          >
            Do Not Update Any Records
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={totalSelected === 0 || isProcessing}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isProcessing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Update Selected Records
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}