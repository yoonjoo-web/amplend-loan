import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, UserPlus, Loader2 } from "lucide-react";
import { LoanPartner } from "@/entities/all";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import AddressAutocomplete from "../shared/AddressAutocomplete";
import { LOAN_PARTNER_ROLES, normalizeAppRole } from "@/components/utils/appRoles";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

export default function AddContactModal({ isOpen, onClose, contactRole, onSave }) {
  const { toast } = useToast();
  const [view, setView] = useState('options');
  const [partners, setPartners] = useState([]);
  const [filteredPartners, setFilteredPartners] = useState([]);
  const [manualData, setManualData] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [selectedRole, setSelectedRole] = useState(contactRole || '');

  useEffect(() => {
    if (isOpen) {
      setSelectedRole(contactRole || '');
      if (contactRole) {
        loadPartners(contactRole);
        setView('options');
      } else {
        setView('role');
      }
      setManualData({});
      setEmailError('');
    }
  }, [isOpen, contactRole]);

  const formatPhoneNumber = (value) => {
    if (!value) return '';
    const cleaned = value.replace(/\D/g, '');
    const match = cleaned.match(/^(\d{0,3})(\d{0,3})(\d{0,4})$/);
    if (!match) return value;
    
    let formatted = '';
    if (match[1]) formatted = `(${match[1]}`;
    if (match[1].length === 3) formatted += ') ';
    if (match[2]) formatted += match[2];
    if (match[2].length === 3) formatted += '-';
    if (match[3]) formatted += match[3];
    
    return formatted;
  };

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handlePhoneChange = (value) => {
    const formatted = formatPhoneNumber(value);
    setManualData({...manualData, phone: formatted});
  };

  const handleEmailChange = (value) => {
    setManualData({...manualData, email: value});
    if (value && !validateEmail(value)) {
      setEmailError('Please enter a valid email address');
    } else {
      setEmailError('');
    }
  };

  const loadPartners = async (role) => {
    try {
      const allPartners = await LoanPartner.list();
      const normalizedRole = normalizeAppRole(role);
      const filtered = allPartners.filter(p => normalizeAppRole(p.app_role || p.type) === normalizedRole);
      setPartners(filtered);
      setFilteredPartners(filtered);
    } catch (error) {
      console.error('Error loading partners:', error);
    }
  };

  const handleSelectPartner = (partner) => {
    const data = {
      contact_person: partner.contact_person || '',
      name: partner.contact_person || partner.name,
      company: partner.name,
      email: partner.email,
      phone: partner.phone,
      address: [partner.address_street, partner.address_city, partner.address_state, partner.address_zip]
        .filter(Boolean)
        .join(', ')
    };
    onSave(toRoleKey(selectedRole), data);
    onClose();
  };

  const handleManualSave = async () => {
    if (!selectedRole) {
      toast({
        variant: "destructive",
        title: "Select a role",
        description: "Choose a loan partner role before saving."
      });
      return;
    }
    // Validate email if provided
    if (manualData.email && !validateEmail(manualData.email)) {
      toast({
        variant: "destructive",
        title: "Invalid Email",
        description: "Please enter a valid email address.",
      });
      return;
    }

    setIsSaving(true);
    try {
      const partnerData = {
        app_role: selectedRole,
        email: manualData.email,
        phone: manualData.phone
      };

      partnerData.name = manualData.company || manualData.name || manualData.contact_person;
      partnerData.contact_person = manualData.contact_person || manualData.name;
      if (manualData.address) {
        partnerData.address_street = manualData.address;
      }

      // Create the contact in LoanPartner entity
      await base44.entities.LoanPartner.create(partnerData);

      toast({
        title: "Contact Created",
        description: "Contact has been added successfully and is now available in the Contacts page.",
      });

      onSave(toRoleKey(selectedRole), manualData);
      onClose();
    } catch (error) {
      console.error('Error creating contact:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to create contact. Please try again.",
      });
    }
    setIsSaving(false);
  };

  const renderManualFields = () => (
    <>
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Contact Person</Label>
        <Input
          value={manualData.contact_person || manualData.name || ''}
          onChange={(e) => setManualData({ ...manualData, contact_person: e.target.value, name: e.target.value })}
          className="h-9 text-sm"
          placeholder="Contact person name"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Company</Label>
        <Input
          value={manualData.company || ''}
          onChange={(e) => setManualData({ ...manualData, company: e.target.value })}
          className="h-9 text-sm"
          placeholder="Company name"
        />
      </div>
      <div className="space-y-1.5 md:col-span-2">
        <Label className="text-xs font-medium">Address</Label>
        <AddressAutocomplete
          id="partner_address"
          value={manualData.address || ''}
          onChange={(newValue) => setManualData({ ...manualData, address: newValue })}
          onAddressSelect={(addressData) => {
            const fullAddress = [
              addressData.street,
              addressData.city,
              addressData.state,
              addressData.zip
            ].filter(Boolean).join(', ');
            setManualData({ ...manualData, address: fullAddress });
          }}
          placeholder="Start typing address..."
          className="h-9 text-sm"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Email</Label>
        <Input
          type="email"
          value={manualData.email || ''}
          onChange={(e) => handleEmailChange(e.target.value)}
          className={`h-9 text-sm ${emailError ? 'border-red-500' : ''}`}
          placeholder="email@example.com"
        />
        {emailError && <p className="text-xs text-red-500 mt-1">{emailError}</p>}
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Phone</Label>
        <Input
          type="tel"
          value={manualData.phone || ''}
          onChange={(e) => handlePhoneChange(e.target.value)}
          className="h-9 text-sm"
          placeholder="(000) 000-0000"
          maxLength={14}
        />
      </div>
    </>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add Loan Partner Contact</DialogTitle>
          <DialogDescription>
            {selectedRole ? `Role: ${selectedRole}` : 'Select a loan partner role to continue.'}
          </DialogDescription>
        </DialogHeader>

        {view === 'role' && (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Loan Partner Role</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {LOAN_PARTNER_ROLES.map((role) => (
                  <Button
                    key={role}
                    variant="outline"
                    onClick={() => {
                      setSelectedRole(role);
                      loadPartners(role);
                      setView('options');
                    }}
                  >
                    {role}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        )}

        {view === 'options' && (
          <div className="grid grid-cols-2 gap-4 py-4">
            <Button
              variant="outline"
              className="h-24 flex-col gap-2"
              onClick={() => setView('search')}
            >
              <Search className="w-6 h-6" />
              <span>Search Existing</span>
            </Button>
            <Button
              variant="outline"
              className="h-24 flex-col gap-2"
              onClick={() => setView('manual')}
            >
              <UserPlus className="w-6 h-6" />
              <span>Add Manually</span>
            </Button>
          </div>
        )}

        {view === 'search' && (
          <div className="space-y-4">
            <Command>
              <CommandInput placeholder="Search contacts..." />
              <CommandList>
                <CommandEmpty>No contacts found.</CommandEmpty>
                <CommandGroup>
                  {filteredPartners.map((partner) => (
                    <CommandItem
                      key={partner.id}
                      onSelect={() => handleSelectPartner(partner)}
                      className="cursor-pointer"
                    >
                      <div className="flex-1">
                        <p className="font-semibold">{partner.name}</p>
                        <div className="flex gap-4 mt-1 text-xs text-slate-500">
                          {partner.email && <span>{partner.email}</span>}
                          {partner.phone && <span>{partner.phone}</span>}
                        </div>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
            <Button variant="link" onClick={() => setView(selectedRole ? 'options' : 'role')}>Back</Button>
          </div>
        )}

        {view === 'manual' && (
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {renderManualFields()}
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="outline" onClick={() => setView(selectedRole ? 'options' : 'role')} disabled={isSaving}>
                Back
              </Button>
              <Button onClick={handleManualSave} disabled={isSaving} className="bg-slate-700 hover:bg-slate-800">
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Contact'
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

const toRoleKey = (role) => role.toLowerCase().replace(/\s+/g, '_');
