import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, UserCircle, Check } from 'lucide-react';
import { motion } from 'framer-motion';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { hasBrokerOnApplication, hasBrokerOnLoan } from '@/components/utils/brokerVisibility';
import { LOAN_PARTNER_ROLES, normalizeAppRole } from '@/components/utils/appRoles';

export default function Onboarding() {
  const [currentUser, setCurrentUser] = useState(null);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
  });
  const [roleDisplay, setRoleDisplay] = useState('User');
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errors, setErrors] = useState({});
  const [hideBranding, setHideBranding] = useState(false);
  const [isInviteInvalid, setIsInviteInvalid] = useState(false);
  const [inviteTokenId, setInviteTokenId] = useState(null);

  useEffect(() => {
    loadUserData();
  }, []);

  const resolveContextIds = (params) => {
    const directApplicationId = params.get('application_id') || params.get('application');
    const directLoanId = params.get('loan_id') || params.get('loan');
    let applicationId = directApplicationId || null;
    let loanId = directLoanId || null;

    const next = params.get('next');
    if (next) {
      try {
        const nextUrl = new URL(next, window.location.origin);
        const nextParams = new URLSearchParams(nextUrl.search || '');
        const nextId = nextParams.get('id');
        const nextPath = (nextUrl.pathname || '').toLowerCase();
        if (!applicationId && nextId && nextPath.includes('newapplication')) {
          applicationId = nextId;
        }
        if (!loanId && nextId && nextPath.includes('loandetail')) {
          loanId = nextId;
        }
      } catch (error) {
        console.error('Error parsing next URL:', error);
      }
    }

    return { applicationId, loanId };
  };

  const loadUserData = async () => {
    setIsLoading(true);
    try {
      const user = await base44.auth.me();
      setCurrentUser(user);
      
      // Read URL params before any async operations to ensure they're captured
      const params = new URLSearchParams(window.location.search);
      const inviteToken = params.get('invite_token');
      const requestedFirstName = params.get('requested_first_name');
      const requestedLastName = params.get('requested_last_name');
      const firstNameFromUrl = params.get('first_name');
      const lastNameFromUrl = params.get('last_name');
      const roleFromUrl = params.get('app_role') || params.get('role');
      const normalizedRole = normalizeAppRole(roleFromUrl);
      
      // Priority: requested_first_name > first_name > user.first_name
      const firstName = requestedFirstName || firstNameFromUrl || user.first_name || '';
      const lastName = requestedLastName || lastNameFromUrl || user.last_name || '';
      
      setFormData({
        first_name: firstName,
        last_name: lastName,
      });
      
      setRoleDisplay(normalizedRole || user.app_role || 'User');
      const roleCandidate = normalizedRole || user.app_role || 'User';

      if (inviteToken) {
        try {
          const tokens = await base44.entities.BorrowerInviteToken.filter({ token: inviteToken });
          const tokenRecord = tokens?.[0] || null;
          if (!tokenRecord || tokenRecord.status !== 'active') {
            setIsInviteInvalid(true);
            setIsLoading(false);
            return;
          }
          setInviteTokenId(tokenRecord.id);
        } catch (error) {
          console.error('Error validating invite token:', error);
          setIsInviteInvalid(true);
          setIsLoading(false);
          return;
        }
      }

      const isBorrowerContext = roleCandidate === 'Borrower' || roleCandidate === 'Liaison';
      if (isBorrowerContext) {
        const { applicationId, loanId } = resolveContextIds(params);
        if (applicationId || loanId) {
          try {
            const partners = await base44.entities.LoanPartner.list();
            if (loanId) {
              const loan = await base44.entities.Loan.get(loanId);
              setHideBranding(hasBrokerOnLoan(loan, partners));
            } else if (applicationId) {
              const application = await base44.entities.LoanApplication.get(applicationId);
              setHideBranding(hasBrokerOnApplication(application, partners));
            }
          } catch (error) {
            console.error('Error checking broker visibility for onboarding:', error);
            setHideBranding(false);
          }
        } else {
          setHideBranding(false);
        }
      } else {
        setHideBranding(false);
      }

      // Only redirect if user already has both names set AND no URL params provided
      if (user.first_name && user.last_name && !requestedFirstName && !requestedLastName && !firstNameFromUrl && !lastNameFromUrl) {
        window.location.href = createPageUrl('Dashboard');
        return;
      }
    } catch (error) {
      console.error('Error loading user:', error);
    }
    setIsLoading(false);
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.first_name.trim()) {
      newErrors.first_name = 'First name is required';
    }
    
    if (!formData.last_name.trim()) {
      newErrors.last_name = 'Last name is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const roleFromUrl = params.get('app_role') || params.get('role');
    const normalizedRole = normalizeAppRole(roleFromUrl);

    setIsProcessing(true);
    try {
      const email = currentUser.email;
      let linkedRole = '';
      if (!normalizedRole && (!currentUser.app_role || currentUser.app_role === 'User')) {
        try {
          const partners = await base44.entities.LoanPartner.filter({ email });
          if (partners && partners.length > 0) {
            linkedRole = normalizeAppRole(partners[0].app_role || partners[0].type || '');
          }
        } catch (error) {
          console.error('Error checking linked loan partner role:', error);
        }
      }
      const fallbackRole = normalizedRole || linkedRole || currentUser?.app_role || 'Borrower';

      const updateData = {
        first_name: formData.first_name.trim(),
        last_name: formData.last_name.trim(),
        full_name: `${formData.first_name.trim()} ${formData.last_name.trim()}`,
      };

      // Always assign role from URL if provided and user doesn't have one yet
      if (normalizedRole && (!currentUser.app_role || currentUser.app_role === 'User')) {
        updateData.app_role = normalizedRole;
      } else if (!currentUser.app_role || currentUser.app_role === 'User') {
        updateData.app_role = fallbackRole;
      }

      await base44.auth.updateMe(updateData);
      const effectiveRole = normalizedRole || currentUser.app_role || updateData.app_role || '';

      let borrowerId = null;
      const borrowers = await base44.entities.Borrower.filter({ email: email });
      if (borrowers && borrowers.length > 0) {
        borrowerId = borrowers[0].id;
        if (!borrowers[0].user_id) {
          await base44.entities.Borrower.update(borrowers[0].id, {
            user_id: currentUser.id,
            first_name: formData.first_name.trim(),
            last_name: formData.last_name.trim()
          });
        }
      } else if (effectiveRole === 'Borrower' || effectiveRole === 'Liaison') {
        const createdBorrower = await base44.entities.Borrower.create({
          user_id: currentUser.id,
          first_name: formData.first_name.trim(),
          last_name: formData.last_name.trim(),
          email: email
        });
        borrowerId = createdBorrower?.id || null;
      }
      
      const partners = await base44.entities.LoanPartner.filter({ email: email });
      if (partners && partners.length > 0 && !partners[0].user_id) {
        await base44.entities.LoanPartner.update(partners[0].id, {
          user_id: currentUser.id
        });
      } else if (effectiveRole && LOAN_PARTNER_ROLES.includes(effectiveRole)) {
        await base44.entities.LoanPartner.create({
          user_id: currentUser.id,
          name: `${formData.first_name.trim()} ${formData.last_name.trim()}`,
          email: email,
          app_role: effectiveRole
        });
      }

      if (inviteTokenId) {
        try {
          await base44.entities.BorrowerInviteToken.update(inviteTokenId, {
            status: 'used',
            used_at: new Date().toISOString()
          });
        } catch (error) {
          console.error('Error marking invite token as used:', error);
        }
      }

      const nextUrl = params.get('next');
      if (nextUrl) {
        window.location.href = nextUrl;
      } else {
        window.location.href = createPageUrl('Dashboard');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      setErrors({ submit: 'Failed to save profile. Please try again.' });
    }
    setIsProcessing(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-slate-400 mx-auto mb-4" />
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (isInviteInvalid) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-6">
        <Card className="max-w-md">
          <CardContent className="p-10 text-center space-y-3">
            <h2 className="text-2xl font-bold text-slate-900">This Page Is No Longer Available</h2>
            <p className="text-slate-600">
              This onboarding link is inactive or has expired.
            </p>
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
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          {!hideBranding && (
            <>
              <div className="w-20 h-20 bg-gradient-to-br from-slate-900 to-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <UserCircle className="w-10 h-10 text-white" />
              </div>
              <h1 className="text-3xl font-bold text-slate-900 mb-2">
                Welcome to Amplend Loan Portal
              </h1>
            </>
          )}
          <div className="flex items-center justify-center gap-2 text-slate-600">
            <span>You are joining as</span>
            <Badge className="bg-blue-600 text-white">{roleDisplay}</Badge>
          </div>
        </div>

        <Card className="border-0 shadow-xl">
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Complete Your Profile</CardTitle>
            <CardDescription>
              Please confirm your information below
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="first_name" className="text-sm font-medium">
                    First Name <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="first_name"
                      value={formData.first_name}
                      onChange={(e) => {
                        handleInputChange('first_name', e.target.value);
                        setIsEditing(true);
                      }}
                      placeholder="John"
                      className={errors.first_name ? 'border-red-500' : ''}
                      required
                    />
                    {!isEditing && formData.first_name && (
                      <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-600" />
                    )}
                  </div>
                  {errors.first_name && (
                    <p className="text-sm text-red-500">{errors.first_name}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="last_name" className="text-sm font-medium">
                    Last Name <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="last_name"
                      value={formData.last_name}
                      onChange={(e) => {
                        handleInputChange('last_name', e.target.value);
                        setIsEditing(true);
                      }}
                      placeholder="Smith"
                      className={errors.last_name ? 'border-red-500' : ''}
                      required
                    />
                    {!isEditing && formData.last_name && (
                      <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-600" />
                    )}
                  </div>
                  {errors.last_name && (
                    <p className="text-sm text-red-500">{errors.last_name}</p>
                  )}
                </div>

                {!isEditing && formData.first_name && formData.last_name && (
                  <div className="flex items-center gap-2 text-xs text-blue-700 pt-2">
                    <Check className="w-3.5 h-3.5" />
                    <span>Information looks correct? Click Continue, or edit if needed.</span>
                  </div>
                )}
              </div>

              {errors.submit && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600">{errors.submit}</p>
                </div>
              )}

              <Button
                type="submit"
                disabled={isProcessing}
                className="w-full bg-slate-900 hover:bg-slate-800"
              >
                {isProcessing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {isProcessing ? 'Saving...' : 'Continue'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
