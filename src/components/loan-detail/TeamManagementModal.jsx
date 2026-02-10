import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, UserPlus, Trash2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";

export default function TeamManagementModal({ isOpen, onClose, loan, onUpdate, onRefresh }) {
  const { toast } = useToast();
  const [allUsers, setAllUsers] = useState([]);
  const [allBorrowers, setAllBorrowers] = useState([]);
  const [allReferrerPartners, setAllReferrerPartners] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Team member states
  const [borrowerIds, setBorrowerIds] = useState([]);
  const [loanOfficerIds, setLoanOfficerIds] = useState([]);
  const [guarantorIds, setGuarantorIds] = useState([]);
  const [referrerIds, setReferrerIds] = useState([]);
  const [liaisonIds, setLiaisonIds] = useState([]);
  
  // New member to add
  const [newMemberRole, setNewMemberRole] = useState('');
  const [newMemberId, setNewMemberId] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadUsers();
    }
  }, [isOpen, loan]);

  useEffect(() => {
    if (!isOpen) return;
    const borrowerIdsRaw = loan?.borrower_ids || [];
    const liaisonBorrowerIds = new Set(
      (allBorrowers || [])
        .filter(b => b.borrower_type === 'liaison')
        .flatMap(b => [b.id, b.user_id].filter(Boolean))
    );
    const nextLiaisonIds = borrowerIdsRaw.filter(id => liaisonBorrowerIds.has(id));
    const nextBorrowerIds = borrowerIdsRaw.filter(id => !liaisonBorrowerIds.has(id));
    setBorrowerIds(nextBorrowerIds);
    setLoanOfficerIds(loan?.loan_officer_ids || []);
    setGuarantorIds(loan?.guarantor_ids || []);
    setReferrerIds(loan?.referrer_ids || []);
    setLiaisonIds(nextLiaisonIds.length > 0 ? nextLiaisonIds : (loan?.liaison_ids || []));
  }, [isOpen, loan, allBorrowers]);

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const usersResponse = await base44.functions.invoke('getAllUsers');
      const allUsers = usersResponse.data.users || [];
      setAllUsers(allUsers);
      
      // Load borrowers
      const borrowers = await base44.entities.Borrower.list();
      setAllBorrowers(borrowers || []);
      
      // Load referrer loan partners
      const loanPartners = await base44.entities.LoanPartner.filter({ type: 'Referral Partner' });
      setAllReferrerPartners(loanPartners || []);
    } catch (error) {
      console.error('Error loading users:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load users.",
      });
    }
    setIsLoading(false);
  };

  const getUserDisplayName = (userId, roleKey) => {
    // For guarantors and liaisons, look in borrowers
    if (roleKey === 'guarantor' || roleKey === 'liaison') {
      const borrower = allBorrowers.find(b => b.id === userId);
      if (borrower && borrower.first_name && borrower.last_name) {
        return `${borrower.first_name} ${borrower.last_name}`;
      }
      return 'Unknown Contact';
    }
    
    // For referrers, look in loan partners
    if (roleKey === 'referrer') {
      const partner = allReferrerPartners.find(p => p.id === userId);
      if (partner && partner.name) {
        return partner.name;
      }
      return 'Unknown Partner';
    }
    
    // For others, look in users
    const user = allUsers.find(u => u.id === userId);
    if (user && user.first_name && user.last_name) {
      return `${user.first_name} ${user.last_name}`;
    }
    return 'Unknown User';
  };

  const getUserRole = (userId, roleKey) => {
    if (roleKey === 'guarantor' || roleKey === 'liaison') {
      return 'Borrower';
    }
    if (roleKey === 'referrer') {
      return 'Loan Partner';
    }
    const user = allUsers.find(u => u.id === userId);
    return user?.app_role || '';
  };

  const handleAddMember = () => {
    if (!newMemberRole || !newMemberId) return;

    switch (newMemberRole) {
      case 'borrower':
        if (!borrowerIds.includes(newMemberId)) {
          setBorrowerIds([...borrowerIds, newMemberId]);
        }
        break;
      case 'loan_officer':
        if (!loanOfficerIds.includes(newMemberId)) {
          setLoanOfficerIds([...loanOfficerIds, newMemberId]);
        }
        break;
      case 'guarantor':
        if (!guarantorIds.includes(newMemberId)) {
          setGuarantorIds([...guarantorIds, newMemberId]);
        }
        break;
      case 'referrer':
        if (!referrerIds.includes(newMemberId)) {
          setReferrerIds([...referrerIds, newMemberId]);
        }
        break;
      case 'liaison':
        if (!liaisonIds.includes(newMemberId)) {
          setLiaisonIds([...liaisonIds, newMemberId]);
        }
        break;
    }
    
    setNewMemberRole('');
    setNewMemberId('');
  };

  const handleRemoveMember = (userId, role) => {
    switch (role) {
      case 'borrower':
        setBorrowerIds(borrowerIds.filter(id => id !== userId));
        break;
      case 'loan_officer':
        setLoanOfficerIds(loanOfficerIds.filter(id => id !== userId));
        break;
      case 'guarantor':
        setGuarantorIds(guarantorIds.filter(id => id !== userId));
        break;
      case 'referrer':
        setReferrerIds(referrerIds.filter(id => id !== userId));
        break;
      case 'liaison':
        setLiaisonIds(liaisonIds.filter(id => id !== userId));
        break;
    }
  };

  const buildTeamPayload = () => {
    const teamFieldKeys = [
      'borrower_ids',
      'loan_officer_ids',
      'guarantor_ids',
      'referrer_ids',
      'liaison_ids'
    ];
    let nextBorrowerIds = [...borrowerIds];
    let nextLoanOfficerIds = [...loanOfficerIds];
    let nextGuarantorIds = [...guarantorIds];
    let nextReferrerIds = [...referrerIds];
    let nextLiaisonIds = [...liaisonIds];

    if (newMemberRole && newMemberId) {
      switch (newMemberRole) {
        case 'borrower':
          if (!nextBorrowerIds.includes(newMemberId)) {
            nextBorrowerIds.push(newMemberId);
          }
          break;
        case 'loan_officer':
          if (!nextLoanOfficerIds.includes(newMemberId)) {
            nextLoanOfficerIds.push(newMemberId);
          }
          break;
        case 'guarantor':
          if (!nextGuarantorIds.includes(newMemberId)) {
            nextGuarantorIds.push(newMemberId);
          }
          break;
        case 'referrer':
          if (!nextReferrerIds.includes(newMemberId)) {
            nextReferrerIds.push(newMemberId);
          }
          break;
        case 'liaison':
          if (!nextLiaisonIds.includes(newMemberId)) {
            nextLiaisonIds.push(newMemberId);
          }
          break;
      }
    }

    const mergedBorrowerIds = Array.from(
      new Set([...nextBorrowerIds, ...nextLiaisonIds])
    );

    return {
      borrower_ids: mergedBorrowerIds,
      loan_officer_ids: nextLoanOfficerIds,
      guarantor_ids: nextGuarantorIds,
      referrer_ids: nextReferrerIds,
      liaison_ids: nextLiaisonIds,
      overridden_fields: Array.from(
        new Set([...(loan?.overridden_fields || []), ...teamFieldKeys])
      )
    };
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const teamPayload = buildTeamPayload();
      await onUpdate(teamPayload);
      
      toast({
        title: "Team Updated",
        description: "Loan team has been updated successfully.",
      });
      
      if (onRefresh) {
        await onRefresh();
      }
      onClose();
    } catch (error) {
      console.error('Error updating team:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update team.",
      });
    }
    setIsSaving(false);
  };

  // Get available users filtered by selected role
  const getAvailableUsersForRole = () => {
    if (!newMemberRole) return [];
    
    let existingIds = [];
    
    switch (newMemberRole) {
      case 'borrower':
        existingIds = borrowerIds;
        return allUsers.filter(u => 
          u.app_role === 'Borrower' && !existingIds.includes(u.id)
        );
      case 'loan_officer':
        existingIds = loanOfficerIds;
        return allUsers.filter(u => 
          u.app_role === 'Loan Officer' && !existingIds.includes(u.id)
        );
      case 'guarantor':
        existingIds = guarantorIds;
        return allBorrowers.filter(b => !existingIds.includes(b.id));
      case 'referrer':
        existingIds = referrerIds;
        return allReferrerPartners.filter(p => !existingIds.includes(p.id));
      case 'liaison':
        existingIds = liaisonIds;
        return allBorrowers.filter(b => b.borrower_type === 'liaison' && !existingIds.includes(b.id));
    }
    
    return [];
  };

  const renderTeamSection = (title, memberIds, roleKey) => {
    if (memberIds.length === 0) return null;
    
    return (
      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-slate-700">{title}</h4>
        <div className="space-y-2">
          {memberIds.map(userId => (
            <div key={userId} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-900">{getUserDisplayName(userId, roleKey)}</p>
                <p className="text-xs text-slate-500">{getUserRole(userId, roleKey)}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleRemoveMember(userId, roleKey)}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const availableUsers = getAvailableUsersForRole();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Loan Team</DialogTitle>
          <DialogDescription>
            Add or remove team members for this loan
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : (
            <>
              {/* Add New Member Section */}
              <div className="p-4 border rounded-lg bg-slate-50 space-y-3">
                <h4 className="text-sm font-semibold text-slate-900">Add Team Member</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Role</Label>
                    <Select value={newMemberRole} onValueChange={(value) => {
                      setNewMemberRole(value);
                      setNewMemberId(''); // Reset user selection when role changes
                    }}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="loan_officer">Loan Officer</SelectItem>
                        <SelectItem value="guarantor">Guarantor</SelectItem>
                        <SelectItem value="liaison">Liaison</SelectItem>
                        <SelectItem value="referrer">Referrer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>User</Label>
                    <Select 
                      value={newMemberId} 
                      onValueChange={setNewMemberId}
                      disabled={!newMemberRole}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={newMemberRole ? "Select user" : "Select role first"} />
                      </SelectTrigger>
                      <SelectContent>
                        {availableUsers.map(item => {
                          const displayName = 
                            (newMemberRole === 'guarantor' && item.first_name && item.last_name)
                              ? `${item.first_name} ${item.last_name}`
                            : (newMemberRole === 'referrer' && item.name)
                              ? item.name
                            : (item.first_name && item.last_name)
                              ? `${item.first_name} ${item.last_name}`
                              : item.email || item.name || 'Unknown';
                          
                          return (
                            <SelectItem key={item.id} value={item.id}>
                              {displayName}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button 
                  onClick={handleAddMember}
                  disabled={!newMemberRole || !newMemberId}
                  className="w-full"
                >
                  <UserPlus className="w-4 h-4 mr-2" />
                  Add to Team
                </Button>
              </div>

              {/* Current Team Members */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-slate-900">Current Team</h4>
                {renderTeamSection('Borrowers', borrowerIds, 'borrower')}
                {renderTeamSection('Loan Officers', loanOfficerIds, 'loan_officer')}
                {renderTeamSection('Guarantors', guarantorIds, 'guarantor')}
                {renderTeamSection('Liaisons', liaisonIds, 'liaison')}
                {renderTeamSection('Referrers', referrerIds, 'referrer')}
                
                {borrowerIds.length === 0 && loanOfficerIds.length === 0 && 
                 guarantorIds.length === 0 && liaisonIds.length === 0 && referrerIds.length === 0 && (
                  <p className="text-sm text-slate-500 text-center py-4">No team members added yet</p>
                )}
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || isLoading}>
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
