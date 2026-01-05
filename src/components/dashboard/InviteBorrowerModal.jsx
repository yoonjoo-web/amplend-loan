import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, Loader2, UserPlus } from 'lucide-react';
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";

export default function InviteBorrowerModal({ isOpen, onClose, onInviteSubmitted }) {
  const [formData, setFormData] = useState({
    requested_email: '',
    requested_first_name: '',
    requested_last_name: ''
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  if (!isOpen) return null;

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsProcessing(true);

    try {
      await base44.functions.invoke('emailService', {
        email_type: 'invite_borrower',
        recipient_email: formData.requested_email,
        recipient_name: `${formData.requested_first_name} ${formData.requested_last_name}`,
        data: {
          first_name: formData.requested_first_name,
          last_name: formData.requested_last_name
        }
      });

      toast({
        title: "Invitation Sent",
        description: `Invitation email sent to ${formData.requested_email}`,
      });
      onInviteSubmitted?.();
      onClose();
      setFormData({
        requested_email: '',
        requested_first_name: '',
        requested_last_name: ''
      });
    } catch (err) {
      console.error('Error submitting invitation:', err);
      toast({
        variant: "destructive",
        title: "Error",
        description: err.message || "Failed to send invitation. Please try again.",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 30 }}
        className="relative w-full max-w-lg m-4 bg-white rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                <UserPlus className="w-5 h-5 text-slate-700" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900">Invite Borrower</h3>
                <p className="text-sm text-slate-500">Send an invitation to onboard a new borrower</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
              <X className="w-4 h-4" />
            </Button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="requested_first_name">First Name *</Label>
                <Input
                  id="requested_first_name"
                  value={formData.requested_first_name}
                  onChange={(e) => handleInputChange('requested_first_name', e.target.value)}
                  placeholder="First name"
                  disabled={isProcessing}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="requested_last_name">Last Name *</Label>
                <Input
                  id="requested_last_name"
                  value={formData.requested_last_name}
                  onChange={(e) => handleInputChange('requested_last_name', e.target.value)}
                  placeholder="Last name"
                  disabled={isProcessing}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="requested_email">Email Address *</Label>
              <Input
                id="requested_email"
                type="email"
                value={formData.requested_email}
                onChange={(e) => handleInputChange('requested_email', e.target.value)}
                placeholder="email@example.com"
                disabled={isProcessing}
                required
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isProcessing}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isProcessing}
                className="bg-slate-700 hover:bg-slate-800"
              >
                {isProcessing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {isProcessing ? 'Sending...' : 'Send Invitation'}
              </Button>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  );
}