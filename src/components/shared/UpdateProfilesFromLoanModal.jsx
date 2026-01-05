import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from 'lucide-react';

export default function UpdateProfilesFromLoanModal({ isOpen, onClose, onUpdateProfiles, onSkipUpdate }) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md p-6 gap-6">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-amber-600" />
            </div>
            <DialogTitle>Update Contacts with Final Approved Data?</DialogTitle>
          </div>
          <DialogDescription className="font-semibold text-sm leading-relaxed">
            Do you want to update the linked Borrower/Entity/Partner contact profiles with the latest approved values from this Loan?
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="grid grid-cols-2 gap-3">
          <Button 
            variant="outline" 
            onClick={onSkipUpdate}
            className="border-slate-300"
          >
            No, Skip Update
          </Button>
          <Button onClick={onUpdateProfiles} className="bg-blue-600 hover:bg-blue-700">
            Yes, Update Contacts
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}