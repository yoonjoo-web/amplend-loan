import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { User } from "@/entities/all";
import { Save, X } from "lucide-react";
import { format, addMonths } from "date-fns";

export default function LoanForm({ loan, onSubmit, onCancel, isProcessing }) {
  const [users, setUsers] = useState([]);
  const [formData, setFormData] = useState({
    borrower_ids: [],
    loan_officer_ids: [],
    guarantor_ids: [],
    referrer_ids: [],
    loan_number: '',
    loan_type: 'personal',
    principal_amount: '',
    interest_rate: '',
    term_months: '',
    purpose: '',
    collateral: '',
    application_date: format(new Date(), 'yyyy-MM-dd'),
    status: 'pending',
    notes: '',
    ...loan
  });

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    const data = await User.list();
    setUsers(data);
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };
      if (['principal_amount', 'interest_rate', 'term_months'].includes(field)) {
        const principal = parseFloat(updated.principal_amount) || 0;
        const rate = parseFloat(updated.interest_rate) || 0;
        const months = parseInt(updated.term_months) || 0;
        
        if (principal && rate && months) {
          const monthlyRate = rate / 100 / 12;
          const monthlyPayment = principal * (monthlyRate * Math.pow(1 + monthlyRate, months)) / (Math.pow(1 + monthlyRate, months) - 1);
          updated.monthly_payment = monthlyPayment.toFixed(2);
          
          if (updated.application_date) {
            const maturityDate = addMonths(new Date(updated.application_date), months);
            updated.maturity_date = format(maturityDate, 'yyyy-MM-dd');
          }
        }
      }
      return updated;
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      current_balance: formData.principal_amount,
      loan_number: formData.loan_number || `LN-${Date.now()}`
    });
  };

  const getUserOptions = (role) => {
    return users
      .filter(u => !role || u.app_role === role)
      .map(u => ({ value: u.id, label: u.full_name || u.email }));
  };

  return (
    <Card className="border-0 shadow-xl bg-white">
      <CardHeader className="pb-6">
        <CardTitle className="text-2xl font-bold text-slate-900">
          {loan ? 'Edit Loan' : 'New Loan Application'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="borrowers">Borrowers *</Label>
              <MultiSelect
                options={getUserOptions('Borrower')}
                selected={formData.borrower_ids || []}
                onChange={(value) => handleInputChange('borrower_ids', value)}
                placeholder="Select borrowers..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="loan_officers">Loan Officers</Label>
              <MultiSelect
                options={getUserOptions('Loan Officer')}
                selected={formData.loan_officer_ids || []}
                onChange={(value) => handleInputChange('loan_officer_ids', value)}
                placeholder="Select loan officers..."
              />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="guarantors">Guarantors</Label>
              <MultiSelect
                options={getUserOptions('Guarantor')}
                selected={formData.guarantor_ids || []}
                onChange={(value) => handleInputChange('guarantor_ids', value)}
                placeholder="Select guarantors..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="referrers">Referrers</Label>
              <MultiSelect
                options={getUserOptions('Referrer')}
                selected={formData.referrer_ids || []}
                onChange={(value) => handleInputChange('referrer_ids', value)}
                placeholder="Select referrers..."
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="loan_number">Loan Number</Label>
              <Input
                id="loan_number"
                value={formData.loan_number}
                onChange={(e) => handleInputChange('loan_number', e.target.value)}
                placeholder="Auto-generated if empty"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="loan_type">Loan Type *</Label>
              <Select
                value={formData.loan_type}
                onValueChange={(value) => handleInputChange('loan_type', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="personal">Personal Loan</SelectItem>
                  <SelectItem value="auto">Auto Loan</SelectItem>
                  <SelectItem value="mortgage">Mortgage</SelectItem>
                  <SelectItem value="business">Business Loan</SelectItem>
                  <SelectItem value="student">Student Loan</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="principal_amount">Principal Amount *</Label>
              <Input
                id="principal_amount"
                type="number"
                step="0.01"
                value={formData.principal_amount}
                onChange={(e) => handleInputChange('principal_amount', e.target.value)}
                placeholder="0.00"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="interest_rate">Interest Rate (%) *</Label>
              <Input
                id="interest_rate"
                type="number"
                step="0.01"
                value={formData.interest_rate}
                onChange={(e) => handleInputChange('interest_rate', e.target.value)}
                placeholder="0.00"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="term_months">Term (Months) *</Label>
              <Input
                id="term_months"
                type="number"
                value={formData.term_months}
                onChange={(e) => handleInputChange('term_months', e.target.value)}
                placeholder="12"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="monthly_payment">Monthly Payment</Label>
              <Input
                id="monthly_payment"
                type="number"
                step="0.01"
                value={formData.monthly_payment || ''}
                readOnly
                placeholder="Calculated automatically"
                className="bg-slate-50"
              />
            </div>
          </div>
          {/* ... other form fields (purpose, collateral, etc) can go here ... */}
          <div className="flex justify-end gap-3 pt-6 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isProcessing}
            >
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isProcessing}
              className="bg-slate-900 hover:bg-slate-800"
            >
              <Save className="w-4 h-4 mr-2" />
              {isProcessing ? 'Saving...' : 'Save Loan'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}