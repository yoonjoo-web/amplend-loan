import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { X, Filter } from 'lucide-react';

const employmentOptions = ['employed', 'self_employed', 'unemployed', 'retired', 'student'];

export default function FilterModal({ isOpen, onClose, currentFilters, onFiltersChange }) {
  const [filters, setFilters] = useState(currentFilters || { employment_status: 'all' });

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const handleApply = () => {
    onFiltersChange(filters);
    onClose();
  };

  const handleClear = () => {
    const clearedFilters = { employment_status: 'all' };
    setFilters(clearedFilters);
    onFiltersChange(clearedFilters);
    onClose();
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
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                <Filter className="w-5 h-5 text-slate-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900">Filter Borrowers</h3>
                <p className="text-sm text-slate-500">Filter the list by employment status</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
              <X className="w-4 h-4" />
            </Button>
          </div>

          <div className="space-y-4 mb-6">
            <div className="space-y-2">
              <Label htmlFor="employment_status">Employment Status</Label>
              <Select value={filters.employment_status} onValueChange={(value) => handleFilterChange('employment_status', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="All Employment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Employment</SelectItem>
                  {employmentOptions.map(status => (
                    <SelectItem key={status} value={status}>
                      {status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-between gap-3">
            <Button type="button" variant="outline" onClick={handleClear}>
              Clear Filters
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="button" onClick={handleApply} className="bg-slate-900 hover:bg-slate-800">
                Apply Filters
              </Button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}