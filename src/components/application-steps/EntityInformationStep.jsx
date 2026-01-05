import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Building2, Search, Plus, Trash2, UserPlus } from "lucide-react";
import { BorrowerEntity, User } from "@/entities/all";


import { useToast } from "@/components/ui/use-toast";
import DynamicFormRenderer from '../forms/DynamicFormRenderer';
import { base44 } from "@/api/base44Client";
import SearchExistingModal from '../shared/SearchExistingModal';
import { syncEntities } from '@/components/utils/entitySyncHelper';

export default React.memo(function EntityInformationStep({
  data,
  onChange,
  isReadOnly,
  currentUser,
  canManage,
  onAddComment,
  fieldComments
}) {
  const [selectedEntity, setSelectedEntity] = useState(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteFirstName, setInviteFirstName] = useState('');
  const [inviteLastName, setInviteLastName] = useState('');
  const [showInviteForm, setShowInviteForm] = useState({});
  const [showSearchDialog, setShowSearchDialog] = useState(false);
  const [entitiesOwnedByPrimaryBorrower, setEntitiesOwnedByPrimaryBorrower] = useState([]);
  const { toast } = useToast();

  const loadSelectedEntity = useCallback(async () => {
    if (!data.borrower_entity_id) {
      setSelectedEntity(null);
      return;
    }

    try {
      const entity = await BorrowerEntity.get(data.borrower_entity_id);
      setSelectedEntity(entity);
    } catch (error) {
      console.error('Error loading selected entity:', error);
      setSelectedEntity(null);
    }
  }, [data.borrower_entity_id]);

  useEffect(() => {
    if (data.borrower_entity_id) {
      loadSelectedEntity();
    } else {
      setSelectedEntity(null);
    }
  }, [data.borrower_entity_id, loadSelectedEntity]);

  // Initialize entity_owners with primary borrower if empty
  useEffect(() => {
    // Check if there's a primary borrower (by ID or contact info) and no owners yet
    const hasPrimaryBorrower = data.primary_borrower_id || (data.borrower_first_name && data.borrower_email);
    
    if (hasPrimaryBorrower && (!data.entity_owners || data.entity_owners.length === 0)) {
      const primaryBorrowerName =
        data.borrower_first_name && data.borrower_last_name
          ? `${data.borrower_first_name} ${data.borrower_last_name}`
          : 'Primary Borrower';

      onChange({
        entity_owners: [{
          borrower_id: data.primary_borrower_id || '',
          name: primaryBorrowerName,
          ownership_percentage: 51
        }]
      });
    }
  }, [
    data.primary_borrower_id,
    data.borrower_first_name,
    data.borrower_last_name,
    data.borrower_email,
    data.entity_owners,
    onChange
  ]);

  useEffect(() => {
    const loadEntities = async () => {
      try {
        let primaryBorrowerId = null;
        
        // Try to find borrower by user_id if primary_borrower_id exists
        if (data.primary_borrower_id) {
          const borrowers = await base44.entities.Borrower.filter({ user_id: data.primary_borrower_id });
          if (borrowers && borrowers.length > 0) {
            primaryBorrowerId = borrowers[0].id;
          }
        }
        
        // If no borrower found by user_id, try to find by email
        if (!primaryBorrowerId && data.borrower_email) {
          const borrowersByEmail = await base44.entities.Borrower.filter({ email: data.borrower_email });
          if (borrowersByEmail && borrowersByEmail.length > 0) {
            primaryBorrowerId = borrowersByEmail[0].id;
          }
        }
        
        if (!primaryBorrowerId) {
          setEntitiesOwnedByPrimaryBorrower([]);
          return;
        }
        
        const allEntities = await BorrowerEntity.list();
        const ownedEntities = allEntities.filter((entity) => 
          entity.ownership_structure?.some(
            (owner) => owner.borrower_id === primaryBorrowerId
          )
        );
        setEntitiesOwnedByPrimaryBorrower(ownedEntities);
      } catch (error) {
        console.error('Error loading entities:', error);
      }
    };
    
    // Enable loading if we have either primary_borrower_id OR borrower email
    if (data.primary_borrower_id || data.borrower_email) {
      loadEntities();
    }
  }, [data.primary_borrower_id, data.borrower_email]);

  const handleSelectEntity = (entity) => {
    setSelectedEntity(entity);
    const mappedData = syncEntities('BorrowerEntity', 'LoanApplication', entity);
    onChange({
      borrower_entity_id: entity.id,
      ...mappedData,
      overridden_fields: []
    });

    toast({
      title: "Entity Selected",
      description: `${entity.entity_name} has been added to the application.`
    });
    
    setShowSearchDialog(false);
  };

  const handleClearEntity = () => {
    setSelectedEntity(null);

    const primaryBorrowerName =
      data.borrower_first_name && data.borrower_last_name
        ? `${data.borrower_first_name} ${data.borrower_last_name}`
        : 'Primary Borrower';

    onChange({
      borrower_entity_id: null,
      entity_name: '',
      entity_ein: '',
      entity_type: '',
      entity_address_street: '',
      entity_address_unit: '',
      entity_address_city: '',
      entity_address_state: '',
      entity_address_zip: '',
      entity_mailing_address_street: '',
      entity_mailing_address_unit: '',
      entity_mailing_address_city: '',
      entity_mailing_address_state: '',
      entity_mailing_address_zip_code: '',
      entity_owners: [{
        borrower_id: data.primary_borrower_id,
        name: primaryBorrowerName,
        ownership_percentage: 100
      }],
      overridden_fields: []
    });
  };

  const handleAddOwner = () => {
    const newOwners = [...(data.entity_owners || []), {
      borrower_id: '',
      name: '',
      ownership_percentage: 0
    }];
    onChange({ entity_owners: newOwners });
  };

  const handleRemoveOwner = (index) => {
    if (index === 0) {
      toast({
        variant: "destructive",
        title: "Cannot Remove",
        description: "Cannot remove the primary borrower from entity ownership.",
      });
      return;
    }

    const newOwners = [...data.entity_owners];
    newOwners.splice(index, 1);
    onChange({ entity_owners: newOwners });
  };

  const handleOwnerChange = (index, field, value) => {
    const newOwners = [...data.entity_owners];

    if (field === 'ownership_percentage') {
      let numValue = parseFloat(value);
      if (numValue < 0) numValue = 0;
      if (numValue > 100) numValue = 100;
      newOwners[index][field] = numValue || 0;
    } else {
      newOwners[index][field] = value;
    }

    onChange({ entity_owners: newOwners });
  };

  const handleInviteAsCoBorrower = async (index) => {
    const owner = data.entity_owners[index];

    if (!owner.name || !inviteEmail) {
      toast({
        variant: "destructive",
        title: "Missing Information",
        description: "Please provide both name and email for the invitation.",
      });
      return;
    }

    try {
      const allUsers = await User.list();
      const existingUser = allUsers.find(
        (u) => u.email?.toLowerCase() === inviteEmail.toLowerCase()
      ) || null;

      if (existingUser) {
        const newCoBorrower = {
          id: `cb_${Date.now()}`,
          user_id: existingUser.id,
          first_name: existingUser.first_name || inviteFirstName,
          last_name: existingUser.last_name || inviteLastName,
          email: existingUser.email,
          completion_status: 'pending'
        };

        const updatedCoBorrowers = [...(data.co_borrowers || []), newCoBorrower];
        const newOwners = [...data.entity_owners];
        newOwners[index].borrower_id = existingUser.id;

        onChange({
          co_borrowers: updatedCoBorrowers,
          entity_owners: newOwners
        });

        toast({
          title: "Co-Borrower Added",
          description: `${existingUser.first_name} ${existingUser.last_name} has been added as a co-borrower.`,
        });
      } else {
        const [firstName, ...lastNameParts] = owner.name.split(' ');
        const lastName = lastNameParts.join(' ');

        await base44.functions.invoke('emailService', {
          email_type: 'invite_co_borrower',
          recipient_email: inviteEmail,
          recipient_name: `${inviteFirstName || firstName} ${inviteLastName || lastName}`,
          data: {
            first_name: inviteFirstName || firstName,
            last_name: inviteLastName || lastName,
            inviter_name: `${currentUser.first_name} ${currentUser.last_name}`,
            application_number: data.application_number,
            application_id: data.id,
            inviter_id: currentUser.id
          }
        });

        const newCoBorrower = {
          id: `cb_${Date.now()}`,
          first_name: inviteFirstName || firstName,
          last_name: inviteLastName || lastName,
          email: inviteEmail,
          completion_status: 'pending'
        };

        const updatedCoBorrowers = [...(data.co_borrowers || []), newCoBorrower];
        
        onChange({
          co_borrowers: updatedCoBorrowers
        });

        toast({
          title: "Invitation Sent",
          description: `An invitation has been sent to ${inviteEmail}.`,
        });
      }

      setShowInviteForm({ ...showInviteForm, [index]: false });
      setInviteEmail('');
      setInviteFirstName('');
      setInviteLastName('');
    } catch (error) {
      console.error('Error inviting co-borrower:', error);
      toast({
        variant: "destructive",
        title: "Invitation Failed",
        description: "Failed to send invitation. Please try again.",
      });
    }
  };

  const getTotalOwnership = () => {
    return (data.entity_owners || []).reduce(
      (sum, owner) => sum + (owner.ownership_percentage || 0),
      0
    );
  };

  const totalOwnership = getTotalOwnership();

  return (
    <div className="space-y-8">
      {/* Entity Search Section */}
      {!isReadOnly && (
        <div className="flex gap-2 justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSearchDialog(true)}
            disabled={!data.primary_borrower_id && !data.borrower_email}
            className="text-xs"
            title={(!data.primary_borrower_id && !data.borrower_email) ? "Please add primary borrower first" : ""}
          >
            <Search className="w-3.5 h-3.5 mr-1.5" />
            Search Existing Entities
          </Button>
          {data.borrower_entity_id && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearEntity}
              className="text-xs"
            >
              Clear Selection
            </Button>
          )}
        </div>
      )}

      {/* Entity Details Form */}
      <DynamicFormRenderer
        context="application"
        categoryFilter="entityInformation"
        data={data}
        onChange={onChange}
        isReadOnly={isReadOnly}
        onAddComment={onAddComment}
        fieldComments={fieldComments}
        canManage={canManage}
        applicationStatus={data.status}
        showTabs={false}
        currentUser={currentUser}
        profileType="borrowing_entity"
        profileId={data.borrower_entity_id}
      />

      {/* Ownership Structure Section */}
      <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg font-semibold">Ownership Structure</CardTitle>
              {totalOwnership > 0 && (
                <p className="text-sm text-slate-600 mt-2">
                  Total Ownership:{' '}
                  <span
                    className={
                      totalOwnership > 100
                        ? 'text-red-600 font-semibold'
                        : 'font-semibold'
                    }
                  >
                    {totalOwnership}%
                  </span>
                  {totalOwnership > 100 && (
                    <span className="text-red-600 ml-2">(Cannot exceed 100%)</span>
                  )}
                </p>
              )}
            </div>
            {!isReadOnly && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddOwner}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Owner
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {(data.entity_owners || []).map((owner, index) => (
            <Card key={index} className="border border-slate-200 bg-slate-50">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg flex items-center justify-center text-white font-bold">
                      {index + 1}
                    </div>
                    <p className="font-semibold text-slate-900">
                      {index === 0 ? 'Primary Borrower' : `Owner #${index + 1}`}
                    </p>
                  </div>
                  {!isReadOnly && index > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveOwner(index)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>Name *</Label>
                    <Input
                      value={owner.name || ''}
                      onChange={(e) =>
                        handleOwnerChange(index, 'name', e.target.value)
                      }
                      disabled={isReadOnly || index === 0}
                      placeholder="John Smith"
                      className={index === 0 ? 'bg-slate-100' : ''}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Ownership Percentage *</Label>
                    <div className="relative">
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={owner.ownership_percentage || 0}
                        onChange={(e) =>
                          handleOwnerChange(
                            index,
                            'ownership_percentage',
                            e.target.value
                          )
                        }
                        disabled={isReadOnly}
                        placeholder="50"
                        className="pr-10"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
                        %
                      </span>
                    </div>
                  </div>
                </div>

                {/* Invite as Co-Borrower button for additional owners */}
                {!isReadOnly &&
                  index > 0 &&
                  !owner.borrower_id &&
                  !owner.invitation_id && (
                    <div className="mt-6 pt-6 border-t">
                      {!showInviteForm[index] ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setShowInviteForm({
                              ...showInviteForm,
                              [index]: true
                            })
                          }
                        >
                          <UserPlus className="w-4 h-4 mr-2" />
                          Invite as Co-Borrower
                        </Button>
                      ) : (
                        <div className="space-y-4">
                          <p className="text-sm text-slate-600">
                            Send an invitation to this owner to join as a co-borrower
                          </p>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>First Name</Label>
                              <Input
                                value={inviteFirstName}
                                onChange={(e) =>
                                  setInviteFirstName(e.target.value)
                                }
                                placeholder="First name"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Last Name</Label>
                              <Input
                                value={inviteLastName}
                                onChange={(e) =>
                                  setInviteLastName(e.target.value)
                                }
                                placeholder="Last name"
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label>Email *</Label>
                            <Input
                              type="email"
                              value={inviteEmail}
                              onChange={(e) => setInviteEmail(e.target.value)}
                              placeholder="email@example.com"
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => handleInviteAsCoBorrower(index)}
                            >
                              Send Invitation
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setShowInviteForm({
                                  ...showInviteForm,
                                  [index]: false
                                });
                                setInviteEmail('');
                                setInviteFirstName('');
                                setInviteLastName('');
                              }}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                {/* Show status if already invited or linked */}
                {index > 0 && (owner.borrower_id || owner.invitation_id) && (
                  <div className="mt-4 pt-4 border-t">
                    <p className="text-sm text-emerald-600 flex items-center gap-2">
                      {owner.borrower_id ? (
                        <>
                          <Building2 className="w-4 h-4" />
                          Linked as co-borrower
                        </>
                      ) : (
                        <>
                          <UserPlus className="w-4 h-4" />
                          Invitation sent
                        </>
                      )}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}

          {(!data.entity_owners || data.entity_owners.length === 0) && (
            <Card className="border-dashed border-2 border-slate-300">
              <CardContent className="p-8 text-center text-slate-500">
                <Building2 className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No owners added yet.</p>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      <SearchExistingModal
        isOpen={showSearchDialog}
        onClose={() => setShowSearchDialog(false)}
        onSelect={handleSelectEntity}
        items={entitiesOwnedByPrimaryBorrower}
        title={`Search ${data.borrower_first_name} ${data.borrower_last_name}'s Entities`}
        description="Search by entity name"
        placeholder="Enter entity name..."
        searchFields={['entity_name', 'entity_type', 'registration_number']}
        renderItem={(entity) => (
          <div className="flex flex-col items-start gap-0.5">
            <span className="font-medium text-sm text-slate-900">{entity.entity_name}</span>
            <span className="text-xs text-slate-500">
              {entity.entity_type} • EIN: {entity.registration_number || 'N/A'}
            </span>
            {entity.ownership_structure && entity.ownership_structure.length > 0 && (
              <span className="text-xs text-slate-500 mt-0.5">
                Owners: {entity.ownership_structure.map((o) => o.owner_name).join(', ')}
              </span>
            )}
          </div>
        )}
      />
    </div>
  );
});