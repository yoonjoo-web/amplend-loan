import React, { useState } from 'react';
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
  const [search, setSearch] = useState('');

  React.useEffect(() => {
    if (isOpen) setSearch('');
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredItems = search.trim() === ''
    ? items
    : items.filter(item => {
        const term = search.toLowerCase();
        return searchFields.some(field => {
          const fieldValue = field.split('.').reduce((obj, key) => obj?.[key], item);
          return fieldValue && String(fieldValue).toLowerCase().includes(term);
        });
      });

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
          <Command className="border rounded-lg" shouldFilter={false}>
            <CommandInput
              placeholder={placeholder}
              className="border-b px-3 py-2 text-sm"
              value={search}
              onValueChange={setSearch}
            />

            <CommandList className="max-h-64 overflow-auto">
              {isLoading && (
                <div className="p-4 text-center text-sm text-slate-500">
                  Loading...
                </div>
              )}

              {!isLoading && filteredItems.length === 0 && (
                <CommandEmpty className="p-4 text-sm text-slate-500">
                  {emptyMessage}
                </CommandEmpty>
              )}

              <CommandGroup>
                {filteredItems.map(item => (
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