import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Hash, User as UserIcon, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

export default function ConversationInfoModal({ 
  isOpen, 
  onClose, 
  conversation 
}) {
  if (!conversation) return null;

  const isLoanChannel = conversation.type === 'loan_channel';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Conversation Info</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Conversation Header */}
          <div className="flex items-center gap-4">
            <Avatar className={`w-16 h-16 ${isLoanChannel ? 'bg-purple-100' : 'bg-blue-100'}`}>
              <AvatarFallback className={isLoanChannel ? 'text-purple-700' : 'text-blue-700'}>
                {isLoanChannel ? <Hash className="w-8 h-8" /> : <UserIcon className="w-8 h-8" />}
              </AvatarFallback>
            </Avatar>
            <div>
              <h3 className="font-semibold text-lg">
                {isLoanChannel ? `# ${conversation.loan_number}` : 'Direct Message'}
              </h3>
              <Badge className={isLoanChannel ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}>
                {isLoanChannel ? 'Loan Channel' : 'Direct'}
              </Badge>
            </div>
          </div>

          {/* Conversation Details */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="w-4 h-4 text-slate-500" />
              <span className="text-slate-600">Created:</span>
              <span className="font-medium text-slate-900">
                {conversation.last_message?.created_date 
                  ? format(new Date(conversation.last_message.created_date), 'MMM d, yyyy')
                  : 'Unknown'
                }
              </span>
            </div>
            
            <div className="flex items-center gap-2 text-sm">
              <UserIcon className="w-4 h-4 text-slate-500" />
              <span className="text-slate-600">Participants:</span>
              <span className="font-medium text-slate-900">
                {conversation.participants.length} {conversation.participants.length === 1 ? 'person' : 'people'}
              </span>
            </div>
          </div>

          {/* Loan Info for Loan Channels */}
          {isLoanChannel && (
            <div className="p-4 bg-purple-50 rounded-lg border border-purple-100">
              <h4 className="font-semibold text-sm text-purple-900 mb-2">Loan Information</h4>
              <div className="space-y-1 text-sm">
                <p className="text-purple-700">
                  <span className="font-medium">Loan Number:</span> {conversation.loan_number}
                </p>
                <p className="text-purple-700">
                  <span className="font-medium">Loan ID:</span> {conversation.loan_id}
                </p>
              </div>
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