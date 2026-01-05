import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, AlertTriangle, AlertCircle, HelpCircle } from 'lucide-react';

export default function FieldCommentModal({ isOpen, onClose, field, currentComment, onSave }) {
  const [comment, setComment] = useState(currentComment?.comment || '');
  const [indicator, setIndicator] = useState(currentComment?.indicator || 'question');

  if (!isOpen) return null;

  const handleSave = () => {
    onSave({
      comment,
      indicator
    });
    onClose();
  };

  const indicatorIcons = {
    warning: { icon: AlertTriangle, color: 'text-amber-500', label: 'Warning' },
    problematic: { icon: AlertCircle, color: 'text-red-500', label: 'Problematic' },
    question: { icon: HelpCircle, color: 'text-blue-500', label: 'Question' }
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
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-xl font-bold text-slate-900">Add Field Comment</h3>
              <p className="text-sm text-slate-500 mt-1">Field: {field}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
              <X className="w-4 h-4" />
            </Button>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="indicator">Indicator Type</Label>
              <Select value={indicator} onValueChange={setIndicator}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(indicatorIcons).map(([key, { icon: Icon, color, label }]) => (
                    <SelectItem key={key} value={key}>
                      <div className="flex items-center gap-2">
                        <Icon className={`w-4 h-4 ${color}`} />
                        {label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="comment">Comment</Label>
              <Textarea
                id="comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Enter your comment or question..."
                className="h-32"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave} className="bg-slate-900 hover:bg-slate-800">
              Save Comment
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}