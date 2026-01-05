import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Mail, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ParticipantsModal({ 
  isOpen, 
  onClose, 
  participants,
  currentUser 
}) {
  if (!participants || participants.length === 0) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            Conversation Participants ({participants.length})
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Participants List */}
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {participants.map((participant) => (
              <div 
                key={participant.id} 
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <Avatar className="w-12 h-12 bg-slate-200">
                  <AvatarFallback className="text-slate-700 font-semibold">
                    {participant.name.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900 truncate">
                    {participant.name}
                    {participant.id === currentUser?.id && (
                      <span className="text-xs text-slate-500 font-normal ml-2">(You)</span>
                    )}
                  </p>
                  {participant.email && (
                    <div className="flex items-center gap-1 text-xs text-slate-500 mt-1">
                      <Mail className="w-3 h-3" />
                      <span className="truncate">{participant.email}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {participants.length === 0 && (
            <div className="text-center py-8 text-slate-500">
              <UserIcon className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p>No participants found</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end pt-4 border-t">
            <Button onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}