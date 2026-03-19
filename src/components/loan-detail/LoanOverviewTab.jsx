import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Building,
  CalendarCheck2,
  ChevronRight,
  CircleDollarSign,
  CircleUserRound,
  Edit,
  Loader2,
  Save,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { normalizeAppRole } from "@/components/utils/appRoles";

import DynamicFormRenderer from "../forms/DynamicFormRenderer";
import RecentChangesModal from "./RecentChangesModal";

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

const getVisibleSections = (currentUser) => {
  const keys = isManagerView(currentUser) ? MANAGER_SECTIONS : PARTICIPANT_SECTIONS;
  return keys.map((key) => LOAN_DETAIL_SECTIONS[key]);
};

const sanitizeLoanData = (loanData) => {
  const sanitized = { ...loanData };
  sanitized.overridden_fields = loanData.overridden_fields || [];

  if (sanitized.individual_information && Array.isArray(sanitized.individual_information)) {
    sanitized.individual_information = sanitized.individual_information.map((individual) => {
      const clean = { ...individual };
      const booleanFields = [
        "bankruptcy_foreclosure_short_sale_or_deed_in_lieu_in_last_36_months",
        "foreign_national",
        "mortgage_late_payment_or_delinquencies",
        "previous_felony_misdemeanor_convictions_or_other_similar_crimes",
      ];

      booleanFields.forEach((field) => {
        if (clean[field] === "" || clean[field] === null || clean[field] === undefined) {
          clean[field] = false;
        }
      });

      const numberFields = [
        "credit_score_median",
        "rehab_experience",
        "individual_construction_experience",
        "ownership_of_entity",
      ];

      numberFields.forEach((field) => {
        if (clean[field] === "") {
          clean[field] = null;
        }
      });

      return clean;
    });
  }

  if (sanitized.unit_information && Array.isArray(sanitized.unit_information)) {
    sanitized.unit_information = sanitized.unit_information.map((unit) => {
      const clean = { ...unit };
      if (clean.unit_occupied === "" || clean.unit_occupied === null || clean.unit_occupied === undefined) {
        clean.unit_occupied = false;
      }
      return clean;
    });
  }

  return sanitized;
};

function SectionContent({ section, editedLoan, currentUser, isEditing, canEdit, onChange }) {
  return (
    <Card className="border-0 bg-white shadow-xl shadow-slate-200/70">
      <CardContent className="space-y-10 p-8 md:p-10">
        {section.categories.map((category, index) => (
          <div key={category.key} className={index > 0 ? "border-t border-slate-200 pt-10" : ""}>
            <div className="mb-6">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">{section.title}</p>
              <h3 className="mt-2 text-2xl text-slate-900">{category.title}</h3>
            </div>

            <DynamicFormRenderer
              context="loan"
              categoryFilter={category.key}
              data={editedLoan}
              onChange={onChange}
              isReadOnly={!isEditing}
              canManage={canEdit}
              showTabs={false}
              currentUser={currentUser}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default function LoanOverviewTab({ loan, onUpdate, currentUser }) {
  const sections = useMemo(() => getVisibleSections(currentUser), [currentUser]);
  const [editedLoan, setEditedLoan] = useState(loan);
  const [originalLoan, setOriginalLoan] = useState(loan);
  const [activeSection, setActiveSection] = useState(sections[0]?.key || "borrower");
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showRecentChanges, setShowRecentChanges] = useState(false);

  useEffect(() => {
    const loanWithOverrides = {
      ...loan,
      overridden_fields: loan.overridden_fields || [],
    };

    setEditedLoan(loanWithOverrides);
    setOriginalLoan(loanWithOverrides);
  }, [loan]);

  useEffect(() => {
    if (!sections.some((section) => section.key === activeSection)) {
      setActiveSection(sections[0]?.key || "borrower");
    }
  }, [activeSection, sections]);

  const canEdit =
    currentUser &&
    (currentUser.role === "admin" ||
      currentUser.app_role === "Administrator" ||
      currentUser.app_role === "Loan Officer");

  const selectedSection = sections.find((section) => section.key === activeSection) || sections[0];

  const handleFormChange = (newData) => {
    setEditedLoan(sanitizeLoanData(newData));
  };

  const handleSave = async () => {
    setIsSaving(true);

    try {
      const modificationHistory = editedLoan.modification_history ? [...editedLoan.modification_history] : [];
      const modifiedByName =
        currentUser.first_name && currentUser.last_name
          ? `${currentUser.first_name} ${currentUser.last_name}`
          : currentUser.full_name || currentUser.email || "Unknown User";

      const changedFields = Object.keys(editedLoan).filter((key) => {
        const originalValue = originalLoan[key];
        const editedValue = editedLoan[key];

        if (
          typeof originalValue === "object" &&
          originalValue !== null &&
          typeof editedValue === "object" &&
          editedValue !== null
        ) {
          return JSON.stringify(originalValue) !== JSON.stringify(editedValue);
        }

        return originalValue !== editedValue;
      });

      const fieldChanges = changedFields.map((fieldName) => ({
        field_name: fieldName,
        old_value: originalLoan[fieldName],
        new_value: editedLoan[fieldName],
      }));

      modificationHistory.push({
        timestamp: new Date().toISOString(),
        modified_by: currentUser.id || "unknown",
        modified_by_name: modifiedByName,
        description: "Loan details updated",
        fields_changed: changedFields,
        field_changes: fieldChanges,
      });

      const sanitizedLoan = sanitizeLoanData(editedLoan);
      const loanToUpdate = {
        ...sanitizedLoan,
        modification_history: modificationHistory,
        overridden_fields: editedLoan.overridden_fields || [],
      };

      await onUpdate(loanToUpdate);
      setOriginalLoan(sanitizedLoan);
      setIsEditing(false);
    } catch (error) {
      console.error("Failed to save loan changes:", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
        <span className="text-slate-900">Loan Details</span>
        <ChevronRight className="h-4 w-4 text-slate-300" />
        <span>{selectedSection?.title}</span>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-3xl text-slate-900">{selectedSection?.title || "Loan Details"}</h2>
          <p className="text-sm text-slate-500">Role-based Loan Details sections with the original editable workflow.</p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => setShowRecentChanges(true)}>
            Recent Changes
          </Button>
          {canEdit ? (
            <Button
              onClick={() => {
                if (isEditing) {
                  setEditedLoan(originalLoan);
                }
                setIsEditing(!isEditing);
              }}
              variant={isEditing ? "outline" : "default"}
              className={!isEditing ? "bg-slate-700 hover:bg-slate-800" : ""}
            >
              {isEditing ? (
                <>
                  <X className="mr-2 h-4 w-4" />
                  Cancel
                </>
              ) : (
                <>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </>
              )}
            </Button>
          ) : null}
        </div>
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

      {selectedSection ? (
        <SectionContent
          section={selectedSection}
          editedLoan={editedLoan}
          currentUser={currentUser}
          isEditing={isEditing}
          canEdit={canEdit}
          onChange={handleFormChange}
        />
      ) : null}

      {isEditing ? (
        <div className="flex justify-end gap-3 border-t border-slate-200 pt-6">
          <Button
            variant="outline"
            onClick={() => {
              setEditedLoan(originalLoan);
              setIsEditing(false);
            }}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving} className="bg-slate-700 hover:bg-slate-800">
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      ) : null}

      <RecentChangesModal open={showRecentChanges} onOpenChange={setShowRecentChanges} loan={loan} />
    </div>
  );
}
