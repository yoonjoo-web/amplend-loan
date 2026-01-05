import React, { useState } from 'react';
import { Check, X, ChevronDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export default function MultiSelect({ options, value = [], onChange, placeholder, className }) {
  const [open, setOpen] = useState(false);

  const handleSelect = (selectedValue) => {
    let newValue;
    if (value.includes(selectedValue)) {
      // Remove if already selected
      newValue = value.filter(v => v !== selectedValue);
    } else {
      // Add if not selected
      newValue = [...value, selectedValue];
    }
    console.log('MultiSelect - handleSelect called with:', selectedValue);
    console.log('MultiSelect - new value:', newValue);
    onChange(newValue);
  };

  const handleRemove = (valueToRemove, e) => {
    e.stopPropagation();
    const newValue = value.filter(v => v !== valueToRemove);
    console.log('MultiSelect - handleRemove called with:', valueToRemove);
    console.log('MultiSelect - new value:', newValue);
    onChange(newValue);
  };

  const selectedOptions = options.filter(option => value.includes(option.value));
  const unselectedOptions = options.filter(option => !value.includes(option.value));

  return (
    <div className={className}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between min-h-[40px] h-auto"
          >
            <div className="flex flex-wrap gap-1 flex-1 text-left">
              {selectedOptions.length === 0 ? (
                <span className="text-muted-foreground">{placeholder}</span>
              ) : (
                selectedOptions.map((option) => (
                  <Badge
                    key={option.value}
                    variant="secondary"
                    className="mr-1"
                  >
                    {option.label}
                    <button
                      type="button"
                      className="ml-1 ring-offset-background rounded-full outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                      onClick={(e) => handleRemove(option.value, e)}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                    >
                      <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                    </button>
                  </Badge>
                ))
              )}
            </div>
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <div className="max-h-[300px] overflow-y-auto">
            {options.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                No options available
              </div>
            ) : unselectedOptions.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                All options selected
              </div>
            ) : (
              <div className="p-1">
                {unselectedOptions.map((option) => (
                  <div
                    key={option.value}
                    className={cn(
                      "flex items-center gap-2 px-2 py-2 cursor-pointer rounded-sm hover:bg-accent hover:text-accent-foreground",
                      value.includes(option.value) && "bg-accent"
                    )}
                    onClick={() => {
                      console.log('Option clicked:', option.label, option.value);
                      handleSelect(option.value);
                    }}
                  >
                    <div className={cn(
                      "w-4 h-4 border rounded flex items-center justify-center shrink-0",
                      value.includes(option.value) ? 'bg-primary border-primary' : 'border-input'
                    )}>
                      {value.includes(option.value) && (
                        <Check className="h-3 w-3 text-primary-foreground" />
                      )}
                    </div>
                    <span className="flex-1">{option.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}