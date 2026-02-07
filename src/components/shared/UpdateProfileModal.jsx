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
        <DialogFooter className="grid gap-2 pt-4 sm:grid-cols-2 sm:gap-3">
          {actions.map((action, index) => (
            <Button
              key={action.label || index}
              variant={action.variant || 'default'}
              onClick={action.onClick}
              className={`h-10 text-sm font-medium ${action.className || ''} ${
                action.variant === 'outline' ? 'border border-slate-200' : ''
              }`}
            >
              {action.label}
            </Button>
          ))}
        </DialogFooter>
      );
    }

    return (
      <DialogFooter className="grid gap-2 pt-4 sm:grid-cols-2 sm:gap-3">
        <Button
          variant="outline"
          onClick={onKeepApplicationOnly}
          className="h-10 border border-slate-200 text-sm font-medium"
        >
          {secondaryLabel}
        </Button>
        <Button
          onClick={onUpdateProfile}
          className="h-10 text-sm font-medium"
        >
          {primaryLabel}
        </Button>
      </DialogFooter>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <AlertTriangle className="h-4 w-4 text-slate-600" />
            {title}
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-600">
            {description}
          </DialogDescription>
        </DialogHeader>

        {renderActions()}
      </DialogContent>
    </Dialog>
  );
}
