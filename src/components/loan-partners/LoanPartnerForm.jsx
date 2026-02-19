import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Save, X, AlertCircle, Search, UserPlus, Link2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LoanPartner, User as UserEntity } from "@/entities/all";
import { US_STATES } from "../utils/usStates"; // New import for US States
import AddressAutocomplete from "../shared/AddressAutocomplete"; // New import for AddressAutocomplete
import { LOAN_PARTNER_ROLES, normalizeAppRole } from "@/components/utils/appRoles";
import { base44 } from "@/api/base44Client";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// Define the initial state structure for the form data,
// now including granular address fields and excluding the single 'address' field.
const initialFormDataState = {
  user_id: '',
  name: '',
  app_role: '',
  email: '',
  phone: '',
  website: '',
  contact_person: '',
  notes: '',
  address_street: '',
  address_unit: '',
  address_city: '',
  address_state: '',
  address_zip: '',
};

export default function LoanPartnerForm({ partner, onSubmit, onCancel, isProcessing, toast, fixedRole }) {
  const [formData, setFormData] = useState(initialFormDataState);
  const [errors, setErrors] = useState({});
  const [nameExists, setNameExists] = useState(false);
  const [availableUsers, setAvailableUsers] = useState([]);
  const [showUserSearch, setShowUserSearch] = useState(false);
  const [linkedUser, setLinkedUser] = useState(null);

  // Effect to update formData when the 'partner' prop changes.
  // This ensures the form is correctly populated when editing an existing partner
  // or reset when switching to a new partner creation.
  useEffect(() => {
    if (partner) {
      setFormData(prev => ({
        ...initialFormDataState, // Start with a clean slate ensuring all fields are present
        ...partner, // Apply existing partner data
        app_role: normalizeAppRole(partner.app_role || partner.type || ''),
        type: undefined,
        // Explicitly set the old 'address' field to undefined
        // to ensure it's not carried over from the 'partner' object
        // if it still contains an older data model.
        address: undefined,
      }));
    } else {
      setFormData({
        ...initialFormDataState,
        app_role: fixedRole || ''
      }); // Reset to initial state for a new form
    }
  }, [partner, fixedRole]); // Rerun this effect whenever the 'partner' prop object changes

  const loadUsers = useCallback(async () => {
    try {
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

  useEffect(() => {
    if (fixedRole && formData.app_role !== fixedRole) {
      setFormData(prev => ({ ...prev, app_role: fixedRole }));
    }
  }, [fixedRole, formData.app_role]);

  useEffect(() => {
    // Check if partner name exists (but not for the current partner being edited)
    const checkName = async () => {
      if (formData.name && formData.name.trim().length > 0) {
        try {
          const existingPartners = await LoanPartner.filter({ 
            name: formData.name 
          });
          
          // If editing, exclude the current partner from the check
          const isDuplicate = existingPartners.some(p => p.id !== partner?.id);
          setNameExists(isDuplicate);
        } catch (error) {
          console.error('Error checking partner name:', error);
        }
      } else {
        setNameExists(false);
      }
    };

    const debounceTimer = setTimeout(checkName, 500);
    return () => clearTimeout(debounceTimer);
  }, [formData.name, partner?.id]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const handleLinkToUser = (user) => {
    setLinkedUser(user);
    setFormData(prev => ({
      ...prev,
      user_id: user.id,
      contact_person: user.first_name && user.last_name
        ? `${user.first_name} ${user.last_name}`
        : (prev.contact_person || ''),
      email: user.email || prev.email,
      phone: user.phone || prev.phone
    }));
    setShowUserSearch(false);
  };

  const handleUnlinkUser = () => {
    setLinkedUser(null);
    setFormData(prev => ({
      ...prev,
      user_id: ''
    }));
  };

  const handleInviteToPlatform = async () => {
    try {
      const name = formData.contact_person || formData.name || '';
      await base44.functions.invoke('emailService', {
        email_type: 'invite_loan_partner',
        recipient_email: formData.email,
        recipient_name: name,
        data: {
          first_name: name.split(' ')[0] || '',
          last_name: name.split(' ').slice(1).join(' ') || '',
          partner_type: formData.app_role || fixedRole || ''
        }
      });
    } catch (error) {
      console.error('Error sending invitation:', error);
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

  const handleAddressSelect = (addressData) => {
    setFormData(prev => ({
      ...prev,
      address_street: addressData.street,
      address_city: addressData.city,
      address_state: addressData.state,
      address_zip: addressData.zip
    }));
  };



  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (nameExists || Object.keys(errors).some(key => errors[key])) {
      if (toast) {
        toast({
          variant: "destructive",
          title: "Validation Error",
          description: "Please fix the errors before submitting.",
        });
      }
      return;
    }
    
    // Create a copy of formData to clean
    const cleanedData = { ...formData };
    delete cleanedData.type;
    
    // Convert empty string fields to null for database storage or API submission
    Object.keys(cleanedData).forEach(key => {
      if (cleanedData[key] === '') {
        cleanedData[key] = null;
      }
    });

    onSubmit(cleanedData);
  };

  return (
    <Card className="border-0 shadow-xl bg-white">
      <CardHeader className="pb-6">
        <CardTitle className="text-2xl font-bold text-slate-900">
          {partner ? 'Edit Loan Partner' : 'New Loan Partner'}
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
              <Label htmlFor="name">Partner Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="ABC Servicing Company"
                className={errors.name || nameExists ? 'border-red-500' : ''}
                required
              />
              {nameExists && (
                <div className="flex items-center gap-2 text-red-600 text-sm">
                  <AlertCircle className="w-4 h-4" />
                  <span>A partner with this name already exists</span>
                </div>
              )}
              {errors.name && (
                <p className="text-red-500 text-sm">{errors.name}</p>
              )}
            </div>

            {!fixedRole && (
              <div className="space-y-2">
                <Label htmlFor="app_role">Partner Type *</Label>
                <Select
                  value={formData.app_role}
                  onValueChange={(value) => handleInputChange('app_role', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select partner type" />
                  </SelectTrigger>
                  <SelectContent>
                    {LOAN_PARTNER_ROLES.map((role) => (
                      <SelectItem key={role} value={role}>
                        {role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email || ''}
                onChange={(e) => {
                  handleInputChange('email', e.target.value);
                  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                  if (e.target.value && !emailPattern.test(e.target.value)) {
                    setErrors(prev => ({ ...prev, email: 'Please enter a valid email address' }));
                  } else {
                    setErrors(prev => ({ ...prev, email: '' }));
                  }
                }}
                placeholder="contact@partner.com"
                className={errors.email ? 'border-red-500' : ''}
              />
              {errors.email && (
                <p className="text-red-500 text-xs mt-1">{errors.email}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={formData.phone || ''}
                onInput={handlePhoneInput}
                placeholder="(555) 123-4567"
                className={errors.phone ? 'border-red-500' : ''}
              />
              {errors.phone && (
                <p className="text-red-500 text-sm">{errors.phone}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact_person">Contact Person</Label>
              <Input
                id="contact_person"
                value={formData.contact_person || ''}
                onChange={(e) => handleInputChange('contact_person', e.target.value)}
                placeholder="John Smith"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                value={formData.website || ''}
                onChange={(e) => handleInputChange('website', e.target.value)}
                placeholder="https://www.partner.com"
              />
            </div>
          </div>

          {/* Address Section */}
          <div className="space-y-4 pt-4 border-t">
            <h3 className="font-semibold text-slate-900">Address</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2 space-y-2"> {/* Street Address takes full width on md and up */}
                <Label htmlFor="address_street">Street Address</Label>
                <AddressAutocomplete
                  id="address_street"
                  value={formData.address_street || ''}
                  onChange={(value) => handleInputChange('address_street', value)}
                  onAddressSelect={handleAddressSelect}
                  placeholder="123 Main Street"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address_unit">Unit/Suite</Label>
                <Input
                  id="address_unit"
                  value={formData.address_unit || ''}
                  onChange={(e) => handleInputChange('address_unit', e.target.value)}
                  placeholder="Suite 200"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address_city">City</Label>
                <Input
                  id="address_city"
                  value={formData.address_city || ''}
                  onChange={(e) => handleInputChange('address_city', e.target.value)}
                  placeholder="New York"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address_state">State</Label>
                <Select
                  value={formData.address_state || ''}
                  onValueChange={(value) => handleInputChange('address_state', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select state" />
                  </SelectTrigger>
                  <SelectContent>
                    {/* Map through US_STATES to populate the select options */}
                    {US_STATES.map(state => (
                      <SelectItem key={state.value} value={state.value}>
                        {state.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address_zip">ZIP Code</Label>
                <Input
                  id="address_zip"
                  value={formData.address_zip || ''}
                  onChange={(e) => handleInputChange('address_zip', e.target.value)}
                  placeholder="10001"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes || ''}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              placeholder="Any additional information..."
              className="h-32"
            />
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
              disabled={isProcessing || nameExists}
              className="bg-slate-900 hover:bg-slate-800"
            >
              <Save className="w-4 h-4 mr-2" />
              {isProcessing ? 'Saving...' : 'Save Partner'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
