import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Building,
  CalendarCheck2,
  CircleDollarSign,
  CircleUserRound,
  ChevronRight,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { normalizeAppRole } from "@/components/utils/appRoles";

const LOAN_DETAIL_SECTIONS = {
  borrower: {
    key: "borrower",
    title: "Borrower",
    description: "Borrower-specific information and workflow will live here.",
    icon: CircleUserRound,
  },
  loan: {
    key: "loan",
    title: "Loan",
    description: "Loan-specific data, terms, and calculations will live here.",
    icon: CircleDollarSign,
  },
  property: {
    key: "property",
    title: "Property",
    description: "Property details, collateral data, and related workflow will live here.",
    icon: Building,
  },
  closing: {
    key: "closing",
    title: "Closing",
    description: "Closing milestones, dates, and coordination workflow will live here.",
    icon: CalendarCheck2,
  },
};

const MANAGER_SECTIONS = ["borrower", "loan", "property", "closing"];
const PARTICIPANT_SECTIONS = ["borrower", "loan", "property"];

const isManagerView = (currentUser) => {
  if (!currentUser) return false;
  const normalizedRole = normalizeAppRole(currentUser.app_role);
  return currentUser.role === "admin" || ["Administrator", "Loan Officer"].includes(normalizedRole);
};

const getVisibleSections = (currentUser) => {
  const keys = isManagerView(currentUser) ? MANAGER_SECTIONS : PARTICIPANT_SECTIONS;
  return keys.map((key) => LOAN_DETAIL_SECTIONS[key]);
};

function PlaceholderPanel({ section }) {
  const Icon = section.icon;

  return (
    <motion.div
      key={section.key}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="space-y-6"
    >
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-lg shadow-slate-300/50">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Loan Details</p>
            <h2 className="text-3xl text-slate-900">{section.title}</h2>
          </div>
        </div>
        <p className="max-w-2xl text-sm text-slate-600 md:text-base">{section.description}</p>
      </div>

      <Card className="border-0 bg-white shadow-xl shadow-slate-200/70">
        <CardContent className="space-y-8 p-8 md:p-10">
          <div className="space-y-3">
            <h3 className="text-xl text-slate-900">This subpage is ready for build-out.</h3>
            <p className="text-sm text-slate-600 md:text-base">
              Navigation, hierarchy, and role-based visibility are in place for the {section.title.toLowerCase()} section.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm text-slate-900">Included now</p>
              <p className="mt-2 text-sm text-slate-600">
                Animated nested navigation and a dedicated content shell for this Loan Details subpage.
              </p>
            </div>
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-5">
              <p className="text-sm text-slate-900">Next build step</p>
              <p className="mt-2 text-sm text-slate-600">
                Replace this placeholder with the actual {section.title.toLowerCase()} forms, data, and actions.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default function LoanOverviewTab({ currentUser }) {
  const sections = useMemo(() => getVisibleSections(currentUser), [currentUser]);
  const [activeSection, setActiveSection] = useState(sections[0]?.key || "borrower");

  useEffect(() => {
    if (!sections.some((section) => section.key === activeSection)) {
      setActiveSection(sections[0]?.key || "borrower");
    }
  }, [activeSection, sections]);

  const selectedSection = sections.find((section) => section.key === activeSection) || sections[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
        <span className="text-slate-900">Loan Details</span>
        <ChevronRight className="h-4 w-4 text-slate-300" />
        <span>{selectedSection?.title}</span>
      </div>

      <Card className="border-0 bg-white/80 shadow-sm backdrop-blur-sm">
        <CardContent className="p-3">
          <div className="flex flex-wrap gap-2">
            {sections.map((section, index) => {
              const Icon = section.icon;
              const isActive = section.key === activeSection;

              return (
                <motion.button
                  key={section.key}
                  type="button"
                  onClick={() => setActiveSection(section.key)}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: index * 0.04, ease: "easeOut" }}
                  className={cn(
                    "relative inline-flex items-center gap-2 overflow-hidden rounded-2xl px-4 py-2.5 text-sm transition-colors",
                    isActive ? "text-white" : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  {isActive ? (
                    <motion.span
                      layoutId="loan-details-subpage-active-pill"
                      className="absolute inset-0 rounded-2xl bg-slate-900 shadow-lg shadow-slate-300/60"
                      transition={{ type: "spring", stiffness: 380, damping: 32 }}
                    />
                  ) : (
                    <span className="absolute inset-0 rounded-2xl bg-slate-50 ring-1 ring-slate-200/80" />
                  )}
                  <span className="relative z-10 flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    <span>{section.title}</span>
                  </span>
                </motion.button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {selectedSection ? <PlaceholderPanel section={selectedSection} /> : null}
    </div>
  );
}
