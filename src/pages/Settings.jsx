import React, { useState, useEffect } from 'react';
import { User } from '@/entities/all';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, User as UserIcon, ClipboardList, Settings as SettingsIcon, Bell, FileText, Compass, Mail } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { Label } from '@/components/ui/label';
import { useToast } from "@/components/ui/use-toast";
import { base44 } from "@/api/base44Client";
import { usePermissions } from "@/components/hooks/usePermissions";
import { runRoleMigration } from "@/components/utils/roleMigration";
import { runFieldRoleCleanup } from "@/components/utils/fieldRoleCleanup";
import { runLoanContactCleanup } from "@/components/utils/loanContactCleanup";

import UserTable from '../components/settings/UserTable';
import EditUserModal from '../components/settings/EditUserModal';
import FieldsManagementTab from "../components/settings/FieldsManagementTab";
import ChecklistManagementTab from "../components/settings/ChecklistManagementTab";
import ManageInvitesTab from "../components/settings/ManageInvitesTab";
import { createPageUrl } from "@/utils";
import ProductTour from "../components/shared/ProductTour";

export default function Settings() {
  const { currentUser, permissions, isLoading: permissionsLoading } = usePermissions();
  const [allUsers, setAllUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingUser, setEditingUser] = useState(null);
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('tab') || null;
    }
    return null;
  });

  const { toast } = useToast();

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Only load users if user has permission to manage users
      if (permissions.canManageUsers) {
        const users = await User.list('-created_date');
        setAllUsers(users);
      }
    } catch (error) {
      console.error("Failed to load user data:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load settings data. Please try again.",
      });
    }
    setIsLoading(false);
  };

  useEffect(() => {
    if (!permissionsLoading && currentUser) {
      loadData();
      if (permissions.canManageUsers) {
        runRoleMigration({ toast });
        runFieldRoleCleanup({ toast });
        runLoanContactCleanup({ toast });
      }
      
      // Set default tab based on permissions if not already set
      if (activeTab === null) {
        if (permissions.canManageUsers) {
          setActiveTab('users');
        } else if (permissions.canManageChecklists) {
          setActiveTab('checklist');
        } else if (permissions.isPlatformAdmin || permissions.isAdministrator) {
          setActiveTab('fields');
        } else {
          setActiveTab('profile');
        }
      }
    }
  }, [permissionsLoading, currentUser, permissions, activeTab]);

  const handleEditUser = (user) => {
    setEditingUser(user);
  };

  const handleCloseModal = () => {
    setEditingUser(null);
  };

  const handleSaveUser = async (userData) => {
    try {
      await User.update(userData.id, {
        app_role: userData.app_role,
        first_name: userData.first_name,
        last_name: userData.last_name
      });
      
      toast({
        title: "User Updated",
        description: "User details have been updated successfully.",
      });
      
      await loadData();
      handleCloseModal();
    } catch (error) {
      console.error('Error updating user:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update user. Please try again.",
      });
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
    const navTourCompleted = localStorage.getItem(`nav_tour_completed_${currentUser.id}`);
    const pageTourCompleted = localStorage.getItem(`page_tour_Settings_${currentUser.id}`);
    return navTourCompleted !== 'true' && pageTourCompleted !== 'true';
  };

  if (!permissions.canAccessSettings) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
        <div className="max-w-7xl mx-auto">
          <Card>
            <CardContent className="p-12 text-center">
              <SettingsIcon className="w-16 h-16 mx-auto mb-4 text-slate-300" />
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Access Denied</h2>
              <p className="text-slate-600">You don't have permission to access settings.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <>
    {shouldShowTour() && <ProductTour currentUser={currentUser} pageName="Settings" />}
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight mb-2">
            Settings
          </h1>
          <p className="text-slate-600">Manage users, invitations, and application configuration</p>
        </motion.div>

        {/* Tab Navigation */}
        <div className="flex gap-4 border-b border-slate-200 overflow-x-auto">
          {permissions.canManageUsers && (
            <button
              data-tour="tab-users"
              onClick={() => setActiveTab('users')}
              className={`px-4 py-2 font-medium transition-colors whitespace-nowrap ${
                activeTab === 'users'
                  ? 'text-slate-900 border-b-2 border-slate-900'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="w-4 h-4 inline mr-2" />
              User Management
            </button>
          )}
          {(permissions.isPlatformAdmin || permissions.isAdministrator) && (
            <button
              data-tour="tab-fields"
              onClick={() => setActiveTab('fields')}
              className={`px-4 py-2 font-medium transition-colors whitespace-nowrap ${
                activeTab === 'fields'
                  ? 'text-slate-900 border-b-2 border-slate-900'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="w-4 h-4 inline mr-2" />
              Fields
            </button>
          )}
          {permissions.canManageChecklists && (
            <>
              <button
                data-tour="tab-checklist"
                onClick={() => setActiveTab('checklist')}
                className={`px-4 py-2 font-medium transition-colors whitespace-nowrap ${
                  activeTab === 'checklist'
                    ? 'text-slate-900 border-b-2 border-slate-900'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ClipboardList className="w-4 h-4 inline mr-2" />
                Checklist
              </button>
            </>
          )}
          {permissions.canManageNotifications && (
            <button
              onClick={() => setActiveTab('notifications')}
              className={`px-4 py-2 font-medium transition-colors whitespace-nowrap ${
                activeTab === 'notifications'
                  ? 'text-slate-900 border-b-2 border-slate-900'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Bell className="w-4 h-4 inline mr-2" />
              Notifications
            </button>
          )}
          {(permissions.isPlatformAdmin || permissions.isAdministrator || permissions.isLoanOfficer) && (
            <button
              onClick={() => setActiveTab('invites')}
              className={`px-4 py-2 font-medium transition-colors whitespace-nowrap ${
                activeTab === 'invites'
                  ? 'text-slate-900 border-b-2 border-slate-900'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Mail className="w-4 h-4 inline mr-2" />
              Manage Invites
            </button>
          )}
          <button
            onClick={() => setActiveTab('tour')}
            className={`px-4 py-2 font-medium transition-colors whitespace-nowrap ${
              activeTab === 'tour'
                ? 'text-slate-900 border-b-2 border-slate-900'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Compass className="w-4 h-4 inline mr-2" />
            Product Tour
          </button>
          <button
            onClick={() => setActiveTab('profile')}
            className={`px-4 py-2 font-medium transition-colors whitespace-nowrap ${
              activeTab === 'profile'
                ? 'text-slate-900 border-b-2 border-slate-900'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <UserIcon className="w-4 h-4 inline mr-2" />
            Profile
          </button>
        </div>

        {/* User Management Tab */}
        {activeTab === 'users' && permissions.canManageUsers && (
          <Card>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle>User Management</CardTitle>
                  <CardDescription>
                    Edit user roles and details.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <UserTable users={allUsers} onEditUser={handleEditUser} onUserUpdate={loadData} />
            </CardContent>
          </Card>
        )}

        {/* Fields Management Tab */}
        {activeTab === 'fields' && (permissions.isPlatformAdmin || permissions.isAdministrator) && (
          <FieldsManagementTab currentUser={currentUser} />
        )}

        {/* Checklist Management Tab */}
        {activeTab === 'checklist' && permissions.canManageChecklists && (
          <ChecklistManagementTab currentUser={currentUser} />
        )}

        {/* Notifications Tab */}
        {activeTab === 'notifications' && permissions.canManageNotifications && (
          <Card>
            <CardHeader>
              <CardTitle>Daily Report Settings</CardTitle>
              <CardDescription>
                Configure automated daily email reports for borrowers
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h4 className="font-semibold text-blue-900 mb-2">How Daily Reports Work</h4>
                  <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                    <li>Borrowers receive automated end-of-day summary emails</li>
                    <li>Reports include: recent updates, overdue tasks, upcoming deadlines, and unread notifications</li>
                    <li>Users can manage their preferences in their profile settings</li>
                    <li>Reports are only sent if there are updates to report</li>
                  </ul>
                </div>

                <div className="p-4 bg-slate-50 rounded-lg">
                  <h4 className="font-semibold text-slate-900 mb-3">Manual Trigger</h4>
                  <p className="text-sm text-slate-600 mb-4">
                    For testing or immediate needs, you can manually trigger daily reports to be sent now.
                  </p>
                  <Button
                    variant="outline"
                    onClick={async () => {
                      try {
                        await base44.functions.invoke('sendDailyReports');
                        toast({
                          title: "Daily Reports Sent",
                          description: "Manual daily report trigger completed successfully.",
                        });
                      } catch (error) {
                        console.error('Error sending daily reports:', error);
                        toast({
                          variant: "destructive",
                          title: "Error",
                          description: "Failed to send daily reports. Please try again.",
                        });
                      }
                    }}
                    className="border-purple-300 hover:bg-purple-50"
                  >
                    <Mail className="w-4 h-4 mr-2" />
                    Send Daily Reports Now
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Manage Invites Tab */}
        {activeTab === 'invites' && (permissions.isPlatformAdmin || permissions.isAdministrator || permissions.isLoanOfficer) && (
          <ManageInvitesTab currentUser={currentUser} />
        )}

        {/* Product Tour Tab */}
        {activeTab === 'tour' && (
          <Card>
            <CardHeader>
              <CardTitle>Product Tour</CardTitle>
              <CardDescription>
                Learn about the platform features with a guided tour
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-slate-600">
                  The product tour guides you through the key features of the platform. You can replay it anytime to refresh your knowledge.
                </p>
                <Button
                  onClick={() => {
                    if (window.resetProductTours) {
                      window.resetProductTours();
                      window.location.href = createPageUrl('Dashboard');
                    }
                  }}
                >
                  <Compass className="w-4 h-4 mr-2" />
                  Replay Product Tour
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <Card>
            <CardHeader>
              <CardTitle>Profile Settings</CardTitle>
              <CardDescription>
                Manage your personal information and preferences
              </CardDescription>
            </CardHeader>
            <CardContent>
              {currentUser && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>First Name</Label>
                      <p className="text-slate-900 font-medium">{currentUser.first_name || '-'}</p>
                    </div>
                    <div>
                      <Label>Last Name</Label>
                      <p className="text-slate-900 font-medium">{currentUser.last_name || '-'}</p>
                    </div>
                    <div>
                      <Label>Email</Label>
                      <p className="text-slate-900 font-medium">{currentUser.email || '-'}</p>
                    </div>
                    <div>
                      <Label>Role</Label>
                      <p className="text-slate-900 font-medium">{currentUser.app_role || '-'}</p>
                    </div>
                  </div>
                  <div className="pt-4 border-t">
                    <p className="text-sm text-slate-500">
                      To update your profile information, please contact an administrator.
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Modals */}
        <AnimatePresence>
          {editingUser && (
            <EditUserModal
              isOpen={!!editingUser}
              onClose={handleCloseModal}
              user={editingUser}
              onUserUpdate={loadData}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
    </>
  );
}
