import React, { useState, useEffect } from "react";
import { User, BorrowerEntity } from "@/entities/all";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { UserCircle, Building2, Bell, Compass } from "lucide-react";
import { motion } from "framer-motion";
import { useToast } from "@/components/ui/use-toast";
import { usePermissions } from "@/components/hooks/usePermissions";
import ProductTour from "../components/shared/ProductTour";
import { createPageUrl } from "@/utils";
import { resetAllTours } from "../components/shared/tourConfig";

export default function MyProfile() {
  const { currentUser, permissions, isLoading: permissionsLoading } = usePermissions();
  const [ownedEntity, setOwnedEntity] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [emailPreferences, setEmailPreferences] = useState({
    receive_daily_report: true,
    report_time: '17:00'
  });

  const { toast } = useToast();

  useEffect(() => {
    if (!permissionsLoading && currentUser) {
      loadProfileData();
    }
  }, [permissionsLoading, currentUser]);

  const loadProfileData = async () => {
    setIsLoading(true);
    try {
      // Load email preferences
      if (currentUser.email_preferences) {
        setEmailPreferences(currentUser.email_preferences);
      }

      // Rule 9: Load owned entity if user is a borrower
      if (permissions.canViewOwnedEntityProfile) {
        const entities = await BorrowerEntity.list();
        // Find user's borrower record first
        const borrowers = await base44.entities.Borrower.filter({ user_id: currentUser.id });
        const userBorrower = borrowers.length > 0 ? borrowers[0] : null;
        
        const userEntity = entities.find(entity =>
          entity.ownership_structure?.some(owner => 
            owner.borrower_id === userBorrower?.id
          )
        );
        setOwnedEntity(userEntity);
      }
    } catch (error) {
      console.error('Error loading profile data:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load profile data. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveEmailPreferences = async () => {
    // Rule 8: Borrowers can edit email preferences
    if (!permissions.canEditMyEmailPreferences) {
      toast({
        variant: "destructive",
        title: "Permission Denied",
        description: "You cannot edit email preferences.",
      });
      return;
    }

    setIsSaving(true);
    try {
      await User.update(currentUser.id, {
        email_preferences: emailPreferences
      });

      toast({
        title: "Preferences Saved",
        description: "Your email preferences have been updated successfully.",
      });
    } catch (error) {
      console.error('Error saving preferences:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save preferences. Please try again.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (permissionsLoading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900"></div>
      </div>
    );
  }

  // Check if tour should auto-show on first login
  const shouldShowTour = () => {
    if (!currentUser) return false;
    const navTourCompleted = localStorage.getItem(`tour_completed_${currentUser.id}`);
    return navTourCompleted !== 'true';
  };

  // Rule 6: Only Borrowers and Loan Partners can view My Profile
  if (!permissions.canViewMyProfile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
        <div className="max-w-7xl mx-auto">
          <Card>
            <CardContent className="p-12 text-center">
              <UserCircle className="w-16 h-16 mx-auto mb-4 text-slate-300" />
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Access Denied</h2>
              <p className="text-slate-600">You don't have access to this profile page.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <>
    {shouldShowTour() && <ProductTour currentUser={currentUser} pageName="MyProfile" />}
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-5xl mx-auto space-y-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight mb-2">
            My Profile
          </h1>
          <p className="text-slate-600">View your profile information and manage preferences</p>
        </motion.div>

        <Tabs defaultValue="personal" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="personal" className="flex items-center gap-2">
              <UserCircle className="w-4 h-4" />
              Personal Info
            </TabsTrigger>
            {permissions.canViewOwnedEntityProfile && (
              <TabsTrigger value="entity" className="flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                My Entity
              </TabsTrigger>
            )}
            <TabsTrigger value="preferences" className="flex items-center gap-2">
              <Bell className="w-4 h-4" />
              Preferences
            </TabsTrigger>
          </TabsList>

          {/* Personal Information Tab */}
          <TabsContent value="personal">
            <Card>
              <CardHeader>
                <CardTitle>Personal Information</CardTitle>
                <CardDescription>
                  Your personal details. Contact an administrator to make changes.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label>First Name</Label>
                    <Input
                      value={currentUser.first_name || ''}
                      disabled
                      className="bg-slate-50"
                    />
                  </div>
                  <div>
                    <Label>Last Name</Label>
                    <Input
                      value={currentUser.last_name || ''}
                      disabled
                      className="bg-slate-50"
                    />
                  </div>
                  <div>
                    <Label>Email</Label>
                    <Input
                      value={currentUser.email || ''}
                      disabled
                      className="bg-slate-50"
                    />
                  </div>
                  <div>
                    <Label>Role</Label>
                    <Input
                      value={currentUser.app_role || ''}
                      disabled
                      className="bg-slate-50"
                    />
                  </div>
                </div>

                {/* Rule 7 & 8: Cannot edit profile */}
                <div className="pt-4 border-t">
                  <p className="text-sm text-slate-500">
                    📌 To update your personal information, please contact an administrator.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Entity Information Tab - Rule 9 */}
          {permissions.canViewOwnedEntityProfile && (
            <TabsContent value="entity">
              <Card>
                <CardHeader>
                  <CardTitle>My Entity</CardTitle>
                  <CardDescription>
                    {ownedEntity
                      ? 'View details about your entity/company'
                      : 'You are not currently associated with any entity'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {ownedEntity ? (
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <Label>Entity Name</Label>
                          <Input
                            value={ownedEntity.entity_name || ''}
                            disabled
                            className="bg-slate-50"
                          />
                        </div>
                        <div>
                          <Label>Entity Type</Label>
                          <Input
                            value={ownedEntity.entity_type || ''}
                            disabled
                            className="bg-slate-50"
                          />
                        </div>
                        <div>
                          <Label>Registration Number</Label>
                          <Input
                            value={ownedEntity.registration_number || ''}
                            disabled
                            className="bg-slate-50"
                          />
                        </div>
                        <div>
                          <Label>Email</Label>
                          <Input
                            value={ownedEntity.email || ''}
                            disabled
                            className="bg-slate-50"
                          />
                        </div>
                      </div>

                      {ownedEntity.ownership_structure && ownedEntity.ownership_structure.length > 0 && (
                        <div>
                          <Label className="mb-3 block">Ownership Structure</Label>
                          <div className="space-y-2">
                            {ownedEntity.ownership_structure.map((owner, index) => (
                              <div key={index} className="p-3 bg-slate-50 rounded-lg flex justify-between items-center">
                                <span className="font-medium">{owner.owner_name}</span>
                                <span className="text-slate-600">{owner.ownership_percentage}%</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Rule 9: Cannot edit entity */}
                      <div className="pt-4 border-t">
                        <p className="text-sm text-slate-500">
                          📌 You can view your entity information but cannot edit it. Contact an administrator for changes.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <Building2 className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                      <p className="text-slate-500">No entity associated with your profile</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* Preferences Tab - Rule 8: Can edit email preferences */}
          <TabsContent value="preferences">
            <Card>
              <CardHeader>
                <CardTitle>Email Preferences</CardTitle>
                <CardDescription>
                  Manage your email notification settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                  <div className="flex-1">
                    <Label htmlFor="daily-report" className="font-medium">
                      Daily Report Emails
                    </Label>
                    <p className="text-sm text-slate-600 mt-1">
                      Receive end-of-day summary emails about your loans and tasks
                    </p>
                  </div>
                  <Switch
                    id="daily-report"
                    checked={emailPreferences.receive_daily_report}
                    onCheckedChange={(checked) =>
                      setEmailPreferences({ ...emailPreferences, receive_daily_report: checked })
                    }
                    disabled={!permissions.canEditMyEmailPreferences}
                  />
                </div>

                {/* Product Tour Replay */}
                <div className="border-t pt-6">
                  <h4 className="font-medium text-slate-900 mb-2">Product Tour</h4>
                  <p className="text-sm text-slate-600 mb-3">
                    Replay the guided tour to learn about the platform features.
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => {
                      resetAllTours(currentUser?.id);
                      window.location.href = createPageUrl('Dashboard');
                    }}
                  >
                    <Compass className="w-4 h-4 mr-2" />
                    Replay Product Tour
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
    </>
  );
}