import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoanPaymentsTab({ loanId }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment History</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-center py-12 text-slate-500">
          <p>Payment history coming soon...</p>
        </div>
      </CardContent>
    </Card>
  );
}