import {
  CheckSquare,
  ClipboardList,
  CircleUserRound,
  Folder,
  LayoutDashboard,
  PenTool,
  TrendingUp,
} from "lucide-react";
import { createPageUrl } from "@/utils";
import { normalizeAppRole } from "@/components/utils/appRoles";

export const DEFAULT_LOAN_DETAIL_TAB = "dashboard";

const ALL_LOAN_DETAIL_SUBPAGES = [
  {
    key: "dashboard",
    title: "Dashboard",
    description: "Default landing space for the loan workspace.",
    icon: LayoutDashboard,
    isPlaceholder: true,
  },
  {
    key: "workspace",
    title: "Workspace",
    description: "Central workspace for loan collaboration and activity.",
    icon: PenTool,
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

const MANAGER_TABS = ["dashboard", "workspace", "details", "checklist", "documents", "draws"];
const PARTICIPANT_TABS = ["dashboard", "tasks", "details", "documents", "draws"];

const isLoanWorkspaceManager = (user) => {
  if (!user) return null;
  const normalizedRole = normalizeAppRole(user.app_role);
  return user.role === "admin" || ["Administrator", "Loan Officer"].includes(normalizedRole);
};

export const getLoanDetailSubpages = (user) => {
  const canManageLoanWorkspace = isLoanWorkspaceManager(user);
  const allowedTabs =
    canManageLoanWorkspace === null
      ? ALL_LOAN_DETAIL_SUBPAGES.map((subpage) => subpage.key)
      : canManageLoanWorkspace
        ? MANAGER_TABS
        : PARTICIPANT_TABS;

  const subpagesByKey = Object.fromEntries(
    ALL_LOAN_DETAIL_SUBPAGES.map((subpage) => [subpage.key, subpage])
  );

  return allowedTabs.map((tab) => subpagesByKey[tab]).filter(Boolean);
};

export const loanDetailSubpages = ALL_LOAN_DETAIL_SUBPAGES;

export const isValidLoanDetailTab = (tab, user) =>
  getLoanDetailSubpages(user).some((subpage) => subpage.key === tab);

export const getLoanDetailSubpage = (tab, user) =>
  getLoanDetailSubpages(user).find((subpage) => subpage.key === tab) || getLoanDetailSubpages(user)[0];

export const getDefaultLoanDetailFallbackTab = (user, { openTask = false } = {}) => {
  if (!openTask) return DEFAULT_LOAN_DETAIL_TAB;
  return isLoanWorkspaceManager(user) ? "checklist" : "tasks";
};

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
