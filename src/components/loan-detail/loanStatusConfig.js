export const LOAN_STATUS_OPTIONS = [
  {
    value: "underwriting",
    label: "Underwriting",
    description:
      "The lender is evaluating the borrower's financial information, credit history, experience, and other relevant factors for risk assessment.",
    color: "bg-purple-100 text-purple-800",
  },
  {
    value: "processing",
    label: "Processing",
    description:
      "The lender sent a list of required items and reviews the delivered documents for completeness and accuracy.",
    color: "bg-amber-100 text-amber-800",
  },
  {
    value: "on_hold",
    label: "On Hold",
    description: "The loan is being placed on hold until further notice.",
    color: "bg-slate-100 text-slate-800",
  },
  {
    value: "preclosed_review",
    label: "Preclosed Review",
    description:
      "The loan file is being reviewed before the post-appraisal term sheet is sent.",
    color: "bg-sky-100 text-sky-800",
  },
  {
    value: "term_sheet_sent",
    label: "Term Sheet Sent (Post-Appraisal)",
    description:
      "The post-appraisal term sheet is sent along with a completed appraisal report.",
    color: "bg-cyan-100 text-cyan-800",
  },
  {
    value: "conditional_approval",
    label: "Conditional Approval",
    description:
      "The lender issued a conditional approval contingent upon the satisfaction of specific conditions by the borrower.",
    color: "bg-yellow-100 text-yellow-800",
  },
  {
    value: "final_approval",
    label: "Final Approval",
    description:
      "Once all conditions are met, the lender grants final approval for the loan.",
    color: "bg-emerald-100 text-emerald-800",
  },
  {
    value: "clear_to_close",
    label: "Clear to Close (CTC)",
    description:
      "Clear-to-Close approval has been obtained from Title, Lender Attorney, Borrower, and Seller.",
    color: "bg-green-100 text-green-800",
  },
  {
    value: "closing_scheduled",
    label: "Closing Scheduled",
    description:
      "A closing date and time are scheduled for the borrower to sign the loan documents and finalize the transaction.",
    color: "bg-teal-100 text-teal-800",
  },
  {
    value: "loan_funded",
    label: "Loan Funded",
    description:
      "The approved loan amount has been disbursed to the Title/Borrower.",
    color: "bg-indigo-100 text-indigo-800",
  },
  {
    value: "loan_sold",
    label: "Loan Sold",
    description:
      "The funded loan has been sold to a loan buyer in the secondary market.",
    color: "bg-violet-100 text-violet-800",
  },
  {
    value: "in_house_servicing",
    label: "In-House Servicing",
    description:
      "The lender continues to manage the loan account, including processing payments, managing escrow accounts, and providing customer service support.",
    color: "bg-blue-100 text-blue-800",
  },
  {
    value: "draws_underway",
    label: "Draws Underway",
    description:
      "Either a rehab or construction project is progressing and the draw holdback amount still remains.",
    color: "bg-orange-100 text-orange-800",
  },
  {
    value: "draws_fully_released",
    label: "Draws Fully Released",
    description:
      "Financed budget amount is fully drawn and the loan is waiting to be repaid.",
    color: "bg-lime-100 text-lime-800",
  },
  {
    value: "archived",
    label: "Archived",
    description: "The loan is fully paid off and thus closed.",
    color: "bg-gray-100 text-gray-800",
  },
  {
    value: "dead",
    label: "Dead",
    description:
      "The loan is permanently closed with no possibility of revival.",
    color: "bg-gray-100 text-gray-800",
  },
];

export const LOAN_STATUS_MAP = Object.fromEntries(
  LOAN_STATUS_OPTIONS.map((status) => [status.value, status])
);

export const LOAN_PROGRESS_STATUS_OPTIONS = LOAN_STATUS_OPTIONS.filter(
  (status) => !["archived", "dead"].includes(status.value)
);

export const getLoanStatusMeta = (status) =>
  LOAN_STATUS_MAP[status] || {
    value: status,
    label: status
      ? status
          .split("_")
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" ")
      : "Unknown Status",
    description: "This loan has an unrecognized status.",
    color: "bg-gray-100 text-gray-800",
  };
