import React, { useEffect, useState } from 'react';
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

export default function UpdateProfileModal({
  isOpen,
  onClose,
  onUpdateProfile,
  onKeepApplicationOnly,
  title = 'Update Contact?',
  description = 'Do you want to also update the underlying contact with this new value?',
  primaryLabel = 'Yes, Update Contact',
  secondaryLabel = 'Application Only',
  actions = null,
  options = null,
  onSubmitOption = null,
  submitLabel = 'Submit',
  defaultOption = null
}) {
  const [selectedOption, setSelectedOption] = useState(
    defaultOption || options?.[0]?.value || ''
  );

  useEffect(() => {
    if (isOpen && options?.length) {
      setSelectedOption(defaultOption || options[0]?.value || '');
    }
  }, [defaultOption, isOpen, options]);

  const renderActions = () => {
    if (options && options.length > 0) {
      return (
        <>
          <div className="space-y-2">
            <RadioGroup
              value={selectedOption}
              onValueChange={setSelectedOption}
              className="gap-2"
            >
              {options.map((option) => (
                <div
                  key={option.value}
                  className="flex items-start gap-2 rounded-md border border-slate-200 px-3 py-2"
                >
                  <RadioGroupItem
                    value={option.value}
                    id={`update-profile-${option.value}`}
                    className="mt-0.5"
                  />
                  <Label
                    htmlFor={`update-profile-${option.value}`}
                    className="text-sm font-medium text-slate-700"
                  >
                    {option.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>
          <DialogFooter className="pt-4">
            <Button
              onClick={() => onSubmitOption && onSubmitOption(selectedOption)}
              disabled={!selectedOption || !onSubmitOption}
              className="h-10 text-sm font-medium"
            >
              {submitLabel}
            </Button>
          </DialogFooter>
        </>
      );
    }

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
