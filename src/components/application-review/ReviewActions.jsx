import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  PlayCircle, 
  CheckCircle, 
  FileCheck, 
  XCircle,
  Loader2,
  Save
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export default function ReviewActions({ 
  applicationStatus, 
  onStartReview, 
  onFinishReview,
  onProceedToLoan,
  onReject,
  onSaveReview,
  isProcessing
}) {
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showProceedDialog, setShowProceedDialog] = useState(false);
  const [showFinishDialog, setShowFinishDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  const handleReject = () => {
    if (!rejectionReason.trim()) {
      alert('Please provide a rejection reason');
      return;
    }
    onReject(rejectionReason);
    setShowRejectDialog(false);
    setRejectionReason('');
  };

  if (applicationStatus === 'draft' || applicationStatus === 'rejected') {
    return null; // No review actions for drafts or rejected apps
  }

  return (
    <>
      <Card className="border-2 border-slate-200 bg-slate-50">
        <CardContent className="p-6">
          <h3 className="font-semibold text-slate-900 mb-4">Review Actions</h3>
          
          <div className="flex flex-wrap gap-3">
            {applicationStatus === 'submitted' && (
              <>
                <Button
                  onClick={onStartReview}
                  disabled={isProcessing}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {isProcessing ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <PlayCircle className="w-4 h-4 mr-2" />
                  )}
                  Start Review
                </Button>
                
                <Button
                  onClick={() => setShowRejectDialog(true)}
                  disabled={isProcessing}
                  variant="destructive"
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Reject Application
                </Button>
              </>
            )}

            {applicationStatus === 'under_review' && (
              <>
                <Button
                  onClick={onSaveReview}
                  disabled={isProcessing}
                  variant="outline"
                  className="border-blue-600 text-blue-600 hover:bg-blue-50"
                >
                  {isProcessing ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Save Review
                </Button>

                <Button
                  onClick={() => setShowFinishDialog(true)}
                  disabled={isProcessing}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  {isProcessing ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle className="w-4 h-4 mr-2" />
                  )}
                  Finish Review
                </Button>
                
                <Button
                  onClick={() => setShowRejectDialog(true)}
                  disabled={isProcessing}
                  variant="destructive"
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Reject Application
                </Button>
              </>
            )}

            {applicationStatus === 'review_completed' && (
              <>
                <Button
                  onClick={() => setShowProceedDialog(true)}
                  disabled={isProcessing}
                  className="bg-slate-900 hover:bg-slate-800"
                >
                  {isProcessing ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <FileCheck className="w-4 h-4 mr-2" />
                  )}
                  Proceed to Loan
                </Button>
                
                <Button
                  onClick={() => setShowRejectDialog(true)}
                  disabled={isProcessing}
                  variant="destructive"
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Reject Application
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Rejection Dialog */}
      <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Application</AlertDialogTitle>
            <AlertDialogDescription>
              Please provide a reason for rejecting this application. The borrower will be notified.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="rejection_reason">Rejection Reason *</Label>
            <Textarea
              id="rejection_reason"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Explain why this application is being rejected..."
              className="mt-2 h-32"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleReject} className="bg-red-600 hover:bg-red-700">
              Reject Application
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Finish Review Dialog */}
      <AlertDialog open={showFinishDialog} onOpenChange={setShowFinishDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Finish Review</AlertDialogTitle>
            <AlertDialogDescription>
              Mark this review as completed? The borrower will be notified that review is complete.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { onFinishReview(); setShowFinishDialog(false); }} className="bg-emerald-600 hover:bg-emerald-700">
              Finish Review
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Proceed to Loan Dialog */}
      <AlertDialog open={showProceedDialog} onOpenChange={setShowProceedDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Proceed to Loan</AlertDialogTitle>
            <AlertDialogDescription>
              Approve this application and create a new loan record? The borrower will be notified of approval.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { onProceedToLoan(); setShowProceedDialog(false); }} className="bg-slate-900 hover:bg-slate-800">
              Approve & Create Loan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}