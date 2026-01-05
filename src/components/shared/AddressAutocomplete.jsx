import React, { useState, useEffect, useRef } from 'react';
import { Input } from "@/components/ui/input";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Loader2 } from "lucide-react";
import { googlePlacesAutocomplete } from "@/functions/googlePlacesAutocomplete";

export default function AddressAutocomplete({ 
  value, 
  onChange, 
  onAddressSelect, 
  disabled, 
  placeholder = "Start typing an address...",
  className = "",
  id,
  onBlur
}) {
  const [suggestions, setSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceTimer = useRef(null);
  const wrapperRef = useRef(null);

  // Click outside to close suggestions
  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchSuggestions = async (input) => {
    if (!input || input.length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setIsLoading(true);
    try {
      const response = await googlePlacesAutocomplete({ input });
      console.log(`🔍 AddressAutocomplete [${id || placeholder}] - Suggestions response:`, response);
      setSuggestions(response.data.suggestions || []);
      setShowSuggestions(true);
    } catch (error) {
      console.error(`❌ AddressAutocomplete [${id || placeholder}] - Error fetching suggestions:`, error);
      setSuggestions([]);
    }
    setIsLoading(false);
  };

  const handleInputChange = (e) => {
    const newValue = e.target.value;
    onChange(newValue);

    // Debounce API calls
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      fetchSuggestions(newValue);
    }, 300);
  };

  const handleSelectSuggestion = async (suggestion) => {
    console.log(`📍 AddressAutocomplete [${id || placeholder}] - Selected suggestion:`, suggestion);
    
    setShowSuggestions(false);
    setSuggestions([]);
    setIsLoading(true);

    try {
      const response = await googlePlacesAutocomplete({ placeId: suggestion.placeId });
      console.log(`📦 AddressAutocomplete [${id || placeholder}] - Place details RAW response:`, response);
      console.log(`📦 AddressAutocomplete [${id || placeholder}] - Place details response.data:`, response.data);
      
      const addressData = response.data;
      console.log(`🏠 AddressAutocomplete [${id || placeholder}] - Parsed addressData:`, addressData);
      
      const displayValue = `${addressData.street}, ${addressData.city}, ${addressData.state} ${addressData.zip}`;
      onChange(displayValue);

      // Call the callback with parsed address data
      if (onAddressSelect) {
        const dataToSend = {
          street: addressData.street,
          unit: addressData.unit || '',
          city: addressData.city,
          state: addressData.state,
          zip: addressData.zip
        };
        console.log(`✅ AddressAutocomplete [${id || placeholder}] - Calling onAddressSelect with:`, dataToSend);
        onAddressSelect(dataToSend);
      } else {
        console.warn(`⚠️ AddressAutocomplete [${id || placeholder}] - onAddressSelect callback is not defined`);
      }
    } catch (error) {
      console.error(`❌ AddressAutocomplete [${id || placeholder}] - Error fetching place details:`, error);
    }
    setIsLoading(false);
  };

  const handleBlur = (e) => {
    // Delay to allow click on suggestion to register
    setTimeout(() => {
      if (onBlur) {
        onBlur(e);
      }
    }, 200);
  };

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <Input
          id={id}
          value={value || ''}
          onChange={handleInputChange}
          onFocus={() => {
            if ((value && value.length >= 3) || suggestions.length > 0) {
              setShowSuggestions(true);
            }
          }}
          onBlur={handleBlur}
          disabled={disabled}
          placeholder={placeholder}
          className={className}
          autoComplete="off"
        />
        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
          </div>
        )}
      </div>

      {showSuggestions && suggestions.length > 0 && !disabled && (
        <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg">
          <Command className="rounded-lg border-0">
            <CommandList>
              {suggestions.length === 0 && (
                <CommandEmpty>No addresses found.</CommandEmpty>
              )}
              <CommandGroup>
                {suggestions.map((suggestion, index) => (
                  <CommandItem
                    key={`${suggestion.placeId}-${index}`}
                    onSelect={() => handleSelectSuggestion(suggestion)}
                    className="cursor-pointer"
                  >
                    {suggestion.description}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </div>
      )}
    </div>
  );
}