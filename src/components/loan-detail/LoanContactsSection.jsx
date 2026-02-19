import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Mail, Phone, Building2, X } from "lucide-react";
import { LOAN_PARTNER_ROLES } from "@/components/utils/appRoles";

import AddContactModal from "./AddContactModal";

export default function LoanContactsSection({ loan, onUpdate, readOnly = false }) {
  const [contacts, setContacts] = useState(loan.loan_contacts || {});
  const [showModal, setShowModal] = useState(false);
  const [selectedContactRole, setSelectedContactRole] = useState('');

  useEffect(() => {
    const normalized = normalizeLoanContacts(loan.loan_contacts || {});
    setContacts(normalized.contacts);
    if (normalized.changed && !readOnly) {
      onUpdate({ loan_contacts: normalized.contacts });
    }
  }, [loan.loan_contacts]);

  const handleAddContact = () => {
    if (readOnly) return;
    setSelectedContactRole('');
    setShowModal(true);
  };

  const handleSaveContact = async (roleKey, data) => {
    if (readOnly) return;
    const updatedContacts = { ...contacts, [roleKey]: data };
    setContacts(updatedContacts);
    await onUpdate({ loan_contacts: updatedContacts });
  };

  const handleRemoveContact = async (type) => {
    if (readOnly) return;
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
          {readOnly ? (
            <p className="text-xs text-slate-500">No contact provided.</p>
          ) : (
            <p className="text-xs text-slate-500">No contact provided.</p>
          )}
        </div>
      );
    }

    return (
      <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
        <div className="flex items-start justify-between mb-2">
          <span className="text-sm font-semibold text-slate-700">{label}</span>
          {!readOnly && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => handleRemoveContact(type)}
            >
              <X className="w-3 h-3" />
            </Button>
          )}
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
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Loan Contacts</CardTitle>
            {!readOnly && (
              <Button size="sm" onClick={handleAddContact}>
                <Plus className="w-4 h-4 mr-2" />
                Add Loan Partner Contact
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {LOAN_PARTNER_ROLES.map((role) => {
            const roleKey = toRoleKey(role);
            return (
              <ContactCard
                key={role}
                type={roleKey}
                label={role}
                data={contacts[roleKey]}
              />
            );
          })}
        </CardContent>
      </Card>

      {!readOnly && (
        <AddContactModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          contactRole={selectedContactRole}
          onSave={handleSaveContact}
        />
      )}
    </>
  );
}

const toRoleKey = (role) => role.toLowerCase().replace(/\s+/g, '_');

const normalizeLoanContacts = (rawContacts) => {
  const contacts = { ...(rawContacts || {}) };
  const nextContacts = {};
  let changed = false;

  LOAN_PARTNER_ROLES.forEach((role) => {
    const key = toRoleKey(role);
    if (contacts[key]) {
      nextContacts[key] = contacts[key];
    }
  });

  if (!nextContacts.insurance_company && contacts.insurance_agent) {
    nextContacts.insurance_company = contacts.insurance_agent;
    changed = true;
  }
  if (!nextContacts.title_company && contacts.title_escrow) {
    nextContacts.title_company = contacts.title_escrow;
    changed = true;
  }
  if (!nextContacts.broker && contacts.referral_broker) {
    nextContacts.broker = contacts.referral_broker;
    changed = true;
  }
  if (!nextContacts.referral_partner && contacts.referral_broker) {
    nextContacts.referral_partner = nextContacts.referral_partner || contacts.referral_broker;
  }

  return { contacts: nextContacts, changed };
};
