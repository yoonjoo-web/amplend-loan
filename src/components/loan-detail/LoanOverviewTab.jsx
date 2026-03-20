import React, { useEffect, useMemo, useState } from "react";
import {
  Edit,
  Loader2,
  Save,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import DynamicFormRenderer from "../forms/DynamicFormRenderer";
import RecentChangesModal from "./RecentChangesModal";
import { getLoanOverviewSections } from "./loanOverviewSections";

const NON_EDITABLE_FIELDS = new Set([
  "id",
  "created_date",
  "updated_date",
  "created_by",
  "modification_history",
]);

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
    <div className="space-y-10">
      {section.categories.map((category, index) => (
        <div key={category.key} className={index > 0 ? "border-t border-slate-200 pt-10" : ""}>
          <h3 className="mb-6 text-2xl text-slate-900">{category.title}</h3>

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
    </div>
  );
}

export default function LoanOverviewTab({ loan, onUpdate, currentUser, activeSection }) {
  const sections = useMemo(() => getLoanOverviewSections(currentUser), [currentUser]);
  const [editedLoan, setEditedLoan] = useState(loan);
  const [originalLoan, setOriginalLoan] = useState(loan);
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
      const sanitizedLoan = sanitizeLoanData(editedLoan);
      const changedFields = Object.keys(sanitizedLoan).filter((key) => {
        if (NON_EDITABLE_FIELDS.has(key)) {
          return false;
        }

        const originalValue = originalLoan[key];
        const editedValue = sanitizedLoan[key];

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

      if (changedFields.length === 0) {
        setIsEditing(false);
        return;
      }

      const loanToUpdate = changedFields.reduce((updates, fieldName) => {
        updates[fieldName] = sanitizedLoan[fieldName];
        return updates;
      }, {});

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
      <Card>
        <CardContent className="space-y-6 p-6 md:p-8">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-3xl text-slate-900">{selectedSection?.title || "Loan Details"}</h2>

            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={() => setShowRecentChanges(true)}>
                Recent Changes
              </Button>
              {canEdit ? (
                <>
                  {isEditing ? (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setEditedLoan(originalLoan);
                        setIsEditing(false);
                      }}
                      disabled={isSaving}
                    >
                      <X className="mr-2 h-4 w-4" />
                      Cancel
                    </Button>
                  ) : null}
                  <Button
                    onClick={isEditing ? handleSave : () => setIsEditing(true)}
                    disabled={isSaving}
                    className="bg-slate-700 hover:bg-slate-800"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : isEditing ? (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Save Changes
                      </>
                    ) : (
                      <>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit
                      </>
                    )}
                  </Button>
                </>
              ) : null}
            </div>
          </div>

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
        </CardContent>
      </Card>

      <RecentChangesModal open={showRecentChanges} onOpenChange={setShowRecentChanges} loan={loan} />
    </div>
  );
}
