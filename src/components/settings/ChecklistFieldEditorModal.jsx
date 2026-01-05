import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Upload, FileText } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";

const FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'textarea', label: 'Text Area' },
  { value: 'select', label: 'Dropdown' },
  { value: 'date', label: 'Date' },
  { value: 'multi-select', label: 'Multi-Select' },
  { value: 'multi-select-users', label: 'Multi-Select Users' },
  { value: 'array-textarea', label: 'Array of Text (Notes)' },
  { value: 'file-array', label: 'File Array' },
  { value: 'file-upload', label: 'File Upload (Template)' }
];

export default function ChecklistFieldEditorModal({ isOpen, onClose, field, checklistType }) {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: '',
    label: '',
    type: 'text',
    required: false,
    placeholder: '',
    helpText: '',
    options: ''
  });
  const [isUploading, setIsUploading] = useState(false);
  const [templateUrl, setTemplateUrl] = useState('');

  useEffect(() => {
    if (field) {
      setFormData({
        name: field.name || '',
        label: field.label || '',
        type: field.type || 'text',
        required: field.required || false,
        placeholder: field.placeholder || '',
        helpText: field.helpText || '',
        options: field.options ? field.options.join(', ') : ''
      });
      setTemplateUrl(field.template_url || '');
    }
  }, [field]);

  const handleTemplateUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setTemplateUrl(file_url);
      
      toast({
        title: "Template Uploaded",
        description: "Template file uploaded successfully.",
      });
    } catch (error) {
      console.error('Error uploading template:', error);
      toast({
        variant: "destructive",
        title: "Upload Failed",
        description: "Failed to upload template. Please try again.",
      });
    }
    setIsUploading(false);
    event.target.value = '';
  };

  const handleSave = () => {
    const fieldConfig = {
      ...formData,
      options: formData.options ? formData.options.split(',').map(o => o.trim()) : [],
      template_url: templateUrl
    };
    
    console.log('Saving checklist field:', fieldConfig, 'for type:', checklistType);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{field ? 'Edit Checklist Field' : 'Add New Checklist Field'}</DialogTitle>
          <DialogDescription>
            Configure field for {checklistType === 'action' ? 'Action Item' : 'Document'} Checklist
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Field Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., category"
              />
              <p className="text-xs text-slate-500">Internal field name (use lowercase with underscores)</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="label">Display Label *</Label>
              <Input
                id="label"
                value={formData.label}
                onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                placeholder="e.g., Category"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="type">Field Type *</Label>
              <Select
                value={formData.type}
                onValueChange={(value) => setFormData({ ...formData, type: value })}
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

            <div className="flex items-center space-x-2 pt-8">
              <Checkbox
                id="required"
                checked={formData.required}
                onCheckedChange={(checked) => setFormData({ ...formData, required: checked })}
              />
              <Label htmlFor="required" className="cursor-pointer">Required Field</Label>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="placeholder">Placeholder Text</Label>
            <Input
              id="placeholder"
              value={formData.placeholder}
              onChange={(e) => setFormData({ ...formData, placeholder: e.target.value })}
              placeholder="e.g., Enter category"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="helpText">Help Text</Label>
            <Textarea
              id="helpText"
              value={formData.helpText}
              onChange={(e) => setFormData({ ...formData, helpText: e.target.value })}
              placeholder="Additional instructions or information"
              rows={2}
            />
          </div>

          {(formData.type === 'select' || formData.type === 'multi-select') && (
            <div className="space-y-2">
              <Label htmlFor="options">Options (comma-separated)</Label>
              <Textarea
                id="options"
                value={formData.options}
                onChange={(e) => setFormData({ ...formData, options: e.target.value })}
                placeholder="e.g., Option 1, Option 2, Option 3"
                rows={3}
              />
            </div>
          )}

          {checklistType === 'document' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Template File</Label>
                <div>
                  <input
                    type="file"
                    id="template-upload-field"
                    className="hidden"
                    onChange={handleTemplateUpload}
                    disabled={isUploading}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => document.getElementById('template-upload-field').click()}
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
              {templateUrl && (
                <div className="flex items-center gap-2 p-2 bg-slate-50 rounded">
                  <FileText className="w-4 h-4 text-slate-500" />
                  <span className="text-sm flex-1">Template uploaded</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => window.open(templateUrl, '_blank')}
                  >
                    View
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700">
            {field ? 'Update Field' : 'Add Field'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}