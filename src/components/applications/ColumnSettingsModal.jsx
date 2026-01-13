import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { X, Columns3, AlertTriangle, GripVertical } from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

const availableColumns = [
  { key: 'application_number', label: 'Application #', required: true },
  { key: 'borrower_name', label: 'Borrower', required: true },
  { key: 'loan_type', label: 'Loan Type' },
  { key: 'loan_amount', label: 'Loan Amount' },
  { key: 'status', label: 'Status', required: true },
  { key: 'created_date', label: 'Created' },
  { key: 'updated_date', label: 'Last Updated', required: true },
  { key: 'submission_count', label: 'Submissions' },
  { key: 'property_address', label: 'Property Address' },
  { key: 'property_type', label: 'Property Type' },
  { key: 'borrower_email', label: 'Email' },
  { key: 'borrower_phone', label: 'Phone' },
  { key: 'borrower_address_street', label: 'Property' },
  { key: 'loan_purpose', label: 'Loan Purpose' },
  { key: 'current_step', label: 'Progress' }
];

const STORAGE_KEY = 'loan_applications_visible_columns';
const RECOMMENDED_MAX = 7;

export default function ColumnSettingsModal({ isOpen, onClose, onColumnsChange }) {
  const [selectedColumns, setSelectedColumns] = useState([]);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      setSelectedColumns(JSON.parse(saved));
    } else {
      const defaults = ['application_number', 'borrower_name', 'borrower_address_street', 'loan_type', 'status', 'updated_date', 'submission_count'];
      setSelectedColumns(defaults);
    }
  }, [isOpen]);

  const handleColumnToggle = (columnKey) => {
    const column = availableColumns.find(col => col.key === columnKey);
    if (column?.required) return;

    setSelectedColumns(prev => {
      if (prev.includes(columnKey)) {
        return prev.filter(key => key !== columnKey);
      } else {
        return [...prev, columnKey];
      }
    });
  };

  const handleDragEnd = (result) => {
    if (!result.destination) return;

    const items = Array.from(selectedColumns);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    setSelectedColumns(items);
  };

  const handleSave = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(selectedColumns));
    const columnsWithLabels = selectedColumns.map(key => {
      const col = availableColumns.find(c => c.key === key);
      return { key, label: col?.label || key };
    });
    onColumnsChange(columnsWithLabels);
    onClose();
  };

  const handleReset = () => {
    const defaults = ['application_number', 'borrower_name', 'borrower_address_street', 'loan_type', 'status', 'updated_date', 'submission_count'];
    setSelectedColumns(defaults);
  };

  if (!isOpen) return null;

  const exceedsRecommended = selectedColumns.length > RECOMMENDED_MAX;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 30 }}
        className="relative w-full max-w-md m-4 bg-white rounded-xl shadow-2xl max-h-[80vh] overflow-y-auto"
      >
        <div className="p-6">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                <Columns3 className="w-5 h-5 text-slate-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900">Customize Columns</h3>
                <p className="text-sm text-slate-500">Select and reorder columns</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
              <X className="w-4 h-4" />
            </Button>
          </div>

          {exceedsRecommended && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-amber-700">
                <strong>Too many columns:</strong> For optimal readability, we recommend showing no more than {RECOMMENDED_MAX} columns at once. You currently have {selectedColumns.length} selected.
              </div>
            </div>
          )}

          <div className="space-y-3 mb-6">
            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="columns">
                {(provided) => (
                  <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                    {selectedColumns.map((key, index) => {
                      const column = availableColumns.find(col => col.key === key);
                      if (!column) return null;
                      
                      return (
                        <Draggable key={key} draggableId={key} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              className={`flex items-center space-x-3 p-2 rounded-lg border ${
                                snapshot.isDragging ? 'bg-slate-100 border-slate-300' : 'bg-white border-slate-200'
                              }`}
                            >
                              <div {...provided.dragHandleProps} className="cursor-grab active:cursor-grabbing">
                                <GripVertical className="w-4 h-4 text-slate-400" />
                              </div>
                              <Checkbox
                                id={column.key}
                                checked={true}
                                onCheckedChange={() => handleColumnToggle(column.key)}
                                disabled={column.required}
                              />
                              <Label
                                htmlFor={column.key}
                                className={`flex-1 ${column.required ? 'text-slate-500' : 'text-slate-700 cursor-pointer'}`}
                              >
                                {column.label}
                                {column.required && <span className="text-xs ml-1">(Required)</span>}
                              </Label>
                            </div>
                          )}
                        </Draggable>
                      );
                    })}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>

            <div className="pt-4 border-t">
              <p className="text-sm font-medium text-slate-700 mb-2">Available Columns</p>
              {availableColumns
                .filter(col => !selectedColumns.includes(col.key))
                .map(column => (
                  <div key={column.key} className="flex items-center space-x-3 p-2">
                    <Checkbox
                      id={column.key}
                      checked={false}
                      onCheckedChange={() => handleColumnToggle(column.key)}
                      disabled={column.required}
                    />
                    <Label
                      htmlFor={column.key}
                      className="flex-1 text-slate-700 cursor-pointer"
                    >
                      {column.label}
                    </Label>
                  </div>
                ))}
            </div>
          </div>

          <div className="text-sm text-slate-500 mb-6">
            <strong>{selectedColumns.length}</strong> of {RECOMMENDED_MAX} columns selected
          </div>

          <div className="flex justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleReset}
            >
              Reset to Default
            </Button>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSave}
                className="bg-slate-900 hover:bg-slate-800"
              >
                Apply Changes
              </Button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
