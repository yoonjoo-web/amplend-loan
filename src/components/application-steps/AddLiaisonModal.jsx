import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Search, UserPlus, Loader2 } from 'lucide-react';
import { Loan, LoanApplication, LoanPartner } from '@/entities/all';
import { useToast } from '@/components/ui/use-toast';
import { normalizeAppRole } from '@/components/utils/appRoles';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { base44 } from '@/api/base44Client';

const coBorrowerMatches = (coBorrowers, borrowerAccessIds) => {
  if (!Array.isArray(coBorrowers) || coBorrowers.length === 0) return false;
  return coBorrowers.some((cb) =>
    borrowerAccessIds.includes(cb.user_id) || borrowerAccessIds.includes(cb.borrower_id)
  );
};

const resolveBorrowerAccessIds = (applicationData, permissions) => {
  if (permissions?.borrowerAccessIds?.length) {
    return permissions.borrowerAccessIds;
  }

  const ids = new Set();
  if (applicationData?.primary_borrower_id) ids.add(applicationData.primary_borrower_id);
  if (Array.isArray(applicationData?.co_borrowers)) {
    applicationData.co_borrowers.forEach((cb) => {
      if (cb?.borrower_id) ids.add(cb.borrower_id);
      if (cb?.user_id) ids.add(cb.user_id);
    });
  }
  return Array.from(ids);
};

const resolvePartnerName = (partner, fallbackId) => {
  const name = partner?.name || partner?.contact_person;
  const email = partner?.email;
  return [name, email, fallbackId].find(Boolean) || 'Unknown Liaison';
};

const resolvePartnerRole = (partner) => {
  return normalizeAppRole(partner?.app_role || partner?.type || '') || 'Loan Partner';
};

export default function AddLiaisonModal({
  isOpen,
  onClose,
  applicationData,
  onAddLiaison,
  permissions
}) {
  const { toast } = useToast();
  const [view, setView] = useState('options');
  const [isLoading, setIsLoading] = useState(false);
  const [partners, setPartners] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: ''
  });

  const canUseGlobalLiaisonList = Boolean(
    permissions?.isPlatformAdmin || permissions?.isAdministrator || permissions?.isLoanOfficer
  );

  const existingLiaisonIds = useMemo(() => {
    return Array.isArray(applicationData?.liaison_ids) ? applicationData.liaison_ids : [];
  }, [applicationData?.liaison_ids]);

  useEffect(() => {
    if (!isOpen) return;
    setView('options');
    setSearchTerm('');
    setInviteForm({
      first_name: '',
      last_name: '',
      email: '',
      phone: ''
    });
    loadLiaisons();
  }, [isOpen]);

  const loadLiaisons = async () => {
    setIsLoading(true);
    try {
      if (canUseGlobalLiaisonList) {
        const loanPartnersData = await LoanPartner.list('-created_date').catch(() => []);
        const results = (loanPartnersData || [])
          .filter((partner) => resolvePartnerRole(partner) === 'Liaison')
          .map((partner) => ({
            id: partner?.id,
            partner,
            name: resolvePartnerName(partner, partner?.id),
            role: 'Liaison',
            email: partner?.email || null,
            phone: partner?.phone || null,
          }));
        setPartners(results);
      } else {
        const borrowerAccessIds = resolveBorrowerAccessIds(applicationData, permissions);

        const [loanPartnersData, loansData, applicationsData] = await Promise.all([
          LoanPartner.list('-created_date').catch(() => []),
          Loan.list('-created_date').catch(() => []),
          LoanApplication.list('-created_date').catch(() => [])
        ]);

        const relevantLoans = (loansData || []).filter((loan) =>
          (loan.borrower_ids || []).some((id) => borrowerAccessIds.includes(id))
        );
        const relevantApplications = (applicationsData || []).filter((app) =>
          borrowerAccessIds.includes(app.primary_borrower_id) || coBorrowerMatches(app.co_borrowers, borrowerAccessIds)
        );

        const partnerById = new Map();
        (loanPartnersData || []).forEach((partner) => {
          if (partner?.id) partnerById.set(partner.id, partner);
          if (partner?.user_id) partnerById.set(partner.user_id, partner);
        });

        const statsMap = new Map();

        const registerPartner = (partnerId) => {
          if (!partnerId) return;
          const partner = partnerById.get(partnerId);
          const key = partner?.id || partnerId;
          const existing = statsMap.get(key) || {
            id: key,
            partner,
            name: resolvePartnerName(partner, partnerId),
            role: resolvePartnerRole(partner),
            email: partner?.email || null,
            phone: partner?.phone || null,
          };
          statsMap.set(key, existing);
        };

        relevantLoans.forEach((loan) => {
          const ids = Array.from(new Set(loan.referrer_ids || []));
          ids.forEach((id) => registerPartner(id));
        });

        relevantApplications.forEach((app) => {
          const ids = Array.from(new Set(app.referrer_ids || []));
          ids.forEach((id) => registerPartner(id));
        });

        const results = Array.from(statsMap.values())
          .filter((partner) => partner.role === 'Liaison');
        setPartners(results);
      }
    } catch (error) {
      console.error('Error loading liaisons:', error);
      setPartners([]);
    }
    setIsLoading(false);
  };

  const filteredPartners = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    return partners.filter((partner) => {
      if (!needle) return true;
      return [
        partner.name,
        partner.email,
        partner.phone
      ].some((value) => String(value || '').toLowerCase().includes(needle));
    });
  }, [partners, searchTerm]);

  const handleSelectPartner = (partner) => {
    const targetId = partner?.partner?.user_id || partner?.partner?.id || partner?.id;
    if (!targetId) return;
    onAddLiaison(targetId);
    onClose();
  };

  const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleInviteChange = (field, value) => {
    setInviteForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleInviteSubmit = async (e) => {
    e.preventDefault();
    if (!inviteForm.first_name || !inviteForm.last_name || !inviteForm.email) {
      toast({
        variant: 'destructive',
        title: 'Missing required fields',
        description: 'First name, last name, and email are required.'
      });
      return;
    }
    if (!validateEmail(inviteForm.email)) {
      toast({
        variant: 'destructive',
        title: 'Invalid email',
        description: 'Please enter a valid email address.'
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const fullName = `${inviteForm.first_name} ${inviteForm.last_name}`.trim();
      const partnerData = {
        app_role: 'Liaison',
        name: fullName,
        contact_person: fullName,
        email: inviteForm.email,
        phone: inviteForm.phone
      };

      const createdPartner = await base44.entities.LoanPartner.create(partnerData);

      try {
        await base44.functions.invoke('emailService', {
          email_type: 'invite_loan_partner',
          recipient_email: inviteForm.email,
          recipient_name: fullName,
          data: {
            first_name: inviteForm.first_name,
            last_name: inviteForm.last_name,
            partner_type: 'Liaison'
          }
        });
      } catch (emailError) {
        console.error('Error sending liaison invitation:', emailError);
      }

      toast({
        title: 'Liaison Invited',
        description: `Invitation sent to ${inviteForm.email}.`
      });

      const targetId = createdPartner?.user_id || createdPartner?.id;
      if (targetId) {
        onAddLiaison(targetId);
      }
      onClose();
    } catch (error) {
      console.error('Error inviting liaison:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error?.message || 'Failed to invite liaison. Please try again.'
      });
    }
    setIsSubmitting(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Add Liaison</DialogTitle>
          <DialogDescription>
            {canUseGlobalLiaisonList
              ? 'Invite a new liaison or select an existing one.'
              : 'Invite a new liaison or select an existing one from My Partners.'}
          </DialogDescription>
        </DialogHeader>

        {view === 'options' && (
          <div className="grid grid-cols-2 gap-4 py-4">
            <Button
              variant="outline"
              className="h-24 flex-col gap-2"
              onClick={() => setView('search')}
              disabled={isLoading}
            >
              <Search className="w-6 h-6" />
              <span>Search Existing</span>
            </Button>
            <Button
              variant="outline"
              className="h-24 flex-col gap-2"
              onClick={() => setView('invite')}
              disabled={isLoading}
            >
              <UserPlus className="w-6 h-6" />
              <span>Invite New</span>
            </Button>
          </div>
        )}

        {view === 'search' && (
          <div className="space-y-4">
            <Command>
              <CommandInput
                placeholder="Search liaisons..."
                value={searchTerm}
                onValueChange={setSearchTerm}
              />
              <CommandList>
                <CommandEmpty>
                  {isLoading ? 'Loading liaisons...' : 'No liaisons found.'}
                </CommandEmpty>
                <CommandGroup>
                  {filteredPartners
                    .filter((partner) => {
                      const targetId = partner?.partner?.user_id || partner?.partner?.id || partner?.id;
                      return !existingLiaisonIds.includes(targetId);
                    })
                    .map((partner) => (
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

        {view === 'invite' && (
          <form onSubmit={handleInviteSubmit} className="space-y-4 py-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="liaison_first_name">First Name *</Label>
                <Input
                  id="liaison_first_name"
                  value={inviteForm.first_name}
                  onChange={(e) => handleInviteChange('first_name', e.target.value)}
                  placeholder="First name"
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="liaison_last_name">Last Name *</Label>
                <Input
                  id="liaison_last_name"
                  value={inviteForm.last_name}
                  onChange={(e) => handleInviteChange('last_name', e.target.value)}
                  placeholder="Last name"
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="liaison_email">Email *</Label>
                <Input
                  id="liaison_email"
                  type="email"
                  value={inviteForm.email}
                  onChange={(e) => handleInviteChange('email', e.target.value)}
                  placeholder="email@example.com"
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="liaison_phone">Phone</Label>
                <Input
                  id="liaison_phone"
                  type="tel"
                  value={inviteForm.phone}
                  onChange={(e) => handleInviteChange('phone', e.target.value)}
                  placeholder="(000) 000-0000"
                  disabled={isSubmitting}
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setView('options')} disabled={isSubmitting}>
                Back
              </Button>
              <Button type="submit" disabled={isSubmitting} className="bg-slate-700 hover:bg-slate-800">
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  'Send Invitation'
                )}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
