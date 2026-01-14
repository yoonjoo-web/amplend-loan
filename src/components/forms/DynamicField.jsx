import React, { useState, useEffect } from 'react';
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, AlertCircle, AlertTriangle, HelpCircle, Info, Search } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import AddressAutocomplete from "../shared/AddressAutocomplete";
import { US_STATES } from "../utils/usStates";
import { US_CITIES_BY_STATE } from "../utils/usCitiesData";
import { US_COUNTIES_BY_STATE } from "../utils/usCountiesData";
import { evaluateFormula } from "../utils/formulaEvaluator";
import { LoanPartner } from "@/entities/all";
import { RotateCcw } from 'lucide-react';
import FieldChangeIndicator from "../application-steps/FieldChangeIndicator";

// Formatting functions
function formatPhoneNumber(value) {
  if (!value) return '';
  const cleaned = value.replace(/\D/g, '');
  const match = cleaned.match(/^(\d{0,3})(\d{0,3})(\d{0,4})$/);
  if (!match) return value;
  
  let formatted = '';
  if (match[1]) formatted = `(${match[1]}`;
  if (match[1].length === 3) formatted += ') ';
  if (match[2]) formatted += match[2];
  if (match[2].length === 3) formatted += '-';
  if (match[3]) formatted += match[3];
  
  return formatted;
}

function formatSSN(value) {
  if (!value) return '';
  const cleaned = value.replace(/\D/g, '');
  const match = cleaned.match(/^(\d{0,3})(\d{0,2})(\d{0,4})$/);
  if (!match) return value;
  
  let formatted = '';
  if (match[1]) formatted = match[1];
  if (match[1].length === 3 && match[2]) formatted += `-${match[2]}`;
  if (match[2].length === 2 && match[3]) formatted += `-${match[3]}`;
  
  return formatted;
}

function formatEIN(value) {
  if (!value) return '';
  const cleaned = value.replace(/\D/g, '');
  const match = cleaned.match(/^(\d{0,2})(\d{0,7})$/);
  if (!match) return value;

  let formatted = '';
  if (match[1]) formatted = match[1];
  if (match[1].length === 2 && match[2]) formatted += `-${match[2]}`;

  return formatted;
}

function formatCurrency(value) {
  if (value === null || value === undefined || value === '') return '';
  const cleaned = String(value).replace(/[^\d.]/g, '');
  const number = parseFloat(cleaned);
  if (isNaN(number)) return '';
  return number.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseCurrency(value) {
  if (!value) return null;
  const cleaned = String(value).replace(/[^\d.]/g, '');
  const number = parseFloat(cleaned);
  return isNaN(number) ? null : number;
}

function formatOptionLabel(option) {
  if (!option) return option;
  
  // Special mappings for better labels
  const labelMap = {
    'individual': 'Individual',
    'entity': 'Entity',
    'yes': 'Yes',
    'no': 'No',
    'fix_flip': 'Fix & Flip',
    'bridge': 'Bridge',
    'new_construction': 'New Construction',
    'dscr': 'DSCR',
    'purchase': 'Purchase',
    'refinance': 'Refinance',
    'cash_out_refinance': 'Cash-Out Refinance'
  };
  
  if (labelMap[option]) return labelMap[option];
  
  if (typeof option === 'string' && option === option.toUpperCase() && !option.includes('_')) {
    return option;
  }
  if (typeof option === 'string' && option.includes('_') && option === option.toLowerCase()) {
    return option.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  }
  if (typeof option === 'string' && option.length > 0 && option[0] === option[0].toLowerCase()) {
    return option.charAt(0).toUpperCase() + option.slice(1);
  }
  return option;
}

function getOptionDescription(fieldName, option) {
  const descriptions = {
    'borrower_type': {
      'individual': 'Borrowing as an individual person',
      'entity': 'Borrowing through a business entity (LLC, Corporation, etc.)'
    },
    'loan_type': {
      'fix_flip': 'Short-term financing for property renovation and resale',
      'bridge': 'Temporary financing bridging the gap between transactions',
      'new_construction': 'Financing for ground-up construction projects',
      'dscr': 'Debt Service Coverage Ratio loan for investment properties'
    }
  };
  
  return descriptions[fieldName]?.[option] || '';
}

const FIELD_TOOLTIPS = {
  'foreign_national': `Not a U.S. Citizen or Permanent Resident and not meeting the criteria by the definition of a Permanent Resident Alien/Non-Permanent Resident Alien

(a) Acceptable documentation to verify that a non-U.S. citizen borrower is legally present in this U.S
(b) Must be employed in the United States for the past 24 months
(c) Must demonstrate that income and employment is likely to continue for at least three (3) years
(d) All borrowers must have a social security/ITIN`
};

function ReferrerDropdown({ value, onChange, isReadOnly }) {
  const [loanPartners, setLoanPartners] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadReferrers();
  }, []);

  const loadReferrers = async () => {
    setIsLoading(true);
    try {
      const allPartners = await LoanPartner.list();
      const referrers = allPartners.filter(p => p.type === 'Referral Partner');
      setLoanPartners(referrers);
    } catch (error) {
      console.error('Error loading referrers:', error);
      setLoanPartners([]);
    }
    setIsLoading(false);
  };

  const formatReferrerName = (partner) => {
    if (!partner || !partner.name) return '';
    const nameParts = partner.name.trim().split(' ');
    if (nameParts.length === 1) return partner.name;
    const firstInitial = nameParts[0].charAt(0).toUpperCase();
    const lastName = nameParts[nameParts.length - 1];
    return `${firstInitial}. ${lastName}`;
  };

  const filteredPartners = loanPartners.filter(partner => {
    if (!searchQuery) return true;
    const formattedName = formatReferrerName(partner);
    const fullName = partner.name || '';
    return (
      formattedName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      fullName.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const selectedPartner = loanPartners.find(p => p.name === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between h-10 text-sm"
          disabled={isReadOnly || isLoading}
        >
          {selectedPartner ? formatReferrerName(selectedPartner) : (isLoading ? "Loading..." : "Search referrers...")}
          <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command>
          <CommandInput 
            placeholder="Search referrers..." 
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandEmpty>No referrer found.</CommandEmpty>
          <CommandGroup className="max-h-64 overflow-auto">
            {filteredPartners.map((partner) => (
              <CommandItem
                key={partner.id}
                value={partner.name}
                onSelect={() => {
                  onChange(partner.name);
                  setOpen(false);
                  setSearchQuery('');
                }}
                className="cursor-pointer"
              >
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{formatReferrerName(partner)}</span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default function DynamicField({
  fieldConfig,
  value,
  onChange,
  allFieldValues = {},
  isReadOnly = false,
  onAddComment = null,
  fieldComments = {},
  canManage = false,
  applicationStatus = null,
  overriddenFields = [],
  repeatableFieldKey = null,
  showOverrideControl = false,
  profileType = null,
  profileId = null,
  applicationData = null
}) {
  const [calculatedValue, setCalculatedValue] = useState(value);
  const [displayValue, setDisplayValue] = useState(value);
  const [autoCalculatedValue, setAutoCalculatedValue] = useState(null);
  const [isOverrideMode, setIsOverrideMode] = useState(false);
  const [emailError, setEmailError] = useState('');

  const comment = fieldComments?.[fieldConfig.field_name];
  const hasComment = !!comment && !!comment.comment;
  // Field-level comments appear in 'under_review', 'review_completed', 'approved', 'rejected' statuses
  const statusesWithComments = ['under_review', 'review_completed', 'approved', 'rejected'];
  const showComments = hasComment && (!applicationStatus || statusesWithComments.includes(applicationStatus));
  // Comments are only editable in 'under_review' status
  const canEditComments = canManage && applicationStatus === 'under_review';
  const fieldTooltip = FIELD_TOOLTIPS[fieldConfig.field_name];

  const getCommentIcon = () => {
    if (!hasComment) return null;
    switch (comment.indicator) {
      case 'warning': return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
      case 'problematic': return <AlertCircle className="w-4 h-4 text-red-600" />;
      case 'question': return <HelpCircle className="w-4 h-4 text-blue-600" />;
      default: return <MessageSquare className="w-4 h-4 text-slate-600" />;
    }
  };

  const getCommentBadgeColor = () => {
    if (!hasComment) return 'bg-slate-100 text-slate-800';
    switch (comment.indicator) {
      case 'warning': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'problematic': return 'bg-red-100 text-red-800 border-red-300';
      case 'question': return 'bg-blue-100 text-blue-800 border-blue-300';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  useEffect(() => {
    if (!fieldConfig.value_conditional) {
      setCalculatedValue(value);
      setAutoCalculatedValue(null);
      return;
    }

    const conditional = fieldConfig.value_conditional;
    let calculatedVal = null;

    // Always calculate what the auto-calculated value would be
    if (conditional.type === 'formula' && conditional.formula) {
      try {
        calculatedVal = evaluateFormula(conditional.formula, allFieldValues);
        setAutoCalculatedValue(calculatedVal);
      } catch (error) {
        console.error('Error evaluating formula:', error);
        setAutoCalculatedValue(null);
      }
    } else if (conditional.type === 'copy_from' && conditional.source_field) {
      calculatedVal = allFieldValues[conditional.source_field];
      setAutoCalculatedValue(calculatedVal);
    } else if (conditional.type === 'conditional_value' && conditional.rules) {
      for (const rule of conditional.rules) {
        const fieldValue = allFieldValues[rule.condition_field];
        const operator = rule.condition_operator || 'equals';
        const conditionValue = rule.condition_value;
        
        let conditionMet = false;
        switch (operator) {
          case 'equals': conditionMet = String(fieldValue) === String(conditionValue); break;
          case 'not_equals': conditionMet = String(fieldValue) !== String(conditionValue); break;
          case 'contains': conditionMet = String(fieldValue).includes(String(conditionValue)); break;
          case 'greater_than': conditionMet = parseFloat(fieldValue) > parseFloat(conditionValue); break;
          case 'less_than': conditionMet = parseFloat(fieldValue) < parseFloat(conditionValue); break;
          case 'in':
            const values = String(conditionValue).split(',').map(v => v.trim());
            conditionMet = values.includes(String(fieldValue));
            break;
        }
        
        if (conditionMet) {
          calculatedVal = rule.result_value;
          setAutoCalculatedValue(calculatedVal);
          break;
        }
      }
    }

    // Check if field has been manually overridden (support both regular and repeatable fields)
    const fieldKey = repeatableFieldKey || fieldConfig.field_name;
    if (overriddenFields.includes(fieldKey)) {
      console.log('[DynamicField] Field is overridden, using stored value:', fieldKey, value);
      setCalculatedValue(value);
      return;
    }

    // Allow manual editing in edit mode
    if (!isReadOnly) {
      setCalculatedValue(value);
      return;
    }

    console.log('[DynamicField] Auto-calculating field:', fieldConfig.field_name);

    // Apply auto-calculated value
    if (calculatedVal !== null && calculatedVal !== value) {
      setCalculatedValue(calculatedVal);
      onChange(calculatedVal);
    }
  }, [allFieldValues, fieldConfig.value_conditional, isReadOnly, onChange, value, overriddenFields, fieldConfig.field_name, repeatableFieldKey]);

  useEffect(() => {
    if (fieldConfig.field_type !== 'email') return;
    if (!value) {
      setEmailError('');
      return;
    }
    setEmailError(EMAIL_PATTERN.test(value) ? '' : 'Please enter a valid email address');
  }, [fieldConfig.field_type, value]);

  useEffect(() => {
    if (fieldConfig.field_type === 'currency') {
      setDisplayValue(formatCurrency(value));
    } else if (fieldConfig.field_type === 'tel') {
      setDisplayValue(formatPhoneNumber(value));
    } else if (fieldConfig.field_type === 'ssn') {
      setDisplayValue(formatSSN(value));
    } else if (fieldConfig.field_type === 'ein' || fieldConfig.field_name === 'entity_ein') {
      setDisplayValue(formatEIN(value));
    } else {
      setDisplayValue(value);
    }
  }, [value, fieldConfig.field_type, fieldConfig.field_name]);

  const shouldDisplay = () => {
    if (!fieldConfig.display_conditional) return true;
    
    const { field, operator = 'equals', value: conditionValue } = fieldConfig.display_conditional;
    const fieldValue = allFieldValues[field];
    
    if (typeof fieldValue === 'boolean' || fieldValue === 'true' || fieldValue === 'false') {
      const boolValue = fieldValue === true || fieldValue === 'true';
      const boolCondition = conditionValue === true || conditionValue === 'true' || conditionValue === '1' || conditionValue === 1;
      
      if (operator === 'equals') return boolValue === boolCondition;
      if (operator === 'not_equals') return boolValue !== boolCondition;
    }
    
    switch (operator) {
      case 'equals': return String(fieldValue) === String(conditionValue);
      case 'not_equals': return String(fieldValue) !== String(conditionValue);
      case 'contains': return String(fieldValue).includes(String(conditionValue));
      case 'greater_than': return parseFloat(fieldValue) > parseFloat(conditionValue);
      case 'less_than': return parseFloat(fieldValue) < parseFloat(conditionValue);
      case 'in':
        const values = String(conditionValue).split(',').map(v => v.trim());
        return values.includes(String(fieldValue));
      default: return true;
    }
  };

  if (!shouldDisplay()) return null;

  const isCalculated = !!fieldConfig.value_conditional;
  const fieldKey = repeatableFieldKey || fieldConfig.field_name;
  const isManuallyEdited = isCalculated && overriddenFields.includes(fieldKey);
  const isFieldOverridden = showOverrideControl && overriddenFields.includes(fieldKey);
  
  console.log('[DynamicField] Override state:', {
    fieldName: fieldConfig.field_name,
    showOverrideControl,
    isFieldOverridden,
    overriddenFields,
    value,
    isOverrideMode
  });
  
  // Field is read-only if: globally readonly, field configured readonly, OR inherited but not in override mode
  const effectiveReadOnly = isReadOnly || fieldConfig.read_only || (showOverrideControl && !isOverrideMode && !isFieldOverridden);
  
  console.log('[DynamicField] Effective readonly:', {
    fieldName: fieldConfig.field_name,
    isReadOnly,
    fieldReadOnly: fieldConfig.read_only,
    showOverrideControl,
    isOverrideMode,
    isFieldOverridden,
    effectiveReadOnly
  });

  const handleEnableOverride = () => {
    console.log('[DynamicField] Enabling override for:', fieldConfig.field_name);
    setIsOverrideMode(true);
    
    // Mark field as overridden immediately
    const newOverriddenFields = [...overriddenFields];
    if (!newOverriddenFields.includes(fieldKey)) {
      newOverriddenFields.push(fieldKey);
      onChange({
        overridden_fields: newOverriddenFields
      });
    }
  };

  const handleRevertToInherited = () => {
    console.log('[DynamicField] Reverting to inherited for:', fieldConfig.field_name);
    setIsOverrideMode(false);
    
    // Remove from overridden fields
    const newOverriddenFields = overriddenFields.filter(f => f !== fieldKey);
    onChange({
      [fieldConfig.field_name]: value, // Keep current value but mark as not overridden
      overridden_fields: newOverriddenFields
    });
  };

  const handleRevertToCalculated = () => {
    if (!isCalculated || !isManuallyEdited) return;
    
    // Remove from overridden fields and set to calculated value
    const updates = {};
    updates[fieldConfig.field_name] = autoCalculatedValue;
    
    const newOverriddenFields = overriddenFields.filter(f => f !== fieldKey);
    updates.overridden_fields = newOverriddenFields;
    
    onChange(updates);
  };

  const handlePhoneChange = (e) => {
    const formatted = formatPhoneNumber(e.target.value);
    setDisplayValue(formatted);
    onChange(formatted.replace(/\D/g, ''));
  };

  const handleSSNChange = (e) => {
    const formatted = formatSSN(e.target.value);
    setDisplayValue(formatted);
    onChange(formatted.replace(/\D/g, ''));
  };

  const handleCurrencyChange = (e) => {
    onChange(parseCurrency(e.target.value));
  };

  const handleEINChange = (e) => {
    const formatted = formatEIN(e.target.value);
    setDisplayValue(formatted);
    onChange(formatted.replace(/\D/g, ''));
  };

  const handleAddressSelect = (addressData) => {
    const updates = {};
    if (fieldConfig.field_name.includes('street')) {
      const prefix = fieldConfig.field_name.replace('_street', '');
      updates[`${prefix}_street`] = addressData.street;
      updates[`${prefix}_city`] = addressData.city;
      updates[`${prefix}_state`] = addressData.state;
      updates[`${prefix}_zip`] = addressData.zip;
    }
    onChange(updates);
  };

  const renderField = () => {
    if (fieldConfig.field_name === 'referrer_name') {
      return <ReferrerDropdown value={value} onChange={onChange} isReadOnly={effectiveReadOnly} />;
    }

    switch (fieldConfig.field_type) {
      case 'radio':
        // Convert boolean values to "yes"/"no" for comparison
        let normalizedValue = value;
        if (typeof value === 'boolean') {
          normalizedValue = value ? 'yes' : 'no';
        }
        
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {(fieldConfig.options || []).map((option) => {
              const description = getOptionDescription(fieldConfig.field_name, option);
              const isSelected = String(normalizedValue).toLowerCase() === String(option).toLowerCase();
              
              const handleClick = () => {
                if (effectiveReadOnly) return;

                // If the field stores booleans, convert the option back to boolean
                let valueToSet = option;
                if (typeof value === 'boolean' || fieldConfig.field_name.includes('_national') || 
                    fieldConfig.field_name.includes('bankruptcy') || fieldConfig.field_name.includes('foreclosure') ||
                    fieldConfig.field_name.includes('mortgage_late') || fieldConfig.field_name.includes('felony') ||
                    fieldConfig.field_name.includes('occupied')) {
                  valueToSet = option.toLowerCase() === 'yes';
                }

                // Track override for calculated radio fields
                if (isCalculated && !isReadOnly) {
                  const updates = {};
                  updates[fieldConfig.field_name] = valueToSet;

                  const fieldKey = repeatableFieldKey || fieldConfig.field_name;
                  const overriddenFields = allFieldValues.overridden_fields || [];
                  if (!overriddenFields.includes(fieldKey)) {
                    updates.overridden_fields = [...overriddenFields, fieldKey];
                  }
                  onChange(updates);
                } else {
                  onChange(valueToSet);
                }
              };
              
              return (
                <div 
                  key={option} 
                  onClick={handleClick}
                  className={`flex items-start space-x-3 p-3 rounded-lg border transition-all ${
                    effectiveReadOnly ? 'cursor-default' : 'cursor-pointer'
                  } ${
                    isSelected 
                      ? 'border-blue-500 bg-blue-50 shadow-sm' 
                      : effectiveReadOnly 
                        ? 'border-slate-200 bg-slate-50'
                        : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/50'
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full border-2 mt-0.5 flex items-center justify-center transition-all ${
                    isSelected 
                      ? 'border-blue-500 bg-blue-500' 
                      : 'border-slate-300'
                  }`}>
                    {isSelected && <div className="w-2 h-2 rounded-full bg-white"></div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium transition-colors ${
                      isSelected ? 'text-blue-700' : 'text-slate-900'
                    }`}>
                      {formatOptionLabel(option)}
                    </p>
                    {description && (
                      <p className="text-xs text-slate-500 mt-0.5 leading-snug">{description}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        );

      case 'fulladdress':
        // Format display value without country
        const fullAddressDisplay = [
          value?.street,
          value?.unit ? `Unit ${value.unit}` : null,
          value?.city,
          value?.state,
          value?.zip
        ].filter(Boolean).join(', ');

        return (
          <AddressAutocomplete
            id={fieldConfig.field_name}
            value={typeof value === 'string' ? value : fullAddressDisplay}
            onChange={(newValue) => {
              // For fulladdress type, just store the input string directly
              onChange(newValue);
            }}
            onAddressSelect={(addressData) => {
              // When an address is selected from dropdown, use the formatted address
              // AddressAutocomplete already calls onChange with suggestion.description
              // So we don't need to do anything here for fulladdress type
              console.log('Full address selected:', addressData);
            }}
            disabled={effectiveReadOnly}
            placeholder={fieldConfig.placeholder || 'Enter full address'}
            className="h-10 text-sm"
          />
        );

      case 'address':
        return (
          <AddressAutocomplete
            id={fieldConfig.field_name}
            value={value || ''}
            onChange={(newValue) => onChange(newValue)}
            onAddressSelect={handleAddressSelect}
            disabled={effectiveReadOnly}
            placeholder={fieldConfig.placeholder || 'Start typing an address...'}
            className="h-10 text-sm"
          />
        );

      case 'tel':
        return (
          <Input
            type="text"
            value={displayValue || ''}
            onChange={handlePhoneChange}
            placeholder={fieldConfig.placeholder || '(000) 000-0000'}
            disabled={effectiveReadOnly}
            required={fieldConfig.required}
            maxLength={14}
            className="h-10 text-sm"
          />
        );

      case 'email':
        return (
          <div className="space-y-1">
            <Input
              type="email"
              value={value || ''}
              onChange={(e) => {
                const nextValue = e.target.value;
                onChange(nextValue);
                setEmailError(
                  nextValue && !EMAIL_PATTERN.test(nextValue)
                    ? 'Please enter a valid email address'
                    : ''
                );
              }}
              placeholder={fieldConfig.placeholder || 'email@example.com'}
              disabled={effectiveReadOnly}
              required={fieldConfig.required}
              pattern={EMAIL_PATTERN.source}
              className={`h-10 text-sm ${emailError ? 'border-red-500' : ''}`}
            />
            {emailError && <p className="text-xs text-red-500">{emailError}</p>}
          </div>
        );

      case 'ssn':
        return (
          <Input
            type="text"
            value={displayValue || ''}
            onChange={handleSSNChange}
            placeholder={fieldConfig.placeholder || '000-00-0000'}
            disabled={effectiveReadOnly}
            required={fieldConfig.required}
            maxLength={11}
            className="h-10 text-sm"
          />
        );

      case 'ein':
        return (
          <Input
            type="text"
            value={displayValue || ''}
            onChange={handleEINChange}
            placeholder={fieldConfig.placeholder || '00-0000000'}
            disabled={effectiveReadOnly}
            required={fieldConfig.required}
            maxLength={10}
            className="h-10 text-sm"
          />
        );

      case 'currency':
        return (
          <div className="relative">
            <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500 text-sm">$</span>
            <Input
              type="text"
              value={displayValue || ''}
              onChange={handleCurrencyChange}
              placeholder={fieldConfig.placeholder || '0'}
              disabled={effectiveReadOnly}
              required={fieldConfig.required}
              className="pl-7 h-10 text-sm"
              onWheel={(e) => e.target.blur()}
            />
          </div>
        );

      case 'percentage':
        return (
          <div className="relative">
            <Input
              type="number"
              value={value === null || value === undefined ? '' : value}
              onChange={(e) => onChange(e.target.value === '' ? null : parseFloat(e.target.value))}              
              placeholder={fieldConfig.placeholder || '0'}
              disabled={effectiveReadOnly}
              required={fieldConfig.required}
              min={fieldConfig.validation?.min}
              max={fieldConfig.validation?.max}
              className="pr-7 h-10 text-sm"
              onWheel={(e) => e.target.blur()}
            />
            <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-500 text-sm">%</span>
          </div>
        );

      case 'number':
        return (
          <Input
            type="number"
            value={value === null || value === undefined ? '' : value}
            onChange={(e) => onChange(e.target.value === '' ? null : parseFloat(e.target.value))}            
            placeholder={fieldConfig.placeholder}
            disabled={effectiveReadOnly}
            required={fieldConfig.required}
            min={fieldConfig.validation?.min}
            max={fieldConfig.validation?.max}
            className="h-10 text-sm"
            onWheel={(e) => e.target.blur()}
          />
        );

      case 'date':
        return (
          <Input
            type="date"
            value={value || ''}
            onChange={(e) => onChange(e.target.value || null)}
            disabled={effectiveReadOnly}
            required={fieldConfig.required}
            className="h-10 text-sm"
          />
        );

      case 'datetime':
        return (
          <Input
            type="datetime-local"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            disabled={effectiveReadOnly}
            required={fieldConfig.required}
            className="h-10 text-sm"
          />
        );

      case 'textarea':
        return (
          <Textarea
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={fieldConfig.placeholder}
            disabled={effectiveReadOnly}
            required={fieldConfig.required}
            rows={3}
            className="text-sm resize-none min-h-[90px]"
          />
        );

      case 'select':
        return (
          <Select
            value={value || ''}
            onValueChange={onChange}
            disabled={effectiveReadOnly}
            required={fieldConfig.required}
          >
            <SelectTrigger className="h-10 text-sm">
              <SelectValue placeholder={fieldConfig.placeholder || 'Select an option...'} />
            </SelectTrigger>
            <SelectContent>
              {(fieldConfig.options || []).map((option) => (
                <SelectItem key={option} value={option} className="text-sm py-2">
                  {formatOptionLabel(option)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'checkbox':
        return (
          <div className="flex items-start space-x-3 p-3 rounded-lg border border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 transition-all bg-white max-w-md">
            <Checkbox
              checked={value === true || value === 'true'}
              onCheckedChange={(checked) => onChange(checked)}
              disabled={effectiveReadOnly}
              className="mt-0.5 flex-shrink-0"
            />
            <div className="flex-1 min-w-0">
              <Label className="cursor-pointer text-sm font-medium text-slate-900 leading-snug">
                {fieldConfig.field_label}
              </Label>
              {fieldConfig.description && (
                <p className="text-xs text-slate-500 mt-1 leading-snug">{fieldConfig.description}</p>
              )}
            </div>
          </div>
        );

      case 'state':
        return (
          <Select
            value={value || ''}
            onValueChange={onChange}
            disabled={effectiveReadOnly}
            required={fieldConfig.required}
          >
            <SelectTrigger className="h-10 text-sm">
              <SelectValue placeholder="Select state..." />
            </SelectTrigger>
            <SelectContent>
              {US_STATES.map((state) => (
                <SelectItem key={state.value} value={state.value} className="text-sm py-2">
                  {state.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'city':
        const stateForCity = allFieldValues[fieldConfig.field_name.replace('_city', '_state')];
        const cities = stateForCity ? US_CITIES_BY_STATE[stateForCity] || [] : [];
        return (
          <Select
            value={value || ''}
            onValueChange={onChange}
            disabled={effectiveReadOnly || !stateForCity}
            required={fieldConfig.required}
          >
            <SelectTrigger className="h-10 text-sm">
              <SelectValue placeholder={stateForCity ? 'Select city...' : 'Select state first...'} />
            </SelectTrigger>
            <SelectContent>
              {cities.map((city) => (
                <SelectItem key={city} value={city} className="text-sm py-2">{city}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'county':
        const stateForCounty = allFieldValues[fieldConfig.field_name.replace('_county', '_state')];
        const counties = stateForCounty ? US_COUNTIES_BY_STATE[stateForCounty] || [] : [];
        return (
          <Select
            value={value || ''}
            onValueChange={onChange}
            disabled={effectiveReadOnly || !stateForCounty}
            required={fieldConfig.required}
          >
            <SelectTrigger className="h-10 text-sm">
              <SelectValue placeholder={stateForCounty ? 'Select county...' : 'Select state first...'} />
            </SelectTrigger>
            <SelectContent>
              {counties.map((county) => (
                <SelectItem key={county} value={county} className="text-sm py-2">{county}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'zipcode':
        return (
          <Input
            type="text"
            value={value || ''}
            onChange={(e) => {
              const cleaned = e.target.value.replace(/\D/g, '').slice(0, 5);
              onChange(cleaned);
            }}
            placeholder={fieldConfig.placeholder || '00000'}
            disabled={effectiveReadOnly}
            required={fieldConfig.required}
            maxLength={5}
            className="h-10 text-sm"
          />
        );

      default:
        if (fieldConfig.field_name === 'entity_ein') {
          return (
            <Input
              type="text"
              value={displayValue || ''}
              onChange={handleEINChange}
              placeholder={fieldConfig.placeholder || '00-0000000'}
              disabled={effectiveReadOnly}
              required={fieldConfig.required}
              maxLength={10}
              className="h-10 text-sm"
            />
          );
        }
        return (
          <Input
            type="text"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={fieldConfig.placeholder}
            disabled={effectiveReadOnly}
            required={fieldConfig.required}
            minLength={fieldConfig.validation?.minLength}
            maxLength={fieldConfig.validation?.maxLength}
            pattern={fieldConfig.validation?.pattern}
            className="h-10 text-sm"
          />
        );
    }
  };

  if (fieldConfig.field_type === 'checkbox') {
    return (
      <div className="space-y-3">
        {renderField()}
        {showComments && hasComment && (
          <div className={`p-3 rounded-lg border ${getCommentBadgeColor()}`}>
            <div className="flex items-start gap-2">
              {getCommentIcon()}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold">Loan Officer Comment:</p>
                <p className="text-xs mt-0.5">{comment.comment}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (fieldConfig.field_type === 'radio') {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Label className="text-sm font-semibold text-slate-800">
            {fieldConfig.field_label}
            {fieldConfig.required && <span className="text-red-500 ml-1">*</span>}
          </Label>
          {fieldTooltip && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="w-4 h-4 text-blue-500 cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-sm whitespace-pre-line text-xs">
                  <p>{fieldTooltip}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        
        {renderField()}
        
        {showComments && hasComment && (
          <div className={`p-3 rounded-lg border ${getCommentBadgeColor()}`}>
            <div className="flex items-start gap-2">
              {getCommentIcon()}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold">Loan Officer Comment:</p>
                <p className="text-xs mt-0.5">{comment.comment}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Label htmlFor={fieldConfig.field_name} className="text-xs font-medium text-slate-700">
          {fieldConfig.field_label}
          {fieldConfig.required && <span className="text-red-500 ml-0.5">*</span>}
        </Label>
        {fieldTooltip && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="w-3.5 h-3.5 text-blue-500 cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-sm whitespace-pre-line text-xs">
                <p>{fieldTooltip}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        {isCalculated && !isManuallyEdited && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">Auto-calc</Badge>
        )}
        {isManuallyEdited && (
          <>
            <Badge className="text-[10px] px-1.5 py-0 bg-orange-100 text-orange-700 border-orange-300">Overridden</Badge>
            {!isReadOnly && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleRevertToCalculated}
                      className="h-5 px-1.5 text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="text-xs">
                    <p>Revert to calculated value</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </>
        )}
        {showOverrideControl && !isFieldOverridden && !isOverrideMode && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleEnableOverride}
                  className="h-5 px-2 text-[10px] border-blue-300 text-blue-600 hover:bg-blue-50"
                >
                  Override
                </Button>
              </TooltipTrigger>
              <TooltipContent className="text-xs">
                <p>Override inherited value from contact</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        {showOverrideControl && (isFieldOverridden || isOverrideMode) && (
          <>
            <Badge className="text-[10px] px-1.5 py-0 bg-purple-100 text-purple-700 border-purple-300">Inherited (Overridden)</Badge>
            {!isReadOnly && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleRevertToInherited}
                      className="h-5 px-1.5 text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="text-xs">
                    <p>Revert to inherited value</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </>
        )}
        {canEditComments && onAddComment && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onAddComment(fieldConfig.field_name)}
            className="h-5 px-1.5 text-slate-500 hover:text-blue-600"
          >
            <MessageSquare className="w-3.5 h-3.5" />
          </Button>
        )}
        {applicationData && (
          <FieldChangeIndicator fieldName={fieldConfig.field_name} applicationData={applicationData} />
        )}
      </div>
      
      {renderField()}
      
      {fieldConfig.description && (
        <p className="text-xs text-slate-500 leading-snug">{fieldConfig.description}</p>
      )}

      {showComments && hasComment && (
        <div className={`p-3 rounded-lg border ${getCommentBadgeColor()}`}>
          <div className="flex items-start gap-2">
            {getCommentIcon()}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold">Loan Officer Comment:</p>
              <p className="text-xs mt-0.5">{comment.comment}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}