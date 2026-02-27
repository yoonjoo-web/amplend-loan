
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Edit, Trash2, GripVertical, Loader2, RefreshCw, Search, Repeat } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight } from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { useToast } from "@/components/ui/use-toast";
import { base44 } from "@/api/base44Client";

import FieldEditorModal from './FieldEditorModal';

// Skip built-in and special fields
const SKIP_FIELDS = [
  'id', 'created_date', 'updated_date', 'created_by',
  'status', 'current_step', 'submission_count',
  'assigned_loan_officer_id', 'primary_borrower_id',
  'borrower_entity_id', 'has_coborrowers',
  'co_borrowers', 'entity_owners', 
  'field_comments', 'overall_review_comment',
  'esignature', 'esignature_date',
  'acknowledgement_agreed', 'authorization_agreed',
  'rejection_reason', 'notes', 'overridden_fields',
  'borrower_completion_status', 'borrower_invitation_status',
  'borrower_ids', 'loan_officer_ids',
  'broker_id', 'referrer_id', 'liaison_id',
  'individuals', 'draws', 'loan_partners', 'unit_information',
  'modification_history'
];

// Helper function to add delay between API calls
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export default function FieldsManagementTab({ currentUser }) {
  const [activeTab, setActiveTab] = useState('application');
  const [openSections, setOpenSections] = useState({}); // Empty object = all collapsed by default
  const [editingField, setEditingField] = useState(null);
  const [editingCategory, setEditingCategory] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [allFields, setAllFields] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  const { toast } = useToast();

  const canManage = currentUser && (
    currentUser.role === 'admin' || 
    currentUser.app_role === 'Administrator'
  );

  // Monitor isSaving state changes
  useEffect(() => {
    console.log('FieldsManagementTab: isSaving changed to', isSaving);
  }, [isSaving]);

  useEffect(() => {
    if (canManage) {
      loadFields();
    }
  }, [canManage, activeTab]);

  const loadFields = async () => {
    setIsLoading(true);
    try {
      // Just load existing field configurations
      const configs = await base44.entities.FieldConfiguration.filter({ context: activeTab });
      
      // Sort by display_order
      const sorted = configs.sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
      setAllFields(sorted);
    } catch (error) {
      console.error('Error loading field configurations:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load field configurations.",
        duration: 4000,
      });
    }
    setIsLoading(false);
  };

  const toggleSection = (sectionKey) => {
    setOpenSections(prev => ({
      ...prev,
      [sectionKey]: !prev[sectionKey]
    }));
  };

  const groupByCategory = () => {
    const grouped = {};
    
    // Filter by search query
    const filteredFields = allFields.filter(field => {
      if (!searchQuery) return true;
      
      const query = searchQuery.toLowerCase();
      return (
        field.field_name?.toLowerCase().includes(query) ||
        field.field_label?.toLowerCase().includes(query) ||
        field.category?.toLowerCase().includes(query) ||
        field.category_display_name?.toLowerCase().includes(query)
      );
    });
    
    filteredFields.forEach(field => {
      const category = field.category_display_name || field.category;
      if (!grouped[category]) {
        grouped[category] = {
          fields: [],
          is_repeatable: field.is_repeatable_category || false
        };
      }
      grouped[category].fields.push(field);
    });
    return grouped;
  };

  const handleDragEnd = async (result) => {
    if (!result.destination) return;

    const { source, destination, type, draggableId } = result;

    let updatedAllFields = [...allFields];
    let fieldsToUpdateInDb = [];

    // Helper to get categories in their current display order
    const getOrderedCategories = (fieldsSnapshot) => {
      const grouped = {};
      fieldsSnapshot.forEach(field => {
        const category = field.category_display_name || field.category;
        if (!grouped[category]) grouped[category] = [];
        grouped[category].push(field);
      });

      return Object.keys(grouped).sort((a, b) => {
        const firstFieldA = grouped[a][0];
        const firstFieldB = grouped[b][0];
        return (firstFieldA?.display_order || 0) - (firstFieldB?.display_order || 0);
      });
    };

    if (type === 'category') {
      const categoriesOrdered = getOrderedCategories(updatedAllFields);

      const [movedCategoryName] = categoriesOrdered.splice(source.index, 1);
      categoriesOrdered.splice(destination.index, 0, movedCategoryName);

      // Reconstruct allFields based on new category order and re-assign display_order
      let reorderedAllFields = [];
      let displayOrderCounter = 0;

      for (const catName of categoriesOrdered) {
        const fieldsInThisCategory = updatedAllFields
          .filter(f => (f.category_display_name || f.category) === catName)
          .sort((a, b) => (a.display_order || 0) - (b.display_order || 0)); // Maintain internal field order

        for (const field of fieldsInThisCategory) {
          const newField = { ...field, display_order: displayOrderCounter++ };
          reorderedAllFields.push(newField);
          // Check if display_order actually changed for DB update
          const originalField = allFields.find(f => f.id === newField.id);
          if (originalField && originalField.display_order !== newField.display_order) {
            fieldsToUpdateInDb.push({ id: newField.id, display_order: newField.display_order });
          }
        }
      }
      updatedAllFields = reorderedAllFields;

    } else if (type === 'field') {
      const sourceCategory = source.droppableId.replace('-fields', '');
      const destCategory = destination.droppableId.replace('-fields', '');
      
      // Find the field that was dragged using its ID
      const draggedFieldId = draggableId.split('::')[1];
      const draggedFieldIndex = updatedAllFields.findIndex(f => f.id === draggedFieldId);
      if (draggedFieldIndex === -1) return;

      const draggedField = updatedAllFields[draggedFieldIndex];
      
      // Remove the dragged field from the array
      updatedAllFields.splice(draggedFieldIndex, 1);
      
      // Calculate the absolute position to insert the field
      // Get all fields in the destination category
      const destCategoryFields = updatedAllFields.filter(f => 
        (f.category_display_name || f.category) === destCategory
      );
      
      // Find the absolute index where we should insert
      let insertIndex;
      if (destination.index === 0) {
        // Insert at the beginning of the destination category
        // Find the first field in this category
        const firstFieldInCategory = updatedAllFields.find(f => 
          (f.category_display_name || f.category) === destCategory
        );
        if (firstFieldInCategory) {
          insertIndex = updatedAllFields.indexOf(firstFieldInCategory);
        } else {
          // Category is empty, find where it should go based on category order
          const categoriesOrdered = getOrderedCategories(allFields);
          const destCategoryIndex = categoriesOrdered.indexOf(destCategory);
          
          // Find the last field of the previous category
          let insertAfterIndex = -1;
          for (let i = destCategoryIndex - 1; i >= 0; i--) {
            const prevCategoryFields = updatedAllFields.filter(f => 
              (f.category_display_name || f.category) === categoriesOrdered[i]
            );
            if (prevCategoryFields.length > 0) {
              const lastField = prevCategoryFields[prevCategoryFields.length - 1];
              insertAfterIndex = updatedAllFields.indexOf(lastField);
              break;
            }
          }
          insertIndex = insertAfterIndex + 1;
        }
      } else if (destination.index >= destCategoryFields.length) {
        // Insert at the end of the destination category
        const lastFieldInCategory = destCategoryFields[destCategoryFields.length - 1];
        if (lastFieldInCategory) {
          insertIndex = updatedAllFields.indexOf(lastFieldInCategory) + 1;
        } else {
          // If category was empty and destination.index was not 0 (e.g. only 1 item in category and dropped at index 1)
          // this case should be covered by insert after previous category logic or simply append to end if it's the last category
          const categoriesOrdered = getOrderedCategories(allFields);
          const destCategoryIndex = categoriesOrdered.indexOf(destCategory);
          let lastFieldGlobalIndex = -1;

          // Find the global index of the last field in the immediately preceding category, if any
          for (let i = destCategoryIndex - 1; i >= 0; i--) {
              const prevCategoryFields = updatedAllFields.filter(f =>
                  (f.category_display_name || f.category) === categoriesOrdered[i]
              ).sort((a, b) => a.display_order - b.display_order); // Ensure sorted by display_order

              if (prevCategoryFields.length > 0) {
                  lastFieldGlobalIndex = updatedAllFields.indexOf(prevCategoryFields[prevCategoryFields.length - 1]);
                  break;
              }
          }
          insertIndex = lastFieldGlobalIndex + 1;
          // If insertIndex is still -1 (meaning it's the first category and empty), insert at 0
          if (insertIndex < 0) insertIndex = 0;
        }
      } else {
        // Insert at specific position within the category
        const targetField = destCategoryFields[destination.index];
        insertIndex = updatedAllFields.indexOf(targetField);
      }
      
      // Insert the field at the calculated position
      updatedAllFields.splice(insertIndex, 0, draggedField);

      // Re-assign display_order to all fields
      let reorderedAllFields = [];
      let displayOrderCounter = 0;
      
      const categoriesOrdered = getOrderedCategories(allFields);

      for (const catName of categoriesOrdered) {
        const fieldsForThisCat = updatedAllFields
          .filter(f => (f.category_display_name || f.category) === catName)
          .sort((a, b) => {
            const indexA = updatedAllFields.findIndex(f => f.id === a.id);
            const indexB = updatedAllFields.findIndex(f => f.id === b.id);
            return indexA - indexB;
          });
        
        for (const field of fieldsForThisCat) {
          const newField = { ...field, display_order: displayOrderCounter++ };
          reorderedAllFields.push(newField);
          const originalField = allFields.find(f => f.id === newField.id);
          if (originalField && originalField.display_order !== newField.display_order) {
            fieldsToUpdateInDb.push({ 
              id: newField.id, 
              display_order: newField.display_order
            });
          }
        }
      }
      updatedAllFields = reorderedAllFields;
    } else {
      return;
    }

    setAllFields(updatedAllFields); // Optimistic update

    if (fieldsToUpdateInDb.length === 0) {
      return; // No actual changes to save
    }

    setIsSaving(true);
    try {
      // Execute all necessary updates with delay to avoid rate limiting
      for (let i = 0; i < fieldsToUpdateInDb.length; i++) {
        const fieldUpdate = fieldsToUpdateInDb[i];
        try {
          console.log('FieldsManagementTab: About to update field', fieldUpdate.id);
          const updateResult = await base44.entities.FieldConfiguration.update(fieldUpdate.id, fieldUpdate);
          console.log('FieldsManagementTab: Update result:', updateResult);
        } catch (updateError) {
          console.error(`Error updating field ${fieldUpdate.id}:`, updateError);
          // Continue with other updates even if one fails
        }
        
        // Add 1000ms (1 second) delay between updates to avoid rate limiting
        if (i < fieldsToUpdateInDb.length - 1) {
          await sleep(1000);
        }
      }
      
      console.log('FieldsManagementTab: All updates complete, calling toast. Type:', type);
      
      // Wrap toast in try-catch to prevent crashes
      try {
        toast({
          title: type === 'category' ? "Categories Reordered" : "Order Updated",
          description: type === 'category' ? "Category order has been saved successfully." : "Field order has been saved successfully.",
          duration: 3000,
        });
        console.log('FieldsManagementTab: Toast called successfully');
      } catch (toastError) {
        console.error('FieldsManagementTab: Toast error:', toastError);
      }
    } catch (error) {
      console.error(`Error updating ${type} order:`, error);
      
      if (error.message && error.message.includes('Rate limit')) {
        console.log('FieldsManagementTab: Calling toast (drag end rate limit error).');
        try {
          toast({
            variant: "destructive",
            title: "Too Many Changes",
            description: "Please wait a moment before making more changes. Your previous changes were saved.",
            duration: 4000,
          });
        } catch (toastError) {
          console.error('FieldsManagementTab: Toast error:', toastError);
        }
      } else {
        console.log('FieldsManagementTab: Calling toast (drag end general error).');
        try {
          toast({
            variant: "destructive",
            title: "Error",
            description: `Failed to update ${type} order. Some changes may not have been saved.`,
            duration: 4000,
          });
        } catch (toastError) {
          console.error('FieldsManagementTab: Toast error:', toastError);
        }
      }
      
      // Reload fields to get the actual state from the database
      await loadFields();
    } finally {
      console.log('FieldsManagementTab: Setting isSaving to false');
      setIsSaving(false);
    }
  };

  const handleEditField = (field, category) => {
    setEditingField(field);
    setEditingCategory(category);
  };

  const handleCloseModal = () => {
    console.log('FieldsManagementTab: handleCloseModal called');
    setEditingField(null);
    setEditingCategory(null);
  };

  const handleSaveField = async (fieldData) => {
    console.log('FieldsManagementTab: handleSaveField called with fieldData:', fieldData);
    console.log('FieldsManagementTab: section value in fieldData:', fieldData.section);
    
    setIsSaving(true);
    try {
      if (editingField && editingField.id) {
        console.log('FieldsManagementTab: Updating field with ID:', editingField.id);
        console.log('FieldsManagementTab: Data being sent to update:', fieldData);
        await base44.entities.FieldConfiguration.update(editingField.id, fieldData);
      } else {
        console.log('FieldsManagementTab: Creating new field');
        await base44.entities.FieldConfiguration.create({
          ...fieldData,
          context: activeTab,
          display_order: allFields.length
        });
      }
      
      await loadFields();
      handleCloseModal();
      
      console.log('FieldsManagementTab: Calling toast (save success) after closing modal. editingField:', !!editingField);
      setTimeout(() => {
        console.log('FieldsManagementTab: Toast timeout executed (save success)');
        try {
          toast({
            title: editingField ? "Field Updated" : "Field Created",
            description: editingField 
              ? "Field configuration has been updated successfully." 
              : "New field has been created successfully.",
            duration: 3000,
          });
        } catch (toastError) {
          console.error('FieldsManagementTab: Toast error:', toastError);
        }
      }, 100);
    } catch (error) {
      console.error('Error saving field:', error);
      handleCloseModal();
      console.log('FieldsManagementTab: Calling toast (save error) after closing modal due to error.');
      setTimeout(() => {
        console.log('FieldsManagementTab: Toast timeout executed (save error)');
        try {
          toast({
            variant: "destructive",
            title: "Error",
            description: "Failed to save field configuration.",
            duration: 3000,
          });
        } catch (toastError) {
          console.error('FieldsManagementTab: Toast error:', toastError);
        }
      }, 100);
    }
    setIsSaving(false);
  };

  const handleDeleteField = async (field) => {
    if (!confirm('Are you sure you want to delete this field configuration?')) return;
    
    setIsSaving(true);
    try {
      await base44.entities.FieldConfiguration.delete(field.id);
      
      console.log('FieldsManagementTab: Calling toast (delete success).');
      try {
        toast({
          title: "Field Deleted",
          description: "Field configuration has been removed.",
          duration: 3000,
        });
      } catch (toastError) {
        console.error('FieldsManagementTab: Toast error:', toastError);
      }
      
      await loadFields();
    } catch (error) {
      console.error('Error deleting field:', error);
      console.log('FieldsManagementTab: Calling toast (delete error).');
      try {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to delete field configuration.",
          duration: 4000,
        });
      } catch (toastError) {
        console.error('FieldsManagementTab: Toast error:', toastError);
      }
    }
    setIsSaving(false);
  };

  const renderFieldList = (fields, category) => {
    return (
      <Droppable droppableId={`${category}-fields`} type="field">
        {(provided) => (
          <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
            {fields.map((field, idx) => (
              <Draggable key={field.id} draggableId={`${category}::${field.id}`} index={idx}>
                {(provided) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <div {...provided.dragHandleProps}>
                        <GripVertical className="w-5 h-5 text-slate-400 cursor-grab" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-slate-900">{field.field_label}</p>
                          {field.required && (
                            <Badge variant="outline" className="text-xs">Required</Badge>
                          )}
                          <Badge variant="secondary" className="text-xs">{field.field_type}</Badge>
                          {field.display_conditional && (
                            <Badge className="text-xs bg-amber-100 text-amber-800">Conditional</Badge>
                          )}
                          {field.value_conditional && (
                            <Badge className="text-xs bg-purple-100 text-purple-800">Calculated</Badge>
                          )}
                          {field.read_only && (
                            <Badge className="text-xs bg-gray-100 text-gray-800">Read-Only</Badge>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-1">Field name: {field.field_name}</p>
                        {field.value_conditional?.formula && (
                          <p className="text-xs text-purple-600 mt-1">Formula: {field.value_conditional.formula}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditField(field, category)}
                        disabled={isSaving}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:text-red-700"
                        onClick={() => handleDeleteField(field)}
                        disabled={isSaving}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    );
  };

  if (!canManage) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-slate-500">
          Only administrators can manage field configurations.
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
        </CardContent>
      </Card>
    );
  }

  const groupedFields = groupByCategory();
  const sortedCategories = Object.keys(groupedFields).sort((a, b) => {
    const firstFieldA = allFields.find(f => (f.category_display_name || f.category) === a);
    const firstFieldB = allFields.find(f => (f.category_display_name || f.category) === b);
    return (firstFieldA?.display_order || 0) - (firstFieldB?.display_order || 0);
  });

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <CardTitle>Field Configuration</CardTitle>
              </div>
              <CardDescription>
                Edit, reorder, and manage application and loan fields.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={loadFields}
                disabled={isLoading || isSaving}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isLoading || isSaving ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="application">Application</TabsTrigger>
              <TabsTrigger value="loan">Loan</TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="space-y-4">
              <div className="flex items-center gap-3 justify-end">
                <div className="relative flex-1 max-w-xs">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder="Search fields..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Badge variant="outline" className="text-slate-600 whitespace-nowrap">
                  {allFields.length} fields
                </Badge>
              </div>

              {allFields.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="p-12 text-center">
                    <p className="text-slate-500">No fields configured yet.</p>
                  </CardContent>
                </Card>
              ) : Object.keys(groupedFields).length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="p-12 text-center">
                    <p className="text-slate-500">No fields match your search.</p>
                  </CardContent>
                </Card>
              ) : (
                <DragDropContext onDragEnd={handleDragEnd}>
                  <Droppable droppableId="categories" type="category">
                    {(provided) => (
                      <div 
                        {...provided.droppableProps} 
                        ref={provided.innerRef}
                        className="space-y-4"
                      >
                        {sortedCategories.map((category, categoryIndex) => (
                          <Draggable key={category} draggableId={category} index={categoryIndex}>
                            {(provided) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                              >
                                <Collapsible
                                  open={openSections[category] === true}
                                  onOpenChange={() => toggleSection(category)}
                                >
                                  <Card className="border border-slate-200">
                                    <CardHeader className="hover:bg-slate-50 transition-colors">
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3 text-left">
                                          <div {...provided.dragHandleProps}>
                                            <GripVertical className="w-5 h-5 text-slate-400 cursor-grab" />
                                          </div>
                                          <CollapsibleTrigger asChild>
                                            <button className="flex items-center gap-2 hover:opacity-70 transition-opacity">
                                              {openSections[category] === true ? (
                                                <ChevronDown className="w-5 h-5 text-slate-600" />
                                              ) : (
                                                <ChevronRight className="w-5 h-5 text-slate-600" />
                                              )}
                                            </button>
                                          </CollapsibleTrigger>
                                          <div className="flex items-center gap-2">
                                            <CardTitle className="text-lg">{category}</CardTitle>
                                            {groupedFields[category].is_repeatable && (
                                              <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                                                <Repeat className="w-3 h-3 mr-1" />
                                                Repeatable
                                              </Badge>
                                            )}
                                          </div>
                                        </div>
                                        <Badge variant="outline" className="text-slate-600">
                                          {groupedFields[category].fields.length} fields
                                        </Badge>
                                      </div>
                                    </CardHeader>
                                    <CollapsibleContent>
                                      <CardContent>
                                        {renderFieldList(groupedFields[category].fields, category)}
                                      </CardContent>
                                    </CollapsibleContent>
                                  </Card>
                                </Collapsible>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {(editingField || editingCategory) && (
        <FieldEditorModal
          isOpen={true}
          onClose={handleCloseModal}
          field={editingField}
          category={editingCategory}
          context={activeTab}
          onSave={handleSaveField}
          isSaving={isSaving}
        />
      )}
    </>
  );
}
