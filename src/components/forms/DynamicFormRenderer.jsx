import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Trash2, History } from 'lucide-react';
import { base44 } from "@/api/base44Client";
import DynamicField from './DynamicField';
import UpdateProfileModal from '../shared/UpdateProfileModal';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export default function DynamicFormRenderer({
  context,
  data = {},
  onChange,
  isReadOnly = false,
  onAddComment = null,
  fieldComments = {},
  canManage = false,
  categoryFilter = null,
  applicationStatus = null,
  showTabs = true,
  currentUser = null,
  profileType = null,
  profileId = null
}) {
  const [fieldConfigs, setFieldConfigs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showUpdateProfileModal, setShowUpdateProfileModal] = useState(false);
  const [pendingFieldChange, setPendingFieldChange] = useState(null);
  const [fieldChanges, setFieldChanges] = useState({});

  useEffect(() => {
    loadFieldConfigurations();
  }, [context, categoryFilter, currentUser]);
  
  useEffect(() => {
    calculateFieldChanges();
  }, [data]);
  
  const calculateFieldChanges = () => {
    // Always calculate changes regardless of status
    if (context !== 'application' || !data?.submission_snapshots || data.submission_snapshots.length < 1) {
      setFieldChanges({});
      return;
    }
    
    const changes = {};
    const snapshots = [...(data.submission_snapshots || [])].sort((a, b) => a.submission_number - b.submission_number);
    
    // Build full history by comparing each submission with the next
    for (let i = 0; i < snapshots.length; i++) {
      const currentSnapshot = snapshots[i];
      const nextSnapshot = i < snapshots.length - 1 ? snapshots[i + 1] : { data_snapshot: data };
      
      const prevData = currentSnapshot.data_snapshot || {};
      const nextData = nextSnapshot.data_snapshot || data;
      
      Object.keys(nextData).forEach(fieldName => {
        // Skip internal fields
        if (['id', 'created_date', 'updated_date', 'created_by', 'submission_snapshots', 'field_comments', 'modification_history', 'co_borrowers', 'entity_owners', 'property_modification_history', 'overridden_fields'].includes(fieldName)) {
          return;
        }
        
        const prevValue = prevData[fieldName];
        const nextValue = nextData[fieldName];
        
        // Detect change between consecutive submissions
        if (JSON.stringify(prevValue) !== JSON.stringify(nextValue)) {
          if (!changes[fieldName]) {
            changes[fieldName] = [];
          }
          changes[fieldName].push({
            submission_number: currentSnapshot.submission_number,
            submission_date: currentSnapshot.submission_date,
            old_value: prevValue,
            new_value: nextValue
          });
        }
      });
    }
    
    setFieldChanges(changes);
  };

  const loadFieldConfigurations = async () => {
    setIsLoading(true);
    try {
      const query = { context };
      if (categoryFilter) {
        query.category = categoryFilter;
      }

      let configs = await base44.entities.FieldConfiguration.filter(query);
      
      // Filter by role if currentUser is provided
      if (currentUser && currentUser.app_role) {
        configs = configs.filter(config => {
          // If visible_to_roles is empty or undefined, field is visible to all
          if (!config.visible_to_roles || config.visible_to_roles.length === 0) {
            return true;
          }
          // Otherwise, check if user's role is in the list
          return config.visible_to_roles.includes(currentUser.app_role);
        });
      }
      
      const sorted = configs.sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
      setFieldConfigs(sorted);
    } catch (error) {
      console.error('Error loading field configurations:', error);
      setFieldConfigs([]);
    }
    setIsLoading(false);
  };

  const getInheritedFieldsForProfile = (pType) => {
    console.log('[DynamicFormRenderer] getInheritedFieldsForProfile:', pType);
    // Map profile types to their inherited field prefixes and actual entity fields
    const profileFieldMaps = {
      'borrower': {
        prefixes: ['borrower_'],
        // Fields that actually exist in Borrower entity (check Borrower schema)
        actualFields: [
          'borrower_first_name', 'borrower_last_name', 'borrower_email', 'borrower_phone',
          'borrower_address_street', 'borrower_address_unit', 'borrower_address_city',
          'borrower_address_state', 'borrower_address_zip',
          'borrower_mailing_address_street', 'borrower_mailing_address_unit',
          'borrower_mailing_address_city', 'borrower_mailing_address_state',
          'borrower_mailing_address_zip',
          'borrower_date_of_birth', 'borrower_ssn', 'borrower_annual_gross_income',
          'borrower_liquidity_amount', 'borrower_rehabs_done_36_months',
          'borrower_rentals_owned_36_months', 'borrower_credit_score'
        ]
      },
      'borrowing_entity': {
        prefixes: ['entity_'],
        actualFields: [
          'entity_name', 'entity_ein', 'entity_type', 'entity_email', 'entity_phone',
          'entity_address_street', 'entity_address_unit', 'entity_address_city',
          'entity_address_state', 'entity_address_zip',
          'entity_mailing_address_street', 'entity_mailing_address_unit',
          'entity_mailing_address_city', 'entity_mailing_address_state',
          'entity_mailing_address_zip_code'
        ]
      }
    };
    
    const profileMap = profileFieldMaps[pType];
    if (!profileMap) {
      console.log('[DynamicFormRenderer] No profile map for type:', pType);
      return [];
    }
    
    // Return only fields that are in the actualFields list
    const inherited = fieldConfigs
      .filter(config => profileMap.actualFields.includes(config.field_name))
      .map(config => config.field_name);
    
    console.log('[DynamicFormRenderer] Inherited fields for', pType, ':', inherited);
    return inherited;
  };

  const handleFieldChange = (fieldName, value, fieldLabel, isCalculatedField = false) => {
    console.log('[DynamicFormRenderer] Field change:', { fieldName, value, isCalculatedField, isReadOnly });
    console.log('[DynamicFormRenderer] Current overridden_fields before change:', data.overridden_fields);
    
    const canOverride = currentUser && (
      currentUser.role === 'admin' ||
      currentUser.app_role === 'Administrator' ||
      currentUser.app_role === 'Loan Officer'
    );
    
    const isBorrowerEditingOwnApp = currentUser && currentUser.app_role === 'Borrower';
    
    // Check if this is an inherited field from a profile
    const inheritedFields = profileType && profileId ? getInheritedFieldsForProfile(profileType) : [];
    const isInheritedField = inheritedFields.includes(fieldName);
    const overriddenFields = data.overridden_fields || [];
    const isAlreadyOverridden = overriddenFields.includes(fieldName);
    const isObjectUpdate = typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Date);
    const isOverrideOnlyUpdate = isObjectUpdate && Object.keys(value).every(key => key === 'overridden_fields');
    
    console.log('[DynamicFormRenderer] isInheritedField check:', { 
      fieldName, 
      isInheritedField, 
      profileType, 
      profileId,
      inheritedFields 
    });
    
    if (isOverrideOnlyUpdate) {
      onChange({ ...data, ...value });
      return;
    }

    if (isInheritedField && canOverride && !isReadOnly && !isAlreadyOverridden) {
      // For admins/loan officers editing inherited field, show modal
      setPendingFieldChange({ fieldName, value, fieldLabel });
      setShowUpdateProfileModal(true);
    } else {
      // For borrowers or non-inherited fields, just update
      const updates = {};
      if (isObjectUpdate) {
        Object.assign(updates, value);
      } else {
        updates[fieldName] = value;
      }
      
      // Track override for inherited fields when changed by any user
      if (isInheritedField) {
        if (!overriddenFields.includes(fieldName)) {
          console.log('[DynamicFormRenderer] Adding inherited field to overridden_fields:', fieldName);
          updates.overridden_fields = [...overriddenFields, fieldName];
        }
      }
      
      // Always preserve overridden_fields, and add if this is a manually edited calculated field
      if (isCalculatedField && !isReadOnly && !overriddenFields.includes(fieldName)) {
        console.log('[DynamicFormRenderer] Adding calculated field to overridden_fields:', fieldName);
        updates.overridden_fields = [...overriddenFields, fieldName];
      } else if (!updates.overridden_fields) {
        // Always preserve existing overridden_fields
        updates.overridden_fields = overriddenFields;
      }
      
      console.log('[DynamicFormRenderer] Updates:', updates);
      onChange({ ...data, ...updates });
    }
  };

  const handleUpdateProfile = async () => {
    if (!pendingFieldChange || !profileType || !profileId) return;

    try {
      // Update profile
      let entityType = '';
      if (profileType === 'borrower') entityType = 'Borrower';
      else if (profileType === 'entity') entityType = 'BorrowerEntity';
      
      if (entityType) {
        await base44.entities[entityType].update(profileId, {
          [pendingFieldChange.fieldName]: pendingFieldChange.value
        });
      }
      
      // Update application and track as synced override
      const updates = { [pendingFieldChange.fieldName]: pendingFieldChange.value };
      const overriddenFields = data.overridden_fields || [];
      if (!overriddenFields.includes(pendingFieldChange.fieldName)) {
        updates.overridden_fields = [...overriddenFields, pendingFieldChange.fieldName];
      }
      
      onChange({ ...data, ...updates });
    } catch (error) {
      console.error('Error updating profile:', error);
    }
    
    setShowUpdateProfileModal(false);
    setPendingFieldChange(null);
  };

  const handleKeepApplicationOnly = () => {
    if (!pendingFieldChange) return;
    
    // Update application only and track as override
    const updates = { [pendingFieldChange.fieldName]: pendingFieldChange.value };
    const overriddenFields = data.overridden_fields || [];
    if (!overriddenFields.includes(pendingFieldChange.fieldName)) {
      updates.overridden_fields = [...overriddenFields, pendingFieldChange.fieldName];
    }
    
    onChange({ ...data, ...updates });
    setShowUpdateProfileModal(false);
    setPendingFieldChange(null);
  };

  const handleRepeatableFieldChange = (categoryKey, index, fieldName, value, isCalculatedField = false) => {
    console.log('=== REPEATABLE FIELD CHANGE ===');
    console.log('Category:', categoryKey, 'Index:', index, 'Field:', fieldName, 'Value:', value, 'isCalculatedField:', isCalculatedField);

    const currentArray = data[categoryKey] || [];
    const updatedArray = [...currentArray];

    if (typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Date)) {
      updatedArray[index] = { ...updatedArray[index], ...value };
    } else {
      // Normalize boolean field values (especially from radio buttons)
      let finalValue = value;
      const isBooleanField = fieldName.includes('occupied') || 
                             fieldName.includes('_is_') || 
                             fieldName.includes('has_') ||
                             fieldName.includes('bankruptcy') ||
                             fieldName.includes('foreign_national') ||
                             fieldName.includes('mortgage_late') ||
                             fieldName.includes('felony') ||
                             fieldName === 'is_guarantor';

      if (isBooleanField) {
        // Handle radio button string values and empty states
        if (value === 'true' || value === true) {
          finalValue = true;
        } else if (value === 'false' || value === false) {
          finalValue = false;
        } else if (value === '' || value === null || value === undefined) {
          finalValue = false;
        }
      }
      updatedArray[index] = { ...updatedArray[index], [fieldName]: finalValue };
    }

    const updates = { [categoryKey]: updatedArray };
    
    // Track override for calculated fields in repeatable sections
    if (isCalculatedField && !isReadOnly) {
      const repeatableFieldKey = `${categoryKey}[${index}].${fieldName}`;
      const overriddenFields = data.overridden_fields || [];
      if (!overriddenFields.includes(repeatableFieldKey)) {
        console.log('[DynamicFormRenderer] Adding repeatable field to overridden_fields:', repeatableFieldKey);
        updates.overridden_fields = [...overriddenFields, repeatableFieldKey];
      } else {
        updates.overridden_fields = overriddenFields;
      }
    }

    console.log('Updated instance:', updatedArray[index]);
    console.log('Updates being sent:', updates);

    onChange({ ...data, ...updates });
  };

  const handleAddRepeatableInstance = (categoryKey, fields) => {
    const currentArray = data[categoryKey] || [];
    const newInstance = {};
    fields.forEach(field => {
      if (field.field_type === 'checkbox') {
        newInstance[field.field_name] = false;
      } else if (field.field_type === 'number' || field.field_type === 'currency' || field.field_type === 'percentage') {
        newInstance[field.field_name] = 0;
      } else if (field.field_type === 'date' || field.field_type === 'datetime') {
        newInstance[field.field_name] = null;
      } else {
        // Check if field name suggests it should be a boolean
        const isBooleanField = field.field_name.includes('occupied') || 
                               field.field_name.includes('_is_') || 
                               field.field_name.includes('has_') ||
                               field.field_name.includes('bankruptcy') ||
                               field.field_name.includes('foreign_national') ||
                               field.field_name.includes('mortgage_late') ||
                               field.field_name.includes('felony') ||
                               field.field_name === 'is_guarantor';
        
        if (isBooleanField) {
          newInstance[field.field_name] = false;
        } else {
          newInstance[field.field_name] = '';
        }
      }
    });
    onChange({ ...data, [categoryKey]: [...currentArray, newInstance] });
  };

  const handleRemoveRepeatableInstance = (categoryKey, index) => {
    const currentArray = data[categoryKey] || [];
    const updatedArray = currentArray.filter((_, i) => i !== index);
    onChange({ ...data, [categoryKey]: updatedArray });
  };

  const groupedFields = fieldConfigs.reduce((acc, field) => {
    const category = field.category_display_name || field.category;
    if (!acc[category]) {
      acc[category] = {
        fields: [],
        is_repeatable: field.is_repeatable_category || false,
        category_key: field.category
      };
    }
    acc[category].fields.push(field);
    return acc;
  }, {});

  const categories = Object.keys(groupedFields);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (fieldConfigs.length === 0) {
    return (
      <Card className="border-slate-200">
        <CardContent className="p-12 text-center text-slate-500">
          <p>No fields configured yet. Please configure fields in Settings → Fields.</p>
        </CardContent>
      </Card>
    );
  }

  const renderCategoryContent = (categoryName, categoryData) => {
    const { fields, is_repeatable, category_key } = categoryData;

    if (!is_repeatable) {
      // Group fields by section
      const fieldsBySection = fields.reduce((acc, field) => {
        const section = field.section || 'default';
        if (!acc[section]) {
          acc[section] = [];
        }
        acc[section].push(field);
        return acc;
      }, {});

      const sections = Object.keys(fieldsBySection);
      const hasMultipleSections = sections.length > 1 || (sections.length === 1 && sections[0] !== 'default');

      return (
        <div className="space-y-10">
          {sections.map((sectionKey, sectionIndex) => {
            const sectionFields = fieldsBySection[sectionKey];
            const sectionLabel = sectionKey === 'default' ? null : sectionKey;

            return (
              <div key={sectionKey} className="space-y-6">
                {sectionLabel && hasMultipleSections && (() => {
                  // Check if this section should be displayed
                  // For "Mailing Address" section, only show if "mailing_address_different" is true
                  if (sectionLabel.toLowerCase().includes('mailing address')) {
                    let mailingCheckboxField = null;
                    if (categoryFilter === 'borrowerInformation') {
                      mailingCheckboxField = 'borrower_mailing_address_different_from_your_address';
                    } else if (categoryFilter === 'entityInformation') {
                      mailingCheckboxField = 'mailing_address_different_from_address';
                    } else if (categoryFilter === 'coBorrowerInformation') {
                      mailingCheckboxField = 'mailing_address_different_from_your_address';
                    }
                    
                    console.log('[DynamicFormRenderer] Section header check for mailing address:', {
                      sectionLabel,
                      categoryFilter,
                      mailingCheckboxField,
                      checkboxValue: mailingCheckboxField ? data[mailingCheckboxField] : 'N/A'
                    });
                    
                    if (mailingCheckboxField) {
                      const isDifferent = data[mailingCheckboxField] === true || 
                                         data[mailingCheckboxField] === 'true';
                      if (!isDifferent) {
                        console.log('[DynamicFormRenderer] Hiding mailing address section header');
                        return null; // Don't render section header if mailing address is not different
                      }
                    }
                  }
                  
                  return (
                    <div className="border-b border-blue-200 pb-2 bg-blue-50/30 -mx-2 px-2 rounded-t">
                      <h3 className="text-sm font-semibold text-blue-900 uppercase tracking-wider">
                        {sectionLabel}
                      </h3>
                    </div>
                  );
                })()}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
                  {sectionFields.map((fieldConfig) => {
                    console.log('[DynamicFormRenderer] Rendering field:', {
                      fieldName: fieldConfig.field_name,
                      section: sectionKey,
                      sectionLabel,
                      categoryFilter
                    });
                    
                    // Hide mailing address fields if mailing address is not different
                    // Find the appropriate checkbox field based on category
                    let mailingCheckboxField = null;
                    if (categoryFilter === 'borrowerInformation') {
                      mailingCheckboxField = 'borrower_mailing_address_different_from_your_address';
                    } else if (categoryFilter === 'entityInformation') {
                      mailingCheckboxField = 'mailing_address_different_from_address';
                    } else if (categoryFilter === 'coBorrowerInformation') {
                      mailingCheckboxField = 'mailing_address_different_from_your_address';
                    }
                    
                    console.log('[DynamicFormRenderer] Mailing checkbox field:', mailingCheckboxField);
                    
                    if (sectionLabel && sectionLabel.toLowerCase().includes('mailing address') && mailingCheckboxField) {
                      const isDifferent = data[mailingCheckboxField] === true || 
                                         data[mailingCheckboxField] === 'true';
                      
                      console.log('[DynamicFormRenderer] Mailing address section check:', {
                        sectionLabel,
                        mailingCheckboxField,
                        checkboxValue: data[mailingCheckboxField],
                        isDifferent,
                        willHide: !isDifferent
                      });
                      
                      if (!isDifferent) {
                        console.log('[DynamicFormRenderer] Hiding mailing address field:', fieldConfig.field_name);
                        return null; // Don't render mailing address fields
                      }
                    }
                    
                    // Check display conditional
                    if (fieldConfig.display_conditional) {
                      const { field, value, operator = 'equals' } = fieldConfig.display_conditional;
                      const fieldValue = data[field];
                      
                      let shouldDisplay = false;
                      
                      if (typeof fieldValue === 'boolean' || fieldValue === 'true' || fieldValue === 'false') {
                        const boolValue = fieldValue === true || fieldValue === 'true';
                        const boolCondition = value === true || value === 'true' || value === '1' || value === 1;
                        shouldDisplay = operator === 'equals' ? (boolValue === boolCondition) : (boolValue !== boolCondition);
                      } else {
                        switch (operator) {
                          case 'equals':
                            shouldDisplay = fieldValue == value;
                            break;
                          case 'not_equals':
                            shouldDisplay = fieldValue != value;
                            break;
                          case 'contains':
                            shouldDisplay = typeof fieldValue === 'string' && fieldValue.includes(value);
                            break;
                          case 'greater_than':
                            shouldDisplay = parseFloat(fieldValue) > parseFloat(value);
                            break;
                          case 'less_than':
                            shouldDisplay = parseFloat(fieldValue) < parseFloat(value);
                            break;
                          case 'in':
                            shouldDisplay = Array.isArray(value) && value.includes(fieldValue);
                            break;
                          default:
                            shouldDisplay = false; // Default to not display if operator is unknown
                        }
                      }
                      
                      // Special handling for loan_purpose field based on loan_type (DSCR)
                      if (fieldConfig.field_name === 'loan_purpose' && data.loan_type) {
                        const loanType = data.loan_type;
                        const currentOptions = fieldConfig.options || [];
                        
                        if (loanType === 'dscr') {
                          // DSCR: show only purchase, cash_out_refinance, rate_term_refinance
                          fieldConfig = {
                            ...fieldConfig,
                            options: ['purchase', 'cash_out_refinance', 'rate_term_refinance']
                          };
                        } else {
                          // Non-DSCR: show only purchase, refinance
                          fieldConfig = {
                            ...fieldConfig,
                            options: ['purchase', 'refinance']
                          };
                        }
                      }
                      
                      if (!shouldDisplay) return null;
                    } else if (fieldConfig.field_name === 'loan_purpose' && data.loan_type) {
                      // Also handle loan_purpose filtering when there's no display_conditional
                      const loanType = data.loan_type;
                      
                      if (loanType === 'dscr') {
                        fieldConfig = {
                          ...fieldConfig,
                          options: ['purchase', 'cash_out_refinance', 'rate_term_refinance']
                        };
                      } else {
                        fieldConfig = {
                          ...fieldConfig,
                          options: ['purchase', 'refinance']
                        };
                      }
                    }

                    // Full width for certain field types
                    const isFullWidth = ['radio', 'textarea', 'checkbox'].includes(fieldConfig.field_type);
                    
                    return (
                      <div key={fieldConfig.field_name} className={isFullWidth ? 'md:col-span-2' : ''}>
                       <div className="relative">
                         <DynamicField
                           fieldConfig={fieldConfig}
                           value={data[fieldConfig.field_name]}
                           onChange={(value) => handleFieldChange(fieldConfig.field_name, value, fieldConfig.field_label, !!fieldConfig.value_conditional)}
                           allFieldValues={data}
                           isReadOnly={isReadOnly}
                           onAddComment={onAddComment}
                           fieldComments={fieldComments}
                           canManage={canManage}
                           applicationStatus={applicationStatus}
                           overriddenFields={data.overridden_fields || []}
                           showOverrideControl={profileId && profileType && getInheritedFieldsForProfile(profileType).includes(fieldConfig.field_name)}
                           profileType={profileType}
                           profileId={profileId}
                         />
                          {fieldChanges[fieldConfig.field_name] && fieldChanges[fieldConfig.field_name].length > 0 && (
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="absolute -top-3 right-0 h-6 px-2 py-0 text-xs bg-orange-100 text-orange-700 border-orange-300 hover:bg-orange-200"
                                >
                                  <History className="w-3 h-3 mr-1" />
                                  Changed
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-96" align="end">
                                <div className="space-y-2">
                                  <h4 className="font-semibold text-sm text-slate-900">Change History</h4>
                                  <div className="space-y-3 max-h-64 overflow-y-auto">
                                    {fieldChanges[fieldConfig.field_name].map((change, idx) => (
                                      <div key={idx} className="text-xs border-l-2 border-orange-500 pl-3 py-2 bg-slate-50 rounded">
                                        <div className="flex items-center gap-2 mb-1">
                                          <Badge variant="outline" className="text-xs">
                                            Submission #{change.submission_number}
                                          </Badge>
                                          <span className="text-slate-500">
                                            {new Date(change.submission_date).toLocaleDateString()}
                                          </span>
                                        </div>
                                        <div className="space-y-1">
                                          <div>
                                            <span className="font-medium text-slate-600">Previous: </span>
                                            <span className="text-slate-900">{change.old_value?.toString() || '(empty)'}</span>
                                          </div>
                                          <div>
                                            <span className="font-medium text-slate-600">Current: </span>
                                            <span className="text-slate-900">{change.new_value?.toString() || '(empty)'}</span>
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </PopoverContent>
                            </Popover>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      );
    } else {
      // Repeatable category
      const instances = data[category_key] || [];
      
      return (
        <div className="space-y-4">
          {!isReadOnly && (
            <div className="flex justify-end">
              <Button
                type="button"
                onClick={() => handleAddRepeatableInstance(category_key, fields)}
                size="sm"
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add {categoryName.replace(/s$/, '')}
              </Button>
            </div>
          )}

          {instances.length === 0 ? (
            <Card className="border-dashed border-2 border-slate-300">
              <CardContent className="p-8 text-center text-slate-500">
                <p className="text-sm">No {categoryName.toLowerCase()} added yet.</p>
              </CardContent>
            </Card>
          ) : (
            instances.map((instance, index) => (
              <Card key={index} className="border border-slate-200">
                <CardHeader className="bg-slate-50 border-b border-slate-200 py-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold">
                      {categoryName.replace(/s$/, '')} #{index + 1}
                    </CardTitle>
                    {!isReadOnly && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveRepeatableInstance(category_key, index)}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
                    {fields.map((fieldConfig) => {
                      const isFullWidth = ['radio', 'textarea', 'checkbox'].includes(fieldConfig.field_type);
                      
                      return (
                        <div key={fieldConfig.field_name} className={isFullWidth ? 'md:col-span-2' : ''}>
                          <DynamicField
                            fieldConfig={fieldConfig}
                            value={instance[fieldConfig.field_name]}
                            onChange={(value) => handleRepeatableFieldChange(category_key, index, fieldConfig.field_name, value, !!fieldConfig.value_conditional)}
                            allFieldValues={{ ...data, ...instance }}
                            isReadOnly={isReadOnly}
                            onAddComment={onAddComment}
                            fieldComments={fieldComments}
                            canManage={canManage}
                            applicationStatus={applicationStatus}
                            overriddenFields={data.overridden_fields || []}
                            repeatableFieldKey={`${category_key}[${index}].${fieldConfig.field_name}`}
                          />
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      );
    }
  };

  if (!showTabs && categories.length === 1) {
    const categoryName = categories[0];
    const categoryData = groupedFields[categoryName];
    return (
      <Card className="border-0 shadow-lg bg-white/95">
        <CardContent className="p-8">
          {renderCategoryContent(categoryName, categoryData)}
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-0 shadow-lg bg-white/95">
        <CardContent className="p-8">
          {Object.entries(groupedFields).map(([categoryName, categoryData]) => (
            <div key={categoryName}>
              {renderCategoryContent(categoryName, categoryData)}
            </div>
          ))}
        </CardContent>
      </Card>
      
      <UpdateProfileModal
        isOpen={showUpdateProfileModal}
        onClose={() => {
          setShowUpdateProfileModal(false);
          setPendingFieldChange(null);
        }}
        onUpdateProfile={handleUpdateProfile}
        onKeepApplicationOnly={handleKeepApplicationOnly}
        fieldLabel={pendingFieldChange?.fieldLabel || ''}
      />
    </>
  );
}
