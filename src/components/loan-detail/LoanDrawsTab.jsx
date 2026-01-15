import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2 } from "lucide-react";

export default function LoanDrawsTab({ loan, onUpdate, currentUser }) {
  const [draws, setDraws] = useState(loan.draws || []);

  const canEdit = currentUser && (
    currentUser.role === 'admin' || 
    ['Administrator', 'Loan Officer'].includes(currentUser.app_role)
  );

  const calculateDisimburseCumulative = (drawsList) => {
    return drawsList.reduce((sum, draw) => sum + (parseFloat(draw.approved_amount) || 0), 0);
  };

  const calculateFundsCumulative = (drawsList) => {
    return drawsList.reduce((sum, draw) => sum + (parseFloat(draw.funds_to_borrower) || 0), 0);
  };

  const recalculateDraws = (drawsList) => {
    let disburseCumulative = 0;
    let fundsCumulative = 0;

    return drawsList.map((draw) => {
      const approvedAmount = parseFloat(draw.approved_amount) || 0;
      const fundsToBorrower = parseFloat(draw.funds_to_borrower) || 0;

      disburseCumulative += approvedAmount;
      fundsCumulative += fundsToBorrower;

      return {
        ...draw,
        total_rehab_budget: loan.total_rehab_budget || 0,
        total_disimburse: disburseCumulative,
        net_funds_to_borrower: fundsCumulative,
        remaining_budget: (loan.total_rehab_budget || 0) - disburseCumulative
      };
    });
  };

  const handleAddDraw = () => {
    const disimburseCumulative = calculateDisimburseCumulative(draws);
    const fundsCumulative = calculateFundsCumulative(draws);
    const newDraw = {
      id: Date.now().toString(),
      inspection_company: '',
      total_rehab_budget: loan.total_rehab_budget || 0,
      approved_amount: 0,
      inspection_fee: 0,
      wire_fee: 25,
      rush_order_fee: 0,
      total_disimburse: disimburseCumulative,
      funds_to_borrower: 0,
      net_funds_to_borrower: fundsCumulative,
      remaining_budget: (loan.total_rehab_budget || 0) - disimburseCumulative,
      net_draw_released_date: ''
    };
    const updatedDraws = recalculateDraws([...draws, newDraw]);
    setDraws(updatedDraws);
    saveDraws(updatedDraws);
  };

  const handleRemoveDraw = (index) => {
    const updatedDraws = draws.filter((_, i) => i !== index);
    setDraws(updatedDraws);
    saveDraws(updatedDraws);
  };

  const handleDrawChange = (index, field, value) => {
    const updatedDraws = [...draws];
    updatedDraws[index] = { ...updatedDraws[index], [field]: value };

    if (['approved_amount', 'inspection_fee', 'wire_fee', 'rush_order_fee'].includes(field)) {
      const approvedAmount = parseFloat(updatedDraws[index].approved_amount) || 0;
      const inspectionFee = parseFloat(updatedDraws[index].inspection_fee) || 0;
      const wireFee = parseFloat(updatedDraws[index].wire_fee) || 0;
      const rushOrderFee = parseFloat(updatedDraws[index].rush_order_fee) || 0;
      updatedDraws[index].funds_to_borrower = Math.max(0, approvedAmount - inspectionFee - wireFee - rushOrderFee);
    }

    const recalculatedDraws = recalculateDraws(updatedDraws);
    setDraws(recalculatedDraws);
    saveDraws(recalculatedDraws);
  };

  const saveDraws = (updatedDraws) => {
    onUpdate({ draws: updatedDraws });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Draw Tracking</CardTitle>
          {canEdit && (
            <Button onClick={handleAddDraw} size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Add Draw
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border bg-white p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Total Rehab Budget
            </div>
            <div className="mt-2 text-lg font-semibold text-slate-900">
              ${(loan.total_rehab_budget || 0).toLocaleString()}
            </div>
          </div>
          <div className="rounded-lg border bg-white p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Total Disburse
            </div>
            <div className="mt-2 text-lg font-semibold text-slate-900">
              ${calculateDisimburseCumulative(draws).toLocaleString()}
            </div>
          </div>
          <div className="rounded-lg border bg-white p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Net Funds to Borrower
            </div>
            <div className="mt-2 text-lg font-semibold text-slate-900">
              ${calculateFundsCumulative(draws).toLocaleString()}
            </div>
          </div>
        </div>
        {draws.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <p>No draws recorded yet</p>
            {canEdit && (
              <Button onClick={handleAddDraw} variant="outline" className="mt-4">
                <Plus className="w-4 h-4 mr-2" />
                Add First Draw
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Draw #</TableHead>
                  <TableHead>Inspection Company</TableHead>
                  <TableHead>Approved Amount</TableHead>
                  <TableHead>Inspection Fee</TableHead>
                  <TableHead>Wire Fee</TableHead>
                  <TableHead>Rush Order Fee</TableHead>
                  <TableHead>Funds to Borrower</TableHead>
                  <TableHead>Remaining Budget</TableHead>
                  <TableHead>Release Date</TableHead>
                  {canEdit && <TableHead>Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {draws.map((draw, index) => (
                  <TableRow key={draw.id}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>
                      <Select
                        value={draw.inspection_company}
                        onValueChange={(value) => handleDrawChange(index, 'inspection_company', value)}
                        disabled={!canEdit}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Trinity">Trinity</SelectItem>
                          <SelectItem value="Sitewire">Sitewire</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={draw.approved_amount || ''}
                        onChange={(e) => handleDrawChange(index, 'approved_amount', parseFloat(e.target.value) || 0)}
                        placeholder="$10,000"
                        disabled={!canEdit}
                        className="w-32"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={draw.inspection_fee || ''}
                        onChange={(e) => handleDrawChange(index, 'inspection_fee', parseFloat(e.target.value) || 0)}
                        placeholder="$0"
                        disabled={!canEdit}
                        className="w-28"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={draw.wire_fee || ''}
                        onChange={(e) => handleDrawChange(index, 'wire_fee', parseFloat(e.target.value) || 0)}
                        placeholder="$25"
                        disabled={!canEdit}
                        className="w-24"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={draw.rush_order_fee || ''}
                        onChange={(e) => handleDrawChange(index, 'rush_order_fee', parseFloat(e.target.value) || 0)}
                        placeholder="$0"
                        disabled={!canEdit}
                        className="w-24"
                      />
                    </TableCell>
                    <TableCell>
                      ${(draw.funds_to_borrower || 0).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      ${(draw.remaining_budget || 0).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Input
                        type="date"
                        value={draw.net_draw_released_date || ''}
                        onChange={(e) => handleDrawChange(index, 'net_draw_released_date', e.target.value)}
                        disabled={!canEdit}
                        className="w-40"
                      />
                    </TableCell>
                    {canEdit && (
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveDraw(index)}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
