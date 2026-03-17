import {
  CheckSquare,
  ClipboardList,
  CircleUserRound,
  Folder,
  LayoutDashboard,
  TrendingUp,
} from "lucide-react";
import { createPageUrl } from "@/utils";

export const DEFAULT_LOAN_DETAIL_TAB = "dashboard";

export const loanDetailSubpages = [
  {
    key: "dashboard",
    title: "Loan Dashboard",
    description: "Default landing space for the loan workspace.",
    icon: LayoutDashboard,
    isPlaceholder: true,
  },
  {
    key: "tasks",
    title: "My Tasks",
    description: "Track assigned work for this loan.",
    icon: CircleUserRound,
    isPlaceholder: true,
  },
  {
    key: "documents",
    title: "Documents",
    description: "Review uploaded files and document activity.",
    icon: Folder,
    isPlaceholder: false,
  },
  {
    key: "details",
    title: "Loan Details",
    description: "Inspect the core terms and structured loan data.",
    icon: ClipboardList,
    isPlaceholder: false,
  },
  {
    key: "checklist",
    title: "Checklist",
    description: "Follow milestones and outstanding requirements.",
    icon: CheckSquare,
    isPlaceholder: true,
  },
  {
    key: "draws",
    title: "Draws",
    description: "Monitor draw requests and disbursement status.",
    icon: TrendingUp,
    isPlaceholder: true,
  },
];

export const isValidLoanDetailTab = (tab) =>
  loanDetailSubpages.some((subpage) => subpage.key === tab);

export const getLoanDetailSubpage = (tab) =>
  loanDetailSubpages.find((subpage) => subpage.key === tab) || loanDetailSubpages[0];

export const getLoanDetailTabUrl = (loanId, tab = DEFAULT_LOAN_DETAIL_TAB, extraParams = {}) => {
  const params = new URLSearchParams({
    id: loanId,
    tab,
  });

  Object.entries(extraParams).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, value);
    }
  });

  return `${createPageUrl("LoanDetail")}?${params.toString()}`;
};
