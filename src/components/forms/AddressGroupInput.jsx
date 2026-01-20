
import React, { useState, useEffect } from 'react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import AddressAutocomplete from "../shared/AddressAutocomplete";
import CityAutocomplete from "../shared/CityAutocomplete";
import { US_STATES } from "../utils/usStates";
import { US_COUNTIES_BY_STATE } from "../utils/usCountiesData";
import { base44 } from "@/api/base44Client";

export default function AddressGroupInput({ value, onChange, fieldNamePrefix, allFieldValues = {}, isReadOnly = false }) {
  const streetField = `${fieldNamePrefix}_street`;
  const unitField = `${fieldNamePrefix}_unit`;
  const cityField = `${fieldNamePrefix}_city`;
  const stateField = `${fieldNamePrefix}_state`;
  const zipField = `${fieldNamePrefix}_zip`;
  const countyField = `${fieldNamePrefix}_county`;

  const currentStreet = allFieldValues[streetField] || '';
  const currentUnit = allFieldValues[unitField] || '';
  const currentCity = allFieldValues[cityField] || '';
  const currentState = allFieldValues[stateField] || '';
  const currentZip = allFieldValues[zipField] || '';
  const currentCounty = allFieldValues[countyField] || '';

  const [isLoadingCounty, setIsLoadingCounty] = useState(false);

  const handleAddressSelect = (addressData) => {
    const updates = {
      [streetField]: addressData.street || currentStreet,
      [cityField]: addressData.city || currentCity,
      [stateField]: addressData.state || currentState,
      [zipField]: addressData.zip ? addressData.zip.replace(/\D/g, '').slice(0, 5) : currentZip, // Ensure zip is clean and 5 digits
      [countyField]: addressData.county || currentCounty
    };
    onChange(updates);
  };

  const handleFieldChange = (fieldName, fieldValue) => {
    onChange({ [fieldName]: fieldValue });
  };

  // Auto-populate county based on city and state
  useEffect(() => {
    // Only attempt to fetch if city and state are present, county is not, and not in read-only mode.
    if (currentCity && currentState && !currentCounty && !isReadOnly) {
      const fetchCounty = async () => {
        setIsLoadingCounty(true);
        try {
          // Use LLM to find the county for the given city and state
          const response = await base44.integrations.Core.InvokeLLM({
            prompt: `What county is ${currentCity}, ${currentState} in? Respond with ONLY the county name followed by " County". For example: "Los Angeles County" or "Cook County". Do not include any other text.`,
            response_json_schema: {
              type: "object",
              properties: {
                county: { type: "string" }
              }
            }
          });

          if (response && response.county) {
            // Check if the fetched county is already in our static list, or add it
            // This is a safety measure, though the LLM should ideally return recognized counties.
            const fetchedCountyClean = response.county.replace(/ County$/i, '').trim(); // Remove " County" suffix
            if (US_COUNTIES_BY_STATE[currentState] && !US_COUNTIES_BY_STATE[currentState].includes(fetchedCountyClean)) {
                // If it's a new county, we could potentially add it to the local list,
                // or just set the value and let the select display it.
                // For now, we'll just set the value directly.
            }
            onChange({ [countyField]: fetchedCountyClean });
          }
        } catch (error) {
          console.error('Error fetching county:', error);
        } finally {
          setIsLoadingCounty(false);
        }
      };

      fetchCounty();
    }
  }, [currentCity, currentState, currentCounty, isReadOnly, countyField, onChange]);

  const counties = currentState ? US_COUNTIES_BY_STATE[currentState] || [] : [];

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Street Address</Label>
        <AddressAutocomplete
          value={currentStreet}
          onChange={(value) => handleFieldChange(streetField, value)}
          onSelect={handleAddressSelect}
          placeholder="123 Main St"
          disabled={isReadOnly}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Unit/Apt (optional)</Label>
          <Input
            value={currentUnit}
            onChange={(e) => handleFieldChange(unitField, e.target.value)}
            placeholder="Unit 4B"
            disabled={isReadOnly}
          />
        </div>

        <div className="space-y-2">
          <Label>ZIP Code</Label>
          <Input
            value={currentZip}
            onChange={(e) => {
              const cleaned = e.target.value.replace(/\D/g, '').slice(0, 5); // Allow only digits, max 5
              handleFieldChange(zipField, cleaned);
            }}
            placeholder="00000"
            disabled={isReadOnly}
            maxLength={5}
            inputMode="numeric" // Suggest numeric keyboard on mobile
            pattern="[0-9]{5}" // HTML5 validation pattern
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>State</Label>
          <Select
            value={currentState}
            onValueChange={(value) => handleFieldChange(stateField, value)}
            disabled={isReadOnly}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select state..." />
            </SelectTrigger>
            <SelectContent>
              {US_STATES.map((state) => (
                <SelectItem key={state.value} value={state.value}>
                  {state.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>City</Label>
          <CityAutocomplete
            id={cityField}
            value={currentCity}
            onChange={(value) => handleFieldChange(cityField, value)}
            onCitySelect={(cityData) => {
              const updates = { [cityField]: cityData.city || currentCity };
              if (cityData.state) {
                updates[stateField] = cityData.state;
              }
              onChange(updates);
            }}
            disabled={isReadOnly}
            placeholder="Start typing a city..."
            className="h-10 text-sm"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>County</Label>
        <Select
          value={currentCounty}
          onValueChange={(value) => handleFieldChange(countyField, value)}
          disabled={isReadOnly || !currentState || isLoadingCounty} // Disable if no state, or loading
        >
          <SelectTrigger>
            <SelectValue placeholder={isLoadingCounty ? "Loading..." : currentState ? "Select county..." : "Select state first..."} />
          </SelectTrigger>
          <SelectContent>
            {/* Show currentCounty as an option if it's not in the predefined list but set, e.g. from LLM */}
            {currentCounty && !counties.includes(currentCounty) && (
                <SelectItem key={currentCounty} value={currentCounty}>
                    {currentCounty}
                </SelectItem>
            )}
            {counties.map((county) => (
              <SelectItem key={county} value={county}>
                {county}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isLoadingCounty && (
          <p className="text-xs text-slate-500">Auto-detecting county...</p>
        )}
      </div>
    </div>
  );
}
