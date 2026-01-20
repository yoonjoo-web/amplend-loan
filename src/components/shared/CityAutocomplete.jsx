import React, { useState, useEffect, useRef } from 'react';
import { Input } from "@/components/ui/input";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Loader2 } from "lucide-react";
import { googlePlacesAutocomplete } from "@/functions/googlePlacesAutocomplete";

function getCityStateFallback(description) {
  if (!description) return { city: '', state: '' };
  const parts = description.split(',').map((part) => part.trim());
  const city = parts[0] || '';
  const state = parts.length > 1 ? parts[1].split(' ')[0] : '';
  return { city, state };
}

export default function CityAutocomplete({
  value,
  onChange,
  onCitySelect,
  disabled,
  placeholder = "Start typing a city...",
  className = "",
  id,
  onBlur
}) {
  const [suggestions, setSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceTimer = useRef(null);
  const wrapperRef = useRef(null);

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
    if (!input || input.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setIsLoading(true);
    try {
      const response = await googlePlacesAutocomplete({ input, types: '(cities)' });
      setSuggestions(response.data.suggestions || []);
      setShowSuggestions(true);
    } catch (error) {
      console.error(`❌ CityAutocomplete [${id || placeholder}] - Error fetching suggestions:`, error);
      setSuggestions([]);
    }
    setIsLoading(false);
  };

  const handleInputChange = (e) => {
    const newValue = e.target.value;
    onChange(newValue);

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      fetchSuggestions(newValue);
    }, 300);
  };

  const handleSelectSuggestion = async (suggestion) => {
    setShowSuggestions(false);
    setSuggestions([]);
    setIsLoading(true);

    try {
      const response = await googlePlacesAutocomplete({ placeId: suggestion.placeId });
      const addressData = response.data || {};
      const fallback = getCityStateFallback(suggestion.description);
      const city = addressData.city || fallback.city;
      const state = addressData.state || fallback.state;

      onChange(city);

      if (onCitySelect) {
        onCitySelect({ city, state });
      }
    } catch (error) {
      console.error(`❌ CityAutocomplete [${id || placeholder}] - Error fetching place details:`, error);
    }
    setIsLoading(false);
  };

  const handleBlur = (e) => {
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
            if ((value && value.length >= 2) || suggestions.length > 0) {
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
                <CommandEmpty>No cities found.</CommandEmpty>
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
