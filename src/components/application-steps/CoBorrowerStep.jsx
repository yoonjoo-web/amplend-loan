import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Link2, UserPlus, Search } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import SearchExistingModal from "../shared/SearchExistingModal";
import { useToast } from "@/components/ui/use-toast";
import { base44 } from "@/api/base44Client";
import DynamicField from "../forms/DynamicField";
import { syncEntities } from "@/components/utils/entitySyncHelper";


const CoBorrowerForm = ({ coBorrower, index, onUpdate, onRemove, isReadOnly, canManage, currentUser }) => {
  const [fieldConfigs, setFieldConfigs] = useState([]);
  const [isLoadingFields, setIsLoadingFields] = useState(true);
  
  const isThisCoBorrower = currentUser && coBorrower.user_id === currentUser.id;

  const loadFieldConfigurations = React.useCallback(async () => {
    setIsLoadingFields(true);
    try {
      const configs = await base44.entities.FieldConfiguration.filter({ 
        context: 'application',
        category: 'coBorrowerInformation'
      });
      const sorted = configs.sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
      setFieldConfigs(sorted);
    } catch (error) {
      console.error('Error loading field configurations:', error);
      setFieldConfigs([]);
    }
    setIsLoadingFields(false);
  }, []);

  React.useEffect(() => {
    loadFieldConfigurations();
  }, [loadFieldConfigurations]);

  const handleFieldChange = (fieldName, value) => {
    const updatedCoBorrower = { ...coBorrower };
    
    if (typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Date)) {
      Object.assign(updatedCoBorrower, value);
    } else {
      updatedCoBorrower[fieldName] = value;
    }
    
    onUpdate(index, updatedCoBorrower);
  };

  // Group fields by section
  const fieldsBySection = fieldConfigs.reduce((acc, field) => {
    const section = field.section || 'default';
    if (!acc[section]) {
      acc[section] = [];
    }
    acc[section].push(field);
    return acc;
  }, {});

  const sections = Object.keys(fieldsBySection);
  const hasMultipleSections = sections.length > 1 || (sections.length === 1 && sections[0] !== 'default');

  return (
    <motion.div 
      layout 
      initial={{ opacity: 0, y: -20 }} 
      animate={{ opacity: 1, y: 0 }} 
      exit={{ opacity: 0, y: 20 }} 
      className="pt-6 space-y-6 border-t border-slate-200 first:border-t-0 first:pt-0"
    >
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold">
            {index + 1}
          </div>
          <div>
            <h4 className="font-semibold text-slate-900">Co-Borrower {index + 1}</h4>
            {coBorrower.user_id && (
              <div className="flex items-center gap-2 mt-1">
                <Link2 className="w-3 h-3 text-blue-600" />
                <span className="text-xs text-blue-600">Linked to user account</span>
              </div>
            )}
            {coBorrower.invitation_id && (
              <Badge variant="outline" className="mt-1">
                Invitation Sent
              </Badge>
            )}
          </div>
        </div>
        {!isReadOnly && (
          <Button variant="ghost" size="icon" onClick={() => onRemove(index)} className="text-red-600 hover:text-red-700 hover:bg-red-50">
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>

      {isLoadingFields ? (
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
        </div>
      ) : (
        <div className="space-y-10">
          {sections.map((sectionKey) => {
            const sectionFields = fieldsBySection[sectionKey];
            const sectionLabel = sectionKey === 'default' ? null : sectionKey;

            return (
              <div key={sectionKey} className="space-y-6">
                {sectionLabel && hasMultipleSections && (
                  <div className="border-b border-blue-200 pb-2 bg-blue-50/30 -mx-2 px-2 rounded-t">
                    <h3 className="text-sm font-semibold text-blue-900 uppercase tracking-wider">
                      {sectionLabel}
                    </h3>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
                  {sectionFields.map((fieldConfig) => {
                    const isFullWidth = ['radio', 'textarea', 'checkbox'].includes(fieldConfig.field_type);
                    
                    return (
                      <div key={fieldConfig.field_name} className={isFullWidth ? 'md:col-span-2' : ''}>
                        <DynamicField
                          fieldConfig={fieldConfig}
                          value={coBorrower[fieldConfig.field_name]}
                          onChange={(value) => handleFieldChange(fieldConfig.field_name, value)}
                          allFieldValues={coBorrower}
                          isReadOnly={isReadOnly || (coBorrower.user_id && !isThisCoBorrower && !canManage)}
                          canManage={canManage}
                          profileType="borrower"
                          profileId={coBorrower.user_id}
                          overriddenFields={coBorrower.overridden_fields || []}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

    </motion.div>
  );
};

export default React.memo(function CoBorrowerStep({ data, onChange, isReadOnly, currentUser, canManage, onAddComment, fieldComments, singleCoBorrowerMode = false, coBorrowerIndex = -1 }) {
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showInviteLinkDialog, setShowInviteLinkDialog] = useState(false);
  const [selectedBorrowerToLink, setSelectedBorrowerToLink] = useState(null);
  const [allBorrowers, setAllBorrowers] = useState([]);
  const [inviteData, setInviteData] = useState({
    requested_email: '',
    requested_first_name: '',
    requested_last_name: ''
  });
  const coBorrowers = data.co_borrowers || [];
  const { toast } = useToast();
  const isBroker = currentUser?.app_role === 'Broker';

  // Determine if current user is a co-borrower viewing their own form
  const isCurrentUserCoBorrower = currentUser && coBorrowers.some(cb => cb.user_id === currentUser.id);
  const currentUserCoBorrowerIndex = currentUser ? coBorrowers.findIndex(cb => cb.user_id === currentUser.id) : -1;

  // Filter co-borrowers to show based on mode
  const coBorrowersToShow = singleCoBorrowerMode && coBorrowerIndex >= 0 
    ? [coBorrowers[coBorrowerIndex]].filter(Boolean)
    : (isCurrentUserCoBorrower && !canManage) 
      ? [coBorrowers[currentUserCoBorrowerIndex]].filter(Boolean) 
      : coBorrowers;

  React.useEffect(() => {
    const loadBorrowers = async () => {
      try {
        const borrowers = await base44.entities.Borrower.list();
        const currentBorrowerIds = [
          data.primary_borrower_id,
          ...coBorrowers.map(cb => cb.user_id || cb.borrower_id)
        ].filter(Boolean);
        const filtered = borrowers.filter(
          b => !currentBorrowerIds.includes(b.user_id) && !currentBorrowerIds.includes(b.id)
        );
        setAllBorrowers(filtered);
      } catch (error) {
        console.error('Error loading borrowers:', error);
      }
    };
    loadBorrowers();
  }, [data.primary_borrower_id, coBorrowers]);

  const handleSelectBorrower = async (borrower) => {
    if (borrower.user_id) {
      const mappedData = syncEntities('Borrower', 'LoanApplication', borrower);
      const newCoBorrower = {
        id: `temp_${Date.now()}`,
        user_id: borrower.user_id,
        ...mappedData,
        completion_status: 'pending',
        invited_by_user_id: currentUser?.id,
        invited_by_role: currentUser?.app_role || currentUser?.role
      };
      onChange({ co_borrowers: [...coBorrowers, newCoBorrower] });
      
      // TEMPORARILY DISABLED: Send email notification
      // try {
      //   const borrowerName = `${currentUser.first_name} ${currentUser.last_name}`;
      //   await base44.functions.invoke('emailService', {
      //     email_type: 'invite_co_borrower',
      //     recipient_email: borrower.email,
      //     recipient_name: `${borrower.first_name} ${borrower.last_name}`,
      //     data: {
      //       first_name: borrower.first_name,
      //       last_name: borrower.last_name,
      //       inviter_name: borrowerName,
      //       application_number: data.application_number,
      //       application_id: data.id,
      //       role: 'Co-Borrower'
      //     }
      //   });
      // } catch (emailError) {
      //   console.log('Could not send email notification:', emailError);
      // }

      // TEMPORARILY DISABLED: Create in-app notification
      // try {
      //   const borrowerName = `${currentUser.first_name} ${currentUser.last_name}`;
      //   await base44.entities.Notification.create({
      //     user_id: borrower.user_id,
      //     message: `You have been added as a co-borrower to application #${data.application_number} by ${borrowerName}`,
      //     type: 'other',
      //     entity_type: 'LoanApplication',
      //     entity_id: data.id,
      //     link_url: `/new-application?id=${data.id}`,
      //     priority: 'high'
      //   });
      // } catch (notifError) {
      //   console.log('Could not create in-app notification:', notifError);
      // }
      
      toast({
        title: "Co-Borrower Added",
        description: `${borrower.first_name} ${borrower.last_name} has been added.`,
      });
    } else {
      setSelectedBorrowerToLink(borrower);
      setShowInviteLinkDialog(true);
    }
  };

  const handleSendLinkInvitation = async () => {
    if (!selectedBorrowerToLink) return;

    try {
      // Add the borrower to the application
      const mappedData = syncEntities('Borrower', 'LoanApplication', selectedBorrowerToLink);
      const newCoBorrower = {
        id: `temp_${Date.now()}`,
        borrower_id: selectedBorrowerToLink.id,
        ...mappedData,
        completion_status: 'pending',
        invited_by_user_id: currentUser?.id,
        invited_by_role: currentUser?.app_role || currentUser?.role
      };
      onChange({ co_borrowers: [...coBorrowers, newCoBorrower] });

      // TEMPORARILY DISABLED: Email invitation
      // await base44.functions.invoke('emailService', {
      //   email_type: 'invite_co_borrower',
      //   recipient_email: selectedBorrowerToLink.email,
      //   recipient_name: `${selectedBorrowerToLink.first_name} ${selectedBorrowerToLink.last_name}`,
      //   data: {
      //     first_name: selectedBorrowerToLink.first_name,
      //     last_name: selectedBorrowerToLink.last_name,
      //     application_number: data.application_number,
      //     application_id: data.id,
      //     role: 'Co-Borrower'
      //   }
      // });

      toast({
        title: "Co-Borrower Added",
        description: `${selectedBorrowerToLink.first_name} ${selectedBorrowerToLink.last_name} has been added (invitation temporarily disabled).`
      });

      setShowInviteLinkDialog(false);
      setSelectedBorrowerToLink(null);
    } catch (error) {
      console.error('Error adding co-borrower:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to add co-borrower. Please try again."
      });
    }
  };

  const handleSubmitInvite = async (e) => {
    e.preventDefault();

    try {
      // TEMPORARILY DISABLED: Email and notification sending
      // const borrowerName = `${currentUser.first_name} ${currentUser.last_name}`;

      // // Send email notification
      // await base44.functions.invoke('emailService', {
      //   email_type: 'invite_co_borrower',
      //   recipient_email: inviteData.requested_email,
      //   recipient_name: `${inviteData.requested_first_name} ${inviteData.requested_last_name}`,
      //   data: {
      //     first_name: inviteData.requested_first_name,
      //     last_name: inviteData.requested_last_name,
      //     inviter_name: borrowerName,
      //     application_number: data.application_number,
      //     application_id: data.id,
      //     role: 'Co-Borrower'
      //   }
      // });

      // // Create in-app notification for the co-borrower (if they have an account)
      // try {
      //   const allUsers = await base44.entities.User.list();
      //   const coBorrowerUser = allUsers.find(u => u.email?.toLowerCase() === inviteData.requested_email.toLowerCase());
      //   
      //   if (coBorrowerUser) {
      //     await base44.entities.Notification.create({
      //       user_id: coBorrowerUser.id,
      //       message: `You have been added as a co-borrower to application #${data.application_number} by ${borrowerName}`,
      //       type: 'other',
      //       entity_type: 'LoanApplication',
      //       entity_id: data.id,
      //       link_url: `/new-application?id=${data.id}`,
      //       priority: 'high'
      //     });
      //   }
      // } catch (notifError) {
      //   console.log('Could not create in-app notification:', notifError);
      // }

      const newCoBorrower = {
        id: `temp_${Date.now()}`,
        first_name: inviteData.requested_first_name,
        last_name: inviteData.requested_last_name,
        email: inviteData.requested_email,
        completion_status: 'pending',
        invited_by_user_id: currentUser?.id,
        invited_by_role: currentUser?.app_role || currentUser?.role
      };
      onChange({ co_borrowers: [...coBorrowers, newCoBorrower] });

      toast({
        title: "Co-Borrower Added",
        description: `${inviteData.requested_first_name} ${inviteData.requested_last_name} has been added (invitation temporarily disabled).`,
      });

      setShowInviteModal(false);
      setInviteData({
        requested_email: '',
        requested_first_name: '',
        requested_last_name: ''
      });
    } catch (error) {
      console.error('Error adding co-borrower:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to add co-borrower. Please try again.",
      });
    }
  };

  const handleUpdateCoBorrower = (index, updatedCoBorrower) => {
    const updated = [...coBorrowers];
    updated[index] = updatedCoBorrower;
    onChange({ co_borrowers: updated });
  };

  const handleRemoveCoBorrower = (index) => {
    const updated = coBorrowers.filter((_, i) => i !== index);
    onChange({ co_borrowers: updated });
  };

  // Determine if Add Co-Borrower button should be shown
  // Co-borrowers should not see this button - only staff and primary borrowers can add co-borrowers
  const showAddButton = !isReadOnly && !isCurrentUserCoBorrower && !singleCoBorrowerMode;

  return (
    <div className="space-y-6 bg-white rounded-lg border border-slate-200 p-6">
      <div>
        <div className="flex justify-between items-start mb-2">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">
              {singleCoBorrowerMode || isCurrentUserCoBorrower ? 'Your Information' : 'Co-Borrowers'}
            </h2>
            <p className="text-slate-600 mt-1">
              {singleCoBorrowerMode || isCurrentUserCoBorrower 
                ? 'Please provide your personal details as a co-borrower'
                : 'Add any co-borrowers for this loan application'}
            </p>
          </div>
          {showAddButton && (
            <Button onClick={() => setShowOptionsModal(true)} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" />
              Add Co-Borrower
            </Button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {coBorrowersToShow.map((coBorrower, displayIndex) => {
          // Calculate the actual index in the full coBorrowers array for updates
          const actualIndex = singleCoBorrowerMode && coBorrowerIndex >= 0 
            ? coBorrowerIndex 
            : (isCurrentUserCoBorrower && !canManage)
              ? currentUserCoBorrowerIndex
              : displayIndex;
          
          return (
            <CoBorrowerForm
              key={coBorrower.id}
              coBorrower={coBorrower}
              index={actualIndex}
              onUpdate={handleUpdateCoBorrower}
              onRemove={handleRemoveCoBorrower}
              isReadOnly={isReadOnly}
              canManage={canManage}
              currentUser={currentUser}
            />
          );
        })}
      </AnimatePresence>

      {coBorrowersToShow.length === 0 && (
        <div className="text-center py-8 text-slate-500">
          <p className="text-sm">No co-borrowers added yet</p>
          {showAddButton && (
            <p className="text-xs mt-1">Click "Add Co-Borrower" to get started</p>
          )}
        </div>
      )}

      <Dialog open={showOptionsModal} onOpenChange={setShowOptionsModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Co-Borrower</DialogTitle>
            <DialogDescription>
              Search for an existing borrower or invite a new one
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {!isBroker && (
              <Button
                variant="outline"
                className="w-full justify-start h-auto py-4"
                onClick={() => {
                  setShowSearchModal(true);
                  setShowOptionsModal(false);
                }}
              >
                <Search className="w-5 h-5 mr-3" />
                <div className="text-left">
                  <p className="font-semibold">Search Existing Borrowers</p>
                  <p className="text-xs text-slate-500">Find and select a registered borrower</p>
                </div>
              </Button>
            )}
            <Button
              variant="outline"
              className="w-full justify-start h-auto py-4"
              onClick={() => {
                setShowInviteModal(true);
                setShowOptionsModal(false);
              }}
            >
              <UserPlus className="w-5 h-5 mr-3" />
              <div className="text-left">
                <p className="font-semibold">Invite New Borrower</p>
                <p className="text-xs text-slate-500">Send an invitation to join the platform</p>
              </div>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <SearchExistingModal
        isOpen={showSearchModal}
        onClose={() => setShowSearchModal(false)}
        onSelect={handleSelectBorrower}
        items={allBorrowers}
        title="Search Existing Borrowers"
        placeholder="Search by name or email..."
        emptyMessage="No borrowers found."
        searchFields={['first_name', 'last_name', 'email']}
        renderItem={(borrower) => (
          <div className="flex flex-col items-start gap-0.5">
            <span className="font-medium text-sm text-slate-900">
              {borrower.first_name} {borrower.last_name}
            </span>
            <span className="text-xs text-slate-500">{borrower.email}</span>
            {!borrower.user_id && (
              <span className="text-xs text-amber-600 mt-0.5">Not linked to user account</span>
            )}
          </div>
        )}
      />

      <Dialog open={showInviteModal} onOpenChange={setShowInviteModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Invite New Co-Borrower</DialogTitle>
            <DialogDescription>
              Send an invitation to join the platform
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmitInvite} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="requested_first_name">First Name *</Label>
                <Input
                  id="requested_first_name"
                  value={inviteData.requested_first_name}
                  onChange={(e) => setInviteData({ ...inviteData, requested_first_name: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="requested_last_name">Last Name *</Label>
                <Input
                  id="requested_last_name"
                  value={inviteData.requested_last_name}
                  onChange={(e) => setInviteData({ ...inviteData, requested_last_name: e.target.value })}
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="requested_email">Email Address *</Label>
              <Input
                id="requested_email"
                type="email"
                value={inviteData.requested_email}
                onChange={(e) => setInviteData({ ...inviteData, requested_email: e.target.value })}
                required
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setShowInviteModal(false)}>
                Cancel
              </Button>
              <Button type="submit">
                Send Invitation
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showInviteLinkDialog} onOpenChange={setShowInviteLinkDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Co-Borrower to Link Account</DialogTitle>
            <DialogDescription>
              This borrower doesn't have a linked user account yet. Send them an invitation to create an account and link to this application.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-sm font-medium text-blue-900">
                {selectedBorrowerToLink?.first_name} {selectedBorrowerToLink?.last_name}
              </p>
              <p className="text-sm text-blue-700">{selectedBorrowerToLink?.email}</p>
              <p className="text-xs text-blue-600 mt-2">Application: #{data.application_number}</p>
              <p className="text-xs text-blue-600">Role: Co-Borrower</p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => {
                setShowInviteLinkDialog(false);
                setSelectedBorrowerToLink(null);
              }}>
                Cancel
              </Button>
              <Button onClick={handleSendLinkInvitation}>
                Send Invitation
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
});
