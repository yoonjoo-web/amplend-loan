import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Bell, Mail, LogOut, User, Settings, CheckCircle, ClipboardList } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";
import { hasBrokerOnApplication, hasBrokerOnLoan, wasInvitedByBroker } from "@/components/utils/brokerVisibility";

export default function UniversalHeader({ currentUser }) {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [messageCount, setMessageCount] = useState(0);
  const [hideBranding, setHideBranding] = useState(false);

  // Fetch unread messages
  const { data: messages = [] } = useQuery({
    queryKey: ['user-messages', currentUser?.id],
    queryFn: async () => {
      if (!currentUser) return [];
      try {
        const msgs = await base44.entities.Message.filter({
          participant_ids: { $in: [currentUser.id] },
          read_by: { $nin: [currentUser.id] }
        }, '-created_date', 20);
        return msgs || [];
      } catch (error) {
        console.log('Could not load messages:', error);
        return [];
      }
    },
    enabled: !!currentUser,
    retry: false,
    staleTime: 30000,
    refetchInterval: 60000, // Refetch every minute
  });

  // Fetch unread notifications
  const { data: notifications = [] } = useQuery({
    queryKey: ['user-notifications', currentUser?.id],
    queryFn: async () => {
      if (!currentUser) return [];
      try {
        const notifs = await base44.entities.Notification.filter({
          user_id: currentUser.id,
          read: false
        }, '-created_date', 50);
        return notifs || [];
      } catch (error) {
        console.log('Could not load notifications:', error);
        return [];
      }
    },
    enabled: !!currentUser,
    retry: false,
    staleTime: 30000,
    refetchInterval: 60000, // Refetch every minute
  });

  // Fetch private tickets for loan officers
  const { data: privateTickets = [] } = useQuery({
    queryKey: ['header-private-tickets', currentUser?.id],
    queryFn: async () => {
      if (!currentUser || currentUser.app_role !== 'Loan Officer') return [];
      try {
        const tickets = await base44.entities.ChecklistItem.filter({
          is_private: true,
          owner_id: currentUser.id,
          status: { $in: ['in_progress', 'flagged'] }
        });
        return tickets || [];
      } catch (error) {
        console.log('Could not load private tickets:', error);
        return [];
      }
    },
    enabled: !!currentUser && currentUser.app_role === 'Loan Officer',
    retry: false,
    staleTime: 30000,
    refetchInterval: 60000,
  });

  // Mark notification as read mutation
  const markNotificationReadMutation = useMutation({
    mutationFn: async (notificationId) => {
      await base44.entities.Notification.update(notificationId, { read: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-notifications'] });
    },
  });

  // Mark all notifications as read mutation
  const markAllNotificationsReadMutation = useMutation({
    mutationFn: async () => {
      const promises = notifications.map(notif => 
        base44.entities.Notification.update(notif.id, { read: true })
      );
      await Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-notifications'] });
    },
  });

  useEffect(() => {
    setMessageCount(messages.length);
  }, [messages]);

  useEffect(() => {
    let isMounted = true;

    const resolveBrandingVisibility = async () => {
      if (!currentUser || currentUser.app_role !== 'Borrower') {
        if (isMounted) setHideBranding(false);
        return;
      }

      try {
        const borrowersByUserId = await base44.entities.Borrower.filter({ user_id: currentUser.id });
        const borrowerRecord = borrowersByUserId?.[0]
          || (currentUser.email
            ? (await base44.entities.Borrower.filter({ email: currentUser.email }))?.[0]
            : null);
        const borrowerIds = new Set([currentUser.id, borrowerRecord?.id].filter(Boolean));
        const hasBorrowerRecord = Boolean(borrowerRecord);

        let invitedByBroker = wasInvitedByBroker(borrowerRecord);

        const pathname = (location.pathname || '').toLowerCase();
        const isLoanDetail = pathname.includes('loandetail');
        const isApplication = pathname.includes('newapplication');
        const params = new URLSearchParams(location.search || '');
        const id = params.get('id');

        if (id && isApplication) {
          const application = await base44.entities.LoanApplication.get(id);
          if (!isMounted) return;
          if (!invitedByBroker && !hasBorrowerRecord) {
            const coBorrowerEntry = application?.co_borrowers?.find(cb =>
              borrowerIds.has(cb.user_id) || borrowerIds.has(cb.borrower_id)
            );
            invitedByBroker = wasInvitedByBroker(coBorrowerEntry);
          }
          const loanPartners = await base44.entities.LoanPartner.list();
          if (!isMounted) return;
          const hasBroker = hasBrokerOnApplication(application, loanPartners);
          setHideBranding(invitedByBroker || hasBroker);
          return;
        }

        if (id && isLoanDetail) {
          const loanPartners = await base44.entities.LoanPartner.list();
          const loan = await base44.entities.Loan.get(id);
          if (!isMounted) return;
          const hasBroker = hasBrokerOnLoan(loan, loanPartners);
          setHideBranding(invitedByBroker || hasBroker);
          return;
        }

        const [loans, applications] = await Promise.all([
          base44.entities.Loan.list().catch(() => []),
          base44.entities.LoanApplication.list().catch(() => [])
        ]);
        if (!isMounted) return;

        if (!invitedByBroker && !hasBorrowerRecord) {
          invitedByBroker = applications.some((app) => {
            const coBorrowerEntry = app?.co_borrowers?.find(cb =>
              borrowerIds.has(cb.user_id) || borrowerIds.has(cb.borrower_id)
            );
            return wasInvitedByBroker(coBorrowerEntry);
          });
        }

        const loanPartners = await base44.entities.LoanPartner.list();
        if (!isMounted) return;
        const hasBroker = loans.some((loan) => hasBrokerOnLoan(loan, loanPartners))
          || applications.some((app) => hasBrokerOnApplication(app, loanPartners));
        setHideBranding(invitedByBroker || hasBroker);
      } catch (error) {
        console.error('Error resolving branding visibility:', error);
        if (isMounted) setHideBranding(false);
      }
    };

    resolveBrandingVisibility();
    return () => {
      isMounted = false;
    };
  }, [currentUser, location.pathname, location.search]);

  const handleLogout = async () => {
    try {
      await base44.auth.logout();
    } catch (error) {
      console.error('Error logging out:', error);
      window.location.reload();
    }
  };

  const handleNotificationClick = (notification) => {
    // Mark as read
    markNotificationReadMutation.mutate(notification.id);
    
    // Navigate if link_url exists
    if (notification.link_url) {
      navigate(notification.link_url);
    }
  };

  const getNotificationIcon = (type) => {
    // Return empty string or a simple indicator without emojis
    return '';
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high':
        return 'border-l-4 border-l-red-500';
      case 'low':
        return 'border-l-4 border-l-blue-500';
      default:
        return 'border-l-4 border-l-slate-300';
    }
  };

  const getUserInitials = () => {
    if (!currentUser) return "U";
    if (currentUser.first_name && currentUser.last_name) {
      return `${currentUser.first_name[0]}${currentUser.last_name[0]}`.toUpperCase();
    }
    if (currentUser.full_name) {
      const parts = currentUser.full_name.split(' ');
      if (parts.length >= 2) {
        return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
      }
      return currentUser.full_name.substring(0, 2).toUpperCase();
    }
    return currentUser.email?.substring(0, 2).toUpperCase() || "U";
  };

  const getUserDisplayName = () => {
    if (!currentUser) return "User";
    if (currentUser.first_name && currentUser.last_name) {
      return `${currentUser.first_name} ${currentUser.last_name}`;
    }
    if (currentUser.full_name) {
      return currentUser.full_name;
    }
    return currentUser.email || "User";
  };

  if (!currentUser) {
    return null;
  }

  return (
    <div className="sticky top-0 z-40 w-full border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="flex h-16 items-center justify-between px-6">
        <div className="flex items-center gap-4">
          {!hideBranding && (
            <h1 className="text-xl font-bold text-slate-900">Amplend</h1>
          )}
        </div>

        <div className="flex items-center gap-4">
          {/* Private Tickets Popover - Only for Loan Officers */}
          {currentUser.app_role === 'Loan Officer' && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                  <ClipboardList className="h-5 w-5" />
                  {privateTickets.length > 0 && (
                    <Badge 
                      variant="destructive" 
                      className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
                    >
                      {privateTickets.length > 9 ? '9+' : privateTickets.length}
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80" align="end">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold">Active Tickets</h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(createPageUrl("Dashboard"))}
                      className="text-xs text-blue-600 hover:text-blue-700"
                    >
                      View All
                    </Button>
                  </div>
                  {privateTickets.length > 0 ? (
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {privateTickets.map((ticket) => (
                        <div
                          key={ticket.id}
                          className="p-3 rounded-lg border hover:bg-slate-50 cursor-pointer transition-colors"
                          onClick={() => navigate(createPageUrl("Dashboard"))}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <p className="text-sm font-medium">{ticket.item_name}</p>
                              <Badge 
                                className={`mt-1 text-xs ${
                                  ticket.status === 'flagged' 
                                    ? 'bg-red-100 text-red-700' 
                                    : 'bg-blue-100 text-blue-700'
                                } border-0`}
                              >
                                {ticket.status === 'flagged' ? 'Flagged' : 'In Progress'}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500 py-4 text-center">No active tickets</p>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          )}

          {/* Messages Popover */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="relative">
                <Mail className="h-5 w-5" />
                {messageCount > 0 && (
                  <Badge 
                    variant="destructive" 
                    className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
                  >
                    {messageCount > 9 ? '9+' : messageCount}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="end">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold">Messages</h4>
                  {messages.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(createPageUrl("Messages"))}
                      className="text-xs text-blue-600 hover:text-blue-700"
                    >
                      View All
                    </Button>
                  )}
                </div>
                {messages.length > 0 ? (
                  <ScrollArea className="h-96">
                    <div className="space-y-2">
                      {messages.slice(0, 5).map((msg) => (
                        <div
                          key={msg.id}
                          className="p-3 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors"
                          onClick={() => navigate(createPageUrl("Messages"))}
                        >
                          <p className="text-sm font-medium">{msg.sender_name}</p>
                          <p className="text-xs text-slate-600 line-clamp-2">{msg.content}</p>
                          <p className="text-xs text-slate-400 mt-1">
                            {format(new Date(msg.created_date), 'MMM d, h:mm a')}
                          </p>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <p className="text-sm text-slate-500 py-4 text-center">No new messages</p>
                )}
              </div>
            </PopoverContent>
          </Popover>

          {/* Notifications Popover */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="h-5 w-5" />
                {notifications.length > 0 && (
                  <Badge 
                    variant="destructive" 
                    className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
                  >
                    {notifications.length > 9 ? '9+' : notifications.length}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-96" align="end">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold">Notifications</h4>
                  {notifications.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => markAllNotificationsReadMutation.mutate()}
                      className="text-xs text-blue-600 hover:text-blue-700"
                    >
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Mark all read
                    </Button>
                  )}
                </div>
                {notifications.length > 0 ? (
                  <ScrollArea className="h-96">
                    <div className="space-y-2">
                      {notifications.map((notif) => (
                        <div
                          key={notif.id}
                          className={`p-3 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors ${getPriorityColor(notif.priority)}`}
                          onClick={() => handleNotificationClick(notif)}
                        >
                          <div className="flex items-start gap-2">
                            {/* The span for the icon is now empty or can be removed if no visual indicator is desired */}
                            <span className="text-xl">{getNotificationIcon(notif.type)}</span> 
                            <div className="flex-1">
                              <p className="text-sm font-medium text-slate-900">{notif.message}</p>
                              <p className="text-xs text-slate-500 mt-1">
                                {format(new Date(notif.created_date), 'MMM d, h:mm a')}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <p className="text-sm text-slate-500 py-4 text-center">No new notifications</p>
                )}
              </div>
            </PopoverContent>
          </Popover>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-slate-500 text-white">
                    {getUserInitials()}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">
                    {getUserDisplayName()}
                  </p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {currentUser.email}
                  </p>
                  {currentUser.app_role && (
                    <Badge variant="outline" className="mt-1 w-fit text-xs">
                      {currentUser.app_role}
                    </Badge>
                  )}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate(createPageUrl("MyProfile"))}>
                <User className="mr-2 h-4 w-4" />
                My Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate(createPageUrl("Settings"))}>
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
