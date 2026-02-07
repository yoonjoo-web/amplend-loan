import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from 'lucide-react';

export default function UpdateProfileModal({
  isOpen,
  onClose,
  onUpdateProfile,
  onKeepApplicationOnly,
  title = 'Update Contact?',
  description = 'Do you want to also update the underlying contact with this new value?',
  primaryLabel = 'Yes, Update Contact',
  secondaryLabel = 'Application Only',
  actions = null
}) {
  const renderActions = () => {
    if (actions && actions.length > 0) {
      return (
        <DialogFooter className="flex flex-col gap-3 pt-6 border-t border-slate-200">
          {actions.map((action, index) => (
            <Button
              key={action.label || index}
              variant={action.variant || 'default'}
              onClick={action.onClick}
              className={`h-12 text-base font-medium transition-all ${action.className || ''} ${
                action.variant === 'outline' 
                  ? 'border-2 hover:bg-slate-50' 
                  : 'shadow-md hover:shadow-lg'
              }`}
            >
              {action.label}
            </Button>
          ))}
        </DialogFooter>
      );
    }

    return (
      <DialogFooter className="grid grid-cols-2 gap-4 pt-6 border-t border-slate-200">
        <Button 
          variant="outline" 
          onClick={onKeepApplicationOnly}
          className="h-12 border-2 hover:bg-slate-50 font-medium"
        >
          {secondaryLabel}
        </Button>
        <Button 
          onClick={onUpdateProfile} 
          className="h-12 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-md hover:shadow-lg font-medium"
        >
          {primaryLabel}
        </Button>
      </DialogFooter>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader className="space-y-3">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center flex-shrink-0 shadow-lg">
              <AlertTriangle className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-xl font-semibold text-slate-900">{title}</DialogTitle>
              <DialogDescription className="text-slate-600 mt-2 text-base leading-relaxed">
                {description}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {renderActions()}
      </DialogContent>
    </Dialog>
  );
}
