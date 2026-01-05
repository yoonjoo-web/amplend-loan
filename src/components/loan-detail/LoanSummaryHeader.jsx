import React from "react";
import { Card } from "@/components/ui/card";

export default function LoanSummaryHeader({ loan }) {
  const formatCurrency = (amount) => {
    if (!amount) return 'N/A';
    return `$${parseFloat(amount).toLocaleString()}`;
  };

  const getLoanTypeLabel = (type) => {
    const labels = {
      'fix_flip': 'Fix & Flip',
      'bridge': 'Bridge',
      'new_construction': 'New Construction',
      'dscr': 'DSCR'
    };
    return labels[type] || type;
  };

  return (
    <Card className="mb-6 bg-white border-slate-200">
      <div className="p-6">
        <div className={`grid ${loan.borrower_type === 'entity' ? 'grid-cols-2 md:grid-cols-4 lg:grid-cols-6' : 'grid-cols-2 md:grid-cols-4 lg:grid-cols-5'} gap-4`}>
          {/* Property RSVP# */}
          <div className="flex flex-col">
            <span className="text-xs text-slate-500 font-medium mb-1">Property</span>
            <span className="text-sm font-semibold text-slate-900">
              {loan.primary_loan_id || 'N/A'}
            </span>
          </div>

          {/* Borrower */}
          <div className="flex flex-col">
            <span className="text-xs text-slate-500 font-medium mb-1">Borrower</span>
            <span className="text-sm font-semibold text-slate-900">
              {loan.borrower_entity_name || 'N/A'}
            </span>
          </div>

          {/* Loan Type */}
          <div className="flex flex-col">
            <span className="text-xs text-slate-500 font-medium mb-1">Loan Type</span>
            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded w-fit">
              {getLoanTypeLabel(loan.loan_product)}
            </span>
          </div>

          {/* Remaining Balance */}
          <div className="flex flex-col">
            <span className="text-xs text-slate-500 font-medium mb-1">Remaining Balance</span>
            <span className="text-sm font-semibold text-emerald-600">
              {formatCurrency(loan.total_loan_amount)}
            </span>
          </div>

          {/* Loan Amount */}
          <div className="flex flex-col">
            <span className="text-xs text-slate-500 font-medium mb-1">Loan Amount</span>
            <span className="text-sm font-semibold text-slate-900">
              {formatCurrency(loan.total_loan_amount)}
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}