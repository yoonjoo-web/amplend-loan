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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

export default function AddContactModal({ isOpen, onClose, contactType, onSave }) {
  const { toast } = useToast();
  const [view, setView] = useState('options');
  const [partners, setPartners] = useState([]);
  const [filteredPartners, setFilteredPartners] = useState([]);
  const [manualData, setManualData] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [emailError, setEmailError] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadPartners();
      setManualData({});
      setView('options');
      setEmailError('');
    }
  }, [isOpen, contactType]);

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

  const loadPartners = async () => {
    try {
      const allPartners = await LoanPartner.list();
      const typeMap = {
        insurance_agent: 'Insurance Provider',
        title_escrow: 'Title Company',
        buyer_attorney: 'Legal Counsel',
        seller_attorney: 'Legal Counsel',
        referral_broker: 'Referral Partner'
      };
      const filtered = allPartners.filter(p => p.type === typeMap[contactType]);
      setPartners(filtered);
      setFilteredPartners(filtered);
    } catch (error) {
      console.error('Error loading partners:', error);
    }
  };

  const handleSelectPartner = (partner) => {
    const data = {};
    switch (contactType) {
      case 'insurance_agent':
        data.name = partner.contact_person || partner.name;
        data.email = partner.email;
        data.phone = partner.phone;
        data.company = partner.name;
        break;
      case 'title_escrow':
        data.company = partner.name;
        data.address = `${partner.address_street || ''} ${partner.address_city || ''} ${partner.address_state || ''} ${partner.address_zip || ''}`.trim();
        data.contact_person = partner.contact_person;
        data.email = partner.email;
        data.phone = partner.phone;
        break;
      case 'buyer_attorney':
      case 'seller_attorney':
        data.name = partner.contact_person || partner.name;
        data.email = partner.email;
        data.phone = partner.phone;
        data.firm = partner.name;
        break;
      case 'referral_broker':
        data.contact = partner.contact_person || partner.name;
        data.email = partner.email;
        data.phone = partner.phone;
        data.company = partner.name;
        break;
    }
    onSave(contactType, data);
    onClose();
  };

  const handleManualSave = async () => {
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
      // Create LoanPartner in the Contacts page
      const typeMap = {
        insurance_agent: 'Insurance Provider',
        title_escrow: 'Title Company',
        buyer_attorney: 'Legal Counsel',
        seller_attorney: 'Legal Counsel',
        referral_broker: 'Referral Partner'
      };

      const partnerData = {
        type: typeMap[contactType],
        email: manualData.email,
        phone: manualData.phone
      };

      // Map contact-specific fields to LoanPartner fields
      switch (contactType) {
        case 'insurance_agent':
          partnerData.name = manualData.company || manualData.name;
          partnerData.contact_person = manualData.name;
          break;
        case 'title_escrow':
          partnerData.name = manualData.company;
          partnerData.contact_person = manualData.contact_person;
          // Parse address if provided
          if (manualData.address) {
            partnerData.address_street = manualData.address;
          }
          break;
        case 'buyer_attorney':
        case 'seller_attorney':
          partnerData.name = manualData.firm || manualData.name;
          partnerData.contact_person = manualData.name;
          break;
        case 'referral_broker':
          partnerData.name = manualData.company || manualData.contact;
          partnerData.contact_person = manualData.contact;
          break;
      }

      // Create the contact in LoanPartner entity
      await base44.entities.LoanPartner.create(partnerData);

      toast({
        title: "Contact Created",
        description: "Contact has been added successfully and is now available in the Contacts page.",
      });

      onSave(contactType, manualData);
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

  const renderManualFields = () => {
    switch (contactType) {
      case 'insurance_agent':
        return (
          <>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Name</Label>
              <Input
                value={manualData.name || ''}
                onChange={(e) => setManualData({...manualData, name: e.target.value})}
                className="h-9 text-sm"
                placeholder="Contact person name"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Company</Label>
              <Input
                value={manualData.company || ''}
                onChange={(e) => setManualData({...manualData, company: e.target.value})}
                className="h-9 text-sm"
                placeholder="Insurance company name"
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
      case 'title_escrow':
        return (
          <>
            <div className="space-y-1.5 md:col-span-2">
              <Label className="text-xs font-medium">Company</Label>
              <Input
                value={manualData.company || ''}
                onChange={(e) => setManualData({...manualData, company: e.target.value})}
                className="h-9 text-sm"
                placeholder="Title company name"
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label className="text-xs font-medium">Address</Label>
              <AddressAutocomplete
                id="title_address"
                value={manualData.address || ''}
                onChange={(newValue) => setManualData({...manualData, address: newValue})}
                onAddressSelect={(addressData) => {
                  const fullAddress = [
                    addressData.street,
                    addressData.city,
                    addressData.state,
                    addressData.zip
                  ].filter(Boolean).join(', ');
                  setManualData({...manualData, address: fullAddress});
                }}
                placeholder="Start typing address..."
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Contact Person</Label>
              <Input
                value={manualData.contact_person || ''}
                onChange={(e) => setManualData({...manualData, contact_person: e.target.value})}
                className="h-9 text-sm"
                placeholder="Contact name"
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
      case 'buyer_attorney':
      case 'seller_attorney':
        return (
          <>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Name</Label>
              <Input
                value={manualData.name || ''}
                onChange={(e) => setManualData({...manualData, name: e.target.value})}
                className="h-9 text-sm"
                placeholder="Attorney name"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Law Firm</Label>
              <Input
                value={manualData.firm || ''}
                onChange={(e) => setManualData({...manualData, firm: e.target.value})}
                className="h-9 text-sm"
                placeholder="Law firm name"
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
      case 'referral_broker':
        return (
          <>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Contact Name</Label>
              <Input
                value={manualData.contact || ''}
                onChange={(e) => setManualData({...manualData, contact: e.target.value})}
                className="h-9 text-sm"
                placeholder="Contact person name"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Company</Label>
              <Input
                value={manualData.company || ''}
                onChange={(e) => setManualData({...manualData, company: e.target.value})}
                className="h-9 text-sm"
                placeholder="Company name"
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
      default:
        return null;
    }
  };

  const getContactLabel = () => {
    const labels = {
      insurance_agent: 'Insurance Agent',
      title_escrow: 'Title/Escrow Company',
      buyer_attorney: "Buyer's Attorney",
      seller_attorney: "Seller's Attorney",
      referral_broker: 'Referral/Broker'
    };
    return labels[contactType] || 'Contact';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add {getContactLabel()}</DialogTitle>
          <DialogDescription>
            Search from existing contacts or add manually
          </DialogDescription>
        </DialogHeader>

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
            <Button variant="link" onClick={() => setView('options')}>Back</Button>
          </div>
        )}

        {view === 'manual' && (
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {renderManualFields()}
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="outline" onClick={() => setView('options')} disabled={isSaving}>
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