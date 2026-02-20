import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, X, Search, UserPlus, Link2, RotateCcw } from "lucide-react";
import { User as UserEntity } from "@/entities/all";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { US_STATES } from "../utils/usStates";
import AddressAutocomplete from "../shared/AddressAutocomplete";
import { base44 } from "@/api/base44Client";

const FieldWrapper = ({ children, fieldName, overriddenFields, onOverride, onReset, isDisabled, showOverrideControls }) => {
  const isOverridden = overriddenFields?.includes(fieldName);

  return (
    <div className="relative">
      {children}
      {isOverridden && (
        <div className="absolute top-0 right-0 p-1" title="This field has been manually overridden">
          <div className="bg-amber-500 text-white text-xs px-2 py-1 rounded">
            OVERRIDDEN
          </div>
        </div>
      )}
      {showOverrideControls && isDisabled && (
        <div className="absolute bottom-1 right-1 flex gap-1">
          {!isOverridden && (
            <Button size="sm" variant="outline" onClick={() => onOverride(fieldName)}>Override</Button>
          )}
          {isOverridden && (
            <Button size="sm" variant="ghost" onClick={() => onReset(fieldName)}><RotateCcw className="w-3 h-3"/></Button>
          )}
        </div>
      )}
    </div>
  );
};

export default function BorrowerForm({ borrower, onSubmit, onCancel, isProcessing }) {
  const [errors, setErrors] = useState({});
  const [formData, setFormData] = useState({
    user_id: '',
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    // Removed the single 'address' field
    address_street: '', // New address field
    address_unit: '',   // New address field
    address_city: '',   // New address field
    address_state: '',  // New address field
    address_zip: '',    // New address field
    date_of_birth: '',
    ssn: '',
    rehabs_done_36_months: '',
    rentals_owned_36_months: '',
    credit_score: '',
    overridden_fields: [],
    ...borrower // This will ensure that if borrower already has these granular address fields, they are used.
  });

  const [availableUsers, setAvailableUsers] = useState([]);
  const [showUserSearch, setShowUserSearch] = useState(false);
  const [linkedUser, setLinkedUser] = useState(null);

  const loadUsers = useCallback(async () => {
    try {
      // Fetch all users to allow linking to any existing user, not just those already marked as 'Borrower'
      const users = await UserEntity.list();
      setAvailableUsers(users);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  }, []);

  const loadLinkedUser = useCallback(async () => {
    if (formData.user_id) {
      try {
        const user = await UserEntity.get(formData.user_id);
        setLinkedUser(user);
      } catch (error) {
        console.error('Error loading linked user:', error);
      }
    }
  }, [formData.user_id]);

  useEffect(() => {
    loadUsers();
    if (formData.user_id) {
      loadLinkedUser();
    }
  }, [formData.user_id, loadUsers, loadLinkedUser]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const isFieldDisabled = (fieldName) => {
    return formData.user_id && !formData.overridden_fields?.includes(fieldName);
  };

  const handleOverride = (fieldName) => {
    const newOverriddenFields = [...(formData.overridden_fields || []), fieldName];
    setFormData(prev => ({ ...prev, overridden_fields: newOverriddenFields }));
  };

  const handleReset = (fieldName) => {
    const newOverriddenFields = (formData.overridden_fields || []).filter(f => f !== fieldName);
    setFormData(prev => ({ ...prev, overridden_fields: newOverriddenFields }));

    // Reset field to linked user's value if available. This handles new address fields too.
    if (linkedUser && linkedUser[fieldName] !== undefined) {
      setFormData(prev => ({ ...prev, [fieldName]: linkedUser[fieldName] }));
    }
  };

  const handleLinkToUser = (user) => {
    setLinkedUser(user);
    const updatedData = {
      ...formData,
      user_id: user.id,
      first_name: user.first_name || formData.first_name,
      last_name: user.last_name || formData.last_name,
      email: user.email || formData.email,
      phone: user.phone || formData.phone,
      date_of_birth: user.date_of_birth || formData.date_of_birth,
      ssn: user.ssn || formData.ssn,
      rehabs_done_36_months: user.rehabs_done_36_months || formData.rehabs_done_36_months,
      rentals_owned_36_months: user.rentals_owned_36_months || formData.rentals_owned_36_months,
      credit_score: user.credit_score || formData.credit_score,
      // Update with new granular address fields from linked user
      address_street: user.address_street || formData.address_street,
      address_unit: user.address_unit || formData.address_unit,
      address_city: user.address_city || formData.address_city,
      address_state: user.address_state || formData.address_state,
      address_zip: user.address_zip || formData.address_zip,
    };
    setFormData(updatedData);
    setShowUserSearch(false);
  };

  const handleUnlinkUser = () => {
    setLinkedUser(null);
    setFormData(prev => ({
      ...prev,
      user_id: '',
      overridden_fields: []
    }));
  };

  const handleInviteToPlatform = async () => {
    try {
      const inviter = await base44.auth.me().catch(() => null);
      await base44.asServiceRole.functions.invoke('emailService', {
        email_type: 'invite_borrower',
        recipient_email: formData.email,
        recipient_name: `${formData.first_name} ${formData.last_name}`,
        data: {
          first_name: formData.first_name,
          last_name: formData.last_name
        }
      });
      if (formData.id && inviter) {
        try {
          await base44.entities.Borrower.update(formData.id, {
            invited_by_user_id: inviter.id,
            invited_by_role: inviter.app_role || inviter.role
          });
        } catch (updateError) {
          console.error('Error updating borrower inviter fields:', updateError);
        }
      }
    } catch (error) {
      console.error('Error sending invitation:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const cleanedData = { ...formData };
    delete cleanedData.borrower_type;

    // Convert empty strings to null for numeric fields
    ['rehabs_done_36_months', 'rentals_owned_36_months', 'credit_score'].forEach(field => {
      if (cleanedData[field] === '') {
        cleanedData[field] = null;
      } else {
        const numValue = parseFloat(cleanedData[field]);
        cleanedData[field] = isNaN(numValue) ? null : numValue;
      }
    });

    // Clean up all other empty string fields to null for consistent API submission
    Object.keys(cleanedData).forEach(key => {
      if (cleanedData[key] === '') {
        cleanedData[key] = null;
      }
    });

    // If this borrower is linked to a user, and first_name/last_name are set,
    // update the User entity as well
    // Since first_name and last_name are required fields in the form, they will always be "set" if the form is valid.
    if (cleanedData.user_id) {
      try {
        const userUpdateData = {
          first_name: cleanedData.first_name,
          last_name: cleanedData.last_name,
          full_name: `${cleanedData.first_name} ${cleanedData.last_name}`.trim()
        };
        console.log(`Attempting to update linked user ${cleanedData.user_id} with:`, userUpdateData);
        await UserEntity.update(cleanedData.user_id, userUpdateData);
      } catch (error) {
        console.error('Error updating linked user:', error);
        // Decide if this error should prevent borrower submission, or just log and proceed.
        // For now, it logs and continues with borrower submission.
      }
    }

    await onSubmit(cleanedData);
  };

  const handleNumericInput = (field, value) => {
    if (value === '' || !isNaN(parseFloat(value))) {
      handleInputChange(field, value);
    }
  };

  const handlePhoneInput = (e) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 10) value = value.slice(0, 10);
    
    if (value.length >= 7) {
      value = `(${value.slice(0, 3)}) ${value.slice(3, 6)}-${value.slice(6)}`;
    } else if (value.length >= 4) {
      value = `(${value.slice(0, 3)}) ${value.slice(3)}`;
    } else if (value.length > 0) {
      value = `(${value}`;
    }
    
    handleInputChange('phone', value);
    
    const phoneDigits = value.replace(/\D/g, '');
    if (phoneDigits.length > 0 && phoneDigits.length !== 10) {
      setErrors(prev => ({ ...prev, phone: 'Phone must be 10 digits: (XXX) XXX-XXXX' }));
    } else {
      setErrors(prev => ({ ...prev, phone: '' }));
    }
  };

  const handleSSNInput = (e) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 9) value = value.slice(0, 9);
    
    if (value.length >= 5) {
      value = `${value.slice(0, 3)}-${value.slice(3, 5)}-${value.slice(5)}`;
    } else if (value.length >= 3) {
      value = `${value.slice(0, 3)}-${value.slice(3)}`;
    }
    
    handleInputChange('ssn', value);
    
    const ssnDigits = value.replace(/\D/g, '');
    if (ssnDigits.length > 0 && ssnDigits.length !== 9) {
      setErrors(prev => ({ ...prev, ssn: 'SSN must be 9 digits: XXX-XX-XXXX' }));
    } else {
      setErrors(prev => ({ ...prev, ssn: '' }));
    }
  };

  const handleCurrencyInput = (field, e) => {
    const value = e.target.value.replace(/[^0-9]/g, '');
    const numValue = value ? parseFloat(value) : null;
    handleInputChange(field, numValue);
  };

  const formatCurrencyDisplay = (value) => {
    if (!value && value !== 0) return '';
    return Number(value).toLocaleString('en-US');
  };

  const handleAddressSelect = (addressData) => {
    setFormData(prev => ({
      ...prev,
      address_street: addressData.street,
      address_city: addressData.city,
      address_state: addressData.state,
      address_zip: addressData.zip
    }));
  };

  return (
    <Card className="border-0 shadow-xl bg-white">
      <CardHeader className="pb-6">
        <CardTitle className="text-2xl font-bold text-slate-900">
          {borrower ? 'Edit Borrower' : 'New Borrower'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* User Linking Section */}
        <div className="mb-6 p-4 bg-slate-50 rounded-lg">
          <h4 className="font-semibold text-slate-900 mb-3">User Account Linking</h4>

          {formData.user_id && linkedUser ? (
            <div className="flex items-center justify-between p-3 bg-blue-50 rounded border border-blue-200">
              <div className="flex items-center gap-3">
                <Link2 className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="font-medium text-blue-900">
                    Linked to: {linkedUser.first_name} {linkedUser.last_name}
                  </p>
                  <p className="text-sm text-blue-700">{linkedUser.email}</p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={handleUnlinkUser}>
                Unlink
              </Button>
            </div>
          ) : (
            <div className="flex gap-3">
              <Popover open={showUserSearch} onOpenChange={setShowUserSearch}>
                <PopoverTrigger asChild>
                  <Button variant="outline">
                    <Search className="w-4 h-4 mr-2" />
                    Link to User
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0">
                  <Command>
                    <CommandInput placeholder="Search users by name or email..." />
                    <CommandList>
                      <CommandEmpty>No users found.</CommandEmpty>
                      <CommandGroup>
                        {availableUsers.map(user => (
                          <CommandItem
                            key={user.id}
                            onSelect={() => handleLinkToUser(user)}
                            className="cursor-pointer"
                          >
                            <div className="flex flex-col">
                              <span className="font-medium">
                                {user.first_name && user.last_name ? `${user.first_name} ${user.last_name}` : user.full_name || 'No Name'}
                              </span>
                              <span className="text-sm text-slate-500">{user.email}</span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>

              <Button variant="outline" onClick={handleInviteToPlatform}>
                <UserPlus className="w-4 h-4 mr-2" />
                Invite to Platform
              </Button>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="first_name">First Name *</Label>
              <FieldWrapper
                fieldName="first_name"
                overriddenFields={formData.overridden_fields}
                onOverride={handleOverride}
                onReset={handleReset}
                isDisabled={isFieldDisabled('first_name')}
                showOverrideControls={!!formData.user_id}
              >
                <Input
                  id="first_name"
                  value={formData.first_name}
                  onChange={(e) => handleInputChange('first_name', e.target.value)}
                  placeholder="First name"
                  disabled={isFieldDisabled('first_name')}
                  required
                />
              </FieldWrapper>
            </div>

            <div className="space-y-2">
              <Label htmlFor="last_name">Last Name *</Label>
              <FieldWrapper
                fieldName="last_name"
                overriddenFields={formData.overridden_fields}
                onOverride={handleOverride}
                onReset={handleReset}
                isDisabled={isFieldDisabled('last_name')}
                showOverrideControls={!!formData.user_id}
              >
                <Input
                  id="last_name"
                  value={formData.last_name}
                  onChange={(e) => handleInputChange('last_name', e.target.value)}
                  placeholder="Last name"
                  disabled={isFieldDisabled('last_name')}
                  required
                />
              </FieldWrapper>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <FieldWrapper
                fieldName="email"
                overriddenFields={formData.overridden_fields}
                onOverride={handleOverride}
                onReset={handleReset}
                isDisabled={isFieldDisabled('email')}
                showOverrideControls={!!formData.user_id}
              >
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => {
                    handleInputChange('email', e.target.value);
                    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                    if (e.target.value && !emailPattern.test(e.target.value)) {
                      setErrors(prev => ({ ...prev, email: 'Please enter a valid email address' }));
                    } else {
                      setErrors(prev => ({ ...prev, email: '' }));
                    }
                  }}
                  placeholder="email@example.com"
                  disabled={isFieldDisabled('email')}
                  className={errors.email ? 'border-red-500' : ''}
                  required
                />
                {errors.email && (
                  <p className="text-red-500 text-xs mt-1">{errors.email}</p>
                )}
              </FieldWrapper>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <FieldWrapper
                fieldName="phone"
                overriddenFields={formData.overridden_fields}
                onOverride={handleOverride}
                onReset={handleReset}
                isDisabled={isFieldDisabled('phone')}
                showOverrideControls={!!formData.user_id}
              >
                <Input
                  id="phone"
                  value={formData.phone}
                  onInput={handlePhoneInput}
                  placeholder="(555) 123-4567"
                  disabled={isFieldDisabled('phone')}
                  className={errors.phone ? 'border-red-500' : ''}
                />
                {errors.phone && (
                  <p className="text-red-500 text-xs mt-1">{errors.phone}</p>
                )}
              </FieldWrapper>
            </div>

            <div className="space-y-2">
              <Label htmlFor="date_of_birth">Date of Birth</Label>
              <FieldWrapper
                fieldName="date_of_birth"
                overriddenFields={formData.overridden_fields}
                onOverride={handleOverride}
                onReset={handleReset}
                isDisabled={isFieldDisabled('date_of_birth')}
                showOverrideControls={!!formData.user_id}
              >
                <Input
                  id="date_of_birth"
                  type="date"
                  value={formData.date_of_birth}
                  onChange={(e) => handleInputChange('date_of_birth', e.target.value)}
                  disabled={isFieldDisabled('date_of_birth')}
                />
              </FieldWrapper>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ssn">SSN</Label>
              <FieldWrapper
                fieldName="ssn"
                overriddenFields={formData.overridden_fields}
                onOverride={handleOverride}
                onReset={handleReset}
                isDisabled={isFieldDisabled('ssn')}
                showOverrideControls={!!formData.user_id}
              >
                <Input
                  id="ssn"
                  value={formData.ssn}
                  onInput={handleSSNInput}
                  placeholder="XXX-XX-XXXX"
                  disabled={isFieldDisabled('ssn')}
                  className={errors.ssn ? 'border-red-500' : ''}
                />
                {errors.ssn && (
                  <p className="text-red-500 text-xs mt-1">{errors.ssn}</p>
                )}
              </FieldWrapper>
            </div>
          </div>

          {/* Address Section - New implementation */}
          <div className="space-y-4 pt-4 border-t">
            <h3 className="font-semibold text-slate-900">Address</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2 space-y-2">
                <Label htmlFor="address_street">Street Address</Label>
                <FieldWrapper
                  fieldName="address_street"
                  overriddenFields={formData.overridden_fields}
                  onOverride={handleOverride}
                  onReset={handleReset}
                  isDisabled={isFieldDisabled('address_street')}
                  showOverrideControls={!!formData.user_id}
                >
                  <AddressAutocomplete
                    id="address_street"
                    value={formData.address_street || ''}
                    onChange={(value) => handleInputChange('address_street', value)}
                    onAddressSelect={handleAddressSelect}
                    disabled={isFieldDisabled('address_street')}
                    placeholder="123 Main Street"
                  />
                </FieldWrapper>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address_unit">Unit/Apt</Label>
                <FieldWrapper
                  fieldName="address_unit"
                  overriddenFields={formData.overridden_fields}
                  onOverride={handleOverride}
                  onReset={handleReset}
                  isDisabled={isFieldDisabled('address_unit')}
                  showOverrideControls={!!formData.user_id}
                >
                  <Input
                    id="address_unit"
                    value={formData.address_unit || ''}
                    onChange={(e) => handleInputChange('address_unit', e.target.value)}
                    placeholder="Apt 4B"
                    disabled={isFieldDisabled('address_unit')}
                  />
                </FieldWrapper>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address_city">City</Label>
                <FieldWrapper
                  fieldName="address_city"
                  overriddenFields={formData.overridden_fields}
                  onOverride={handleOverride}
                  onReset={handleReset}
                  isDisabled={isFieldDisabled('address_city')}
                  showOverrideControls={!!formData.user_id}
                >
                  <Input
                    id="address_city"
                    value={formData.address_city || ''}
                    onChange={(e) => handleInputChange('address_city', e.target.value)}
                    placeholder="New York"
                    disabled={isFieldDisabled('address_city')}
                  />
                </FieldWrapper>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address_state">State</Label>
                <FieldWrapper
                  fieldName="address_state"
                  overriddenFields={formData.overridden_fields}
                  onOverride={handleOverride}
                  onReset={handleReset}
                  isDisabled={isFieldDisabled('address_state')}
                  showOverrideControls={!!formData.user_id}
                >
                  <Select
                    value={formData.address_state || ''}
                    onValueChange={(value) => handleInputChange('address_state', value)}
                    disabled={isFieldDisabled('address_state')}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent>
                      {US_STATES.map(state => (
                        <SelectItem key={state.value} value={state.value}>
                          {state.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FieldWrapper>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address_zip">ZIP Code</Label>
                <FieldWrapper
                  fieldName="address_zip"
                  overriddenFields={formData.overridden_fields}
                  onOverride={handleOverride}
                  onReset={handleReset}
                  isDisabled={isFieldDisabled('address_zip')}
                  showOverrideControls={!!formData.user_id}
                >
                  <Input
                    id="address_zip"
                    value={formData.address_zip || ''}
                    onChange={(e) => handleInputChange('address_zip', e.target.value)}
                    placeholder="10001"
                    disabled={isFieldDisabled('address_zip')}
                  />
                </FieldWrapper>
              </div>
            </div>
          </div>
          {/* End Address Section */}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="rehabs_done_36_months">Rehabs Done (36 months)</Label>
              <FieldWrapper
                fieldName="rehabs_done_36_months"
                overriddenFields={formData.overridden_fields}
                onOverride={handleOverride}
                onReset={handleReset}
                isDisabled={isFieldDisabled('rehabs_done_36_months')}
                showOverrideControls={!!formData.user_id}
              >
                <Input
                  id="rehabs_done_36_months"
                  type="number"
                  min="0"
                  value={formData.rehabs_done_36_months}
                  onChange={(e) => handleNumericInput('rehabs_done_36_months', e.target.value)}
                  placeholder="5"
                  disabled={isFieldDisabled('rehabs_done_36_months')}
                />
              </FieldWrapper>
            </div>

            <div className="space-y-2">
              <Label htmlFor="rentals_owned_36_months">Rentals Owned (36 months)</Label>
              <FieldWrapper
                fieldName="rentals_owned_36_months"
                overriddenFields={formData.overridden_fields}
                onOverride={handleOverride}
                onReset={handleReset}
                isDisabled={isFieldDisabled('rentals_owned_36_months')}
                showOverrideControls={!!formData.user_id}
              >
                <Input
                  id="rentals_owned_36_months"
                  type="number"
                  min="0"
                  value={formData.rentals_owned_36_months}
                  onChange={(e) => handleNumericInput('rentals_owned_36_months', e.target.value)}
                  placeholder="3"
                  disabled={isFieldDisabled('rentals_owned_36_months')}
                />
              </FieldWrapper>
            </div>

            <div className="space-y-2">
              <Label htmlFor="credit_score">Credit Score</Label>
              <FieldWrapper
                fieldName="credit_score"
                overriddenFields={formData.overridden_fields}
                onOverride={handleOverride}
                onReset={handleReset}
                isDisabled={isFieldDisabled('credit_score')}
                showOverrideControls={!!formData.user_id}
              >
                <Input
                  id="credit_score"
                  type="number"
                  min="300"
                  max="850"
                  value={formData.credit_score}
                  onChange={(e) => handleNumericInput('credit_score', e.target.value)}
                  placeholder="720"
                  disabled={isFieldDisabled('credit_score')}
                />
              </FieldWrapper>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-6 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isProcessing}
            >
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isProcessing}
              className="bg-slate-900 hover:bg-slate-800"
            >
              <Save className="w-4 h-4 mr-2" />
              {isProcessing ? 'Saving...' : 'Save Borrower'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
