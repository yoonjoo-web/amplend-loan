import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, PlayCircle, ChevronDown, ChevronUp } from "lucide-react";
import { toorakApiTest } from "@/functions/toorakApiTest";

const ORIGINATOR_PARTY_ID = "a1a75814-b55e-4ed8-b9cb-092aa31b11a8";

const defaultInputs = {
  // Loan Econ
  totalBudgetAmount: 200000,
  totalMaxLoanAmount: 400000,
  originalLoanAmount: "200000",
  totalOriginationAndDiscountPoints: "0.120000",
  interestReserve: 0,
  financedBudgetAmount: "200000",
  interestRate: "0.120000",
  includeOutOfPocketBudgetInARLTV: true,

  // Loan Info
  loanStructure: "Multiple Draws",
  product: "RENTAL",
  toorakProduct: "Rehab",
  loanType: "BRIDGE",
  loanStage: "FES",
  pledgeOfEquity: "Y",
  cashOutFlag: "No Cash Out",
  loanPurpose: "Purchase",
  exitStrategy: "Rehab to Hold/Rent",
  loanId: 1001,

  // Borrower
  originalCreditScoreMedian: "725",
  experience: "1",
  inState: "N",
  foreignNationalString: "No",

  // Property Info
  numberOfUnits: 2,
  propertyType: "SFR",
  city: "Dunbar",
  state: "WV",
  postalCode: "25064",

  // Property Econ
  grossPotentialRent: "8000",
  costBasisAfterCostIncurred: 512500,
  closingCost: "0.0250",
  originalAsIsAppraisalValue: "500000",
  originalAsRepairedAppraisedValue: "500000",
  purchasePrice: "500000",
  annualPropertyTaxes: "100",
  insurance: "100",
  annualHOAFee: "100",
};

function FieldRow({ label, field, value, onChange, type = "text" }) {
  return (
    <div className="flex items-center gap-3">
      <Label className="w-56 shrink-0 text-sm text-slate-600 text-right">{label}</Label>
      <Input
        type={type}
        value={value}
        onChange={(e) =>
          onChange(field, type === "number" ? (e.target.value === "" ? "" : Number(e.target.value)) : e.target.value)
        }
        className="flex-1 h-8 text-sm"
      />
    </div>
  );
}

function SectionBlock({ title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 text-sm text-slate-700 transition-colors"
      >
        {title}
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {open && <div className="px-4 py-4 space-y-3 bg-white">{children}</div>}
    </div>
  );
}

function ResultViewer({ result }) {
  const [expanded, setExpanded] = useState(false);
  if (!result) return null;

  const isSuccess = result.success;
  const data = result.result;

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader className="border-b border-slate-100 pb-3">
        <CardTitle className="text-base text-slate-900 flex items-center gap-2">
          Evaluation Result
          <Badge className={isSuccess ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}>
            {isSuccess ? "Success" : "Error"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        {result.error && (
          <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800">
            <strong>Error:</strong> {result.error}
            {result.details && (
              <pre className="mt-2 text-xs overflow-auto whitespace-pre-wrap">
                {typeof result.details === "object"
                  ? JSON.stringify(result.details, null, 2)
                  : result.details}
              </pre>
            )}
          </div>
        )}

        {data && (
          <>
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="text-sm text-slate-500 hover:text-slate-800 underline mb-3"
            >
              {expanded ? "Collapse" : "Expand"} full response
            </button>
            {expanded && (
              <pre className="text-xs bg-slate-50 border border-slate-200 rounded p-3 overflow-auto max-h-[500px] whitespace-pre-wrap">
                {JSON.stringify(data, null, 2)}
              </pre>
            )}
            {!expanded && (
              <div className="space-y-2">
                {data.eligible !== undefined && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-slate-700">Eligible:</span>
                    <Badge className={data.eligible ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}>
                      {String(data.eligible)}
                    </Badge>
                  </div>
                )}
                {data.ruleResults && (
                  <div className="text-sm text-slate-600">
                    <span>Rule Results:</span>{" "}
                    {Array.isArray(data.ruleResults) ? `${data.ruleResults.length} rules evaluated` : "See full response"}
                  </div>
                )}
                {data.message && (
                  <div className="text-sm text-slate-600">
                    <span>Message:</span> {data.message}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function ToorakApiTest() {
  const [inputs, setInputs] = useState({ ...defaultInputs });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleChange = (field, value) => {
    setInputs((prev) => ({ ...prev, [field]: value }));
  };

  const buildPayload = () => ({
    loanFact: {
      loan: {
        loanDetail: {
          originatorPartyId: ORIGINATOR_PARTY_ID,
          fundingType: "normal",
          originatorCategoryBucket: "NA",
        },
        loanEcon: {
          totalBudgetAmount: inputs.totalBudgetAmount,
          totalMaxLoanAmount: inputs.totalMaxLoanAmount,
          originalLoanAmount: String(inputs.originalLoanAmount),
          totalOriginationAndDiscountPoints: String(inputs.totalOriginationAndDiscountPoints),
          interestReserve: inputs.interestReserve,
          financedBudgetAmount: String(inputs.financedBudgetAmount),
          interestRate: String(inputs.interestRate),
          includeOutOfPocketBudgetInARLTV: inputs.includeOutOfPocketBudgetInARLTV,
        },
        loanInfo: {
          loanStructure: inputs.loanStructure,
          product: inputs.product,
          toorakProduct: inputs.toorakProduct,
          loanType: inputs.loanType,
          loanStage: inputs.loanStage,
          pledgeOfEquity: inputs.pledgeOfEquity,
          cashOutFlag: inputs.cashOutFlag,
          loanPurpose: inputs.loanPurpose,
          exitStrategy: inputs.exitStrategy,
          loanId: inputs.loanId,
        },
        loanUserMap: [
          {
            isPrimary: true,
            loanUserSequence: "1",
            loanUserType: "Borrower",
            originalCreditScoreMedian: String(inputs.originalCreditScoreMedian),
            experience: String(inputs.experience),
            inState: inputs.inState,
            customer: {
              partyType: "person",
              foreignNationalString: inputs.foreignNationalString,
            },
          },
        ],
      },
      properties: [
        {
          propertyId: 0,
          propertyInfo: {
            numberOfUnits: inputs.numberOfUnits,
            propertyType: inputs.propertyType,
            changeInUseCase: "N",
            valuationSource: "Appraisal",
            percentOccupied: 1,
          },
          propertyLocation: {
            city: inputs.city,
            state: inputs.state,
            postalCode: inputs.postalCode,
          },
          propertyEcon: {
            grossPotentialRent: String(inputs.grossPotentialRent),
            costBasisAfterCostIncurred: inputs.costBasisAfterCostIncurred,
            closingCost: String(inputs.closingCost),
            originalAsIsAppraisalValue: String(inputs.originalAsIsAppraisalValue),
            originalAsRepairedAppraisedValue: String(inputs.originalAsRepairedAppraisedValue),
            purchasePrice: String(inputs.purchasePrice),
            annualPropertyTaxes: String(inputs.annualPropertyTaxes),
            insurance: String(inputs.insurance),
            annualHOAFee: String(inputs.annualHOAFee),
          },
        },
      ],
    },
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const response = await toorakApiTest(buildPayload());
      setResult(response.data || response);
    } catch (err) {
      setResult({ success: false, error: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl text-slate-900">Toorak API Test (X-API-Key)</h1>
          <p className="text-sm text-slate-500 mt-1">
            UAT environment — Rule evaluation using <code className="bg-slate-100 px-1 rounded">X-API-Key</code> authentication.
          </p>
          <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
            <span className="text-slate-600">Originator Party ID:</span>
            <code className="bg-slate-100 px-2 py-0.5 rounded text-slate-700">{ORIGINATOR_PARTY_ID}</code>
            <Badge className="bg-slate-100 text-slate-600 text-xs">Locked</Badge>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <SectionBlock title="Loan Economics">
            <FieldRow label="Total Budget Amount" field="totalBudgetAmount" value={inputs.totalBudgetAmount} onChange={handleChange} type="number" />
            <FieldRow label="Total Max Loan Amount" field="totalMaxLoanAmount" value={inputs.totalMaxLoanAmount} onChange={handleChange} type="number" />
            <FieldRow label="Original Loan Amount" field="originalLoanAmount" value={inputs.originalLoanAmount} onChange={handleChange} />
            <FieldRow label="Total Origination & Discount Points" field="totalOriginationAndDiscountPoints" value={inputs.totalOriginationAndDiscountPoints} onChange={handleChange} />
            <FieldRow label="Interest Reserve" field="interestReserve" value={inputs.interestReserve} onChange={handleChange} type="number" />
            <FieldRow label="Financed Budget Amount" field="financedBudgetAmount" value={inputs.financedBudgetAmount} onChange={handleChange} />
            <FieldRow label="Interest Rate" field="interestRate" value={inputs.interestRate} onChange={handleChange} />
          </SectionBlock>

          <SectionBlock title="Loan Information">
            <FieldRow label="Loan Structure" field="loanStructure" value={inputs.loanStructure} onChange={handleChange} />
            <FieldRow label="Product" field="product" value={inputs.product} onChange={handleChange} />
            <FieldRow label="Toorak Product" field="toorakProduct" value={inputs.toorakProduct} onChange={handleChange} />
            <FieldRow label="Loan Type" field="loanType" value={inputs.loanType} onChange={handleChange} />
            <FieldRow label="Loan Stage" field="loanStage" value={inputs.loanStage} onChange={handleChange} />
            <FieldRow label="Pledge of Equity" field="pledgeOfEquity" value={inputs.pledgeOfEquity} onChange={handleChange} />
            <FieldRow label="Cash Out Flag" field="cashOutFlag" value={inputs.cashOutFlag} onChange={handleChange} />
            <FieldRow label="Loan Purpose" field="loanPurpose" value={inputs.loanPurpose} onChange={handleChange} />
            <FieldRow label="Exit Strategy" field="exitStrategy" value={inputs.exitStrategy} onChange={handleChange} />
            <FieldRow label="Loan ID" field="loanId" value={inputs.loanId} onChange={handleChange} type="number" />
          </SectionBlock>

          <SectionBlock title="Borrower (Primary)">
            <FieldRow label="Credit Score Median" field="originalCreditScoreMedian" value={inputs.originalCreditScoreMedian} onChange={handleChange} />
            <FieldRow label="Experience" field="experience" value={inputs.experience} onChange={handleChange} />
            <FieldRow label="In State (Y/N)" field="inState" value={inputs.inState} onChange={handleChange} />
            <FieldRow label="Foreign National" field="foreignNationalString" value={inputs.foreignNationalString} onChange={handleChange} />
          </SectionBlock>

          <SectionBlock title="Property Information">
            <FieldRow label="Number of Units" field="numberOfUnits" value={inputs.numberOfUnits} onChange={handleChange} type="number" />
            <FieldRow label="Property Type" field="propertyType" value={inputs.propertyType} onChange={handleChange} />
            <FieldRow label="City" field="city" value={inputs.city} onChange={handleChange} />
            <FieldRow label="State" field="state" value={inputs.state} onChange={handleChange} />
            <FieldRow label="Postal Code" field="postalCode" value={inputs.postalCode} onChange={handleChange} />
          </SectionBlock>

          <SectionBlock title="Property Economics">
            <FieldRow label="Gross Potential Rent" field="grossPotentialRent" value={inputs.grossPotentialRent} onChange={handleChange} />
            <FieldRow label="Cost Basis After Cost Incurred" field="costBasisAfterCostIncurred" value={inputs.costBasisAfterCostIncurred} onChange={handleChange} type="number" />
            <FieldRow label="Closing Cost" field="closingCost" value={inputs.closingCost} onChange={handleChange} />
            <FieldRow label="Original As-Is Appraisal Value" field="originalAsIsAppraisalValue" value={inputs.originalAsIsAppraisalValue} onChange={handleChange} />
            <FieldRow label="Original As-Repaired Appraised Value" field="originalAsRepairedAppraisedValue" value={inputs.originalAsRepairedAppraisedValue} onChange={handleChange} />
            <FieldRow label="Purchase Price" field="purchasePrice" value={inputs.purchasePrice} onChange={handleChange} />
            <FieldRow label="Annual Property Taxes" field="annualPropertyTaxes" value={inputs.annualPropertyTaxes} onChange={handleChange} />
            <FieldRow label="Insurance" field="insurance" value={inputs.insurance} onChange={handleChange} />
            <FieldRow label="Annual HOA Fee" field="annualHOAFee" value={inputs.annualHOAFee} onChange={handleChange} />
          </SectionBlock>

          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={loading}
              className="bg-slate-900 hover:bg-slate-800 flex items-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Evaluating...
                </>
              ) : (
                <>
                  <PlayCircle className="w-4 h-4" />
                  Run Evaluation
                </>
              )}
            </Button>
          </div>
        </form>

        {result && <ResultViewer result={result} />}
      </div>
    </div>
  );
}