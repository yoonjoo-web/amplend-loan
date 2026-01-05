
import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { format, addMonths, differenceInMonths } from "date-fns";

export default function LoanCalculatorTab({ loan }) {
  const [calculations, setCalculations] = useState({
    remainingBalance: 0,
    totalInterestPaid: 0,
    totalPrincipalPaid: 0,
    nextPaymentDate: null,
    nextPaymentAmount: 0,
    paymentsMade: 0,
    paymentsRemaining: 0,
    monthsElapsed: 0,
    daysUntilMaturity: 0,
    currentLTV: 0,
    equityBuilt: 0
  });

  useEffect(() => {
    calculateLoanMetrics();
  }, [loan]);

  const calculateLoanMetrics = () => {
    if (!loan.origination_date || !loan.maturity_date || !loan.total_loan_amount) {
      return;
    }

    const originationDate = new Date(loan.origination_date);
    const maturityDate = new Date(loan.maturity_date);
    const today = new Date();
    const firstPaymentDate = loan.first_payment_date ? new Date(loan.first_payment_date) : addMonths(originationDate, 1);

    // Calculate months elapsed since origination
    // Ensure payments don't start before firstPaymentDate
    const monthsElapsed = differenceInMonths(today, firstPaymentDate);
    const paymentsMade = Math.max(0, monthsElapsed);

    // Calculate total loan term in months
    const totalTermMonths = loan.loan_term_months || differenceInMonths(maturityDate, originationDate);
    const paymentsRemaining = Math.max(0, totalTermMonths - paymentsMade);

    // Calculate monthly payment
    const monthlyRate = (loan.interest_rate || 0) / 100 / 12;
    const loanAmount = loan.total_loan_amount || 0;
    
    let monthlyPayment = loan.monthly_payment || 0;
    const interestOnlyMonths = loan.interest_only_period_months || 0;

    if (!monthlyPayment && monthlyRate > 0 && totalTermMonths > 0) {
      if (interestOnlyMonths > 0 && totalTermMonths > interestOnlyMonths) {
        // Calculate amortizing payment for the period AFTER interest-only
        const amortizingMonths = totalTermMonths - interestOnlyMonths;
        // The amortizing payment is calculated based on the original loan amount
        // over the remaining amortizing term, as if the loan was fully amortizing from the start
        // for that specific period.
        // This is a simplification; a more accurate calculation would involve carrying
        // the balance forward after the interest-only period if no principal was paid.
        // For simplicity and common loan products, we assume the original amount amortizes over the full term
        // or a calculated term, but with IO only affecting early payments.
        // If 'monthly_payment' is not provided, we must infer it.
        // A common interpretation for 'interest_only_period_months' without an explicit amortizing payment
        // is that the 'monthly_payment' field should hold the *amortizing* payment for the non-IO phase,
        // or we calculate it based on the original terms.
        // Let's assume for now, if monthly_payment is not provided, we calculate a standard amortizing payment
        // over the full term, and then adjust for IO phases during calculation of actual principal/interest paid.
        // This is a critical point of interpretation for "monthly_payment || 0" vs. calculating it.
        // The current code calculates an amortizing payment over 'remainingMonths' (total - IO).
        // Let's stick to the current logic: if monthly_payment not given, calculate.
        
        // If we are in interest-only period and no monthly_payment is set explicitly
        if (paymentsMade < interestOnlyMonths) {
          monthlyPayment = loanAmount * monthlyRate; // Interest-only payment
        } else {
          // If we are past IO or no IO, calculate standard amortizing payment
          const effectiveTermForAmortization = totalTermMonths - interestOnlyMonths;
          if (effectiveTermForAmortization > 0) {
            monthlyPayment = (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, effectiveTermForAmortization)) / 
                             (Math.pow(1 + monthlyRate, effectiveTermForAmortization) - 1);
          } else {
            // Edge case: entire loan term is interest-only or invalid
            monthlyPayment = loanAmount * monthlyRate;
          }
        }
      } else if (monthlyRate > 0 && totalTermMonths > 0) {
         // No interest-only period, standard amortizing loan
        monthlyPayment = (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, totalTermMonths)) / 
                         (Math.pow(1 + monthlyRate, totalTermMonths) - 1);
      }
    }


    // Calculate principal and interest paid
    let totalInterestPaid = 0;
    let totalPrincipalPaid = 0;
    let remainingBalance = loanAmount;
    let currentBalanceForCalc = loanAmount; // Use a separate variable for iteration

    for (let i = 1; i <= paymentsMade; i++) {
      const interestPayment = currentBalanceForCalc * monthlyRate;
      
      if (i <= interestOnlyMonths) {
        // Interest-only period: principal does not reduce
        totalInterestPaid += interestPayment;
        // currentBalanceForCalc remains the same as no principal paid
      } else {
        // Amortizing period: payment reduces principal
        // Use the calculated monthlyPayment (either provided or amortizing one)
        const principalPayment = monthlyPayment - interestPayment;
        totalInterestPaid += interestPayment;
        totalPrincipalPaid += principalPayment;
        currentBalanceForCalc -= principalPayment;
      }
    }
    remainingBalance = Math.max(0, currentBalanceForCalc); // Ensure balance doesn't go negative

    // Next payment date
    // Calculate the actual next payment due date based on first payment date and payments made.
    const nextPaymentDate = addMonths(firstPaymentDate, paymentsMade);


    // Days until maturity
    const daysUntilMaturity = Math.ceil((maturityDate - today) / (1000 * 60 * 60 * 24));

    // Current LTV
    const currentPropertyValue = loan.as_is_appraisal_value || loan.after_repair_appraisal_value || 0;
    const currentLTV = currentPropertyValue > 0 ? (remainingBalance / currentPropertyValue) * 100 : 0;

    // Equity built
    const equityBuilt = totalPrincipalPaid;

    setCalculations({
      remainingBalance,
      totalInterestPaid,
      totalPrincipalPaid,
      nextPaymentDate,
      nextPaymentAmount: monthlyPayment, // This should be the payment for the next cycle, potentially different if IO ends.
      paymentsMade,
      paymentsRemaining,
      monthsElapsed,
      daysUntilMaturity,
      currentLTV,
      equityBuilt
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount);
  };

  return (
    <Card>
      <CardContent className="p-8">
        <div className="space-y-8 max-w-4xl">
          {/* Loan Summary */}
          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Loan Summary</h3>
            <div className="grid grid-cols-3 gap-6">
              <div>
                <p className="text-sm text-slate-500 mb-1">Original Loan Amount</p>
                <p className="text-2xl font-bold text-slate-900">{formatCurrency(loan.total_loan_amount || 0)}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500 mb-1">Interest Rate</p>
                <p className="text-2xl font-bold text-slate-900">{loan.interest_rate || 0}%</p>
              </div>
              <div>
                <p className="text-sm text-slate-500 mb-1">Loan Term</p>
                <p className="text-2xl font-bold text-slate-900">{loan.loan_term_months || 0} months</p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Current Status */}
          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Current Status</h3>
            <div className="grid grid-cols-2 gap-x-12 gap-y-4">
              <div className="flex justify-between items-center py-3 border-b border-slate-100">
                <span className="text-sm text-slate-600">Remaining Balance</span>
                <span className="font-semibold text-emerald-600">{formatCurrency(calculations.remainingBalance)}</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-slate-100">
                <span className="text-sm text-slate-600">Next Payment Due</span>
                <span className="font-semibold text-slate-900">
                  {calculations.nextPaymentDate ? format(calculations.nextPaymentDate, 'MMM d, yyyy') : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-slate-100">
                <span className="text-sm text-slate-600">Next Payment Amount</span>
                <span className="font-semibold text-slate-900">{formatCurrency(calculations.nextPaymentAmount)}</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-slate-100">
                <span className="text-sm text-slate-600">Current LTV</span>
                <span className={`font-semibold ${calculations.currentLTV > 80 ? 'text-red-600' : 'text-slate-900'}`}>
                  {calculations.currentLTV.toFixed(2)}%
                </span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-slate-100">
                <span className="text-sm text-slate-600">Days Until Maturity</span>
                <span className={`font-semibold ${calculations.daysUntilMaturity < 30 && calculations.daysUntilMaturity > 0 ? 'text-orange-600' : calculations.daysUntilMaturity <= 0 ? 'text-red-600' : 'text-slate-900'}`}>
                  {calculations.daysUntilMaturity > 0 ? calculations.daysUntilMaturity : 'Matured'}
                </span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-slate-100">
                <span className="text-sm text-slate-600">Equity Built</span>
                <span className="font-semibold text-emerald-600">{formatCurrency(calculations.equityBuilt)}</span>
              </div>
            </div>
          </div>

          <Separator />

          {/* Payment Progress */}
          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Payment Progress</h3>
            <div className="grid grid-cols-2 gap-x-12 gap-y-4">
              <div className="flex justify-between items-center py-3 border-b border-slate-100">
                <span className="text-sm text-slate-600">Payments Made</span>
                <span className="font-semibold text-slate-900">{calculations.paymentsMade}</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-slate-100">
                <span className="text-sm text-slate-600">Payments Remaining</span>
                <span className="font-semibold text-slate-900">{calculations.paymentsRemaining}</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-slate-100">
                <span className="text-sm text-slate-600">Total Principal Paid</span>
                <span className="font-semibold text-blue-600">{formatCurrency(calculations.totalPrincipalPaid)}</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-slate-100">
                <span className="text-sm text-slate-600">Total Interest Paid</span>
                <span className="font-semibold text-slate-600">{formatCurrency(calculations.totalInterestPaid)}</span>
              </div>
            </div>
          </div>

          <Separator />

          {/* Loan Details */}
          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Loan Details</h3>
            <div className="grid grid-cols-2 gap-x-12 gap-y-4">
              <div className="flex justify-between items-center py-3 border-b border-slate-100">
                <span className="text-sm text-slate-600">Origination Date</span>
                <span className="font-semibold text-slate-900">
                  {loan.origination_date ? format(new Date(loan.origination_date), 'MMM d, yyyy') : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-slate-100">
                <span className="text-sm text-slate-600">First Payment Date</span>
                <span className="font-semibold text-slate-900">
                  {loan.first_payment_date ? format(new Date(loan.first_payment_date), 'MMM d, yyyy') : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-slate-100">
                <span className="text-sm text-slate-600">Maturity Date</span>
                <span className="font-semibold text-slate-900">
                  {loan.maturity_date ? format(new Date(loan.maturity_date), 'MMM d, yyyy') : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-slate-100">
                <span className="text-sm text-slate-600">Interest Only Period</span>
                <span className="font-semibold text-slate-900">{loan.interest_only_period_months || 0} months</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-slate-100">
                <span className="text-sm text-slate-600">Monthly Payment</span>
                <span className="font-semibold text-slate-900">{formatCurrency(calculations.nextPaymentAmount)}</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-slate-100">
                <span className="text-sm text-slate-600">Accrual Type</span>
                <span className="font-semibold text-slate-900">{loan.accrual_type || 'N/A'}</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-slate-100">
                <span className="text-sm text-slate-600">Rate Type</span>
                <span className="font-semibold text-slate-900">
                  {loan.rate_type === 'fixed' ? 'Fixed' : loan.rate_type === 'adjustable' ? 'Adjustable' : 'N/A'}
                </span>
              </div>
            </div>
          </div>

          {/* Escrow Information */}
          {(loan.property_insurance_escrow || loan.property_tax_escrow_1 || loan.property_tax_escrow_2) && (
            <>
              <Separator />
              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Escrow Accounts</h3>
                <div className="grid grid-cols-2 gap-x-12 gap-y-4">
                  {loan.property_insurance_escrow && (
                    <div className="flex justify-between items-center py-3 border-b border-slate-100">
                      <span className="text-sm text-slate-600">Property Insurance Escrow</span>
                      <span className="font-semibold text-slate-900">{formatCurrency(loan.property_insurance_escrow)}</span>
                    </div>
                  )}
                  {loan.property_tax_escrow_1 && (
                    <div className="flex justify-between items-center py-3 border-b border-slate-100">
                      <span className="text-sm text-slate-600">Property Tax Escrow 1</span>
                      <span className="font-semibold text-slate-900">{formatCurrency(loan.property_tax_escrow_1)}</span>
                    </div>
                  )}
                  {loan.property_tax_escrow_2 && (
                    <div className="flex justify-between items-center py-3 border-b border-slate-100">
                      <span className="text-sm text-slate-600">Property Tax Escrow 2</span>
                      <span className="font-semibold text-slate-900">{formatCurrency(loan.property_tax_escrow_2)}</span>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
