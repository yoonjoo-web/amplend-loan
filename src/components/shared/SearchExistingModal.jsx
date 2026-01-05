import React from 'react';
import { motion } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { X } from 'lucide-react';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

export default function SearchExistingModal({
  isOpen,
  onClose,
  items = [],
  isLoading = false,
  onSelect,
  title = "Search",
  placeholder = "Search...",
  emptyMessage = "No items found.",
  renderItem,
  searchFields = ['name', 'email']
}) {

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 30 }}
        className="relative w-full max-w-lg m-4 bg-white rounded-xl shadow-2xl"
      >
        <div className="p-6">

          {/* Modal Header */}
          <div className="flex items-start justify-between mb-4">
            <h3 className="text-xl font-bold text-slate-900">{title}</h3>
            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Search Component */}
          <Command
            className="border rounded-lg"
            filter={(value, search) => {
              const item = items.find(i => i.id === value);
              if (!item) return 0;

              const term = search.toLowerCase();

              for (const field of searchFields) {
                const fieldValue = field.split('.').reduce((obj, key) => obj?.[key], item);
                if (fieldValue && String(fieldValue).toLowerCase().includes(term)) {
                  return 1;
                }
              }

              return 0;
            }}
          >
            <CommandInput
              placeholder={placeholder}
              className="border-b px-3 py-2 text-sm"
            />

            <CommandList className="max-h-64 overflow-auto">
              {isLoading && (
                <div className="p-4 text-center text-sm text-slate-500">
                  Loading...
                </div>
              )}

              <CommandEmpty className="p-4 text-sm text-slate-500">
                {emptyMessage}
              </CommandEmpty>

              <CommandGroup>
                {items.map(item => (
                  <CommandItem
                    key={item.id}
                    value={item.id}
                    onSelect={() => onSelect(item)}
                    className="cursor-pointer px-3 py-2"
                  >
                    {renderItem(item)}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </div>
      </motion.div>
    </div>
  );
}