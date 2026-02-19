import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { User, Loan, Message } from "@/entities/all";
import { Loader2, User as UserIcon, Hash } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { base44 } from "@/api/base44Client";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

export default function NewConversationModal({ isOpen, onClose, currentUser, onCreated, permissions }) {
  const [users, setUsers] = useState([]);
  const [loans, setLoans] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [selectedRoles, setSelectedRoles] = useState({
    borrowers: true,
    loan_officers: true,
    referrers: true
  });
  const [isCreating, setIsCreating] = useState(false);
  const [activeTab, setActiveTab] = useState("direct");

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    try {
      let allUsers = [];
      let allLoans = [];
      
      // Try to load users - may fail for non-admin users
      try {
        allUsers = await User.list();
      } catch (userError) {
        console.log('Cannot load all users (permission denied), will load loan officers only');
        // For borrowers/loan partners who can't list all users,
        // we need to still show loan officers they can message
        // Try to get loan officers from a different approach
        allUsers = [];
      }

      if (permissions.canMessageOnlyLoanOfficers) {
        const hasLoanOfficer = allUsers.some(u => 
          u.app_role === 'Loan Officer' || 
          u.app_role === 'Administrator' ||
          u.role === 'admin'
        );
        if (!hasLoanOfficer) {
          try {
            const response = await base44.functions.invoke('getLoanOfficers');
            allUsers = response?.data?.users || [];
          } catch (loanOfficerError) {
            console.log('Cannot load loan officers:', loanOfficerError);
            allUsers = [];
          }
        }
      }
      
      // Try to load loans - may fail for some users
      try {
        allLoans = await Loan.list();
      } catch (loanError) {
        console.log('Cannot load loans:', loanError);
        allLoans = [];
      }
      
      // Rule 12: Filter users based on permissions
      let filteredUsers = allUsers.filter(u => u.id !== currentUser?.id); // Exclude self
      
      if (permissions.canMessageOnlyLoanOfficers) {
        // Non-admin/non-LO users can only message loan officers
        filteredUsers = filteredUsers.filter(u => 
          u.app_role === 'Loan Officer'
        );
      }
      // Otherwise (canMessageAnyUser), show all users except self
      
      setUsers(filteredUsers);
      setLoans(allLoans);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const handleCreateDirect = async () => {
    if (!selectedUser || isCreating) return;
    
    setIsCreating(true);
    try {
      const conversationId = [currentUser.id, selectedUser.id].sort().join('_');
      
      // Check if conversation already exists
      const existingMessages = await Message.filter({ conversation_id: conversationId });
      
      if (existingMessages.length === 0) {
        // Create initial message to start conversation
        await Message.create({
          conversation_id: conversationId,
          conversation_type: 'direct',
          sender_id: currentUser.id,
          sender_name: currentUser.full_name || currentUser.email,
          participant_ids: [currentUser.id, selectedUser.id],
          participant_names: [
            currentUser.full_name || currentUser.email,
            selectedUser.full_name || selectedUser.email
          ],
          content: "👋 Started a conversation",
          read_by: [currentUser.id],
          attachments: []
        });
      }
      
      onCreated();
      onClose();
      setSelectedUser(null);
    } catch (error) {
      console.error('Error creating conversation:', error);
    }
    setIsCreating(false);
  };

  const handleCreateLoanChannel = async () => {
    if (!selectedLoan || isCreating) return;
    
    setIsCreating(true);
    try {
      const conversationId = `loan_${selectedLoan.id}`;
      
      // Get participants based on selected roles
      const participantIds = [currentUser.id];
      
      if (selectedRoles.borrowers && selectedLoan.borrower_ids) {
        participantIds.push(...selectedLoan.borrower_ids);
      }
      if (selectedRoles.loan_officers && selectedLoan.loan_officer_ids) {
        participantIds.push(...selectedLoan.loan_officer_ids);
      }
      if (selectedRoles.referrers && selectedLoan.referrer_ids) {
        participantIds.push(...selectedLoan.referrer_ids);
      }
      
      // Remove duplicates
      const uniqueParticipants = [...new Set(participantIds)];
      
      // Check if channel already exists
      const existingMessages = await Message.filter({ conversation_id: conversationId });
      
      if (existingMessages.length === 0) {
        // Create initial message
        await Message.create({
          conversation_id: conversationId,
          conversation_type: 'loan_channel',
          sender_id: currentUser.id,
          sender_name: currentUser.full_name || currentUser.email,
          participant_ids: uniqueParticipants,
          content: `📋 Created loan channel for ${selectedLoan.loan_number || selectedLoan.primary_loan_id}`,
          loan_id: selectedLoan.id,
          loan_number: selectedLoan.loan_number || selectedLoan.primary_loan_id,
          read_by: [currentUser.id],
          attachments: []
        });
      }
      
      onCreated();
      onClose();
      setSelectedLoan(null);
      setSelectedRoles({
        borrowers: true,
        loan_officers: true,
        referrers: true
      });
    } catch (error) {
      console.error('Error creating loan channel:', error);
    }
    setIsCreating(false);
  };

  const toggleRole = (role) => {
    setSelectedRoles(prev => ({
      ...prev,
      [role]: !prev[role]
    }));
  };

  const getRoleCount = (loan, role) => {
    const roleMap = {
      borrowers: loan.borrower_ids?.length || 0,
      loan_officers: loan.loan_officer_ids?.length || 0,
      referrers: loan.referrer_ids?.length || 0
    };
    return roleMap[role] || 0;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Start a Conversation</DialogTitle>
        </DialogHeader>

        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>Direct Message:</strong> Use for private one-on-one conversations with any team member or client.
            {permissions.canCreateLoanChannel && (
              <><br /><strong>Loan Channel:</strong> Use for group discussions about a specific loan with all stakeholders.</>
            )}
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className={permissions.canCreateLoanChannel ? "grid w-full grid-cols-2" : "grid w-full grid-cols-1"}>
            <TabsTrigger value="direct" data-tour="direct-message-tab">
              <UserIcon className="w-4 h-4 mr-2" />
              Direct Message
            </TabsTrigger>
            {/* Rule 12: Only admins and loan officers can create loan channels */}
            {permissions.canCreateLoanChannel && (
              <TabsTrigger value="loan" data-tour="loan-channel-tab">
                <Hash className="w-4 h-4 mr-2" />
                Loan Channel
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="direct" className="space-y-4">
            <div className="space-y-2">
              <Label>
                {permissions.canMessageOnlyLoanOfficers 
                  ? 'Select a loan officer to message:' 
                  : 'Select a person to message:'}
              </Label>
              <Command className="border rounded-lg">
                <CommandInput placeholder="Search users..." />
                <CommandList>
                  <CommandEmpty>No users found.</CommandEmpty>
                  <CommandGroup>
                    {users.map((user) => (
                      <CommandItem
                        key={user.id}
                        onSelect={() => setSelectedUser(user)}
                        className={`cursor-pointer ${selectedUser?.id === user.id ? 'bg-blue-50' : ''}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center">
                            <span className="text-sm font-semibold text-slate-700">
                              {user.first_name && user.last_name 
                                ? `${user.first_name.charAt(0)}${user.last_name.charAt(0)}`.toUpperCase()
                                : (user.full_name || user.email).substring(0, 2).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900">
                              {user.first_name && user.last_name 
                                ? `${user.first_name} ${user.last_name}`
                                : user.full_name || user.email}
                            </p>
                            <p className="text-xs text-slate-500">{user.app_role}</p>
                          </div>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button 
                onClick={handleCreateDirect}
                disabled={!selectedUser || isCreating}
              >
                {isCreating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Start Conversation
              </Button>
            </div>
          </TabsContent>

          {permissions.canCreateLoanChannel && (
            <TabsContent value="loan" className="space-y-4">
              <div className="space-y-2">
                <Label>Select a loan to create a channel:</Label>
                <Command className="border rounded-lg">
                  <CommandInput placeholder="Search loans..." />
                  <CommandList>
                    <CommandEmpty>No loans found.</CommandEmpty>
                    <CommandGroup>
                      {loans.map((loan) => (
                        <CommandItem
                          key={loan.id}
                          onSelect={() => setSelectedLoan(loan)}
                          className={`cursor-pointer ${selectedLoan?.id === loan.id ? 'bg-purple-50' : ''}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                              <Hash className="w-5 h-5 text-purple-700" />
                            </div>
                            <div>
                              <p className="font-semibold text-slate-900">
                                {loan.loan_number || loan.primary_loan_id}
                              </p>
                              <p className="text-xs text-slate-500">
                                {loan.borrower_entity_name || 'No borrower name'}
                              </p>
                            </div>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </div>

              {selectedLoan && (
                <div className="space-y-3 p-4 bg-slate-50 rounded-lg">
                  <Label className="text-sm font-semibold">Include in channel:</Label>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="borrowers"
                          checked={selectedRoles.borrowers}
                          onCheckedChange={() => toggleRole('borrowers')}
                        />
                        <label htmlFor="borrowers" className="text-sm cursor-pointer">
                          Borrowers ({getRoleCount(selectedLoan, 'borrowers')})
                        </label>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="loan_officers"
                          checked={selectedRoles.loan_officers}
                          onCheckedChange={() => toggleRole('loan_officers')}
                        />
                        <label htmlFor="loan_officers" className="text-sm cursor-pointer">
                          Loan Officers ({getRoleCount(selectedLoan, 'loan_officers')})
                        </label>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="referrers"
                          checked={selectedRoles.referrers}
                          onCheckedChange={() => toggleRole('referrers')}
                        />
                        <label htmlFor="referrers" className="text-sm cursor-pointer">
                          Referral Partners ({getRoleCount(selectedLoan, 'referrers')})
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleCreateLoanChannel}
                  disabled={!selectedLoan || isCreating}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  {isCreating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Create Channel
                </Button>
              </div>
            </TabsContent>
          )}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
