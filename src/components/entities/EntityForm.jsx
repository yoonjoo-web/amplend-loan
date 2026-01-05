import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, X, Plus, Trash2 } from "lucide-react";
import { Borrower } from "@/entities/all";
import { US_STATES } from "../utils/usStates";
import AddressAutocomplete from "../shared/AddressAutocomplete";

export default function EntityForm({ entity, onSubmit, onCancel, isProcessing }) {
  const [formData, setFormData] = useState({
    entity_name: '',
    registration_number: '',
    entity_type: '',
    email: '',
    phone: '',
    address_street: '',
    address_unit: '',
    address_city: '',
    address_state: '',
    address_zip: '',
    ownership_structure: [],
    ...entity
  });
  
  const [borrowers, setBorrowers] = useState([]);

  useEffect(() => {
    loadBorrowers();
  }, []);

  const loadBorrowers = async () => {
    try {
      const data = await Borrower.list();
      setBorrowers(data);
    } catch (error) {
      console.error('Error loading borrowers:', error);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
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

  const [errors, setErrors] = useState({});

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

  const handleAddOwner = () => {
    const newOwner = {
      borrower_id: '',
      owner_name: '',
      title: '',
      ownership_percentage: 0
    };
    setFormData(prev => ({
      ...prev,
      ownership_structure: [...prev.ownership_structure, newOwner]
    }));
  };

  const handleRemoveOwner = (index) => {
    setFormData(prev => ({
      ...prev,
      ownership_structure: prev.ownership_structure.filter((_, i) => i !== index)
    }));
  };

  const handleOwnerChange = (index, field, value) => {
    const updated = [...formData.ownership_structure];
    updated[index] = { ...updated[index], [field]: value };
    
    // If borrower_id changes, auto-fill owner_name
    if (field === 'borrower_id' && value) {
      const borrower = borrowers.find(b => b.id === value);
      if (borrower) {
        updated[index].owner_name = `${borrower.first_name} ${borrower.last_name}`;
      }
    }
    
    setFormData(prev => ({ ...prev, ownership_structure: updated }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const cleanedData = { ...formData };
    
    // Convert empty strings to null
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
          {entity ? 'Edit Entity' : 'New Entity'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="entity_name">Entity Name *</Label>
              <Input
                id="entity_name"
                value={formData.entity_name}
                onChange={(e) => handleInputChange('entity_name', e.target.value)}
                placeholder="ABC Holdings LLC"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="entity_type">Entity Type</Label>
              <Select
                value={formData.entity_type}
                onValueChange={(value) => handleInputChange('entity_type', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select entity type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LLC">LLC</SelectItem>
                  <SelectItem value="Corporation">Corporation</SelectItem>
                  <SelectItem value="Partnership">Partnership</SelectItem>
                  <SelectItem value="Sole Proprietorship">Sole Proprietorship</SelectItem>
                  <SelectItem value="Trust">Trust</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="registration_number">EIN / Registration Number</Label>
              <Input
                id="registration_number"
                value={formData.registration_number}
                onInput={(e) => {
                  let value = e.target.value.replace(/\D/g, '');
                  if (value.length > 9) value = value.slice(0, 9);
                  
                  if (value.length >= 3) {
                    value = `${value.slice(0, 2)}-${value.slice(2)}`;
                  }
                  
                  handleInputChange('registration_number', value);
                }}
                placeholder="12-3456789"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
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
                placeholder="contact@entity.com"
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
                value={formData.phone}
                onInput={handlePhoneInput}
                placeholder="(555) 123-4567"
                className={errors.phone ? 'border-red-500' : ''}
              />
              {errors.phone && (
                <p className="text-red-500 text-xs mt-1">{errors.phone}</p>
              )}
            </div>
          </div>

          {/* Address Section */}
          <div className="space-y-4 pt-4 border-t">
            <h3 className="font-semibold text-slate-900">Address</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2 space-y-2">
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
                  value={formData.address_unit}
                  onChange={(e) => handleInputChange('address_unit', e.target.value)}
                  placeholder="Suite 200"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address_city">City</Label>
                <Input
                  id="address_city"
                  value={formData.address_city}
                  onChange={(e) => handleInputChange('address_city', e.target.value)}
                  placeholder="New York"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address_state">State</Label>
                <Select
                  value={formData.address_state || undefined}
                  onValueChange={(value) => handleInputChange('address_state', value)}
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
              </div>

              <div className="space-y-2">
                <Label htmlFor="address_zip">ZIP Code</Label>
                <Input
                  id="address_zip"
                  value={formData.address_zip}
                  onChange={(e) => handleInputChange('address_zip', e.target.value)}
                  placeholder="10001"
                />
              </div>
            </div>
          </div>

          {/* Ownership Structure */}
          <div className="space-y-4 pt-4 border-t">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-slate-900">Ownership Structure</h3>
              <Button type="button" variant="outline" size="sm" onClick={handleAddOwner}>
                <Plus className="w-4 h-4 mr-2" />
                Add Owner
              </Button>
            </div>

            {formData.ownership_structure.map((owner, index) => (
              <Card key={index} className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                  <div className="md:col-span-4 space-y-2">
                    <Label>Link to Borrower</Label>
                    <Select
                      value={owner.borrower_id || ''}
                      onValueChange={(value) => handleOwnerChange(index, 'borrower_id', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select borrower" />
                      </SelectTrigger>
                      <SelectContent>
                        {borrowers.map(borrower => (
                          <SelectItem key={borrower.id} value={borrower.id}>
                            {borrower.first_name} {borrower.last_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="md:col-span-3 space-y-2">
                    <Label>Owner Name</Label>
                    <Input
                      value={owner.owner_name}
                      onChange={(e) => handleOwnerChange(index, 'owner_name', e.target.value)}
                      placeholder="Full name"
                      required
                    />
                  </div>

                  <div className="md:col-span-2 space-y-2">
                    <Label>Title</Label>
                    <Input
                      value={owner.title || ''}
                      onChange={(e) => handleOwnerChange(index, 'title', e.target.value)}
                      placeholder="CEO"
                    />
                  </div>

                  <div className="md:col-span-2 space-y-2">
                    <Label>Ownership %</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={owner.ownership_percentage}
                      onChange={(e) => handleOwnerChange(index, 'ownership_percentage', parseFloat(e.target.value))}
                      required
                    />
                  </div>

                  <div className="md:col-span-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveOwner(index)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}

            {formData.ownership_structure.length === 0 && (
              <p className="text-sm text-slate-500 text-center py-4">
                No owners added yet. Click "Add Owner" to get started.
              </p>
            )}
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
              {isProcessing ? 'Saving...' : 'Save Entity'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}