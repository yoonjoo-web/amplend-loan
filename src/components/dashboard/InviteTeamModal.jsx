import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, Loader2, Users } from 'lucide-react';
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { usePermissions } from "@/components/hooks/usePermissions";

export default function InviteTeamModal({ isOpen, onClose, onInviteSubmitted }) {
  const { toast } = useToast();
  const { currentUser } = usePermissions();

  const [formData, setFormData] = useState({
    requested_email: '',
    requested_first_name: '',
    requested_last_name: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await base44.functions.invoke('emailService', {
        email_type: 'invite_team_member',
        recipient_email: formData.requested_email,
        recipient_name: `${formData.requested_first_name} ${formData.requested_last_name}`,
        data: {
          first_name: formData.requested_first_name,
          last_name: formData.requested_last_name,
          role: 'Loan Officer'
        }
      });

      toast({
        title: "Invitation Sent",
        description: `Invitation email sent to ${formData.requested_email}`,
      });

      onClose();
      if (onInviteSubmitted) onInviteSubmitted();

      setFormData({
        requested_email: '',
        requested_first_name: '',
        requested_last_name: ''
      });
    } catch (error) {
      console.error('Error submitting invitation:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to send invitation. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
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
              <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-emerald-700" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900">Invite Team Member</h3>
                <p className="text-sm text-slate-500">Send an invitation to add a new loan officer</p>
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
                  disabled={isSubmitting}
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
                  disabled={isSubmitting}
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
                disabled={isSubmitting}
                required
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {isSubmitting ? 'Sending...' : 'Send Invitation'}
              </Button>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  );
}