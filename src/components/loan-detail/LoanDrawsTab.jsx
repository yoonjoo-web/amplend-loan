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

  const calculateCumulative = (drawsList) => {
    return drawsList.reduce((sum, draw) => sum + (parseFloat(draw.approved_draw_amount) || 0), 0);
  };

  const handleAddDraw = () => {
    const cumulative = calculateCumulative(draws);
    const newDraw = {
      id: Date.now().toString(),
      inspection_company: '',
      financed_budget_amount: loan.financed_budget_amount || 0,
      approved_draw_amount: 0,
      approved_draw_cumulative: cumulative,
      remaining_budget_amount: (loan.financed_budget_amount || 0) - cumulative,
      net_draw_released: 0,
      net_draw_released_date: ''
    };
    const updatedDraws = [...draws, newDraw];
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
    
    if (field === 'approved_draw_amount') {
      const cumulative = calculateCumulative(updatedDraws);
      updatedDraws[index].approved_draw_cumulative = cumulative;
      updatedDraws[index].remaining_budget_amount = (loan.financed_budget_amount || 0) - cumulative;
    }
    
    setDraws(updatedDraws);
    saveDraws(updatedDraws);
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
                  <TableHead>Financed Budget</TableHead>
                  <TableHead>Approved Draw</TableHead>
                  <TableHead>Cumulative</TableHead>
                  <TableHead>Remaining Budget</TableHead>
                  <TableHead>Net Released</TableHead>
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
                          <SelectItem value="CFSI">CFSI</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      ${(draw.financed_budget_amount || 0).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={draw.approved_draw_amount || ''}
                        onChange={(e) => handleDrawChange(index, 'approved_draw_amount', parseFloat(e.target.value) || 0)}
                        placeholder="$10,000"
                        disabled={!canEdit}
                        className="w-32"
                      />
                    </TableCell>
                    <TableCell>
                      ${(draw.approved_draw_cumulative || 0).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      ${(draw.remaining_budget_amount || 0).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={draw.net_draw_released || ''}
                        onChange={(e) => handleDrawChange(index, 'net_draw_released', parseFloat(e.target.value) || 0)}
                        placeholder="$10,000"
                        disabled={!canEdit}
                        className="w-32"
                      />
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