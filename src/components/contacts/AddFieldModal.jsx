import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X } from 'lucide-react';
import { Borrower, BorrowerEntity, LoanPartner } from "@/entities/all";

export default function AddFieldModal({ isOpen, onClose, onSave, contactType }) {
  const [selectedField, setSelectedField] = useState("");
  const [availableFields, setAvailableFields] = useState([]);

  useEffect(() => {
    if (isOpen) {
      loadAvailableFields();
      setSelectedField("");
    }
  }, [isOpen, contactType]);

  const loadAvailableFields = async () => {
    try {
      let schema;
      switch(contactType) {
        case 'borrower':
          schema = await Borrower.schema();
          break;
        case 'entity':
          schema = await BorrowerEntity.schema();
          break;
        case 'partner':
          schema = await LoanPartner.schema();
          break;
      }

      if (schema && schema.properties) {
        const fields = Object.entries(schema.properties).map(([key, value]) => ({
          key,
          label: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          description: value.description || '',
          type: value.type
        }));
        setAvailableFields(fields);
      }
    } catch (error) {
      console.error("Error loading schema:", error);
    }
  };

  const handleSave = () => {
    if (selectedField) {
      onSave(selectedField);
      onClose();
      setSelectedField("");
    }
  };

  if (!isOpen) return null;

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
            <div>
              <h3 className="text-xl font-bold text-slate-900">Add Field to Display</h3>
              <p className="text-sm text-slate-500">Select a field to show in this contact's profile</p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
              <X className="w-4 h-4" />
            </Button>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="field">Field</Label>
              <Select value={selectedField} onValueChange={setSelectedField}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a field..." />
                </SelectTrigger>
                <SelectContent>
                  {availableFields.map((field) => (
                    <SelectItem key={field.key} value={field.key}>
                      <div>
                        <div className="font-medium">{field.label}</div>
                        {field.description && (
                          <div className="text-xs text-slate-500">{field.description}</div>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} disabled={!selectedField}>
              Add Field
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}