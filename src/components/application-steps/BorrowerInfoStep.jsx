import React, { useState, useEffect } from 'react';
import { Search, UserPlus } from 'lucide-react';
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { base44 } from "@/api/base44Client";
import DynamicFormRenderer from '../forms/DynamicFormRenderer';
import SearchExistingModal from '../shared/SearchExistingModal';
import { syncEntities } from '@/components/utils/entitySyncHelper';

export default function BorrowerInfoStep({ applicationData, onUpdate, isReadOnly = false }) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [showSearchDialog, setShowSearchDialog] = useState(false);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [showInviteLinkDialog, setShowInviteLinkDialog] = useState(false);
  const [selectedBorrowerToLink, setSelectedBorrowerToLink] = useState(null);
  const [allBorrowers, setAllBorrowers] = useState([]);
  const [inviteForm, setInviteForm] = useState({
    first_name: '',
    last_name: '',
    email: ''
  });
  const { toast } = useToast();

  useEffect(() => {
    const initializeBorrowerData = async () => {
      if (isInitialized) return;
      
      try {
        const user = await base44.auth.me();
        setCurrentUser(user);
        
        const borrowers = await base44.entities.Borrower.list();
        const currentBorrowerIds = [
          applicationData.primary_borrower_id,
          ...(applicationData.co_borrowers || []).map(cb => cb.user_id || cb.borrower_id)
        ].filter(Boolean);
        const filteredBorrowers = borrowers.filter(
          b => !currentBorrowerIds.includes(b.user_id) && !currentBorrowerIds.includes(b.id)
        );
        setAllBorrowers(filteredBorrowers);
        
        // Auto-populate borrower information for borrowers while completing the application.
        if (!isReadOnly && user.app_role === 'Borrower') {
          const userBorrower = borrowers.find(b => b.user_id === user.id);
          const mappedData = userBorrower
            ? syncEntities('Borrower', 'LoanApplication', userBorrower)
            : {
                borrower_first_name: user.first_name || '',
                borrower_last_name: user.last_name || '',
                borrower_email: user.email || ''
              };

          const updatedData = { ...applicationData };
          if (!updatedData.primary_borrower_id) {
            updatedData.primary_borrower_id = user.id;
          }

          Object.entries(mappedData).forEach(([key, value]) => {
            const currentValue = updatedData[key];
            if (currentValue === null || currentValue === undefined || currentValue === '') {
              updatedData[key] = value;
            }
          });

          onUpdate(updatedData);
        }
        
        setIsInitialized(true);
      } catch (error) {
        console.error('Error fetching user data:', error);
        setIsInitialized(true);
      }
    };

    initializeBorrowerData();
  }, [isInitialized, applicationData, onUpdate]);

  const handleSelectBorrower = (borrower) => {
    // When selecting from Borrower Info step, always set as primary borrower
    // regardless of whether they have a user_id yet
    const mappedData = syncEntities('Borrower', 'LoanApplication', borrower);
    
    if (borrower.user_id) {
      onUpdate({
        ...applicationData,
        primary_borrower_id: borrower.user_id,
        ...mappedData
      });
      toast({
        title: "Primary Borrower Selected",
        description: `${borrower.first_name} ${borrower.last_name} has been set as the primary borrower.`
      });
      setShowSearchDialog(false);
    } else {
      // Set the borrower info but mark that invitation is pending
      onUpdate({
        ...applicationData,
        primary_borrower_id: borrower.id,
        ...mappedData,
        borrower_invitation_status: 'pending'
      });
      setSelectedBorrowerToLink(borrower);
      setShowInviteLinkDialog(true);
      setShowSearchDialog(false);
    }
  };

  const handleSendLinkInvitation = async () => {
    if (!selectedBorrowerToLink) return;

    try {
      await base44.functions.invoke('emailService', {
        email_type: 'invite_borrower',
        recipient_email: selectedBorrowerToLink.email,
        recipient_name: `${selectedBorrowerToLink.first_name} ${selectedBorrowerToLink.last_name}`,
        data: {
          first_name: selectedBorrowerToLink.first_name,
          last_name: selectedBorrowerToLink.last_name,
          application_number: applicationData.application_number,
          application_id: applicationData.id,
          role: 'Borrower'
        }
      });

      await base44.entities.Borrower.update(selectedBorrowerToLink.id, {
        invitation_status: 'invited',
        invitation_sent_date: new Date().toISOString()
      });

      toast({
        title: "Invitation Sent",
        description: `Invitation sent to ${selectedBorrowerToLink.email} to link their account.`
      });

      setShowInviteLinkDialog(false);
      setSelectedBorrowerToLink(null);
    } catch (error) {
      console.error('Error sending link invitation:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to send invitation. Please try again."
      });
    }
  };

  const handleInvite = async () => {
    if (!inviteForm.first_name || !inviteForm.last_name || !inviteForm.email) {
      toast({
        variant: "destructive",
        title: "Required Fields",
        description: "Please fill in all required fields."
      });
      return;
    }

    try {
      await base44.functions.invoke('emailService', {
        email_type: 'invite_borrower',
        recipient_email: inviteForm.email,
        recipient_name: `${inviteForm.first_name} ${inviteForm.last_name}`,
        data: {
          first_name: inviteForm.first_name,
          last_name: inviteForm.last_name
        }
      });

      toast({
        title: "Invitation Sent",
        description: `An invitation has been sent to ${inviteForm.email}.`
      });

      setShowInviteDialog(false);
      setInviteForm({ first_name: '', last_name: '', email: '' });
    } catch (error) {
      console.error('Error sending invitation:', error);
      toast({
        variant: "destructive",
        title: "Invitation Failed",
        description: "Failed to send invitation. Please try again."
      });
    }
  };

  const handleDataChange = (newData) => {
    onUpdate(newData);
  };

  const canSearchOrInvite = !isReadOnly && currentUser && (
    currentUser.role === 'admin' ||
    currentUser.app_role === 'Administrator' ||
    currentUser.app_role === 'Loan Officer'
  );

  if (!currentUser) {
    return <div className="p-8 text-center">Loading...</div>;
  }

  return (
    <div className="space-y-4">
      {canSearchOrInvite && (
        <div className="flex gap-2 justify-end mb-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSearchDialog(true)}
            className="text-xs"
          >
            <Search className="w-3.5 h-3.5 mr-1.5" />
            Search Existing
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowInviteDialog(true)}
            className="text-xs"
          >
            <UserPlus className="w-3.5 h-3.5 mr-1.5" />
            Invite New
          </Button>
        </div>
      )}

      <DynamicFormRenderer
        context="application"
        categoryFilter="borrowerInformation"
        data={applicationData}
        onChange={handleDataChange}
        isReadOnly={isReadOnly}
        showTabs={false}
        currentUser={currentUser}
        profileType="borrower"
        profileId={applicationData.primary_borrower_id}
        onAddComment={applicationData.onAddComment}
        fieldComments={applicationData.fieldComments || applicationData.field_comments}
        canManage={applicationData.canManage}
        applicationStatus={applicationData.status}
      />

      <SearchExistingModal
        isOpen={showSearchDialog}
        onClose={() => setShowSearchDialog(false)}
        onSelect={handleSelectBorrower}
        items={allBorrowers}
        title="Search Existing Borrowers"
        description="Search by name or email to find an existing borrower"
        placeholder="Enter name or email..."
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

      <Dialog open={showInviteLinkDialog} onOpenChange={setShowInviteLinkDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Borrower to Link Account</DialogTitle>
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
              <p className="text-xs text-blue-600 mt-2">Application: #{applicationData.application_number}</p>
              <p className="text-xs text-blue-600">Role: Borrower</p>
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

      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite New Borrower</DialogTitle>
            <DialogDescription>
              Send an invitation to a new borrower to join the platform
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>First Name *</Label>
              <Input
                value={inviteForm.first_name}
                onChange={(e) => setInviteForm({ ...inviteForm, first_name: e.target.value })}
              />
            </div>
            <div>
              <Label>Last Name *</Label>
              <Input
                value={inviteForm.last_name}
                onChange={(e) => setInviteForm({ ...inviteForm, last_name: e.target.value })}
              />
            </div>
            <div>
              <Label>Email *</Label>
              <Input
                type="email"
                value={inviteForm.email}
                onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowInviteDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleInvite}>
                Send Invitation
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
