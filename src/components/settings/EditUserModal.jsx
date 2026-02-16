import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { X, Loader2 } from 'lucide-react';
import { User } from '@/entities/all';

const allRoles = [
  "Administrator", "Loan Officer", "Referrer", "Broker", 
  "Borrower", "Title Company"
];

export default function EditUserModal({ isOpen, onClose, user, onUserUpdate }) {
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    app_role: ''
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      setFormData({
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        app_role: user.app_role || 'Borrower'
      });
    }
  }, [user]);
  
  if (!isOpen || !user) return null;
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsProcessing(true);

    try {
      const updatedData = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        app_role: formData.app_role
      };
      
      const previousRole = user.app_role;
      
      await User.update(user.id, updatedData);
      
      // If user was changed TO Loan Officer, add them to the queue
      if (formData.app_role === 'Loan Officer' && previousRole !== 'Loan Officer') {
        try {
          const { base44 } = await import('@/api/base44Client');
          const existingQueues = await base44.entities.LoanOfficerQueue.filter({ loan_officer_id: user.id });
          
          if (existingQueues.length === 0) {
            // Get current max position
            const allQueues = await base44.entities.LoanOfficerQueue.list();
            const maxPosition = allQueues.length > 0 
              ? Math.max(...allQueues.map(q => q.queue_position || 0)) 
              : 0;
            
            await base44.entities.LoanOfficerQueue.create({
              loan_officer_id: user.id,
              queue_position: maxPosition + 1,
              active_loan_count: 0,
              is_active: true
            });
          }
        } catch (queueError) {
          console.error('Error adding to loan officer queue:', queueError);
        }
      }
      
      toast({
        title: "Success!",
        description: `User ${user.email} has been updated.`,
      });
      onUserUpdate(); // This will trigger a re-fetch of users on the Settings page
      onClose();

    } catch (err) {
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: err.message || "An unknown error occurred.",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 30 }}
        className="relative w-full max-w-md m-4 bg-white rounded-xl shadow-2xl"
      >
        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-xl font-bold text-slate-900">Edit User</h3>
              <p className="text-sm text-slate-500 truncate">Editing: {user.email}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
              <X className="w-4 h-4" />
            </Button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="firstName">First Name</Label>
                <Input id="firstName" value={formData.first_name} onChange={(e) => handleInputChange('first_name', e.target.value)} required />
              </div>
              <div className="space-y-1">
                <Label htmlFor="lastName">Last Name</Label>
                <Input id="lastName" value={formData.last_name} onChange={(e) => handleInputChange('last_name', e.target.value)} required />
              </div>
            </div>
            
            <div className="space-y-1">
              <Label htmlFor="appRole">Role</Label>
              <Select value={formData.app_role} onValueChange={(value) => handleInputChange('app_role', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a role..." />
                </SelectTrigger>
                <SelectContent>
                  {allRoles.map(role => (
                    <SelectItem key={role} value={role}>{role}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={onClose} disabled={isProcessing}>
                Cancel
              </Button>
              <Button type="submit" className="bg-slate-900 hover:bg-slate-800" disabled={isProcessing}>
                {isProcessing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {isProcessing ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
