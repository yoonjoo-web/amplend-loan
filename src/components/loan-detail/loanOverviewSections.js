import {
  Building,
  CalendarCheck2,
  CircleDollarSign,
  CircleUserRound,
} from "lucide-react";

import { normalizeAppRole } from "@/components/utils/appRoles";

export const DEFAULT_LOAN_OVERVIEW_SECTION = "borrower";

const LOAN_DETAIL_SECTIONS = {
  borrower: {
    key: "borrower",
    title: "Borrower",
    icon: CircleUserRound,
    categories: [
      { key: "borrowerInformation", title: "Borrower Information" },
      { key: "individual_information", title: "Individual Information" },
    ],
  },
  loan: {
    key: "loan",
    title: "Loan",
    icon: CircleDollarSign,
    categories: [
      { key: "loanInformation", title: "Loan Information" },
      { key: "loanEconomics", title: "Loan Economics" },
    ],
  },
  property: {
    key: "property",
    title: "Property",
    icon: Building,
    categories: [
      { key: "propertyInformation", title: "Property Information" },
      { key: "unit_information", title: "Unit Information" },
      { key: "propertyEconomics", title: "Property Economics" },
    ],
  },
  closing: {
    key: "closing",
    title: "Closing",
    icon: CalendarCheck2,
    categories: [
      { key: "estimatedCash-to-close", title: "Estimated Cash-to-Close" },
      { key: "servicingDetails", title: "Servicing Details" },
      { key: "post-closeDetails", title: "Loan Sale Details" },
    ],
  },
};

const MANAGER_SECTIONS = ["borrower", "loan", "property", "closing"];
const PARTICIPANT_SECTIONS = ["borrower", "loan", "property"];

const isManagerView = (currentUser) => {
  if (!currentUser) return false;
  const normalizedRole = normalizeAppRole(currentUser.app_role);
  return currentUser.role === "admin" || ["Administrator", "Loan Officer"].includes(normalizedRole);
};

export const getLoanOverviewSections = (currentUser) => {
  const keys = isManagerView(currentUser) ? MANAGER_SECTIONS : PARTICIPANT_SECTIONS;
  return keys.map((key) => LOAN_DETAIL_SECTIONS[key]);
};

export const isValidLoanOverviewSection = (section, currentUser) =>
  getLoanOverviewSections(currentUser).some((item) => item.key === section);

export const getLoanOverviewSection = (section, currentUser) =>
  getLoanOverviewSections(currentUser).find((item) => item.key === section) ||
  getLoanOverviewSections(currentUser)[0];
