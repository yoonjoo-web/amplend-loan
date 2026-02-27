import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Building2,
  Users,
  Briefcase,
  Edit,
  Calendar,
  DollarSign,
  CreditCard,
  FileText,
  Home,
  Percent,
  TrendingUp,
  Globe,
  User as UserIcon,
  Plus,
  UserPlus,
  Trash2,
  Loader2
} from "lucide-react";
import { motion } from "framer-motion";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";
import { LOAN_PARTNER_ROLES, normalizeAppRole } from "@/components/utils/appRoles";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical } from "lucide-react";
import AddFieldModal from "../components/contacts/AddFieldModal";
import { useToast } from "@/components/ui/use-toast";
import { usePermissions } from "@/components/hooks/usePermissions";
import PropagateProfileChangesModal from "../components/shared/PropagateProfileChangesModal";
import { DEFAULT_INVITE_FIELDS, getBorrowerInvitationFields, resolveBorrowerInviteFields } from "@/components/utils/borrowerInvitationFields";
import { getLocalBorrowerInvite, setLocalBorrowerInvite } from "@/components/utils/borrowerInvitationStorage";

const InfoItem = ({ icon: Icon, label, value, href, isEmail, isPhone }) => {
  if (!value) return null;

  const content = (
    <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors">
      <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
        <Icon className="w-5 h-5 text-slate-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-500 mb-0.5">{label}</p>
        <p className="font-medium text-slate-900 truncate">{value}</p>
      </div>
    </div>
  );

  if (isEmail) {
    return <a href={`mailto:${value}`} className="block">{content}</a>;
  }
  if (isPhone) {
    return <a href={`tel:${value}`} className="block">{content}</a>;
  }
  if (href) {
    return <a href={href} target="_blank" rel="noopener noreferrer" className="block">{content}</a>;
  }

  return content;
};

const AddCoOwnerModal = ({ isOpen, onClose, onSave, allBorrowers, toast }) => {
  // Removed 'owner_name' state
  const [ownership_percentage, setOwnershipPercentage] = useState("");
  const [borrower_id, setBorrowerId] = useState("");
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteData, setInviteData] = useState({ email: '', first_name: '', last_name: '' });
  const [isProcessingInvite, setIsProcessingInvite] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setOwnershipPercentage("");
      setBorrowerId("");
      setShowInviteForm(false);
      setInviteData({ email: '', first_name: '', last_name: '' });
    }
  }, [isOpen]);

  const handleSave = () => {
    if (!borrower_id || ownership_percentage === "" || isNaN(parseFloat(ownership_percentage))) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Please select a borrower and provide a valid ownership percentage.",
      });
      return;
    }
    
    const selectedBorrower = allBorrowers.find(b => b.id === borrower_id);
    const owner_name = selectedBorrower 
      ? `${selectedBorrower.first_name} ${selectedBorrower.last_name}`
      : '';

    onSave({
      owner_name: owner_name,
      ownership_percentage: parseFloat(ownership_percentage),
      borrower_id: borrower_id,
    });
    onClose();
  };

  const handleSendInvite = async () => {
    if (!inviteData.email || !inviteData.first_name || !inviteData.last_name) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Please fill in all invitation fields.",
      });
      return;
    }

    setIsProcessingInvite(true);
    try {
      const isBroker = currentUser?.app_role === 'Broker';
      await base44.functions.invoke('emailService', {
        email_type: isBroker ? 'invite_borrower_broker' : 'invite_borrower',
        recipient_email: inviteData.email,
        recipient_name: `${inviteData.first_name} ${inviteData.last_name}`,
        data: {
          first_name: inviteData.first_name,
          last_name: inviteData.last_name,
          ...(isBroker ? { broker_name: currentUser?.full_name || `${currentUser?.first_name || ''} ${currentUser?.last_name || ''}`.trim() || 'Your broker' } : {})
        }
      });

      toast({
        title: "Invitation Sent",
        description: `Invitation email sent to ${inviteData.email}. They will need to create an account before you can link them.`,
      });
      setShowInviteForm(false);
      setInviteData({ email: '', first_name: '', last_name: '' });
    } catch (error) {
      console.error('Error sending invitation:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to send invitation",
      });
    } finally {
      setIsProcessingInvite(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Co-Owner</DialogTitle>
          <DialogDescription>
            Add a new co-owner to the entity's ownership structure.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6 py-4">
          {!showInviteForm ? (
            <>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="borrower_id">Link Borrower *</Label>
                  <Select
                    value={borrower_id}
                    onValueChange={(value) => {
                      setBorrowerId(value);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select existing borrower" />
                    </SelectTrigger>
                    <SelectContent>
                      {allBorrowers.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.first_name} {b.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ownership_percentage">Ownership Percentage (%) *</Label>
                  <Input
                    id="ownership_percentage"
                    type="number"
                    value={ownership_percentage}
                    onChange={(e) => setOwnershipPercentage(e.target.value)}
                    placeholder="e.g., 50"
                    min="0"
                    max="100"
                    step="0.01"
                  />
                </div>
              </div>

              <div className="flex justify-center pt-2 border-t">
                <Button
                  variant="link"
                  onClick={() => setShowInviteForm(true)}
                  className="text-slate-700"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Invite Co-Owner
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-4">
                <p className="text-sm text-slate-600">
                  Send an invitation to a new borrower who will become a co-owner.
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="invite_first_name">First Name *</Label>
                    <Input
                      id="invite_first_name"
                      value={inviteData.first_name}
                      onChange={(e) => setInviteData(prev => ({ ...prev, first_name: e.target.value }))}
                      placeholder="First name"
                      disabled={isProcessingInvite}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="invite_last_name">Last Name *</Label>
                    <Input
                      id="invite_last_name"
                      value={inviteData.last_name}
                      onChange={(e) => setInviteData(prev => ({ ...prev, last_name: e.target.value }))}
                      placeholder="Last name"
                      disabled={isProcessingInvite}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invite_email">Email Address *</Label>
                  <Input
                    id="invite_email"
                    type="email"
                    value={inviteData.email}
                    onChange={(e) => setInviteData(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="email@example.com"
                    disabled={isProcessingInvite}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button
                  variant="outline"
                  onClick={() => setShowInviteForm(false)}
                  disabled={isProcessingInvite}
                >
                  Back
                </Button>
                <Button
                  onClick={handleSendInvite}
                  disabled={isProcessingInvite}
                  className="bg-slate-700 hover:bg-slate-800"
                >
                  {isProcessingInvite && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Send Invitation
                </Button>
              </div>
            </>
          )}
        </div>
        {!showInviteForm && (
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} className="bg-slate-700 hover:bg-slate-800">Save Co-Owner</Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default function ContactDetail() {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { currentUser, permissions, isLoading: permissionsLoading } = usePermissions();
  const [contact, setContact] = useState(null);
  const [contactType, setContactType] = useState(null);
  const [contactId, setContactId] = useState(null);
  const [relatedLoans, setRelatedLoans] = useState([]);
  const [relatedApplications, setRelatedApplications] = useState([]);
  const [relatedTasks, setRelatedTasks] = useState([]);
  const [allBorrowers, setAllBorrowers] = useState([]);
  const [ownedEntities, setOwnedEntities] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showAddFieldModal, setShowAddFieldModal] = useState(false);
  const [showAddCoOwnerModal, setShowAddCoOwnerModal] = useState(false);
  const [isEditingOwnership, setIsEditingOwnership] = useState(false);
  const [editingOwnershipStructure, setEditingOwnershipStructure] = useState([]);
  const [isEditingContactInfo, setIsEditingContactInfo] = useState(false);
  const [editedContactData, setEditedContactData] = useState({});
  const [showPropagateModal, setShowPropagateModal] = useState(false);
  const [ongoingApplications, setOngoingApplications] = useState([]);
  const [ongoingLoans, setOngoingLoans] = useState([]);
  const [inviteFieldKeys, setInviteFieldKeys] = useState({ dateField: null, statusField: null });
  const [localInviteRecord, setLocalInviteRecord] = useState(null);
  const [creditExpirationDate, setCreditExpirationDate] = useState(null);
  const [visibleAdditionalFields, setVisibleAdditionalFields] = useState(() => {
    const searchParams = new URLSearchParams(location.search);
    const typeFromUrl = searchParams.get('type');
    const stored = typeFromUrl ? localStorage.getItem(`contact_visible_fields_${typeFromUrl}`) : null;
    return stored ? JSON.parse(stored) : [];
  });

  useEffect(() => {
    if (!permissionsLoading && currentUser) {
      loadContactData();
    }
  }, [location.search, permissionsLoading, currentUser]);

  useEffect(() => {
    if (contactType) {
      const stored = localStorage.getItem(`contact_visible_fields_${contactType}`);
      setVisibleAdditionalFields(stored ? JSON.parse(stored) : []);
    }
  }, [contactType]);

  useEffect(() => {
    if (contactType !== 'borrower') return;

    const detected = resolveBorrowerInviteFields(contact);
    if (detected.dateField || detected.statusField) {
      setInviteFieldKeys(detected);
      return;
    }

    getBorrowerInvitationFields(base44).then((schemaFields) => {
      setInviteFieldKeys(schemaFields);
    });
  }, [contactType, contact]);

  useEffect(() => {
    if (contactType === 'borrower' && contact?.id) {
      setLocalInviteRecord(getLocalBorrowerInvite(contact.id));
    } else {
      setLocalInviteRecord(null);
    }
  }, [contactType, contact?.id]);

  const loadContactData = async () => {
    setIsLoading(true);
    const searchParams = new URLSearchParams(location.search);
    const id = searchParams.get('id');
    const type = searchParams.get('type');

    if (!id || !type) {
      navigate(createPageUrl("Contacts"));
      return;
    }

    setContactId(id);
    setContactType(type);

    try {
      let contactData;
      let contactRelatedLoans = [];
      let contactRelatedApplications = [];

      switch(type) {
        case 'borrower':
          try {
            contactData = await base44.entities.Borrower.get(id);
          } catch (err) {
            console.error('Error loading borrower:', err);
            throw new Error('Failed to load borrower data');
          }
          
          try {
            const [allLoans, allApplications, allEntities] = await Promise.all([
              base44.entities.Loan.list().catch(() => []),
              base44.entities.LoanApplication.list().catch(() => []),
              base44.entities.BorrowerEntity.list().catch(() => [])
            ]);
            console.log('[ContactDetail] Borrower ID:', id);
            console.log('[ContactDetail] Borrower user_id:', contactData.user_id);
            console.log('[ContactDetail] Total loans in system:', allLoans?.length);
            console.log('[ContactDetail] All loans:', allLoans);
            
            // Match by borrower's user_id (which is stored in loan.borrower_ids) or the borrower record id
            const borrowerUserId = contactData.user_id;
            contactRelatedLoans = (allLoans || []).filter(loan => {
              const match = loan.borrower_ids?.includes(id) || 
                (borrowerUserId && loan.borrower_ids?.includes(borrowerUserId));
              if (match) {
                console.log('[ContactDetail] Found matching loan:', loan.id, loan.loan_number, 'borrower_ids:', loan.borrower_ids);
              }
              return match;
            });
            console.log('[ContactDetail] Filtered related loans:', contactRelatedLoans.length);
            
            // Match by user_id for primary_borrower_id, or check co_borrowers
            contactRelatedApplications = (allApplications || []).filter(app => 
              app.primary_borrower_id === id || 
              (borrowerUserId && app.primary_borrower_id === borrowerUserId) ||
              app.co_borrowers?.some(cb => cb.user_id === borrowerUserId || cb.borrower_id === id)
            );
            
            // Find entities where this borrower is an owner
            const borrowerOwnedEntities = (allEntities || []).filter(entity => 
              entity.ownership_structure?.some(owner => owner.borrower_id === id)
            );
            setOwnedEntities(borrowerOwnedEntities);
          } catch (err) {
            console.error('Error loading related data for borrower:', err);
          }
          break;
          
        case 'entity':
          try {
            contactData = await base44.entities.BorrowerEntity.get(id);
          } catch (err) {
            console.error('Error loading entity:', err);
            throw new Error('Failed to load entity data');
          }
          
          try {
            const [borrowers, users] = await Promise.all([
              base44.entities.Borrower.list().catch(() => []),
              base44.entities.User.list().catch(() => [])
            ]);
            const usersById = new Map((users || []).map((user) => [user.id, user]));
            const visibleBorrowers = (borrowers || []).filter((b) => {
              if (b.is_invite_temp) return false;
              const linkedUser = b.user_id ? usersById.get(b.user_id) : null;
              return normalizeAppRole(linkedUser?.app_role) !== 'Liaison';
            });
            setAllBorrowers(visibleBorrowers);
            
            const [entityLoans, entityApplications] = await Promise.all([
              base44.entities.Loan.list().catch(() => []),
              base44.entities.LoanApplication.list().catch(() => [])
            ]);
            contactRelatedLoans = (entityLoans || []).filter(loan => loan.borrower_entity_name === contactData.entity_name);
            contactRelatedApplications = (entityApplications || []).filter(app => app.borrower_entity_id === id);
          } catch (err) {
            console.error('Error loading related data for entity:', err);
          }
          break;
          
        case 'partner':
          try {
            contactData = await base44.entities.LoanPartner.get(id);
          } catch (err) {
            console.error('Error loading partner:', err);
            throw new Error('Failed to load partner data');
          }
          
          try {
            const [allLoans, allApplications] = await Promise.all([
              base44.entities.Loan.list().catch(() => []),
              base44.entities.LoanApplication.list().catch(() => [])
            ]);
            
            const partnerIds = new Set([contactData.id, contactData.user_id].filter(Boolean));
            const partnerEmail = contactData.email ? contactData.email.toLowerCase() : null;
            
            const matchesPartnerIds = (ids) => {
              if (!Array.isArray(ids) || ids.length === 0) return false;
              return ids.some((value) => partnerIds.has(value));
            };
            
            const matchesPartnerContact = (contact) => {
              if (!contact || typeof contact !== 'object') return false;
              if (contact.id && partnerIds.has(contact.id)) return true;
              if (contact.user_id && partnerIds.has(contact.user_id)) return true;
              if (partnerEmail && contact.email) {
                return contact.email.toLowerCase() === partnerEmail;
              }
              return false;
            };
            
            const toIdArray = (singleValue, legacyList) => {
              if (singleValue) return [singleValue];
              return Array.isArray(legacyList) ? legacyList : [];
            };

            contactRelatedLoans = (allLoans || []).filter((loan) =>
              matchesPartnerIds(toIdArray(loan.referrer_id, loan.referrer_ids)) ||
              matchesPartnerIds(toIdArray(loan.liaison_id, loan.liaison_ids)) ||
              matchesPartnerIds(toIdArray(loan.broker_id, loan.broker_ids)) ||
              matchesPartnerContact(loan.loan_partners?.broker)
            );
            
            contactRelatedApplications = (allApplications || []).filter((app) =>
              matchesPartnerIds(toIdArray(app.referrer_id, app.referrer_ids)) ||
              matchesPartnerIds(toIdArray(app.liaison_id, app.liaison_ids)) ||
              matchesPartnerIds(toIdArray(app.broker_id, app.broker_ids)) ||
              matchesPartnerContact(app.referral_broker) ||
              matchesPartnerContact(app.loan_partners?.broker)
            );
          } catch (err) {
            console.error('Error loading related data for partner:', err);
          }
          break;
          
        default:
          throw new Error("Unknown contact type");
      }

      if (!contactData) {
        throw new Error("Contact not found");
      }

      console.log('[ContactDetail] contactData loaded:', contactData);
      console.log('[ContactDetail] contactData.credit_expiration_date:', contactData.credit_expiration_date);
      
      setContact(contactData);
      setRelatedLoans(contactRelatedLoans);
      setRelatedApplications(contactRelatedApplications);

      // For borrowers, extract credit expiration date from borrower entity
      if (type === 'borrower' && contactData.credit_expiration_date) {
        setCreditExpirationDate(contactData.credit_expiration_date);
      }

      // Fetch and filter tasks based on related loans/applications and direct contact ID
      try {
        const allTasks = await base44.entities.Task.list().catch(() => []);
        const relatedLoanIds = contactRelatedLoans.map(loan => loan.id);
        const relatedApplicationIds = contactRelatedApplications.map(app => app.id);

        const filteredTasks = allTasks.filter(task =>
          relatedLoanIds.includes(task.loan_id) ||
          relatedApplicationIds.includes(task.application_id) ||
          (task.related_contact_id === id) // Assuming tasks can have a direct contact_id link
        );
        setRelatedTasks(filteredTasks);
      } catch (err) {
        console.error('Error loading related tasks:', err);
        setRelatedTasks([]); // Ensure tasks array is reset on error
      }

    } catch (error) {
      console.error("Failed to load contact:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to load contact data. Returning to contacts list.",
      });
      navigate(createPageUrl("Contacts"));
    }
    setIsLoading(false);
  };

  const handleEditContactInfo = () => {
    setEditedContactData({ ...contact });
    setIsEditingContactInfo(true);
  };

  const handleCancelContactInfoEdit = () => {
    setIsEditingContactInfo(false);
    setEditedContactData({});
  };

  const handleSaveContactInfo = async () => {
    console.log('[ContactDetail] handleSaveContactInfo called');
    console.log('[ContactDetail] Contact type:', contactType);
    console.log('[ContactDetail] Contact ID:', contact.id);
    console.log('[ContactDetail] Edited data:', editedContactData);
    
    // Check if there are actual changes
    const hasChanges = Object.keys(editedContactData).some(key => {
      return JSON.stringify(contact[key]) !== JSON.stringify(editedContactData[key]);
    });

    if (!hasChanges) {
      console.log('[ContactDetail] No changes detected, skipping save');
      setIsEditingContactInfo(false);
      setEditedContactData({});
      return;
    }
    
    setIsProcessing(true);
    try {
      let updatedContact;
      if (contactType === 'borrower') {
        console.log('[ContactDetail] Updating borrower...');
        updatedContact = await base44.entities.Borrower.update(contact.id, editedContactData);
      } else if (contactType === 'entity') {
        console.log('[ContactDetail] Updating entity...');
        updatedContact = await base44.entities.BorrowerEntity.update(contact.id, editedContactData);
      } else if (contactType === 'partner') {
        console.log('[ContactDetail] Updating partner...');
        const partnerPayload = { ...editedContactData };
        delete partnerPayload.type;
        updatedContact = await base44.entities.LoanPartner.update(contact.id, partnerPayload);
      }
      
      console.log('[ContactDetail] Contact updated successfully:', updatedContact);
      
      setContact(updatedContact);
      setIsEditingContactInfo(false);
      setEditedContactData({});
      
      // Set credit expiration date for borrowers directly from borrower entity
      if (contactType === 'borrower' && updatedContact.credit_expiration_date) {
        setCreditExpirationDate(updatedContact.credit_expiration_date);
      }
      
      toast({
        title: "Contact Updated",
        description: "Contact information has been updated successfully.",
      });
      
      console.log('[ContactDetail] About to call checkOngoingRecords...');
      // Check for ongoing applications/loans AFTER toast
      await checkOngoingRecords(updatedContact);
      console.log('[ContactDetail] checkOngoingRecords completed');
    } catch (error) {
      console.error("Error updating contact:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update contact information. Please try again.",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const checkOngoingRecords = async () => {
    console.log('[checkOngoingRecords] Function called');
    console.log('[checkOngoingRecords] Contact type:', contactType);
    console.log('[checkOngoingRecords] Contact ID:', contact?.id);
    
    // Only check for borrower and entity types
    if (contactType !== 'borrower' && contactType !== 'entity') {
      console.log('[checkOngoingRecords] Skipping - contact type is not borrower or entity');
      return;
    }

    try {
      console.log('[checkOngoingRecords] Fetching all applications and loans...');
      const allApps = await base44.entities.LoanApplication.list();
      const allLoans = await base44.entities.Loan.list();
      
      console.log('[checkOngoingRecords] Total applications:', allApps.length);
      console.log('[checkOngoingRecords] Total loans:', allLoans.length);
      
      let ongoingApps = [];
      let ongoingLns = [];
      
      if (contactType === 'borrower') {
        console.log('[checkOngoingRecords] Filtering for borrower user_id:', contact.user_id);
        ongoingApps = allApps.filter(app => {
          const matches = app.primary_borrower_id === contact.user_id &&
            !['rejected', 'approved'].includes(app.status);
          if (matches) {
            console.log('[checkOngoingRecords] Found ongoing app:', app.id, app.application_number, app.status);
          }
          return matches;
        });
        ongoingLns = allLoans.filter(loan => {
          const matches = loan.borrower_ids?.includes(contact.user_id) &&
            ['application_submitted', 'underwriting'].includes(loan.status);
          if (matches) {
            console.log('[checkOngoingRecords] Found ongoing loan:', loan.id, loan.loan_number, loan.status);
          }
          return matches;
        });
      } else if (contactType === 'entity') {
        console.log('[checkOngoingRecords] Filtering for entity:', contact.id, contact.entity_name);
        ongoingApps = allApps.filter(app => {
          const matches = app.borrower_entity_id === contact.id &&
            !['rejected', 'approved'].includes(app.status);
          if (matches) {
            console.log('[checkOngoingRecords] Found ongoing app:', app.id, app.application_number, app.status);
          }
          return matches;
        });
        ongoingLns = allLoans.filter(loan => {
          const matches = loan.borrower_entity_name === contact.entity_name &&
            ['application_submitted', 'underwriting'].includes(loan.status);
          if (matches) {
            console.log('[checkOngoingRecords] Found ongoing loan:', loan.id, loan.loan_number, loan.status);
          }
          return matches;
        });
      }
      
      console.log('[checkOngoingRecords] Filtered ongoing apps:', ongoingApps.length);
      console.log('[checkOngoingRecords] Filtered ongoing loans:', ongoingLns.length);
      
      if (ongoingApps.length > 0 || ongoingLns.length > 0) {
        console.log('[checkOngoingRecords] Setting state and showing modal...');
        setOngoingApplications(ongoingApps);
        setOngoingLoans(ongoingLns);
        setShowPropagateModal(true);
        console.log('[checkOngoingRecords] Modal should now be visible');
      } else {
        console.log('[checkOngoingRecords] No ongoing records found - modal will not show');
      }
    } catch (error) {
      console.error('[checkOngoingRecords] Error checking ongoing records:', error);
    }
  };

  const handlePropagateChanges = async (selected) => {
    console.log('[handlePropagateChanges] Called with:', selected);
    console.log('[handlePropagateChanges] Contact type:', contactType);
    console.log('[handlePropagateChanges] Contact ID:', contact?.id);
    console.log('[handlePropagateChanges] Contact user_id:', contact?.user_id);
    console.log('[handlePropagateChanges] Contact has linked user:', !!contact?.user_id);
    setIsProcessing(true);
    try {
      console.log('[handlePropagateChanges] Calling backend to propagate...');
      
      // Manually sync applications
      for (const appId of selected.applicationIds) {
        try {
          console.log(`[handlePropagateChanges] Processing application ${appId}`);
          const app = await base44.entities.LoanApplication.get(appId);
          if (!app) {
            console.log(`[handlePropagateChanges] Application ${appId} not found`);
            continue;
          }
          
          let updateData = {};
          if (contactType === 'borrower') {
            console.log(`[handlePropagateChanges] Syncing borrower data to application ${appId}`);
            console.log(`[handlePropagateChanges] Borrower entity ID: ${contact.id}`);
            console.log(`[handlePropagateChanges] Borrower has user_id: ${!!contact.user_id}`);
            updateData = {
              borrower_first_name: contact.first_name,
              borrower_last_name: contact.last_name,
              borrower_email: contact.email,
              borrower_phone: contact.phone,
              borrower_address_street: contact.address_street,
              borrower_address_unit: contact.address_unit,
              borrower_address_city: contact.address_city,
              borrower_address_state: contact.address_state,
              borrower_address_zip: contact.address_zip,
              borrower_date_of_birth: contact.date_of_birth,
              borrower_ssn: contact.ssn,
              borrower_rehabs_done_36_months: contact.rehabs_done_36_months,
              borrower_rentals_owned_36_months: contact.rentals_owned_36_months,
              borrower_credit_score: contact.credit_score
            };
            console.log(`[handlePropagateChanges] Update data for application:`, updateData);
          } else if (contactType === 'entity') {
            console.log(`[handlePropagateChanges] Syncing entity data to application ${appId}`);
            console.log(`[handlePropagateChanges] Entity ID: ${contact.id}`);
            console.log(`[handlePropagateChanges] Entity name: ${contact.entity_name}`);
            updateData = {
              entity_name: contact.entity_name,
              entity_ein: contact.registration_number,
              entity_type: contact.entity_type,
              entity_email: contact.email,
              entity_phone: contact.phone,
              entity_address_street: contact.address_street,
              entity_address_unit: contact.address_unit,
              entity_address_city: contact.address_city,
              entity_address_state: contact.address_state,
              entity_address_zip: contact.address_zip,
              entity_owners: contact.ownership_structure
            };
            console.log(`[handlePropagateChanges] Update data for application:`, updateData);
          }
          
          await base44.entities.LoanApplication.update(appId, updateData);
          console.log(`[handlePropagateChanges] Successfully updated application ${appId}`);
        } catch (error) {
          console.error(`[handlePropagateChanges] Error updating application ${appId}:`, error);
        }
      }
      
      // Manually sync loans
      for (const loanId of selected.loanIds) {
        try {
          console.log(`[handlePropagateChanges] Processing loan ${loanId}`);
          const loan = await base44.entities.Loan.get(loanId);
          if (!loan) {
            console.log(`[handlePropagateChanges] Loan ${loanId} not found`);
            continue;
          }
          
          let updateData = {};
          if (contactType === 'borrower') {
            console.log(`[handlePropagateChanges] Syncing borrower data to loan ${loanId}`);
            console.log(`[handlePropagateChanges] Borrower entity ID: ${contact.id}`);
            console.log(`[handlePropagateChanges] Borrower email: ${contact.email}`);
            console.log(`[handlePropagateChanges] Loan has ${(loan.individual_information || []).length} individuals`);
            
            // Update individual borrower in the individual_information array
            const updatedIndividuals = (loan.individual_information || []).map(ind => {
              if (ind.individual_email === contact.email) {
                console.log(`[handlePropagateChanges] Found matching individual in loan, updating...`);
                return {
                  ...ind,
                  first_name: contact.first_name,
                  last_name: contact.last_name,
                  individual_email: contact.email,
                  individual_phone_number: contact.phone,
                  credit_score_median: contact.credit_score,
                  rehab_experience: contact.rehabs_done_36_months,
                  individual_construction_experience: contact.rentals_owned_36_months
                };
              }
              return ind;
            });
            updateData = { individual_information: updatedIndividuals };
            console.log(`[handlePropagateChanges] Update data for loan:`, updateData);
          } else if (contactType === 'entity') {
            console.log(`[handlePropagateChanges] Syncing entity data to loan ${loanId}`);
            console.log(`[handlePropagateChanges] Entity ID: ${contact.id}`);
            console.log(`[handlePropagateChanges] Entity name: ${contact.entity_name}`);
            updateData = {
              borrower_entity_name: contact.entity_name,
              borrower_email: contact.email,
              borrower_phone: contact.phone,
              borrower_billing_address_street: contact.address_street,
              borrower_billing_address_unit: contact.address_unit,
              borrower_billing_address_city: contact.address_city,
              borrower_billing_address_state: contact.address_state,
              borrower_billing_address_zip: contact.address_zip
            };
            console.log(`[handlePropagateChanges] Update data for loan:`, updateData);
          }
          
          await base44.entities.Loan.update(loanId, updateData);
          console.log(`[handlePropagateChanges] Successfully updated loan ${loanId}`);
        } catch (error) {
          console.error(`[handlePropagateChanges] Error updating loan ${loanId}:`, error);
        }
      }
      
      console.log('[handlePropagateChanges] Propagation completed');
      
      toast({
        title: "Changes Propagated",
        description: `Updated ${selected.applicationIds.length + selected.loanIds.length} record(s) with new profile data.`,
      });
      
      setShowPropagateModal(false);
      setOngoingApplications([]);
      setOngoingLoans([]);
    } catch (error) {
      console.error('[handlePropagateChanges] Error propagating changes:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to propagate changes. Please try again.",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleContactFieldChange = (field, value) => {
    if (field === 'registration_number' || field === 'entity_ein') {
      const formatted = formatEIN(value);
      setEditedContactData(prev => ({ ...prev, [field]: formatted.replace(/\D/g, '') }));
      return;
    }
    setEditedContactData(prev => ({ ...prev, [field]: value }));
  };

  const handleAddVisibleField = (fieldKey) => {
    if (!visibleAdditionalFields.includes(fieldKey)) {
      const updated = [...visibleAdditionalFields, fieldKey];
      setVisibleAdditionalFields(updated);
      localStorage.setItem(`contact_visible_fields_${contactType}`, JSON.stringify(updated));
      toast({
        title: "Field Added",
        description: `"${getDisplayLabel(fieldKey)}" is now visible.`,
      });
    }
  };

  const handleRemoveVisibleField = (fieldKey) => {
    const updated = visibleAdditionalFields.filter(f => f !== fieldKey);
    setVisibleAdditionalFields(updated);
    localStorage.setItem(`contact_visible_fields_${contactType}`, JSON.stringify(updated));
    toast({
      title: "Field Removed",
      description: `"${getDisplayLabel(fieldKey)}" is no longer visible.`,
    });
  };

  const handleSaveCoOwner = async (newOwnerData) => {
    if (contactType !== 'entity' || !contact) return;

    const updatedOwnershipStructure = [...(contact.ownership_structure || []), newOwnerData];

    try {
      const updatedContact = await base44.entities.BorrowerEntity.update(contact.id, { ownership_structure: updatedOwnershipStructure });
      setContact(updatedContact);
      toast({
        title: "Co-Owner Added",
        description: `${newOwnerData.owner_name} has been added to the ownership structure.`,
      });
    } catch (error) {
      console.error("Error saving co-owner:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to add co-owner. Please try again.",
      });
    }
  };

  const handleEditOwnership = () => {
    setEditingOwnershipStructure([...contact.ownership_structure]);
    setIsEditingOwnership(true);
  };

  const handleCancelOwnershipEdit = () => {
    setIsEditingOwnership(false);
    setEditingOwnershipStructure([]);
  };

  const handleSaveOwnership = async () => {
    setIsProcessing(true);
    try {
      const updatedContact = await base44.entities.BorrowerEntity.update(contact.id, { 
        ownership_structure: editingOwnershipStructure 
      });
      setContact(updatedContact);
      setIsEditingOwnership(false);
      setEditingOwnershipStructure([]);
      toast({
        title: "Ownership Updated",
        description: "Ownership structure has been updated successfully.",
      });
    } catch (error) {
      console.error("Error updating ownership:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update ownership structure. Please try again.",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleOwnershipPercentageChange = (index, value) => {
    const updated = [...editingOwnershipStructure];
    updated[index] = { ...updated[index], ownership_percentage: parseFloat(value) || 0 };
    setEditingOwnershipStructure(updated);
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      if (!contactId || !contactType) {
        throw new Error("Contact ID or Type missing for deletion.");
      }

      if (contactType === 'borrower') {
        await base44.entities.Borrower.delete(contactId);
      } else if (contactType === 'entity') {
        await base44.entities.BorrowerEntity.delete(contactId);
      } else if (contactType === 'partner') {
        await base44.entities.LoanPartner.delete(contactId);
      } else {
        throw new Error("Unknown contact type for deletion.");
      }

      toast({
        title: "Contact Deleted",
        description: "Contact has been deleted successfully.",
      });

      navigate(createPageUrl('Contacts'));
    } catch (error) {
      console.error('Error deleting contact:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to delete contact: ${error.message}. Please try again.`,
      });
    }
    setIsDeleting(false);
  };

  const formatEIN = (value) => {
    if (!value) return '';
    const cleaned = String(value).replace(/\D/g, '');
    const match = cleaned.match(/^(\d{0,2})(\d{0,7})$/);
    if (!match) return value;

    let formatted = '';
    if (match[1]) formatted = match[1];
    if (match[1].length === 2 && match[2]) formatted += `-${match[2]}`;

    return formatted;
  };

  const getContactHeader = () => {
    switch(contactType) {
      case 'borrower':
        return {
          name: `${contact.first_name} ${contact.last_name}`,
          subtitle: contactType === 'borrower' ? 'Borrower' : '',
          icon: Users,
          iconColor: 'bg-blue-500'
        };
      case 'entity':
        return {
          name: contact.entity_name,
          subtitle: contact.entity_type || 'Business Entity',
          icon: Building2,
          iconColor: 'bg-indigo-500'
        };
      case 'partner':
        return {
          name: contact.name,
          subtitle: normalizeAppRole(contact.app_role || contact.type),
          icon: Briefcase,
          iconColor: 'bg-amber-500'
        };
      default:
        return { name: "Contact", subtitle: "", icon: Users, iconColor: "bg-gray-500" };
    }
  };

  const getInvitationDateLabel = (invitedAt) => {
    if (!invitedAt) return null;
    try {
      return format(new Date(invitedAt), 'MMM d, yyyy');
    } catch (error) {
      return null;
    }
  };

  const getDisplayLabel = (fieldKey) => {
    const specialLabels = {
      'dscr': 'DSCR',
      'ssn': 'SSN',
      'ein': 'EIN',
      'registration_number': 'EIN',
      // Add other special cases here
    };
    if (specialLabels[fieldKey]) {
      return specialLabels[fieldKey];
    }
    return fieldKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const getFieldValue = (fieldKey) => {
    const value = contact[fieldKey];
    
    if (value === null || value === undefined || value === '') {
      return null;
    }

    if (fieldKey.includes('date') && value) {
      try {
        return format(new Date(value + 'T00:00:00'), 'MMM d, yyyy');
      } catch (e) {
        return value;
      }
    }

    if (typeof value === 'number') {
      if (fieldKey.includes('amount') || fieldKey.includes('income') || fieldKey.includes('liquidity')) {
        return `$${value.toLocaleString()}`;
      }
      if (fieldKey === 'dscr') { // Specific handling for DSCR value
        return `${value}x`;
      }
      if (fieldKey.includes('percentage') || fieldKey.includes('ratio')) {
        return `${value}%`;
      }
      return value.toLocaleString();
    }

    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }

    if (typeof value === 'string') {
      if (fieldKey === 'registration_number' || fieldKey === 'entity_ein') {
        return formatEIN(value);
      }
      return value.replace(/_/g, ' ');
    }

    return value;
  };

  const getFieldIcon = (fieldKey) => {
    if (fieldKey.includes('ssn') || fieldKey.includes('credit')) return CreditCard;
    if (fieldKey.includes('date') || fieldKey.includes('birth')) return Calendar;
    if (fieldKey.includes('employment') || fieldKey.includes('job')) return Briefcase;
    if (fieldKey.includes('income') || fieldKey.includes('amount') || fieldKey.includes('liquidity')) return DollarSign;
    if (fieldKey.includes('score')) return TrendingUp;
    if (fieldKey.includes('rehab') || fieldKey.includes('construction')) return Home;
    if (fieldKey.includes('rental') || fieldKey.includes('property')) return Building2;
    if (fieldKey.includes('percentage') || fieldKey.includes('ratio') || fieldKey === 'dscr') return Percent;
    if (fieldKey.includes('website') || fieldKey.includes('url')) return Globe;
    if (fieldKey.includes('person') || fieldKey.includes('contact')) return UserIcon;
    return FileText;
  };

  if (permissionsLoading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  // Rule 4, 5, 10: Check if user can view contact details
  if (!permissions.canViewContactDetails) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
        <div className="max-w-5xl mx-auto">
          <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
            <CardContent className="p-12 text-center">
              <Users className="w-16 h-16 mx-auto mb-4 text-slate-300" />
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Access Denied</h2>
              <p className="text-slate-600">You don't have permission to view contact details.</p>
              <Button
                onClick={() => navigate(createPageUrl("Dashboard"))}
                className="mt-4"
              >
                Go to Dashboard
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const header = contact ? getContactHeader() : null;
  const Icon = header?.icon;
  const inviteStatusKey = inviteFieldKeys.statusField || DEFAULT_INVITE_FIELDS.statusField;
  const inviteDateKey = inviteFieldKeys.dateField || DEFAULT_INVITE_FIELDS.dateField;
  const invitationStatus = contactType === 'borrower' ? contact?.[inviteStatusKey] : null;
  const invitationDateValue = contactType === 'borrower' ? contact?.[inviteDateKey] : null;
  const localInvitationDateValue = localInviteRecord?.sentAt || null;
  const hasInviteRecord = Boolean(
    invitationStatus === 'invited' ||
    invitationDateValue ||
    localInviteRecord?.status === 'invited' ||
    localInvitationDateValue
  );
  const invitationDateLabel = contactType === 'borrower'
    ? getInvitationDateLabel(
        invitationDateValue ||
        localInvitationDateValue ||
        (invitationStatus === 'invited' ? contact?.updated_date : null)
      )
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-center gap-4 mb-6">
            <Button
              variant="outline"
              onClick={() => navigate(createPageUrl("Contacts"))}
              className="flex items-center gap-2"
              disabled={isProcessing || isDeleting}
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Contacts
            </Button>
          </div>

          <Card className="border-0 shadow-xl bg-white/90 backdrop-blur-sm">
            <CardContent className="p-6">
              {contact ? (
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1">
                    {contactType === 'borrower' ? (
                      <div className="min-w-0">
                        <h1 className="text-3xl font-bold text-slate-900 mb-1 tracking-tight">
                          {contact?.first_name} {contact?.last_name}
                        </h1>
                        <p className="text-md text-slate-500">{header?.subtitle}</p>
                      </div>
                    ) : (
                      <>
                        <div className={`w-16 h-16 rounded-xl ${header?.iconColor} flex items-center justify-center flex-shrink-0`}>
                          {Icon && <Icon className="w-8 h-8 text-white" />}
                        </div>
                        <div className="min-w-0">
                          <h1 className="text-3xl font-bold text-slate-900 mb-1">{header?.name}</h1>
                          <p className="text-md text-slate-500">{header?.subtitle}</p>
                        </div>
                      </>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 self-start">
                    {contact.created_date && (
                      <p className="text-xs text-slate-500">
                        Added {format(new Date(contact.created_date), 'MMM d, yyyy')}
                      </p>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="icon" disabled={isProcessing || isDeleting}>
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem 
                          onClick={handleDelete}
                          disabled={isDeleting || isProcessing}
                          className="text-red-600 focus:text-red-600"
                        >
                          {isDeleting ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Deleting...
                            </>
                          ) : (
                            <>
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete Contact
                            </>
                          )}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ) : (
                <p className="text-center text-slate-500">Contact data is missing.</p>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {contact ? (
          <>
            {/* Related Items in Tabs */}
            {(contactType === 'borrower' || contactType === 'entity' || contactType === 'partner') && (
              <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
                <CardContent className="p-0">
                  <Tabs defaultValue="loans" className="w-full">
                    <TabsList className="w-full justify-start rounded-none border-b bg-transparent p-0">
                      {(contactType === 'borrower' || contactType === 'entity' || contactType === 'partner') && (
                        <TabsTrigger 
                          value="loans" 
                          className="rounded-none border-b-2 border-transparent data-[state=active]:border-slate-500 data-[state=active]:bg-transparent"
                        >
                          Related Loans ({relatedLoans.length})
                        </TabsTrigger>
                      )}
                      {(contactType === 'borrower' || contactType === 'entity' || contactType === 'partner') && (
                        <TabsTrigger 
                          value="applications"
                          className="rounded-none border-b-2 border-transparent data-[state=active]:border-slate-500 data-[state=active]:bg-transparent"
                        >
                          Related Applications ({relatedApplications.length})
                        </TabsTrigger>
                      )}
                      <TabsTrigger 
                        value="tasks"
                        className="rounded-none border-b-2 border-transparent data-[state=active]:border-slate-500 data-[state=active]:bg-transparent"
                      >
                        Related Tasks ({relatedTasks.length})
                      </TabsTrigger>
                    </TabsList>

                    {(contactType === 'borrower' || contactType === 'entity' || contactType === 'partner') && (
                      <TabsContent value="loans" className="p-4">
                        {relatedLoans.length > 0 ? (
                          <div className="space-y-1.5">
                            {relatedLoans.map(loan => (
                              <div
                                key={loan.id}
                                className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
                                onClick={() => navigate(createPageUrl('LoanDetail') + `?id=${loan.id}`)}
                              >
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                  <span className="text-sm font-medium text-slate-900 truncate">{loan.loan_number || loan.primary_loan_id}</span>
                                  {loan.total_loan_amount && (
                                    <span className="text-xs text-slate-500">${loan.total_loan_amount.toLocaleString()}</span>
                                  )}
                                </div>
                                <Badge className={`text-[10px] px-1.5 py-0.5 ${
                                  loan.status === 'loan_funded' ? 'bg-green-100 text-green-800' :
                                  loan.status === 'loan_sold' ? 'bg-green-100 text-green-800' :
                                  loan.status === 'clear_to_close' ? 'bg-blue-100 text-blue-800' :
                                  loan.status === 'underwriting' ? 'bg-purple-100 text-purple-800' :
                                  loan.status === 'processing' ? 'bg-indigo-100 text-indigo-800' :
                                  loan.status === 'on_hold' ? 'bg-orange-100 text-orange-800' :
                                  loan.status === 'preclosed_review' ? 'bg-sky-100 text-sky-800' :
                                  'bg-amber-100 text-amber-800'
                                }`}>
                                  {loan.status?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-slate-500 text-center py-4 text-sm">No related loans found</p>
                        )}
                      </TabsContent>
                    )}

                    {(contactType === 'borrower' || contactType === 'entity' || contactType === 'partner') && (
                      <TabsContent value="applications" className="p-4">
                        {relatedApplications.length > 0 ? (
                          <div className="space-y-1.5">
                            {relatedApplications.map(app => (
                              <div
                                key={app.id}
                                className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
                                onClick={() => navigate(createPageUrl('NewApplication') + `?id=${app.id}&action=view`)}
                              >
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                  <span className="text-sm font-medium text-slate-900">#{app.application_number}</span>
                                  <span className="text-xs text-slate-500 truncate">
                                    {app.loan_type === 'dscr' ? 'DSCR' : app.loan_type?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                  </span>
                                </div>
                                <Badge className={`text-[10px] px-1.5 py-0.5 ${
                                  app.status === 'approved' ? 'bg-green-100 text-green-800' :
                                  app.status === 'submitted' ? 'bg-blue-100 text-blue-800' :
                                  app.status === 'rejected' ? 'bg-red-100 text-red-800' :
                                  'bg-amber-100 text-amber-800'
                                }`}>
                                  {app.status?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-slate-500 text-center py-4 text-sm">No related applications found</p>
                        )}
                      </TabsContent>
                    )}

                    <TabsContent value="tasks" className="p-4">
                      {relatedTasks.length > 0 ? (
                        <div className="space-y-1.5">
                          {relatedTasks.map(task => (
                            <div key={task.id} className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-md">
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <span className="text-sm font-medium text-slate-900 truncate">{task.title}</span>
                                {task.dueDate && (
                                  <span className="text-xs text-slate-500">Due: {format(new Date(task.dueDate), 'MMM d')}</span>
                                )}
                              </div>
                              <Badge className={`text-[10px] px-1.5 py-0.5 ${task.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
                                {task.status}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-slate-500 text-center py-4 text-sm">No related tasks found</p>
                      )}
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            )}

            {/* Owned Entities */}
            {contactType === 'borrower' && ownedEntities.length > 0 && (
              <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
                <CardHeader className="border-b border-slate-100 pb-3">
                  <CardTitle className="text-base font-semibold text-slate-900">
                    Owned Entities ({ownedEntities.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="space-y-1.5">
                    {ownedEntities.map(entity => {
                      const ownershipInfo = entity.ownership_structure?.find(owner => owner.borrower_id === contactId);
                      return (
                        <div
                          key={entity.id}
                          className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
                          onClick={() => navigate(createPageUrl('ContactDetail') + `?id=${entity.id}&type=entity`)}
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <Building2 className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-900 truncate">{entity.entity_name}</p>
                              <p className="text-xs text-slate-500">{entity.entity_type || 'Entity'}</p>
                            </div>
                          </div>
                          {ownershipInfo && (
                            <div className="text-right flex-shrink-0">
                              <p className="text-sm font-semibold text-slate-900">{ownershipInfo.ownership_percentage}%</p>
                              <p className="text-xs text-slate-500">ownership</p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Ownership Structure */}
            {contactType === 'entity' && contact?.ownership_structure && (
              <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
                <CardHeader className="border-b border-slate-100 pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold text-slate-900">
                      Ownership Structure
                    </CardTitle>
                    <div className="flex gap-2">
                      {isEditingOwnership ? (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleCancelOwnershipEdit}
                            disabled={isProcessing}
                            className="h-8 text-xs"
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            onClick={handleSaveOwnership}
                            disabled={isProcessing}
                            className="h-8 text-xs bg-slate-700 hover:bg-slate-800"
                          >
                            {isProcessing && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                            Save
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleEditOwnership}
                            disabled={isProcessing || isDeleting}
                            className="h-8 text-xs"
                          >
                            <Edit className="w-3.5 h-3.5 mr-1.5" />
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowAddCoOwnerModal(true)}
                            disabled={isProcessing || isDeleting}
                            className="h-8 text-xs"
                          >
                            <Plus className="w-3.5 h-3.5 mr-1.5" />
                            Add Co-Owner
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-4">
                  {isEditingOwnership ? (
                    <div className="space-y-2">
                      {editingOwnershipStructure.map((owner, idx) => {
                        const borrower = allBorrowers.find(b => b.id === owner.borrower_id);
                        return (
                          <div key={idx} className="flex items-center gap-3 p-2.5 bg-slate-50 rounded-lg">
                            <div className="flex-1">
                              <p className="text-sm font-medium text-slate-900">
                                {owner.owner_name}
                                {borrower && (
                                  <Badge className="ml-2 bg-slate-100 text-slate-700 text-[10px] border border-slate-300 px-1.5 py-0">
                                    Linked
                                  </Badge>
                                )}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                value={owner.ownership_percentage}
                                onChange={(e) => handleOwnershipPercentageChange(idx, e.target.value)}
                                className="w-20 h-8 text-sm text-right"
                                min="0"
                                max="100"
                                step="0.01"
                              />
                              <span className="text-sm font-medium text-slate-700">%</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    contact.ownership_structure.length > 0 ? (
                      <div className="space-y-2">
                        {contact.ownership_structure.map((owner, idx) => {
                          const borrower = allBorrowers.find(b => b.id === owner.borrower_id);
                          return (
                            <div key={idx} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                              <div className="flex-1">
                                {borrower ? (
                                  <button
                                    onClick={() => navigate(createPageUrl('ContactDetail') + `?id=${borrower.id}&type=borrower`)}
                                    className="text-sm font-medium text-slate-900 hover:text-blue-600 transition-colors text-left"
                                  >
                                    {owner.owner_name}
                                    <Badge className="ml-2 bg-slate-100 text-slate-700 text-[10px] border border-slate-300 px-1.5 py-0">
                                      Linked
                                    </Badge>
                                  </button>
                                ) : (
                                  <p className="text-sm font-medium text-slate-900">
                                    {owner.owner_name}
                                  </p>
                                )}
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-semibold text-slate-900">{owner.ownership_percentage}%</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-slate-500 text-center py-3 text-sm">No ownership information available</p>
                    )
                  )}
                  {contact.updated_date && (
                    <p className="text-[11px] text-slate-400 mt-3">
                      Last updated {format(new Date(contact.updated_date), 'MMM d, yyyy')}
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Invite to Platform Button */}
            {!contact.user_id && (contactType === 'borrower' || contactType === 'partner') && (
              <Card className="border-2 border-blue-200 bg-blue-50 mb-6">
                <CardContent className="p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-blue-900">This contact is not linked to a user account</p>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <p className="text-xs text-blue-700">Invite them to create an account and access the platform</p>
                      {contactType === 'borrower' && hasInviteRecord && (
                        <div className="flex items-center gap-2">
                          <Badge className="bg-amber-100 text-amber-800 border border-amber-200 text-[10px] px-1.5 py-0.5">
                            Invited
                          </Badge>
                          {invitationDateLabel && (
                            <span className="text-xs text-slate-500">Sent {invitationDateLabel}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <Button
                    onClick={async () => {
                      try {
                        const firstName = contact.first_name || contact.name?.split(' ')[0] || '';
                        const lastName = contact.last_name || contact.name?.split(' ').slice(1).join(' ') || '';

                        if (!contact.email) {
                          toast({
                            variant: "destructive",
                            title: "Missing Email",
                            description: "This contact does not have an email address.",
                          });
                          return;
                        }

                        const isBroker = currentUser?.app_role === 'Broker';
                        const emailResult = await base44.functions.invoke('emailService', {
                          email_type: contactType === 'partner'
                            ? 'invite_loan_partner'
                            : (isBroker ? 'invite_borrower_broker' : 'invite_borrower'),
                          skip_invite_log: true,
                          recipient_email: contact.email,
                          recipient_name: `${firstName} ${lastName}`,
                          data: {
                            first_name: firstName,
                            last_name: lastName,
                            ...(contactType === 'partner' && { partner_type: normalizeAppRole(contact.app_role || contact.type) }),
                            ...(contactType !== 'partner' && isBroker
                              ? { broker_name: currentUser?.full_name || `${currentUser?.first_name || ''} ${currentUser?.last_name || ''}`.trim() || 'Your broker' }
                              : {})
                          }
                        });

                        toast({
                          title: "Invitation Sent",
                          description: `An invitation email has been sent to ${contact.email}`,
                        });

                        try {
                          const inviteRequest = await base44.entities.BorrowerInviteRequest.create({
                            source: 'log',
                            status: 'sent',
                            invite_type: contactType === 'partner'
                              ? 'invite_loan_partner'
                              : (isBroker ? 'invite_borrower_broker' : 'invite_borrower'),
                            recipient_role: contactType === 'partner'
                              ? normalizeAppRole(contact.app_role || contact.type) || ''
                              : 'Borrower',
                            requested_email: contact.email,
                            requested_first_name: firstName,
                            requested_last_name: lastName,
                            requested_by_user_id: currentUser?.id || null,
                            requested_by_role: currentUser?.app_role || currentUser?.role || 'Unknown',
                            requested_by_name: currentUser?.full_name || currentUser?.email || '',
                            sent_at: new Date().toISOString(),
                            invite_token_id: emailResult?.details?.invite_token_id || null
                          });

                          const inviteTokenId = emailResult?.details?.invite_token_id;
                          if (inviteTokenId && inviteRequest?.id) {
                            try {
                              await base44.entities.BorrowerInviteToken.update(inviteTokenId, {
                                request_id: inviteRequest.id
                              });
                            } catch (tokenLinkError) {
                              console.error('Error linking invite token to logged invitation:', tokenLinkError);
                            }
                          }
                        } catch (logError) {
                          console.error('Error logging invitation:', logError);
                        }

                        if (contactType === 'borrower') {
                          const detectedFields = resolveBorrowerInviteFields(contact);
                          const schemaFields = (!detectedFields.dateField && !detectedFields.statusField)
                            ? await getBorrowerInvitationFields(base44)
                            : detectedFields;
                          const dateField = schemaFields.dateField || DEFAULT_INVITE_FIELDS.dateField;
                          const statusField = schemaFields.statusField || DEFAULT_INVITE_FIELDS.statusField;
                          const inviteSentAt = new Date().toISOString();
                          const inviteUpdate = {
                            [statusField]: 'invited',
                            [dateField]: inviteSentAt,
                            invited_by_user_id: currentUser?.id,
                            invited_by_role: currentUser?.app_role || currentUser?.role
                          };

                          try {
                            const updatedContact = await base44.entities.Borrower.update(contact.id, inviteUpdate);
                            setContact(updatedContact);
                          } catch (updateError) {
                            console.error('Error updating borrower invitation fields:', updateError);
                            setLocalBorrowerInvite(contact.id, { status: 'invited', sentAt: inviteSentAt });
                            setLocalInviteRecord({ status: 'invited', sentAt: inviteSentAt });
                            toast({
                              title: "Invite Stored Locally",
                              description: "Borrower schema has no invitation fields. Add invitation fields to persist this status.",
                            });
                          }
                        }
                      } catch (error) {
                        console.error('Error sending invitation:', error);
                        toast({
                          variant: "destructive",
                          title: "Error",
                          description: "Failed to send invitation. Please try again.",
                        });
                      }
                    }}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <UserPlus className="w-4 h-4 mr-2" />
                    {contactType === 'borrower' && hasInviteRecord ? 'Resend Invitation' : 'Invite to Platform'}
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Basic Information & Address Combined */}
            <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
              <CardHeader className="border-b border-slate-100 pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold text-slate-900">Contact Information</CardTitle>
                  <div className="flex gap-2">
                    {isEditingContactInfo ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleCancelContactInfoEdit}
                          disabled={isProcessing}
                          className="h-8 text-xs"
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleSaveContactInfo}
                          disabled={isProcessing}
                          className="h-8 text-xs bg-slate-700 hover:bg-slate-800"
                        >
                          {isProcessing && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                          Save
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleEditContactInfo}
                        disabled={isProcessing || isDeleting}
                        className="h-8 text-xs"
                      >
                        <Edit className="w-3.5 h-3.5 mr-1.5" />
                        Edit
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-3">
                  <div>
                    <Label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Email</Label>
                    {isEditingContactInfo ? (
                      <Input
                        type="email"
                        value={editedContactData.email || ''}
                        onChange={(e) => handleContactFieldChange('email', e.target.value)}
                        className="h-8 text-sm mt-0.5"
                      />
                    ) : (
                      <p className="text-sm text-slate-900 font-medium break-words mt-0.5">{contact.email || 'N/A'}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Phone</Label>
                    {isEditingContactInfo ? (
                      <Input
                        type="tel"
                        value={editedContactData.phone || ''}
                        onChange={(e) => handleContactFieldChange('phone', e.target.value)}
                        className="h-8 text-sm mt-0.5"
                      />
                    ) : (
                      <p className="text-sm text-slate-900 font-medium mt-0.5">
                        {contact.phone ? (() => {
                          const digits = contact.phone.replace(/\D/g, '');
                          if (digits.length === 10) {
                            return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
                          }
                          return contact.phone;
                        })() : 'N/A'}
                      </p>
                    )}
                  </div>
                  
                  {contactType === 'borrower' && (
                    <>
                      <div>
                        <Label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">SSN</Label>
                        {isEditingContactInfo ? (
                          <Input
                            type="text"
                            value={editedContactData.ssn || ''}
                            onChange={(e) => handleContactFieldChange('ssn', e.target.value)}
                            className="h-8 text-sm mt-0.5"
                          />
                        ) : (
                          <p className="text-sm text-slate-900 font-medium mt-0.5">
                            {contact.ssn ? (() => {
                              const digits = contact.ssn.replace(/\D/g, '');
                              if (digits.length === 9) {
                                return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
                              }
                              return contact.ssn;
                            })() : 'N/A'}
                          </p>
                        )}
                      </div>
                      <div>
                        <Label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Date of Birth</Label>
                        {isEditingContactInfo ? (
                          <Input
                            type="date"
                            value={editedContactData.date_of_birth ? editedContactData.date_of_birth.split('T')[0] : ''}
                            onChange={(e) => handleContactFieldChange('date_of_birth', e.target.value)}
                            className="h-8 text-sm mt-0.5"
                          />
                        ) : (
                          <p className="text-sm text-slate-900 font-medium mt-0.5">
                            {contact.date_of_birth ? format(new Date(contact.date_of_birth + 'T00:00:00'), 'MMM d, yyyy') : 'N/A'}
                          </p>
                        )}
                      </div>
                      <div>
                        <Label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Credit Score</Label>
                        {isEditingContactInfo ? (
                          <Input
                            type="number"
                            value={editedContactData.credit_score || ''}
                            onChange={(e) => handleContactFieldChange('credit_score', parseFloat(e.target.value) || null)}
                            className="h-8 text-sm mt-0.5"
                            min="300"
                            max="850"
                          />
                        ) : (
                          <div className="flex items-center gap-2 mt-0.5">
                            <p className="text-sm text-slate-900 font-medium">{contact.credit_score || 'N/A'}</p>
                            {contact.credit_expiration_date && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-700 border-slate-300">
                                Exp: {format(new Date(contact.credit_expiration_date + 'T00:00:00'), 'MMM d, yyyy')}
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {contactType === 'entity' && (
                    <>
                      <div>
                        <Label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Entity Type</Label>
                        {isEditingContactInfo ? (
                          <Input
                            type="text"
                            value={editedContactData.entity_type || ''}
                            onChange={(e) => handleContactFieldChange('entity_type', e.target.value)}
                            className="h-8 text-sm mt-0.5"
                          />
                        ) : (
                          <p className="text-sm text-slate-900 font-medium mt-0.5">{contact.entity_type || 'N/A'}</p>
                        )}
                      </div>
                      <div>
                        <Label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">EIN</Label>
                        {isEditingContactInfo ? (
                          <Input
                            type="text"
                            value={formatEIN(editedContactData.registration_number) || ''}
                            onChange={(e) => handleContactFieldChange('registration_number', e.target.value)}
                            className="h-8 text-sm mt-0.5"
                          />
                        ) : (
                          <p className="text-sm text-slate-900 font-medium mt-0.5">
                            {contact.registration_number ? formatEIN(contact.registration_number) : 'N/A'}
                          </p>
                        )}
                      </div>
                    </>
                  )}

                  {contactType === 'partner' && (
                    <>
                      <div>
                        <Label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Partner Role</Label>
                        {isEditingContactInfo ? (
                          <Select
                            value={normalizeAppRole(editedContactData.app_role || editedContactData.type || '')}
                            onValueChange={(value) => handleContactFieldChange('app_role', value)}
                          >
                            <SelectTrigger className="h-8 text-sm mt-0.5">
                              <SelectValue placeholder="Select role" />
                            </SelectTrigger>
                            <SelectContent>
                              {LOAN_PARTNER_ROLES.map((role) => (
                                <SelectItem key={role} value={role}>
                                  {role}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <p className="text-sm text-slate-900 font-medium mt-0.5">
                            {normalizeAppRole(contact.app_role || contact.type) || 'N/A'}
                          </p>
                        )}
                      </div>
                      <div>
                        <Label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Website</Label>
                        {isEditingContactInfo ? (
                          <Input
                            type="url"
                            value={editedContactData.website || ''}
                            onChange={(e) => handleContactFieldChange('website', e.target.value)}
                            className="h-8 text-sm mt-0.5"
                          />
                        ) : (
                          <p className="text-sm text-slate-900 font-medium break-words mt-0.5">{contact.website || 'N/A'}</p>
                        )}
                      </div>
                      <div>
                        <Label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Contact Person</Label>
                        {isEditingContactInfo ? (
                          <Input
                            type="text"
                            value={editedContactData.contact_person || ''}
                            onChange={(e) => handleContactFieldChange('contact_person', e.target.value)}
                            className="h-8 text-sm mt-0.5"
                          />
                        ) : (
                          <p className="text-sm text-slate-900 font-medium mt-0.5">{contact.contact_person || 'N/A'}</p>
                        )}
                      </div>
                    </>
                  )}
                </div>

                <div className="border-t border-slate-100 mt-4 pt-4">
                  <Label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide mb-2 block">Address</Label>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-x-6 gap-y-3">
                    <div>
                      <Label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Street</Label>
                      {isEditingContactInfo ? (
                        <Input
                          type="text"
                          value={editedContactData.address_street || ''}
                          onChange={(e) => handleContactFieldChange('address_street', e.target.value)}
                          className="h-8 text-sm mt-0.5"
                        />
                      ) : (
                        <p className="text-sm text-slate-900 font-medium mt-0.5">{contact.address_street || 'N/A'}</p>
                      )}
                    </div>
                    <div>
                      <Label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Unit</Label>
                      {isEditingContactInfo ? (
                        <Input
                          type="text"
                          value={editedContactData.address_unit || ''}
                          onChange={(e) => handleContactFieldChange('address_unit', e.target.value)}
                          className="h-8 text-sm mt-0.5"
                        />
                      ) : (
                        <p className="text-sm text-slate-900 font-medium mt-0.5">{contact.address_unit || 'N/A'}</p>
                      )}
                    </div>
                    <div>
                      <Label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">City</Label>
                      {isEditingContactInfo ? (
                        <Input
                          type="text"
                          value={editedContactData.address_city || ''}
                          onChange={(e) => handleContactFieldChange('address_city', e.target.value)}
                          className="h-8 text-sm mt-0.5"
                        />
                      ) : (
                        <p className="text-sm text-slate-900 font-medium mt-0.5">{contact.address_city || 'N/A'}</p>
                      )}
                    </div>
                    <div>
                      <Label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">State</Label>
                      {isEditingContactInfo ? (
                        <Input
                          type="text"
                          value={editedContactData.address_state || ''}
                          onChange={(e) => handleContactFieldChange('address_state', e.target.value)}
                          className="h-8 text-sm mt-0.5"
                        />
                      ) : (
                        <p className="text-sm text-slate-900 font-medium mt-0.5">{contact.address_state || 'N/A'}</p>
                      )}
                    </div>
                    <div>
                      <Label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">ZIP Code</Label>
                      {isEditingContactInfo ? (
                        <Input
                          type="text"
                          value={editedContactData.address_zip || ''}
                          onChange={(e) => handleContactFieldChange('address_zip', e.target.value)}
                          className="h-8 text-sm mt-0.5"
                        />
                      ) : (
                        <p className="text-sm text-slate-900 font-medium mt-0.5">{contact.address_zip || 'N/A'}</p>
                      )}
                    </div>
                  </div>
                </div>
                
                {contact.updated_date && (
                  <p className="text-[11px] text-slate-400 mt-4">
                    Last updated {format(new Date(contact.updated_date), 'MMM d, yyyy')}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Additional Information (Custom Fields) */}
            <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
              <CardHeader className="border-b border-slate-100 pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold text-slate-900">
                    Additional Information
                  </CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAddFieldModal(true)}
                    disabled={isProcessing || isDeleting}
                    className="h-8 text-xs"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1.5" />
                    Add Field
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                {visibleAdditionalFields.length > 0 ? (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-3">
                      {visibleAdditionalFields.map((fieldKey) => {
                        const value = getFieldValue(fieldKey);
                        const label = getDisplayLabel(fieldKey);

                        return (
                          <div key={fieldKey} className="relative group">
                            <Label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">{label}</Label>
                            <p className="text-sm text-slate-900 font-medium mt-0.5">{value || 'N/A'}</p>
                            <button
                              onClick={() => handleRemoveVisibleField(fieldKey)}
                              className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-full bg-red-100 hover:bg-red-200"
                              disabled={isProcessing || isDeleting}
                            >
                              <Trash2 className="w-3 h-3 text-red-600" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                    {contact.updated_date && (
                      <p className="text-[11px] text-slate-400 mt-4">
                        Last updated {format(new Date(contact.updated_date), 'MMM d, yyyy')}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-slate-500 text-center py-6 text-sm">No additional information displayed. Click "Add Field" to show more details.</p>
                )}
              </CardContent>
            </Card>
          </>
        ) : (
          <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
            <CardContent className="p-8 text-center text-slate-500">
              Contact not found
            </CardContent>
          </Card>
        )}
      </div>

      <>
        <AddFieldModal
          isOpen={showAddFieldModal}
          onClose={() => setShowAddFieldModal(false)}
          onSave={handleAddVisibleField}
          contactType={contactType}
          visibleFields={visibleAdditionalFields}
          contact={contact}
        />

        <AddCoOwnerModal
          isOpen={showAddCoOwnerModal}
          onClose={() => setShowAddCoOwnerModal(false)}
          onSave={handleSaveCoOwner}
          allBorrowers={allBorrowers}
          toast={toast}
        />

        <PropagateProfileChangesModal
          isOpen={showPropagateModal}
          onClose={() => {
            setShowPropagateModal(false);
            setOngoingApplications([]);
            setOngoingLoans([]);
          }}
          onUpdateRecords={handlePropagateChanges}
          applications={ongoingApplications}
          loans={ongoingLoans}
          isProcessing={isProcessing}
        />
      </>
    </div>
  );
}
