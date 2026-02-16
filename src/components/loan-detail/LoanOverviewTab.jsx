import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { X, Edit, Loader2, Save } from "lucide-react";
import { base44 } from "@/api/base44Client";

import DynamicFormRenderer from "../forms/DynamicFormRenderer";

// Define the desired category groupings and their display names
const CATEGORY_GROUPS = {
  'Borrower Information': ['borrowerInformation'],
  'Individual Information': ['individual_information'],
  'Loan Information': ['loanInformation'],
  'Loan Economics': ['loanEconomics'],
  'Estimated Cash-to-Close': ['estimatedCash-to-close'],
  'Property Information': ['propertyInformation'],
  'Unit Information': ['unit_information'],
  'Property Economics': ['propertyEconomics'],
  'Loan Sale Details': ['post-closeDetails'],
  'Servicing Details': ['servicingDetails'],
  'Recording': ['Recording']
};

export default function LoanOverviewTab({ loan, onUpdate, currentUser }) {
  const [editedLoan, setEditedLoan] = useState(loan);
  const [originalLoan, setOriginalLoan] = useState(loan);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [fieldConfigs, setFieldConfigs] = useState([]);
  const [activeCategory, setActiveCategory] = useState('');

  useEffect(() => {
    console.log('=== LOAN DATA ON RELOAD ===');
    console.log('Individual information array received:', JSON.stringify(loan.individual_information, null, 2));
    console.log('Overridden fields:', loan.overridden_fields);
    console.log('Full loan object received:', loan);

    // Ensure overridden_fields exists
    const loanWithOverrides = {
      ...loan,
      overridden_fields: loan.overridden_fields || []
    };

    setEditedLoan(loanWithOverrides);
    setOriginalLoan(loanWithOverrides);
  }, [loan]);

  useEffect(() => {
    loadFieldConfigurations();
  }, []);

  const loadFieldConfigurations = async () => {
    try {
      const configs = await base44.entities.FieldConfiguration.filter({ context: 'loan' });
      const sorted = configs.sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
      setFieldConfigs(sorted);
      
      // Set first category group as active
      const firstGroup = Object.keys(CATEGORY_GROUPS)[0];
      setActiveCategory(firstGroup);
    } catch (error) {
      console.error('Error loading field configurations:', error);
    }
  };

  const canEdit = currentUser && (
    currentUser.role === 'admin' ||
    currentUser.app_role === 'Administrator' ||
    currentUser.app_role === 'Loan Officer'
  );

  const sanitizeLoanData = (loanData) => {
    console.log('=== SANITIZE CALLED ===');
    console.log('Input individual_information:', JSON.stringify(loanData.individual_information, null, 2));
    console.log('Input overridden_fields:', loanData.overridden_fields);

    const sanitized = { ...loanData };

    // CRITICAL: Preserve overridden_fields
    sanitized.overridden_fields = loanData.overridden_fields || [];
    console.log('Preserving overridden_fields:', sanitized.overridden_fields);

    // Sanitize individual_information array
    if (sanitized.individual_information && Array.isArray(sanitized.individual_information)) {
      console.log('Processing individual_information array, length:', sanitized.individual_information.length);
      sanitized.individual_information = sanitized.individual_information.map((individual, idx) => {
        console.log(`Individual ${idx} before:`, individual);
        const clean = { ...individual };
        // Convert empty strings to false for boolean fields
        const booleanFields = ['bankruptcy_foreclosure_short_sale_or_deed_in_lieu_in_last_36_months', 'foreign_national', 'mortgage_late_payment_or_delinquencies', 'previous_felony_misdemeanor_convictions_or_other_similar_crimes'];
        booleanFields.forEach(field => {
          if (clean[field] === '' || clean[field] === null || clean[field] === undefined) {
            clean[field] = false;
          }
        });
        // Convert empty strings to null for number fields
        const numberFields = ['credit_score_median', 'rehab_experience', 'individual_construction_experience', 'ownership_of_entity'];
        numberFields.forEach(field => {
          if (clean[field] === '') {
            clean[field] = null;
          }
        });
        console.log(`Individual ${idx} after:`, clean);
        return clean;
      });
    } else {
      console.log('No individual_information array found or not an array:', sanitized.individual_information);
    }

    // Sanitize unit_information array
    if (sanitized.unit_information && Array.isArray(sanitized.unit_information)) {
      sanitized.unit_information = sanitized.unit_information.map(unit => {
        const clean = { ...unit };
        if (clean.unit_occupied === '' || clean.unit_occupied === null || clean.unit_occupied === undefined) {
          clean.unit_occupied = false;
        }
        return clean;
      });
    }

    console.log('Sanitize returning individual_information:', JSON.stringify(sanitized.individual_information, null, 2));
    return sanitized;
  };

  const handleFormChange = (newData) => {
    console.log('=== FORM CHANGE TRIGGERED ===');
    console.log('New data received (full):', newData);
    console.log('Overridden fields in new data:', newData.overridden_fields);
    console.log('Loan Purchase Price:', newData.loan_purchase_price_amount);
    console.log('Legal Fee:', newData.legal_fee);
    console.log('Interest Only Period:', newData.interest_only_period_months);
    console.log('Loan Term:', newData.loan_term_months);

    const sanitized = sanitizeLoanData(newData);

    console.log('After sanitization (full):', sanitized);
    console.log('Overridden fields after sanitization:', sanitized.overridden_fields);
    console.log('Loan Purchase Price after sanitization:', sanitized.loan_purchase_price_amount);
    console.log('Legal Fee after sanitization:', sanitized.legal_fee);
    console.log('Interest Only Period after sanitization:', sanitized.interest_only_period_months);
    console.log('Loan Term after sanitization:', sanitized.loan_term_months);

    setEditedLoan(sanitized);
  };

  const handleSave = async () => {
    console.log('=== HANDLE SAVE CALLED ===');
    console.log('editedLoan BEFORE sanitization:', editedLoan);
    console.log('editedLoan.overridden_fields BEFORE:', editedLoan.overridden_fields);
    console.log('editedLoan.loan_purchase_price_amount BEFORE:', editedLoan.loan_purchase_price_amount);
    console.log('editedLoan.legal_fee BEFORE:', editedLoan.legal_fee);
    console.log('editedLoan.interest_only_period_months BEFORE:', editedLoan.interest_only_period_months);
    console.log('editedLoan.loan_term_months BEFORE:', editedLoan.loan_term_months);

    setIsSaving(true);
    try {
      const modificationHistory = editedLoan.modification_history ? [...editedLoan.modification_history] : [];
      const modifiedByName = currentUser.first_name && currentUser.last_name
        ? `${currentUser.first_name} ${currentUser.last_name}`
        : currentUser.full_name || currentUser.email || 'Unknown User';

      const changedFields = Object.keys(editedLoan).filter(key => {
        const originalValue = originalLoan[key];
        const editedValue = editedLoan[key];

        if (typeof originalValue === 'object' && originalValue !== null && typeof editedValue === 'object' && editedValue !== null) {
          return JSON.stringify(originalValue) !== JSON.stringify(editedValue);
        }
        return originalValue !== editedValue;
      });

      console.log('Changed fields detected:', changedFields);

      // Create detailed field changes array with old and new values
      const fieldChanges = changedFields.map(fieldName => ({
        field_name: fieldName,
        old_value: originalLoan[fieldName],
        new_value: editedLoan[fieldName]
      }));

      modificationHistory.push({
        timestamp: new Date().toISOString(),
        modified_by: currentUser.id || 'unknown',
        modified_by_name: modifiedByName,
        description: `Loan details updated`,
        fields_changed: changedFields,
        field_changes: fieldChanges
      });

      // Sanitize and create a clean loan object
      const sanitizedLoan = sanitizeLoanData(editedLoan);
      console.log('=== AFTER SANITIZE ===');
      console.log('sanitizedLoan.overridden_fields:', sanitizedLoan.overridden_fields);
      console.log('sanitizedLoan.loan_purchase_price_amount:', sanitizedLoan.loan_purchase_price_amount);
      console.log('sanitizedLoan.legal_fee:', sanitizedLoan.legal_fee);
      console.log('sanitizedLoan.interest_only_period_months:', sanitizedLoan.interest_only_period_months);
      console.log('sanitizedLoan.loan_term_months:', sanitizedLoan.loan_term_months);

      const loanToUpdate = { 
        ...sanitizedLoan, 
        modification_history: modificationHistory,
        overridden_fields: editedLoan.overridden_fields || [] // Ensure overridden_fields is always included
      };

      console.log('=== LOAN TO UPDATE (FINAL) ===');
      console.log('loanToUpdate.overridden_fields:', loanToUpdate.overridden_fields);
      console.log('loanToUpdate.loan_purchase_price_amount:', loanToUpdate.loan_purchase_price_amount);
      console.log('loanToUpdate.legal_fee:', loanToUpdate.legal_fee);
      console.log('loanToUpdate.interest_only_period_months:', loanToUpdate.interest_only_period_months);
      console.log('loanToUpdate.loan_term_months:', loanToUpdate.loan_term_months);
      console.log('Full loan object being sent:', loanToUpdate);

      await onUpdate(loanToUpdate);
      setOriginalLoan(sanitizedLoan);
      setIsEditing(false);
    } catch (error) {
      console.error("Failed to save loan changes:", error);
    } finally {
      setIsSaving(false);
    }
  };

  // Get categories that have fields defined
  const availableCategoryGroups = Object.entries(CATEGORY_GROUPS).filter(([groupName, categories]) => {
    return categories.some(cat => fieldConfigs.some(f => f.category === cat));
  });

  return (
    <Card className="border-0 shadow-sm bg-white">
      <CardHeader className="border-b border-slate-100">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-bold text-slate-900">Loan Overview</CardTitle>
          {canEdit && (
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
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </>
              ) : (
                <>
                  <Edit className="w-4 h-4 mr-2" />
                  Edit
                </>
              )}
            </Button>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="p-6">
        {availableCategoryGroups.length > 0 ? (
          <Tabs value={activeCategory} onValueChange={setActiveCategory}>
            <TabsList className="flex flex-wrap gap-2 h-auto bg-slate-100 p-2 mb-6">
              {availableCategoryGroups.map(([groupName]) => (
                <TabsTrigger 
                  key={groupName} 
                  value={groupName}
                  className="data-[state=active]:bg-white data-[state=active]:shadow-sm px-4 py-2"
                >
                  {groupName}
                </TabsTrigger>
              ))}
            </TabsList>

            {availableCategoryGroups.map(([groupName, categories]) => (
              <TabsContent key={groupName} value={groupName}>
                {categories.map((category, idx) => {
                  const categoryFields = fieldConfigs.filter(f => f.category === category);
                  if (categoryFields.length === 0) return null;
                  
                  return (
                    <div key={category} className={idx > 0 ? 'mt-6' : ''}>
                      <DynamicFormRenderer
                        context="loan"
                        categoryFilter={category}
                        data={editedLoan}
                        onChange={handleFormChange}
                        isReadOnly={!isEditing}
                        canManage={canEdit}
                        showTabs={false}
                      />
                    </div>
                  );
                })}
              </TabsContent>
            ))}
          </Tabs>
        ) : (
          <DynamicFormRenderer
            context="loan"
            data={editedLoan}
            onChange={handleFormChange}
            isReadOnly={!isEditing}
            canManage={canEdit}
          />
        )}

        {isEditing && (
          <div className="flex justify-end gap-3 pt-6 mt-6 border-t">
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
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="bg-slate-700 hover:bg-slate-800"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
