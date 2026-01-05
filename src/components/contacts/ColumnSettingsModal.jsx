import React from 'react';
import { motion } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { X, Columns3 } from 'lucide-react';
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

export default function ColumnSettingsModal({ isOpen, onClose, visibleColumns, onColumnsChange }) {
  if (!isOpen) return null;

  const columnOptions = [
    { key: 'name', label: 'Name' },
    { key: 'type', label: 'Type' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone' },
    { key: 'created_date', label: 'Date Added' }
  ];

  const handleToggle = (columnKey) => {
    onColumnsChange({
      ...visibleColumns,
      [columnKey]: !visibleColumns[columnKey]
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 30 }}
        className="relative w-full max-w-md m-4 bg-white rounded-xl shadow-2xl"
      >
        <div className="p-6">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                <Columns3 className="w-5 h-5 text-slate-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900">Column Settings</h3>
                <p className="text-sm text-slate-500">Choose which columns to display</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
              <X className="w-4 h-4" />
            </Button>
          </div>

          <div className="space-y-4">
            {columnOptions.map((column) => (
              <div key={column.key} className="flex items-center space-x-3 p-3 rounded-lg hover:bg-slate-50 transition-colors">
                <Checkbox
                  id={column.key}
                  checked={visibleColumns[column.key]}
                  onCheckedChange={() => handleToggle(column.key)}
                />
                <Label htmlFor={column.key} className="flex-1 cursor-pointer font-medium text-slate-900">
                  {column.label}
                </Label>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-slate-200">
            <Button onClick={onClose} className="bg-slate-900 hover:bg-slate-800">
              Done
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}