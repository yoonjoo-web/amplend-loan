
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { APP_ROLES } from "@/components/utils/appRoles";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Plus, X, Loader2, Search } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { base44 } from "@/api/base44Client";

const FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'email', label: 'Email' },
  { value: 'tel', label: 'Phone Number' },
  { value: 'number', label: 'Number' },
  { value: 'currency', label: 'Currency' },
  { value: 'percentage', label: 'Percentage' },
  { value: 'date', label: 'Date' },
  { value: 'datetime', label: 'Date & Time' },
  { value: 'textarea', label: 'Text Area' },
  { value: 'select', label: 'Dropdown' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'radio', label: 'Radio Buttons' },
  { value: 'fulladdress', label: 'Full Address' },
  { value: 'address', label: 'Address (with autocomplete)' },
  { value: 'state', label: 'U.S. State (dropdown)' },
  { value: 'city', label: 'U.S. City (dropdown based on state)' },
  { value: 'county', label: 'U.S. County (dropdown based on state)' },
  { value: 'ssn', label: 'SSN (auto-formatted)' },
  { value: 'zipcode', label: 'ZIP Code (auto-formatted)' }
];

const OPERATORS = [
  { value: 'equals', label: 'Equals' },
  { value: 'not_equals', label: 'Not Equals' },
  { value: 'contains', label: 'Contains' },
  { value: 'greater_than', label: 'Greater Than' },
  { value: 'less_than', label: 'Less Than' },
  { value: 'in', label: 'In (comma-separated)' }
];

function labelToFieldName(label) {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '_');
}

function FieldSearch({ value, onChange, context, excludeFields = [], showValueInput = false, onValueChange = null, currentValue = '' }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [availableFields, setAvailableFields] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadFields();
  }, [context]);

  const loadFields = async () => {
    setIsLoading(true);
    try {
      const { data } = await base44.functions.invoke('getEntityFieldList', { context });
      setAvailableFields(data.fields || []);
    } catch (error) {
      console.error('Error loading fields:', error);
      setAvailableFields([]);
    }
    setIsLoading(false);
  };

  const filteredFields = availableFields.filter(field => {
    if (excludeFields.includes(field.field_name)) return false;
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      field.field_name.toLowerCase().includes(query) ||
      field.field_label?.toLowerCase().includes(query)
    );
  });

  const selectedField = availableFields.find(f => f.field_name === value);
  const hasOptions = selectedField && ['select', 'radio'].includes(selectedField.field_type) && selectedField.options?.length > 0;
  const isBooleanField = selectedField && selectedField.field_type === 'checkbox';


  return (
    <div className="space-y-2">
      <div className="relative">
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search fields..."
          className="pl-10"
        />
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
      </div>

      {selectedField && (
        <div className="flex items-center gap-2 p-2 bg-blue-50 rounded border border-blue-200">
          <Badge variant="outline">{selectedField.field_label}</Badge>
          <span className="text-xs text-slate-600">({selectedField.field_name})</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange('')}
            className="ml-auto h-6 w-6 p-0"
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
      )}

      {searchQuery && (
        <div className="max-h-48 overflow-y-auto border rounded-md">
          {isLoading ? (
            <div className="p-4 text-center text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin mx-auto" />
            </div>
          ) : filteredFields.length === 0 ? (
            <div className="p-4 text-center text-slate-500 text-sm">No fields found</div>
          ) : (
            <div className="divide-y">
              {filteredFields.map((field) => (
                <button
                  key={field.field_name}
                  type="button"
                  onClick={() => {
                    onChange(field.field_name);
                    setSearchQuery('');
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-slate-50 transition-colors"
                >
                  <div className="font-medium text-sm">{field.field_label}</div>
                  <div className="text-xs text-slate-500">{field.field_name}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {showValueInput && selectedField && onValueChange && (
        <div className="space-y-2 pt-2">
          <Label className="text-sm">Value</Label>
          {isBooleanField ? (
             <Select value={String(currentValue)} onValueChange={onValueChange}>
             <SelectTrigger>
               <SelectValue placeholder="Select boolean value..." />
             </SelectTrigger>
             <SelectContent>
               <SelectItem value="true">True</SelectItem>
               <SelectItem value="false">False</SelectItem>
             </SelectContent>
           </Select>
          ) : hasOptions ? (
            <Select value={currentValue} onValueChange={onValueChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select a value..." />
              </SelectTrigger>
              <SelectContent>
                {selectedField.options.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              value={currentValue}
              onChange={(e) => onValueChange(e.target.value)}
              placeholder="Enter comparison value"
            />
          )}
        </div>
      )}
    </div>
  );
}

const ROLE_OPTIONS = APP_ROLES.map((role) => ({ value: role, label: role }));

export default function FieldEditorModal({ isOpen, onClose, field, category, context, onSave, isSaving }) {
  const [formData, setFormData] = useState({
    field_name: '',
    field_label: '',
    field_type: 'text',
    category: category || '',
    category_display_name: category || '',
    section: '',
    required: false,
    read_only: false,
    placeholder: '',
    description: '',
    options: [],
    validation: {},
    display_conditional: null,
    value_conditional: null,
    visible_to_roles: [],
    display_order: 0
  });

  const [optionInput, setOptionInput] = useState('');
  const [showDisplayConditional, setShowDisplayConditional] = useState(false);
  const [showValueConditional, setShowValueConditional] = useState(false);
  const [conditionalRules, setConditionalRules] = useState([]);
  const [availableCategories, setAvailableCategories] = useState([]);
  const [availableSections, setAvailableSections] = useState([]);
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [showNewSection, setShowNewSection] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newSectionName, setNewSectionName] = useState('');

  useEffect(() => {
    if (field) {
      setFormData({
        ...field,
        validation: field.validation || {},
        display_conditional: field.display_conditional || null,
        value_conditional: field.value_conditional || null,
        visible_to_roles: field.visible_to_roles || [],
        section: field.section || ''
      });
      setShowDisplayConditional(!!field.display_conditional);
      setShowValueConditional(!!field.value_conditional);
      if (field.value_conditional?.rules) {
        setConditionalRules(field.value_conditional.rules);
      }
    } else {
      setFormData({
        field_name: '',
        field_label: '',
        field_type: 'text',
        category: category || '',
        category_display_name: category || '',
        section: '',
        required: false,
        read_only: false,
        placeholder: '',
        description: '',
        options: [],
        validation: {},
        display_conditional: null,
        value_conditional: null,
        visible_to_roles: [],
        display_order: 0
      });
      setShowDisplayConditional(false);
      setShowValueConditional(false);
      setConditionalRules([]);
    }
  }, [field, category, isOpen]);

  useEffect(() => {
    if (isOpen) {
      loadCategoriesAndSections();
    }
  }, [isOpen, context, field?.section]); // Added field?.section to dependencies to react to its change

  const loadCategoriesAndSections = async () => {
    try {
      const { data } = await base44.functions.invoke('getEntityFieldList', { context });
      const fields = data.fields || [];
      
      const categories = [...new Set(fields.map(f => f.category_display_name || f.category))].filter(Boolean);
      setAvailableCategories(categories);
      
      let sections = [...new Set(fields.map(f => f.section).filter(Boolean))];
      
      // If editing a field with a section, make sure that section is in the list
      if (field?.section && !sections.includes(field.section)) {
        sections.push(field.section);
      }
      
      setAvailableSections(sections);
    } catch (error) {
      console.error('Error loading categories and sections:', error);
      setAvailableCategories([]);
      setAvailableSections([]);
    }
  };

  const handleInputChange = (fieldName, value) => {
    setFormData(prev => ({ ...prev, [fieldName]: value }));
  };

  const handleFieldLabelChange = (value) => {
    setFormData(prev => {
      const updates = { field_label: value };
      if (!field) {
        updates.field_name = labelToFieldName(value);
      }
      return { ...prev, ...updates };
    });
  };

  const handleAddOption = () => {
    if (!optionInput.trim()) return;
    setFormData(prev => ({
      ...prev,
      options: [...(prev.options || []), optionInput.trim()]
    }));
    setOptionInput('');
  };

  const handleRemoveOption = (index) => {
    setFormData(prev => ({
      ...prev,
      options: prev.options.filter((_, i) => i !== index)
    }));
  };

  const handleValidationChange = (key, value) => {
    setFormData(prev => ({
      ...prev,
      validation: { ...prev.validation, [key]: value }
    }));
  };

  const handleDisplayConditionalChange = (key, value) => {
    let processedValue = value;
    if (key === 'value') {
      if (value === 'true' || value === '1') {
        processedValue = true;
      } else if (value === 'false' || value === '0') {
        processedValue = false;
      }
    }
    
    setFormData(prev => ({
      ...prev,
      display_conditional: {
        ...prev.display_conditional,
        [key]: processedValue
      }
    }));
  };

  const handleValueConditionalChange = (key, value) => {
    setFormData(prev => ({
      ...prev,
      value_conditional: {
        ...prev.value_conditional,
        [key]: value
      }
    }));
  };

  const handleAddConditionalRule = () => {
    const newRule = {
      condition_field: '',
      condition_operator: 'equals',
      condition_value: '',
      result_value: ''
    };
    setConditionalRules([...conditionalRules, newRule]);
  };

  const handleConditionalRuleChange = (index, key, value) => {
    const updated = [...conditionalRules];
    updated[index] = { ...updated[index], [key]: value };
    setConditionalRules(updated);
  };

  const handleRemoveConditionalRule = (index) => {
    setConditionalRules(conditionalRules.filter((_, i) => i !== index));
  };

  const handleCategoryChange = (value) => {
    if (value === '__new__') {
      setShowNewCategory(true);
      setNewCategoryName('');
    } else {
      setShowNewCategory(false);
      handleInputChange('category', value);
      handleInputChange('category_display_name', value);
    }
  };

  const handleAddNewCategory = () => {
    if (!newCategoryName.trim()) return;
    handleInputChange('category', newCategoryName.trim());
    handleInputChange('category_display_name', newCategoryName.trim());
    setShowNewCategory(false);
    setNewCategoryName('');
  };

  const handleSectionChange = (value) => {
    if (value === '__new__') {
      setShowNewSection(true);
      setNewSectionName('');
    } else if (value === '__none__') {
      setShowNewSection(false);
      handleInputChange('section', '');
    } else {
      setShowNewSection(false);
      handleInputChange('section', value);
    }
  };

  const handleAddNewSection = () => {
    if (!newSectionName.trim()) return;
    handleInputChange('section', newSectionName.trim());
    setShowNewSection(false);
    setNewSectionName('');
  };

  const handleRoleToggle = (roleValue) => {
    setFormData(prev => {
      const currentRoles = prev.visible_to_roles || [];
      const newRoles = currentRoles.includes(roleValue)
        ? currentRoles.filter(r => r !== roleValue)
        : [...currentRoles, roleValue];
      return { ...prev, visible_to_roles: newRoles };
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const dataToSave = {
      ...formData,
      section: formData.section || '',
      display_conditional: showDisplayConditional ? formData.display_conditional : null,
      value_conditional: showValueConditional ? {
        ...formData.value_conditional,
        rules: formData.value_conditional?.type === 'conditional_value' ? conditionalRules : undefined
      } : null
    };

    onSave(dataToSave);
  };

  const needsOptions = ['select', 'radio'].includes(formData.field_type);
  
  // Ensure current section is in the list (in case it loaded before availableSections)
  const sectionsToShow = [...availableSections];
  if (formData.section && !sectionsToShow.includes(formData.section)) {
    sectionsToShow.push(formData.section);
    // Sort to keep it alphabetical, but new added section might need specific placement logic if desired
    sectionsToShow.sort(); 
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{field ? 'Edit Field' : 'Add Custom Field'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardContent className="pt-6 space-y-4">
              <h3 className="font-semibold text-lg">Basic Information</h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="field_label">Field Label (display) *</Label>
                  <Input
                    id="field_label"
                    value={formData.field_label || ''}
                    onChange={(e) => handleFieldLabelChange(e.target.value)}
                    placeholder="e.g., First Name"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="field_name">Field Name (database) *</Label>
                  <Input
                    id="field_name"
                    value={formData.field_name || ''}
                    onChange={(e) => handleInputChange('field_name', e.target.value)}
                    placeholder="e.g., borrower_first_name"
                    required
                    disabled={!!field}
                    className={!field ? 'bg-slate-50' : ''}
                  />
                  {!field && (
                    <p className="text-xs text-slate-500">Auto-generated from field label</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="field_type">Field Type *</Label>
                  <Select
                    value={formData.field_type}
                    onValueChange={(value) => handleInputChange('field_type', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FIELD_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  {!showNewCategory ? (
                    <Select
                      value={formData.category_display_name || formData.category}
                      onValueChange={handleCategoryChange}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select or create category..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableCategories.map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {cat}
                          </SelectItem>
                        ))}
                        <SelectItem value="__new__">
                          <span className="flex items-center gap-2 text-blue-600">
                            <Plus className="w-4 h-4" />
                            Add New Category
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="flex gap-2">
                      <Input
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        placeholder="e.g., Borrower Information"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddNewCategory();
                          }
                        }}
                      />
                      <Button type="button" size="sm" onClick={handleAddNewCategory}>
                        <Plus className="w-4 h-4" />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setShowNewCategory(false)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>

                <div className="space-y-2 col-span-2">
                  <Label htmlFor="section">Section (optional grouping within category)</Label>
                  {!showNewSection ? (
                    <Select
                      value={formData.section || '__none__'}
                      onValueChange={handleSectionChange}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select or create section..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">No Section</SelectItem>
                        {sectionsToShow.map((sec) => (
                          <SelectItem key={sec} value={sec}>
                            {sec}
                          </SelectItem>
                        ))}
                        <SelectItem value="__new__">
                          <span className="flex items-center gap-2 text-blue-600">
                            <Plus className="w-4 h-4" />
                            Add New Section
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="flex gap-2">
                      <Input
                        value={newSectionName}
                        onChange={(e) => setNewSectionName(e.target.value)}
                        placeholder="e.g., Basic Information, Address"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddNewSection();
                          }
                        }}
                      />
                      <Button type="button" size="sm" onClick={handleAddNewSection}>
                        <Plus className="w-4 h-4" />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setShowNewSection(false)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                  <p className="text-xs text-slate-500">
                    Sections help organize fields within a category with visual separators
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="placeholder">Placeholder Text</Label>
                <Input
                  id="placeholder"
                  value={formData.placeholder || ''}
                  onChange={(e) => handleInputChange('placeholder', e.target.value)}
                  placeholder="e.g., Enter your first name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Help Text / Description</Label>
                <Textarea
                  id="description"
                  value={formData.description || ''}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="Additional information to help users understand this field"
                  rows={2}
                />
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="required"
                    checked={formData.required}
                    onCheckedChange={(checked) => handleInputChange('required', checked)}
                  />
                  <Label htmlFor="required" className="cursor-pointer">Required</Label>
                </div>
              </div>

              <div className="space-y-3 pt-4 border-t">
                <Label className="text-sm font-semibold">Visible to Roles</Label>
                <p className="text-xs text-slate-500">
                  Select which roles can see this field. If none selected, field is visible to all roles.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {ROLE_OPTIONS.map((role) => (
                    <div key={role.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`role_${role.value}`}
                        checked={(formData.visible_to_roles || []).includes(role.value)}
                        onCheckedChange={() => handleRoleToggle(role.value)}
                      />
                      <Label htmlFor={`role_${role.value}`} className="cursor-pointer text-sm">
                        {role.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {needsOptions && (
            <Card>
              <CardContent className="pt-6 space-y-4">
                <h3 className="font-semibold text-lg">Options</h3>

                <div className="flex gap-2">
                  <Input
                    value={optionInput}
                    onChange={(e) => setOptionInput(e.target.value)}
                    placeholder="Add an option"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddOption();
                      }
                    }}
                  />
                  <Button type="button" onClick={handleAddOption}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {(formData.options || []).map((option, index) => (
                    <Badge key={index} variant="secondary" className="px-3 py-1">
                      {option}
                      <button
                        type="button"
                        onClick={() => handleRemoveOption(index)}
                        className="ml-2 hover:text-red-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="pt-6">
              <Tabs defaultValue="display" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="display">Display Conditional</TabsTrigger>
                  <TabsTrigger value="value">Value Conditional</TabsTrigger>
                </TabsList>

                <TabsContent value="display" className="space-y-4 mt-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-slate-600">
                      Show this field only when certain conditions are met
                    </p>
                    <Checkbox
                      checked={showDisplayConditional}
                      onCheckedChange={setShowDisplayConditional}
                    />
                  </div>

                  {showDisplayConditional && (
                    <div className="space-y-4 p-4 bg-slate-50 rounded-lg">
                      <div className="space-y-2">
                        <Label>When Field</Label>
                        <FieldSearch
                          value={formData.display_conditional?.field || ''}
                          onChange={(value) => handleDisplayConditionalChange('field', value)}
                          context={context}
                          excludeFields={[formData.field_name]}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Operator</Label>
                        <Select
                          value={formData.display_conditional?.operator || 'equals'}
                          onValueChange={(value) => handleDisplayConditionalChange('operator', value)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {OPERATORS.map(op => (
                              <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <FieldSearch
                        value={formData.display_conditional?.field || ''}
                        onChange={() => {}}
                        context={context}
                        excludeFields={[formData.field_name]}
                        showValueInput={true}
                        currentValue={
                          typeof formData.display_conditional?.value === 'boolean' 
                            ? (formData.display_conditional?.value ? 'true' : 'false')
                            : (formData.display_conditional?.value || '')
                        }
                        onValueChange={(value) => handleDisplayConditionalChange('value', value)}
                      />
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="value" className="space-y-4 mt-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-slate-600">
                      Automatically calculate or set this field's value
                    </p>
                    <Checkbox
                      checked={showValueConditional}
                      onCheckedChange={setShowValueConditional}
                    />
                  </div>

                  {showValueConditional && (
                    <div className="space-y-4 p-4 bg-slate-50 rounded-lg">
                      <div className="space-y-2">
                        <Label>Calculation Type</Label>
                        <Select
                          value={formData.value_conditional?.type || 'formula'}
                          onValueChange={(value) => handleValueConditionalChange('type', value)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="formula">Formula</SelectItem>
                            <SelectItem value="copy_from">Copy From Field</SelectItem>
                            <SelectItem value="conditional_value">Conditional Value (If-Then)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {formData.value_conditional?.type === 'formula' && (
                        <div className="space-y-2">
                          <Label>Formula</Label>
                          <Textarea
                            value={formData.value_conditional?.formula || ''}
                            onChange={(e) => handleValueConditionalChange('formula', e.target.value)}
                            placeholder="e.g., {{purchase_price}} * 0.8 or EOMONTH({{origination_date}}, 12)"
                            rows={3}
                          />
                          <p className="text-xs text-slate-500">
                            Use {`{{field_name}}`} for field references. Supports: +, -, *, /, EOMONTH, IFERROR, TEXT, MIN, MAX, IF, ROUND
                          </p>
                        </div>
                      )}

                      {formData.value_conditional?.type === 'copy_from' && (
                        <div className="space-y-2">
                          <Label>Source Field</Label>
                          <FieldSearch
                            value={formData.value_conditional?.source_field || ''}
                            onChange={(value) => handleValueConditionalChange('source_field', value)}
                            context={context}
                            excludeFields={[formData.field_name]}
                          />
                        </div>
                      )}

                      {formData.value_conditional?.type === 'conditional_value' && (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <Label>Conditional Rules</Label>
                            <Button type="button" size="sm" onClick={handleAddConditionalRule}>
                              <Plus className="w-4 h-4 mr-2" />
                              Add Rule
                            </Button>
                          </div>

                          {conditionalRules.map((rule, index) => (
                            <div key={index} className="p-4 bg-white rounded-lg border space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium">Rule {index + 1}</span>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRemoveConditionalRule(index)}
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </div>

                              <div className="space-y-2">
                                <Label className="text-xs">If Field</Label>
                                <FieldSearch
                                  value={rule.condition_field}
                                  onChange={(value) => handleConditionalRuleChange(index, 'condition_field', value)}
                                  context={context}
                                  excludeFields={[formData.field_name]}
                                />
                              </div>

                              <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-2">
                                  <Label className="text-xs">Operator</Label>
                                  <Select
                                    value={rule.condition_operator}
                                    onValueChange={(value) => handleConditionalRuleChange(index, 'condition_operator', value)}
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {OPERATORS.map(op => (
                                        <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>

                                <div className="space-y-2">
                                  <Label className="text-xs">Value</Label>
                                  <FieldSearch
                                    value={rule.condition_field}
                                    onChange={() => {}}
                                    context={context}
                                    excludeFields={[formData.field_name]}
                                    showValueInput={true}
                                    currentValue={rule.condition_value}
                                    onValueChange={(value) => handleConditionalRuleChange(index, 'condition_value', value)}
                                  />
                                </div>
                              </div>

                              <div className="space-y-2">
                                <Label className="text-xs">Then Set Value To</Label>
                                <Input
                                  value={rule.result_value}
                                  onChange={(e) => handleConditionalRuleChange(index, 'result_value', e.target.value)}
                                  placeholder="Result value"
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={isSaving}>
              {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isSaving ? 'Saving...' : 'Save Field'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
