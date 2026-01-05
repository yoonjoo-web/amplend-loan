import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Clock, ChevronDown, ChevronRight, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";

function formatValue(value) {
  if (value === null || value === undefined || value === '') return '(empty)';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
}

export default function VersionHistoryModal({ isOpen, onClose, loan }) {
  const [expandedItems, setExpandedItems] = useState(new Set([0]));
  const [fieldConfigMap, setFieldConfigMap] = useState({});
  const [isLoadingConfigs, setIsLoadingConfigs] = useState(true);
  const modificationHistory = loan.modification_history || [];

  useEffect(() => {
    if (isOpen) {
      loadFieldConfigs();
    }
  }, [isOpen]);

  const loadFieldConfigs = async () => {
    setIsLoadingConfigs(true);
    try {
      const configs = await base44.entities.FieldConfiguration.filter({ context: 'loan' });
      const map = {};
      configs.forEach(config => {
        map[config.field_name] = config.field_label;
      });
      setFieldConfigMap(map);
    } catch (error) {
      console.error('Error loading field configurations:', error);
    }
    setIsLoadingConfigs(false);
  };

  const getFieldDisplayName = (fieldName) => {
    if (fieldConfigMap[fieldName]) {
      return fieldConfigMap[fieldName];
    }
    
    // Fallback formatting
    return fieldName
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ')
      .trim();
  };

  const toggleExpand = (index) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Version History</DialogTitle>
          <DialogDescription>
            Track all changes made to this loan
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-4">
          {isLoadingConfigs ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
            </div>
          ) : modificationHistory.length > 0 ? (
            [...modificationHistory].reverse().map((mod, index) => {
              const isExpanded = expandedItems.has(index);
              const hasFieldChanges = mod.field_changes && mod.field_changes.length > 0;
              
              // Create a summary of what changed with display names
              const changeSummary = hasFieldChanges 
                ? mod.field_changes.map(ch => getFieldDisplayName(ch.field_name)).join(', ')
                : mod.fields_changed?.map(f => getFieldDisplayName(f)).join(', ') || 'Updated';
              
              return (
                <div key={index} className="border border-slate-200 rounded-lg overflow-hidden hover:border-slate-300 transition-colors">
                  <div 
                    className={`flex items-start gap-3 p-4 cursor-pointer transition-colors ${
                      isExpanded ? 'bg-blue-50' : 'bg-slate-50 hover:bg-slate-100'
                    }`}
                    onClick={() => hasFieldChanges && toggleExpand(index)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-900 text-base mb-1">
                            Changed: {changeSummary}
                          </p>
                          {hasFieldChanges && (
                            <p className="text-xs text-slate-500">
                              {mod.field_changes.length} field{mod.field_changes.length !== 1 ? 's' : ''} modified
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {index === 0 && <Badge variant="outline" className="text-xs">Latest</Badge>}
                          {hasFieldChanges && (
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4" />
                              ) : (
                                <ChevronRight className="w-4 h-4" />
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span>{mod.modified_by_name || 'System'}</span>
                        <span>•</span>
                        <span>{format(new Date(mod.timestamp), 'MMM d, yyyy h:mm a')}</span>
                      </div>
                    </div>
                  </div>
                  
                  {isExpanded && hasFieldChanges && (
                    <div className="p-4 bg-white border-t border-slate-200">
                      <div className="space-y-4">
                        {mod.field_changes.map((change, changeIndex) => (
                          <div key={changeIndex} className="bg-slate-50 rounded-lg border border-slate-200 overflow-hidden">
                            <div className="bg-slate-100 px-4 py-2 border-b border-slate-200">
                              <p className="text-sm font-semibold text-slate-900">
                                {getFieldDisplayName(change.field_name)}
                              </p>
                            </div>
                            <div className="p-4">
                              <div className="flex items-center gap-4">
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium text-slate-500 mb-2">Previous Value</p>
                                  <div className="bg-red-50 border border-red-200 rounded-md p-3">
                                    <p className="text-sm text-slate-900 whitespace-pre-wrap break-words font-mono">
                                      {formatValue(change.old_value)}
                                    </p>
                                  </div>
                                </div>
                                
                                <ArrowRight className="w-5 h-5 text-slate-400 flex-shrink-0 mt-6" />
                                
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium text-slate-500 mb-2">New Value</p>
                                  <div className="bg-green-50 border border-green-200 rounded-md p-3">
                                    <p className="text-sm text-slate-900 whitespace-pre-wrap break-words font-mono">
                                      {formatValue(change.new_value)}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="text-center py-8 text-slate-500">
              <p className="text-sm">No modification history available</p>
            </div>
          )}

          <div className="flex items-start gap-3 border-l-2 border-slate-300 pl-4 py-2 mt-6 bg-slate-50 rounded-r-lg">
            <Clock className="w-4 h-4 text-slate-400 mt-1" />
            <div className="flex-1">
              <p className="font-semibold text-slate-900">Loan Created</p>
              <p className="text-xs text-slate-500 mt-1">
                {format(new Date(loan.created_date), 'MMM d, yyyy h:mm a')}
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}