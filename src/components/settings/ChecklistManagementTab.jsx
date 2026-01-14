import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2, GripVertical, Save, ChevronDown, ChevronRight, Upload, FileText, Download, Loader2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";

import { ACTION_ITEM_CHECKLIST_ITEMS, DOCUMENT_CHECKLIST_ITEMS } from '../loan-detail/checklistData';

const LOAN_PRODUCTS = [
  { value: 'fix_flip', label: 'Fix & Flip' },
  { value: 'bridge', label: 'Bridge' },
  { value: 'new_construction', label: 'New Construction' },
  { value: 'dscr', label: 'DSCR' }
];

const LOAN_PURPOSES = [
  { value: 'purchase', label: 'Purchase' },
  { value: 'refinance', label: 'Refinance' }
];

const PROVIDER_OPTIONS = [
  'Amplend',
  'Borrower',
  'Title Company',
  'Appraiser',
  'Inspector',
  'Attorney',
  'Contractor'
];

const ACTION_CATEGORY_OPTIONS = [
  'Underwriting Document',
  'Legal Document',
  'Processing',
  'Post-Close'
];

const DOCUMENT_CATEGORY_OPTIONS = [
  'Borrower Document',
  'Property Document',
  'Closing Document',
  'Post-Closing Document'
];

export default function ChecklistManagementTab({ currentUser }) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('action');
  const [selectedLoanProduct, setSelectedLoanProduct] = useState('fix_flip');
  const [selectedLoanPurpose, setSelectedLoanPurpose] = useState('purchase');
  const [actionItems, setActionItems] = useState(ACTION_ITEM_CHECKLIST_ITEMS);
  const [documentItems, setDocumentItems] = useState(DOCUMENT_CHECKLIST_ITEMS);
  const [editingItem, setEditingItem] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [openCategories, setOpenCategories] = useState({});
  const [editingCategoryName, setEditingCategoryName] = useState(null);
  const [categoryNameInput, setCategoryNameInput] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const canManage = currentUser && (
    currentUser.role === 'admin' ||
    currentUser.app_role === 'Administrator' ||
    currentUser.app_role === 'Loan Officer'
  );

  const toggleCategory = (categoryName) => {
    setOpenCategories(prev => ({
      ...prev,
      [categoryName]: !prev[categoryName]
    }));
  };

  const handleLoanProductChange = (value) => {
    setSelectedLoanProduct(value);
  };

  const handleDragEnd = (result) => {
    if (!result.destination) return;

    const { source, destination, type } = result;

    if (type === 'category') {
      const items = activeTab === 'action' ? [...actionItems] : [...documentItems];
      const categories = [...new Set(items.map(item => item.category))];
      const [movedCategory] = categories.splice(source.index, 1);
      categories.splice(destination.index, 0, movedCategory);

      const reorderedItems = [];
      categories.forEach(category => {
        const categoryItems = items.filter(item => item.category === category);
        reorderedItems.push(...categoryItems);
      });

      if (activeTab === 'action') {
        setActionItems(reorderedItems);
      } else {
        setDocumentItems(reorderedItems);
      }
    } else {
      const items = activeTab === 'action' ? [...actionItems] : [...documentItems];
      const categoryName = result.draggableId.split('::')[0];
      const categoryItems = items.filter(item => item.category === categoryName);
      const otherItems = items.filter(item => item.category !== categoryName);

      const [reorderedItem] = categoryItems.splice(source.index, 1);
      categoryItems.splice(destination.index, 0, reorderedItem);

      // Reconstruct the full list of items while maintaining order of other categories
      const allCategoryNames = [...new Set(items.map(item => item.category))];
      let reorderedItems = [];
      allCategoryNames.forEach(catName => {
        if (catName === categoryName) {
          reorderedItems = [...reorderedItems, ...categoryItems];
        } else {
          reorderedItems = [...reorderedItems, ...items.filter(item => item.category === catName)];
        }
      });

      if (activeTab === 'action') {
        setActionItems(reorderedItems);
      } else {
        setDocumentItems(reorderedItems);
      }
    }
  };

  const handleEditItem = (item, index) => {
    setEditingItem({
      ...item,
      index,
      // Ensure template fields are present for document items, even if empty, for consistent state management
      template_url: item.template_url || '',
      template_name: item.template_name || ''
    });
    setShowEditModal(true);
  };

  const handleSaveItem = () => {
    if (!editingItem || !editingItem.item || !editingItem.category) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Item Name and Category are required.",
      });
      return;
    }

    const newItemData = {
      category: editingItem.category,
      item: editingItem.item,
      description: editingItem.description || '',
      loan_types: editingItem.loan_types || [],
    };

    if (activeTab === 'document') {
      newItemData.provider = editingItem.provider || '';
      newItemData.template_url = editingItem.template_url || '';
      newItemData.template_name = editingItem.template_name || '';
    } else { // activeTab === 'action'
      // Ensure document-specific fields are not carried over to action items
      delete newItemData.provider;
      delete newItemData.template_url;
      delete newItemData.template_name;
    }

    const items = activeTab === 'action' ? [...actionItems] : [...documentItems];
    if (editingItem.index !== undefined) {
      // Update existing item at its original index
      items[editingItem.index] = { ...items[editingItem.index], ...newItemData };
    } else {
      // Add new item to the end of the list
      items.push(newItemData);
    }

    if (activeTab === 'action') {
      setActionItems(items);
    } else {
      setDocumentItems(items);
    }

    setShowEditModal(false);
    setEditingItem(null);
    toast({
      title: "Item Saved",
      description: `Checklist item "${newItemData.item}" has been saved.`,
    });
  };

  const handleDeleteItem = (index) => {
    if (!confirm('Are you sure you want to delete this item?')) return;

    const items = activeTab === 'action' ? [...actionItems] : [...documentItems];
    const deletedItemName = items[index].item; // Get the name before deleting
    items.splice(index, 1);

    if (activeTab === 'action') {
      setActionItems(items);
    } else {
      setDocumentItems(items);
    }
    toast({
      title: "Item Deleted",
      description: `Checklist item "${deletedItemName}" has been deleted.`,
      variant: "destructive"
    });
  };

  const handleStartEditCategory = (categoryName) => {
    setEditingCategoryName(categoryName);
    setCategoryNameInput(categoryName);
  };

  const handleSaveCategoryName = (oldCategoryName) => {
    if (!categoryNameInput.trim() || categoryNameInput === oldCategoryName) {
      setEditingCategoryName(null);
      return;
    }

    const items = activeTab === 'action' ? [...actionItems] : [...documentItems];
    const updatedItems = items.map(item =>
      item.category === oldCategoryName
        ? { ...item, category: categoryNameInput }
        : item
    );

    if (activeTab === 'action') {
      setActionItems(updatedItems);
    } else {
      setDocumentItems(updatedItems);
    }

    const newOpenCategories = { ...openCategories };
    if (newOpenCategories[oldCategoryName] !== undefined) {
      newOpenCategories[categoryNameInput] = newOpenCategories[oldCategoryName];
      delete newOpenCategories[oldCategoryName];
      setOpenCategories(newOpenCategories);
    }

    setEditingCategoryName(null);
    setCategoryNameInput('');
    toast({
      title: "Category Renamed",
      description: `Category "${oldCategoryName}" renamed to "${categoryNameInput}".`,
    });
  };

  const handleTemplateUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setEditingItem(prev => ({ ...prev, template_url: file_url, template_name: file.name }));

      toast({
        title: "Template Uploaded",
        description: `Template file "${file.name}" uploaded successfully.`,
      });
    } catch (error) {
      console.error('Error uploading template:', error);
      toast({
        variant: "destructive",
        title: "Upload Failed",
        description: "Failed to upload template. Please try again.",
      });
    } finally {
      setIsUploading(false);
      event.target.value = ''; // Clear the input so same file can be uploaded again
    }
  };

  const filteredItems = () => {
    const items = activeTab === 'action' ? actionItems : documentItems;
    return items.filter(item => {
      // If loan_types is not defined or empty, assume it applies to all or none based on business logic.
      // For this implementation, if loan_types is empty, it means it doesn't apply to specific loan types.
      if (!item.loan_types || item.loan_types.length === 0) return false;

      const loanProduct = LOAN_PRODUCTS.find(p => p.value === selectedLoanProduct);
      if (!loanProduct) return false;

      const isDscr = selectedLoanProduct === 'dscr';
      const isRefinance = selectedLoanPurpose === 'refinance';

      return item.loan_types.some(type => {
        const typeLower = type.toLowerCase();
        const productLabelLower = loanProduct.label.toLowerCase();

        if (!typeLower.includes(productLabelLower)) return false;

        if (isDscr) {
          return selectedLoanPurpose === 'purchase'
            ? typeLower.includes('purchase')
            : typeLower.includes('refinance');
        }

        if (isRefinance) {
          return typeLower.includes('refinance');
        }

        return true;
      });
    });
  };

  const groupedItems = () => {
    const items = filteredItems();
    const grouped = {};
    items.forEach((item, index) => {
      if (!grouped[item.category]) {
        grouped[item.category] = [];
      }
      // Find the original index from the full list (actionItems or documentItems)
      const originalIndex = (activeTab === 'action' ? actionItems : documentItems).indexOf(item);
      grouped[item.category].push({ ...item, originalIndex });
    });
    return grouped;
  };

  if (!canManage) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-slate-500">
          Only administrators can manage checklist configurations.
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Checklist Management</CardTitle>
          <CardDescription>
            Configure default checklists for each loan product. Items will be automatically created when a loan is initialized.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="action">Action Item Checklist</TabsTrigger>
              <TabsTrigger value="document">Document Checklist</TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-3">
                    <Label className="text-base font-semibold">Loan Product:</Label>
                    <Select value={selectedLoanProduct} onValueChange={handleLoanProductChange}>
                      <SelectTrigger className="w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LOAN_PRODUCTS.map((product) => (
                          <SelectItem key={product.value} value={product.value}>
                            {product.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-3">
                    <Label className="text-base font-semibold">Loan Purpose:</Label>
                    <Select value={selectedLoanPurpose} onValueChange={setSelectedLoanPurpose}>
                      <SelectTrigger className="w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LOAN_PURPOSES.map((purpose) => (
                          <SelectItem key={purpose.value} value={purpose.value}>
                            {purpose.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId="categories" type="category">
                  {(provided) => (
                    <div
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                      className="space-y-4"
                    >
                      {Object.entries(groupedItems()).map(([category, items], categoryIndex) => (
                        <Draggable key={category} draggableId={category} index={categoryIndex}>
                          {(provided) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                            >
                              <Card className="border border-slate-200">
                                <Collapsible
                                  open={openCategories[category]}
                                  onOpenChange={() => toggleCategory(category)}
                                >
                                  <CollapsibleTrigger className="w-full">
                                    <CardHeader className="cursor-pointer hover:bg-slate-50 transition-colors">
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                          <div {...provided.dragHandleProps}>
                                            <GripVertical className="w-5 h-5 text-slate-400 cursor-grab" />
                                          </div>
                                          {openCategories[category] ? (
                                            <ChevronDown className="w-5 h-5 text-slate-600" />
                                          ) : (
                                            <ChevronRight className="w-5 h-5 text-slate-600" />
                                          )}
                                          {editingCategoryName === category ? (
                                            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                              <Input
                                                value={categoryNameInput}
                                                onChange={(e) => setCategoryNameInput(e.target.value)}
                                                onBlur={() => handleSaveCategoryName(category)}
                                                onKeyDown={(e) => {
                                                  if (e.key === 'Enter') {
                                                    handleSaveCategoryName(category);
                                                  } else if (e.key === 'Escape') {
                                                    setEditingCategoryName(null);
                                                  }
                                                }}
                                                className="h-8 w-64"
                                                autoFocus
                                              />
                                              <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => handleSaveCategoryName(category)}
                                              >
                                                <Save className="w-4 h-4" />
                                              </Button>
                                            </div>
                                          ) : (
                                            <div className="flex items-center gap-2">
                                              <CardTitle className="text-lg">{category}</CardTitle>
                                              <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleStartEditCategory(category);
                                                }}
                                              >
                                                <Edit className="w-4 h-4" />
                                              </Button>
                                            </div>
                                          )}
                                        </div>
                                        <Badge variant="outline" className="text-slate-600">
                                          {items.length} items
                                        </Badge>
                                      </div>
                                    </CardHeader>
                                  </CollapsibleTrigger>
                                  <CollapsibleContent>
                                    <CardContent className="pt-4">
                                      <Droppable droppableId={`category-${category}`} type="item">
                                        {(provided) => (
                                          <div
                                            {...provided.droppableProps}
                                            ref={provided.innerRef}
                                            className="space-y-2"
                                          >
                                            {items.map((item, idx) => (
                                              <Draggable
                                                key={`${category}::${item.item}-${idx}`}
                                                draggableId={`${category}::${item.item}-${idx}`}
                                                index={idx}
                                              >
                                                {(provided) => (
                                                  <div
                                                    ref={provided.innerRef}
                                                    {...provided.draggableProps}
                                                    className="flex items-start justify-between p-4 bg-white rounded-lg border border-slate-200 hover:border-slate-300 transition-colors"
                                                  >
                                                    <div className="flex items-start gap-3 flex-1">
                                                      <div {...provided.dragHandleProps}>
                                                        <GripVertical className="w-5 h-5 text-slate-400 cursor-grab mt-1" />
                                                      </div>
                                                      <div className="flex-1">
                                                        <div className="flex items-center gap-2 mb-1">
                                                          <p className="font-medium text-slate-900">{item.item}</p>
                                                          {item.provider && (
                                                            <Badge variant="outline" className="text-xs">
                                                              {item.provider}
                                                            </Badge>
                                                          )}
  
                                                          {activeTab === 'document' && item.template_url && (
                                                            <Button
                                                              variant="ghost"
                                                              size="icon"
                                                              className="h-6 w-6"
                                                              onClick={() => window.open(item.template_url, '_blank')}
                                                              aria-label={`Download template for ${item.item}`}
                                                            >
                                                              <Download className="w-4 h-4" />
                                                            </Button>
                                                          )}
                                                        </div>
                                                        {item.description && (
                                                          <p className="text-sm text-slate-600 mt-1">{item.description}</p>
                                                        )}
                                                      </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                      <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleEditItem(item, item.originalIndex)}
                                                      >
                                                        <Edit className="w-4 h-4" />
                                                      </Button>
                                                      <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="text-red-500 hover:text-red-700"
                                                        onClick={() => handleDeleteItem(item.originalIndex)}
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
                                    </CardContent>
                                  </CollapsibleContent>
                                </Collapsible>
                              </Card>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {showEditModal && editingItem && (
        <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingItem.index !== undefined ? 'Edit Checklist Item' : 'Add Checklist Item'}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="category">Category *</Label>
                  <Select
                    value={editingItem.category}
                    onValueChange={(value) => setEditingItem({ ...editingItem, category: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category..." />
                    </SelectTrigger>
                    <SelectContent>
                      {(activeTab === 'action' ? ACTION_CATEGORY_OPTIONS : DOCUMENT_CATEGORY_OPTIONS).map((cat) => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="provider">Provider</Label>
                  <Select
                    value={editingItem.provider}
                    onValueChange={(value) => setEditingItem({ ...editingItem, provider: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select provider..." />
                    </SelectTrigger>
                    <SelectContent>
                      {PROVIDER_OPTIONS.map((prov) => (
                        <SelectItem key={prov} value={prov}>{prov}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>


              </div>

              <div className="space-y-2">
                <Label htmlFor="item">Item Name *</Label>
                <Input
                  id="item"
                  value={editingItem.item}
                  onChange={(e) => setEditingItem({ ...editingItem, item: e.target.value })}
                  placeholder="e.g., Background Check"
                />
              </div>

              {activeTab === 'document' && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={editingItem.description || ''}
                      onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })}
                      placeholder="Additional details about this document..."
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Template File</Label>
                      <div>
                        <input
                          type="file"
                          id="template-upload-settings"
                          className="hidden"
                          onChange={handleTemplateUpload}
                          disabled={isUploading}
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => document.getElementById('template-upload-settings').click()}
                          disabled={isUploading}
                        >
                          {isUploading ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Uploading...
                            </>
                          ) : (
                            <>
                              <Upload className="w-4 h-4 mr-2" />
                              Upload Template
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                    {editingItem.template_url && (
                      <div className="flex items-center justify-between p-2 bg-slate-50 rounded">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-slate-500" />
                          <span className="text-sm">{editingItem.template_name || 'Template uploaded'}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open(editingItem.template_url, '_blank')}
                          aria-label="Download Template"
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="outline" onClick={() => setShowEditModal(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveItem} className="bg-blue-600 hover:bg-blue-700">
                <Save className="w-4 h-4 mr-2" />
                Save Item
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
