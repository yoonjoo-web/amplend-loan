
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { X, Filter } from 'lucide-react';
import { getLoanTypeLabel, getStatusLabel } from '../utils/displayHelpers';

const statusOptions = ['draft', 'in_review', 'submitted', 'approved', 'rejected'];
const loanTypeOptions = ['fix_flip', 'bridge', 'new_construction', 'dscr'];

export default function FilterModal({ isOpen, onClose, currentFilters, onFiltersChange }) {
  const [filters, setFilters] = useState(currentFilters || { status: 'all', loan_type: 'all' });

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const handleApply = () => {
    onFiltersChange(filters);
    onClose();
  };

  const handleClear = () => {
    const clearedFilters = { status: 'all', loan_type: 'all' };
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
                <h3 className="text-xl font-bold text-slate-900">Filter Applications</h3>
                <p className="text-sm text-slate-500">Filter the list by status and loan type</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
              <X className="w-4 h-4" />
            </Button>
          </div>

          <div className="space-y-4 mb-6">
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={filters.status} onValueChange={(value) => handleFilterChange('status', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {statusOptions.map(status => (
                    <SelectItem key={status} value={status}>
                      {getStatusLabel(status)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="loan_type">Loan Type</Label>
              <Select value={filters.loan_type} onValueChange={(value) => handleFilterChange('loan_type', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="All Loan Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Loan Types</SelectItem>
                  {loanTypeOptions.map(type => (
                    <SelectItem key={type} value={type}>
                      {getLoanTypeLabel(type)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleClear}
            >
              Clear Filters
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
                onClick={handleApply}
                className="bg-slate-900 hover:bg-slate-800"
              >
                Apply Filters
              </Button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
