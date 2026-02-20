import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, XCircle, Building2, FileText } from 'lucide-react';
import { motion } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { createPageUrl } from '@/utils';

export default function JoinRequest() {
  const location = useLocation();
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [requestData, setRequestData] = useState(null);
  const [requestType, setRequestType] = useState(null);
  const { toast } = useToast();

  const formatEIN = (value) => {
    if (!value) return '';
    const cleaned = String(value).replace(/\D/g, '');
    const match = cleaned.match(/^(\d{0,2})(\d{0,7})$/);
    if (!match) return value;

    let formatted = '';
    if (match[1]) formatted = match[1];
    if (match[1].length === 2 && match[2]) formatted += `-${match[2]}`;

    return formatted;
  };

  useEffect(() => {
    loadRequestData();
  }, []);

  const loadRequestData = async () => {
    setIsLoading(true);
    try {
      const user = await base44.auth.me();
      setCurrentUser(user);

      const params = new URLSearchParams(location.search);
      const type = params.get('type');
      const entityId = params.get('entity_id');
      const applicationId = params.get('application_id');
      const inviterId = params.get('inviter_id');

      setRequestType(type);

      if (type === 'co_owner' && entityId) {
        const entity = await base44.entities.BorrowerEntity.get(entityId);
        const inviter = inviterId ? await base44.entities.User.get(inviterId) : null;
        setRequestData({ entity, inviter });
      } else if (type === 'co_borrower' && applicationId) {
        const application = await base44.entities.LoanApplication.get(applicationId);
        const inviter = inviterId ? await base44.entities.User.get(inviterId) : null;
        setRequestData({ application, inviter });
      } else {
        throw new Error('Invalid request parameters');
      }
    } catch (error) {
      console.error('Error loading request data:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load request details. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAcceptCoOwner = async () => {
    setIsProcessing(true);
    try {
      const entity = requestData.entity;
      const updatedOwners = [
        ...(entity.ownership_structure || []),
        {
          borrower_id: currentUser.id,
          owner_name: `${currentUser.first_name} ${currentUser.last_name}`,
          ownership_percentage: 0
        }
      ];

      await base44.entities.BorrowerEntity.update(entity.id, {
        ownership_structure: updatedOwners
      });

      toast({
        title: 'Request Accepted',
        description: `You have been added as a co-owner of ${entity.entity_name}.`,
      });

      setTimeout(() => {
        window.location.href = createPageUrl('Contacts') + `?id=${entity.id}&type=entity`;
      }, 1500);
    } catch (error) {
      console.error('Error accepting co-owner request:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to accept request. Please try again.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAcceptCoBorrower = async () => {
    setIsProcessing(true);
    try {
      const application = requestData.application;
      const newCoBorrower = {
        id: `cb_${Date.now()}`,
        user_id: currentUser.id,
        first_name: currentUser.first_name,
        last_name: currentUser.last_name,
        email: currentUser.email,
        completion_status: 'pending',
        invited_by_user_id: requestData?.inviter?.id || null,
        invited_by_role: requestData?.inviter?.app_role || requestData?.inviter?.role || null
      };

      const updatedCoBorrowers = [...(application.co_borrowers || []), newCoBorrower];

      await base44.entities.LoanApplication.update(application.id, {
        co_borrowers: updatedCoBorrowers
      });

      toast({
        title: 'Request Accepted',
        description: `You have been added as a co-borrower to application #${application.application_number}.`,
      });

      setTimeout(() => {
        window.location.href = createPageUrl('NewApplication') + `?id=${application.id}`;
      }, 1500);
    } catch (error) {
      console.error('Error accepting co-borrower request:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to accept request. Please try again.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDecline = () => {
    toast({
      title: 'Request Declined',
      description: 'You have declined this invitation.',
    });
    setTimeout(() => {
      window.location.href = createPageUrl('Dashboard');
    }, 1500);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-slate-400 mx-auto mb-4" />
          <p className="text-slate-600">Loading request...</p>
        </div>
      </div>
    );
  }

  if (!requestData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-6">
        <Card className="max-w-md">
          <CardContent className="p-12 text-center">
            <XCircle className="w-16 h-16 mx-auto mb-4 text-red-500" />
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Request Not Found</h2>
            <p className="text-slate-600 mb-6">The invitation you're looking for could not be found.</p>
            <Button onClick={() => window.location.href = createPageUrl('Dashboard')}>
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-2xl"
      >
        <Card className="border-0 shadow-xl">
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              {requestType === 'co_owner' ? (
                <Building2 className="w-8 h-8 text-blue-600" />
              ) : (
                <FileText className="w-8 h-8 text-blue-600" />
              )}
              <div>
                <CardTitle className="text-2xl">
                  {requestType === 'co_owner' ? 'Co-Owner Invitation' : 'Co-Borrower Invitation'}
                </CardTitle>
                <CardDescription className="text-base">
                  You've been invited to join
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {requestType === 'co_owner' && requestData.entity && (
              <div className="p-6 bg-slate-50 rounded-lg border border-slate-200">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">{requestData.entity.entity_name}</h3>
                    <p className="text-sm text-slate-600 mt-1">
                      {requestData.entity.entity_type} • EIN: {requestData.entity.registration_number ? formatEIN(requestData.entity.registration_number) : 'N/A'}
                    </p>
                  </div>
                  <Badge className="bg-blue-100 text-blue-800">Entity</Badge>
                </div>

                {requestData.inviter && (
                  <div className="mt-4 pt-4 border-t border-slate-200">
                    <p className="text-sm text-slate-600">
                      Invited by: <span className="font-semibold text-slate-900">
                        {requestData.inviter.first_name} {requestData.inviter.last_name}
                      </span>
                    </p>
                  </div>
                )}

                {requestData.entity.ownership_structure && requestData.entity.ownership_structure.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-slate-200">
                    <p className="text-sm font-semibold text-slate-700 mb-2">Current Owners:</p>
                    <div className="space-y-1">
                      {requestData.entity.ownership_structure.map((owner, idx) => (
                        <div key={idx} className="flex items-center justify-between text-sm">
                          <span className="text-slate-700">{owner.owner_name}</span>
                          <span className="text-slate-600">{owner.ownership_percentage}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {requestType === 'co_borrower' && requestData.application && (
              <div className="p-6 bg-slate-50 rounded-lg border border-slate-200">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">
                      Application #{requestData.application.application_number}
                    </h3>
                    <p className="text-sm text-slate-600 mt-1">
                      {requestData.application.loan_type} • {requestData.application.loan_purpose}
                    </p>
                  </div>
                  <Badge className="bg-blue-100 text-blue-800">Application</Badge>
                </div>

                {requestData.inviter && (
                  <div className="mt-4 pt-4 border-t border-slate-200">
                    <p className="text-sm text-slate-600">
                      Primary Borrower: <span className="font-semibold text-slate-900">
                        {requestData.inviter.first_name} {requestData.inviter.last_name}
                      </span>
                    </p>
                  </div>
                )}

                {requestData.application.property_address_street && (
                  <div className="mt-4 pt-4 border-t border-slate-200">
                    <p className="text-sm text-slate-600">
                      Property: <span className="text-slate-900">
                        {requestData.application.property_address_street}, {requestData.application.property_address_city}, {requestData.application.property_address_state}
                      </span>
                    </p>
                  </div>
                )}
              </div>
            )}

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-900">
                <strong>What happens next?</strong><br />
                By accepting this invitation, you will be added as a {requestType === 'co_owner' ? 'co-owner' : 'co-borrower'} and will have access to the relevant information and be able to complete your section.
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                variant="outline"
                onClick={handleDecline}
                disabled={isProcessing}
              >
                Decline
              </Button>
              <Button
                onClick={requestType === 'co_owner' ? handleAcceptCoOwner : handleAcceptCoBorrower}
                disabled={isProcessing}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isProcessing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {isProcessing ? 'Accepting...' : 'Accept Invitation'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
