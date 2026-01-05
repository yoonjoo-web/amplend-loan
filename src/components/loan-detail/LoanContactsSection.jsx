import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Mail, Phone, Building2, X } from "lucide-react";

import AddContactModal from "./AddContactModal";

export default function LoanContactsSection({ loan, onUpdate }) {
  const [contacts, setContacts] = useState(loan.loan_contacts || {});
  const [showModal, setShowModal] = useState(false);
  const [selectedContactType, setSelectedContactType] = useState('');

  useEffect(() => {
    setContacts(loan.loan_contacts || {});
  }, [loan.loan_contacts]);

  const handleAddContact = (type) => {
    setSelectedContactType(type);
    setShowModal(true);
  };

  const handleSaveContact = async (type, data) => {
    const updatedContacts = { ...contacts, [type]: data };
    setContacts(updatedContacts);
    await onUpdate({ loan_contacts: updatedContacts });
  };

  const handleRemoveContact = async (type) => {
    const updatedContacts = { ...contacts };
    delete updatedContacts[type];
    setContacts(updatedContacts);
    await onUpdate({ loan_contacts: updatedContacts });
  };

  const ContactCard = ({ type, label, data }) => {
    if (!data || Object.keys(data).length === 0) {
      return (
        <div className="border border-dashed border-slate-300 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-slate-700">{label}</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleAddContact(type)}
            className="w-full"
          >
            <Plus className="w-3 h-3 mr-1" />
            Add {label}
          </Button>
        </div>
      );
    }

    return (
      <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
        <div className="flex items-start justify-between mb-2">
          <span className="text-sm font-semibold text-slate-700">{label}</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => handleRemoveContact(type)}
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
        <div className="space-y-2">
          {data.name && (
            <p className="text-sm font-medium text-slate-900">{data.name}</p>
          )}
          {data.contact && (
            <p className="text-sm font-medium text-slate-900">{data.contact}</p>
          )}
          {data.contact_person && (
            <p className="text-sm font-medium text-slate-900">{data.contact_person}</p>
          )}
          {data.company && (
            <div className="flex items-center gap-1 text-xs text-slate-600">
              <Building2 className="w-3 h-3" />
              <span>{data.company}</span>
            </div>
          )}
          {data.firm && (
            <div className="flex items-center gap-1 text-xs text-slate-600">
              <Building2 className="w-3 h-3" />
              <span>{data.firm}</span>
            </div>
          )}
          {data.email && (
            <div className="flex items-center gap-1 text-xs text-slate-600">
              <Mail className="w-3 h-3" />
              <span>{data.email}</span>
            </div>
          )}
          {data.phone && (
            <div className="flex items-center gap-1 text-xs text-slate-600">
              <Phone className="w-3 h-3" />
              <span>{data.phone}</span>
            </div>
          )}
          {data.address && (
            <p className="text-xs text-slate-600">{data.address}</p>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Loan Contacts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <ContactCard
            type="insurance_agent"
            label="Insurance Agent"
            data={contacts.insurance_agent}
          />
          <ContactCard
            type="title_escrow"
            label="Title/Escrow"
            data={contacts.title_escrow}
          />
          <ContactCard
            type="buyer_attorney"
            label="Buyer's Attorney"
            data={contacts.buyer_attorney}
          />
          <ContactCard
            type="seller_attorney"
            label="Seller's Attorney"
            data={contacts.seller_attorney}
          />
          <ContactCard
            type="referral_broker"
            label="Referral/Broker"
            data={contacts.referral_broker}
          />
        </CardContent>
      </Card>

      <AddContactModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        contactType={selectedContactType}
        onSave={handleSaveContact}
      />
    </>
  );
}