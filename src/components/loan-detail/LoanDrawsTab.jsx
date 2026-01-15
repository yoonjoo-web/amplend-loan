import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";

export default function LoanDrawsTab({ loan, onUpdate, currentUser }) {
  const { toast } = useToast();
  const [draws, setDraws] = useState(loan.draws || []);
  const [draftDraws, setDraftDraws] = useState([]);
  const [drawRequests, setDrawRequests] = useState(loan.draw_requests || []);
  const [requestForm, setRequestForm] = useState({
    itemName: '',
    amount: '',
    rushOrder: 'no'
  });
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);

  const canEdit = currentUser && (
    currentUser.role === 'admin' || 
    ['Administrator', 'Loan Officer'].includes(currentUser.app_role)
  );
  const isBorrower = currentUser?.app_role === 'Borrower';
  const canSubmitRequest = (isBorrower && loan.borrower_ids?.includes(currentUser.id)) || canEdit;

  const formatCurrency = (value) => {
    if (value === '' || value === null || Number.isNaN(value)) return '';
    return `$${Number(value).toLocaleString()}`;
  };

  const parseCurrencyInput = (value) => {
    const normalized = value.replace(/[^0-9.]/g, '');
    if (!normalized) return '';
    const parsed = Number.parseFloat(normalized);
    return Number.isNaN(parsed) ? '' : parsed;
  };

  const calculateDisimburseCumulative = (drawsList) => {
    return drawsList.reduce((sum, draw) => sum + (parseFloat(draw.approved_amount) || 0), 0);
  };

  const calculateFundsCumulative = (drawsList) => {
    return drawsList.reduce((sum, draw) => sum + (parseFloat(draw.funds_to_borrower) || 0), 0);
  };

  const applyDraftTotals = (draft) => {
    const approvedAmount = parseFloat(draft.approved_amount) || 0;
    const inspectionFee = parseFloat(draft.inspection_fee) || 0;
    const wireFee = parseFloat(draft.wire_fee) || 0;
    const rushOrderFee = parseFloat(draft.rush_order_fee) || 0;
    const fundsToBorrower = Math.max(0, approvedAmount - inspectionFee - wireFee - rushOrderFee);
    const baseDisburse = calculateDisimburseCumulative(draws);
    const baseFunds = calculateFundsCumulative(draws);

    return {
      ...draft,
      funds_to_borrower: fundsToBorrower,
      total_disimburse: baseDisburse + approvedAmount,
      net_funds_to_borrower: baseFunds + fundsToBorrower,
      remaining_budget: (loan.total_rehab_budget || 0) - (baseDisburse + approvedAmount)
    };
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

  const handleCreateDrawFromRequest = (requestId) => {
    const request = drawRequests.find((item) => item.id === requestId);
    if (!request) return;

    const approvedAmount = parseFloat(request.request_amount) || 0;

    const draftDraw = applyDraftTotals({
      id: Date.now().toString(),
      draw_request_id: request.id,
      requested_item_name: request.item_name || '',
      rush_order_requested: !!request.rush_order,
      inspection_company: '',
      total_rehab_budget: loan.total_rehab_budget || 0,
      approved_amount: approvedAmount,
      inspection_fee: 0,
      wire_fee: 25,
      rush_order_fee: 0,
      net_draw_released_date: ''
    });

    const updatedDrafts = [...draftDraws, draftDraw];
    const updatedRequests = drawRequests.map((item) => (
      item.id === requestId
        ? {
          ...item,
          status: 'draft',
          draft_draw_id: draftDraw.id,
          drafted_at: new Date().toISOString(),
          drafted_by: currentUser?.id || 'unknown'
        }
        : item
    ));

    setDraftDraws(updatedDrafts);
    setDrawRequests(updatedRequests);
    saveDrawRequests(updatedRequests);

    toast({
      title: "Draft Created",
      description: "The draw is ready for edits. Save it to finalize.",
    });
  };

  const handleDraftChange = (index, field, value) => {
    const updatedDrafts = [...draftDraws];
    updatedDrafts[index] = applyDraftTotals({ ...updatedDrafts[index], [field]: value });
    setDraftDraws(updatedDrafts);
  };

  const handleDiscardDraft = (index) => {
    const draft = draftDraws[index];
    const updatedDrafts = draftDraws.filter((_, i) => i !== index);
    const updatedRequests = drawRequests.map((item) => (
      item.id === draft.draw_request_id
        ? {
          ...item,
          status: 'pending',
          draft_draw_id: null,
          drafted_at: null,
          drafted_by: null
        }
        : item
    ));

    setDraftDraws(updatedDrafts);
    setDrawRequests(updatedRequests);
    saveDrawRequests(updatedRequests);
  };

  const handleSaveDraftDraw = (index) => {
    const draft = draftDraws[index];
    if (!draft) return;

    const updatedDraws = recalculateDraws([...draws, draft]);
    const updatedDrafts = draftDraws.filter((_, i) => i !== index);
    const updatedRequests = drawRequests.map((item) => (
      item.id === draft.draw_request_id
        ? {
          ...item,
          status: 'converted',
          converted_draw_id: draft.id,
          converted_at: new Date().toISOString(),
          converted_by: currentUser?.id || 'unknown'
        }
        : item
    ));

    setDraws(updatedDraws);
    setDraftDraws(updatedDrafts);
    setDrawRequests(updatedRequests);
    onUpdate({ draws: updatedDraws, draw_requests: updatedRequests });

    toast({
      title: "Draw Saved",
      description: "The draw has been saved to the loan.",
    });
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

  const saveDrawRequests = (updatedRequests) => {
    onUpdate({ draw_requests: updatedRequests });
  };

  const handleSubmitRequest = async (event) => {
    event.preventDefault();
    if (!requestForm.itemName.trim() || requestForm.amount === '') {
      toast({
        variant: "destructive",
        title: "Missing Details",
        description: "Provide an item name and request amount before submitting.",
      });
      return;
    }

    setIsSubmittingRequest(true);
    const requesterName = currentUser?.first_name && currentUser?.last_name
      ? `${currentUser.first_name} ${currentUser.last_name}`
      : currentUser?.full_name || currentUser?.email || 'Borrower';

    const newRequest = {
      id: Date.now().toString(),
      item_name: requestForm.itemName.trim(),
      request_amount: requestForm.amount,
      rush_order: requestForm.rushOrder === 'yes',
      requested_by: currentUser?.id || 'unknown',
      requested_by_name: requesterName,
      created_at: new Date().toISOString(),
      status: 'pending'
    };

    const updatedRequests = [...drawRequests, newRequest];
    setDrawRequests(updatedRequests);
    saveDrawRequests(updatedRequests);

    const assignedLoanOfficerIds = loan.loan_officer_ids || [];
    if (assignedLoanOfficerIds.length > 0) {
      try {
        await base44.functions.invoke('createNotification', {
          user_ids: assignedLoanOfficerIds,
          message: `New draw request submitted: ${newRequest.item_name} for ${formatCurrency(newRequest.request_amount)}.`,
          type: 'draw_request',
          entity_type: 'Loan',
          entity_id: loan.id,
          link_url: `/LoanDetail?id=${loan.id}`,
          priority: 'high'
        });
      } catch (notifError) {
        console.error('Error creating draw request notification:', notifError);
      }

      try {
        const usersResponse = await base44.functions.invoke('getAllUsers');
        const allUsers = usersResponse?.data?.users || [];
        const assignedLoanOfficers = allUsers.filter((user) => assignedLoanOfficerIds.includes(user.id));

        for (const officer of assignedLoanOfficers) {
          if (!officer.email) continue;
          try {
            await base44.integrations.Core.SendEmail({
              to: officer.email,
              subject: `New Draw Request - Loan #${loan.loan_number || loan.primary_loan_id || loan.id}`,
              body: `Hello ${officer.first_name || 'Loan Officer'},

A new draw request has been submitted for loan ${loan.loan_number || loan.primary_loan_id || loan.id}.

Item: ${newRequest.item_name}
Requested Amount: ${formatCurrency(newRequest.request_amount)}
Rush Order: ${newRequest.rush_order ? 'Yes' : 'No'}
Requested By: ${requesterName}

Please log in to review and create a draw if approved.

Best regards,
Amplend Team`
            });
          } catch (emailError) {
            console.error('Error sending draw request email:', emailError);
          }
        }
      } catch (userError) {
        console.error('Error loading loan officer emails:', userError);
      }
    }

    toast({
      title: "Draw Request Submitted",
      description: assignedLoanOfficerIds.length > 0
        ? "Assigned loan officers have been notified."
        : "Your draw request has been submitted.",
    });

    setRequestForm({
      itemName: '',
      amount: '',
      rushOrder: 'no'
    });
    setIsSubmittingRequest(false);
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

        <div className="mb-8 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Draws</h3>
              <p className="text-sm text-slate-500">
                Saved draws appear here once finalized.
              </p>
            </div>
          </div>

          {draws.length === 0 ? (
            <div className="rounded-lg border border-dashed bg-white p-6 text-center text-sm text-slate-500">
              <p>No draws recorded yet.</p>
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
                          value={draw.approved_amount === '' ? '' : formatCurrency(draw.approved_amount)}
                          onChange={(e) => handleDrawChange(index, 'approved_amount', parseCurrencyInput(e.target.value))}
                          placeholder="$10,000"
                          disabled={!canEdit}
                          inputMode="decimal"
                          className="w-32"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={draw.inspection_fee === '' ? '' : formatCurrency(draw.inspection_fee)}
                          onChange={(e) => handleDrawChange(index, 'inspection_fee', parseCurrencyInput(e.target.value))}
                          placeholder="$0"
                          disabled={!canEdit}
                          inputMode="decimal"
                          className="w-28"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={draw.wire_fee === '' ? '' : formatCurrency(draw.wire_fee)}
                          onChange={(e) => handleDrawChange(index, 'wire_fee', parseCurrencyInput(e.target.value))}
                          placeholder="$25"
                          disabled={!canEdit}
                          inputMode="decimal"
                          className="w-24"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={draw.rush_order_fee === '' ? '' : formatCurrency(draw.rush_order_fee)}
                          onChange={(e) => handleDrawChange(index, 'rush_order_fee', parseCurrencyInput(e.target.value))}
                          placeholder="$0"
                          disabled={!canEdit}
                          inputMode="decimal"
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

          {draftDraws.length > 0 && (
            <div className="space-y-3">
              <div>
                <h4 className="text-sm font-semibold text-slate-900">Draft Draws</h4>
                <p className="text-xs text-slate-500">
                  Review edits, then save to finalize.
                </p>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Inspection Company</TableHead>
                      <TableHead>Approved Amount</TableHead>
                      <TableHead>Inspection Fee</TableHead>
                      <TableHead>Wire Fee</TableHead>
                      <TableHead>Rush Order Fee</TableHead>
                      <TableHead>Funds to Borrower</TableHead>
                      <TableHead>Remaining Budget</TableHead>
                      <TableHead>Release Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {draftDraws.map((draft, index) => (
                      <TableRow key={draft.id}>
                        <TableCell className="font-medium text-slate-900">
                          {draft.requested_item_name || 'Draw'}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={draft.inspection_company}
                            onValueChange={(value) => handleDraftChange(index, 'inspection_company', value)}
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
                            value={draft.approved_amount === '' ? '' : formatCurrency(draft.approved_amount)}
                            onChange={(e) => handleDraftChange(index, 'approved_amount', parseCurrencyInput(e.target.value))}
                            placeholder="$10,000"
                            inputMode="decimal"
                            className="w-32"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={draft.inspection_fee === '' ? '' : formatCurrency(draft.inspection_fee)}
                            onChange={(e) => handleDraftChange(index, 'inspection_fee', parseCurrencyInput(e.target.value))}
                            placeholder="$0"
                            inputMode="decimal"
                            className="w-28"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={draft.wire_fee === '' ? '' : formatCurrency(draft.wire_fee)}
                            onChange={(e) => handleDraftChange(index, 'wire_fee', parseCurrencyInput(e.target.value))}
                            placeholder="$25"
                            inputMode="decimal"
                            className="w-24"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={draft.rush_order_fee === '' ? '' : formatCurrency(draft.rush_order_fee)}
                            onChange={(e) => handleDraftChange(index, 'rush_order_fee', parseCurrencyInput(e.target.value))}
                            placeholder="$0"
                            inputMode="decimal"
                            className="w-24"
                          />
                        </TableCell>
                        <TableCell>
                          ${(draft.funds_to_borrower || 0).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          ${(draft.remaining_budget || 0).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Input
                            type="date"
                            value={draft.net_draw_released_date || ''}
                            onChange={(e) => handleDraftChange(index, 'net_draw_released_date', e.target.value)}
                            className="w-40"
                          />
                        </TableCell>
                        <TableCell className="space-x-2">
                          <Button size="sm" onClick={() => handleSaveDraftDraw(index)}>
                            Save Draw
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleDiscardDraft(index)}>
                            Discard
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>

        <div className="mb-8 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Draw Requests</h3>
              <p className="text-sm text-slate-500">
                Borrowers can submit requests. Loan officers and admins can convert them into draws.
              </p>
            </div>
          </div>

          {canSubmitRequest && (
            <form onSubmit={handleSubmitRequest} className="rounded-lg border bg-slate-50 p-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="draw-request-item">Item Name</Label>
                  <Input
                    id="draw-request-item"
                    value={requestForm.itemName}
                    onChange={(e) => setRequestForm((prev) => ({ ...prev, itemName: e.target.value }))}
                    placeholder="Kitchen cabinets"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="draw-request-amount">Request Amount</Label>
                  <Input
                    id="draw-request-amount"
                    value={requestForm.amount === '' ? '' : formatCurrency(requestForm.amount)}
                    onChange={(e) => setRequestForm((prev) => ({ ...prev, amount: parseCurrencyInput(e.target.value) }))}
                    placeholder="$10,000"
                    inputMode="decimal"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="draw-request-rush">Rush Order</Label>
                  <Select
                    value={requestForm.rushOrder}
                    onValueChange={(value) => setRequestForm((prev) => ({ ...prev, rushOrder: value }))}
                  >
                    <SelectTrigger id="draw-request-rush">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes">Yes</SelectItem>
                      <SelectItem value="no">No</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-slate-500">
                    Rush order guarantees the inspection is scheduled within 24 hours for an extra fee.
                  </p>
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <Button type="submit" disabled={isSubmittingRequest}>
                  Submit Draw Request
                </Button>
              </div>
            </form>
          )}

          {drawRequests.length === 0 ? (
            <div className="rounded-lg border border-dashed bg-white p-6 text-center text-sm text-slate-500">
              No draw requests yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Rush Order</TableHead>
                    <TableHead>Requested By</TableHead>
                    <TableHead>Requested On</TableHead>
                    <TableHead>Status</TableHead>
                    {canEdit && <TableHead>Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {drawRequests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell className="font-medium text-slate-900">
                        {request.item_name}
                      </TableCell>
                      <TableCell>{formatCurrency(request.request_amount || 0)}</TableCell>
                      <TableCell>{request.rush_order ? 'Yes' : 'No'}</TableCell>
                      <TableCell>{request.requested_by_name || 'Borrower'}</TableCell>
                      <TableCell>
                        {request.created_at ? new Date(request.created_at).toLocaleDateString() : '-'}
                      </TableCell>
                      <TableCell className="capitalize">
                        {request.status || 'pending'}
                      </TableCell>
                      {canEdit && (
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleCreateDrawFromRequest(request.id)}
                            disabled={request.status === 'converted' || request.status === 'draft'}
                          >
                            {request.status === 'draft' ? 'Draft Created' : 'Create Draw'}
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

      </CardContent>
    </Card>
  );
}
