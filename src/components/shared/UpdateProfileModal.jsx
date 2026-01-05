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
import { AlertTriangle } from 'lucide-react';

export default function UpdateProfileModal({ isOpen, onClose, onUpdateProfile, onKeepApplicationOnly, fieldLabel }) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md p-6 gap-6">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <DialogTitle>Update Contact Profile?</DialogTitle>
          </div>
          <DialogDescription className="font-semibold text-sm leading-relaxed">
            Do you want to also update the underlying contact with this new value?
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="grid grid-cols-2 gap-3">
          <Button 
            variant="outline" 
            onClick={onKeepApplicationOnly}
            className="border-slate-300"
          >
            Application Only
          </Button>
          <Button onClick={onUpdateProfile} className="bg-blue-600 hover:bg-blue-700">
            Yes, Update Profile
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}