import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Clock } from "lucide-react";
import { format } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function PropertyChangeHistoryModal({ isOpen, onClose, history }) {
  const sortedHistory = [...(history || [])].reverse();

  const formatValue = (value) => {
    if (value === null || value === undefined || value === '') {
      return '(empty)';
    }
    return value;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Property Change History
          </DialogTitle>
          <DialogDescription>
            Complete timeline of all property information changes
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[500px] pr-4">
          {sortedHistory.length > 0 ? (
            <div className="space-y-3">
              {sortedHistory.map((entry, index) => (
                <div key={index} className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="flex items-start justify-between mb-2">
                    <span className="font-semibold text-slate-900">
                      {entry.modified_by_name}
                    </span>
                    <span className="text-xs text-slate-500">
                      {format(new Date(entry.timestamp), 'MMM d, yyyy h:mm a')}
                    </span>
                  </div>
                  <div className="text-sm text-slate-700">
                    Changed <span className="font-medium text-slate-900">{entry.field_name?.replace(/_/g, ' ')}</span>
                  </div>
                  <div className="mt-2 text-sm">
                    <div className="text-red-600">
                      From: <span className="font-medium">{formatValue(entry.old_value)}</span>
                    </div>
                    <div className="text-green-600 mt-1">
                      To: <span className="font-medium">{formatValue(entry.new_value)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-slate-500">
              <Clock className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p>No changes recorded yet</p>
              <p className="text-xs mt-1">Changes will appear here as they are made</p>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}