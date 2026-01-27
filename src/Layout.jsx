import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { usePermissions } from "@/components/hooks/usePermissions";
import {
  LayoutDashboard,
  Users,
  FileText,
  Settings,
  ClipboardList,
  ChevronLeft,
  ChevronRight,
  Briefcase,
  MessageSquare,
  UserCircle
} from "lucide-react";
import {
  SidebarProvider,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import UniversalHeader from "../components/shared/UniversalHeader";
import ProductTour from "../components/shared/ProductTour";

// Hook to shield input fields from global key handlers (capture + bubble, all targets)
function useInputShield() {
  useEffect(() => {
    const isEditable = (t) => {
      const el = t;
      if (!el) return false;
      return el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable;
    };

    const guard = (e) => {
      if (isEditable(e.target)) {
        e.stopImmediatePropagation?.();
        e.stopPropagation();
      }
    };

    const optsCapture = { capture: true, passive: false };
    const optsBubble = { capture: false, passive: false };

    const targets = [
      window,
      document,
      document.body,
    ];

    const types = ["keydown", "beforeinput", "keypress"];

    for (const t of targets) {
      if (!t) continue;
      for (const type of types) {
        t.addEventListener(type, guard, optsCapture);
        t.addEventListener(type, guard, optsBubble);
      }
    }

    return () => {
      for (const t of targets) {
        if (!t) continue;
        for (const type of types) {
          t.removeEventListener(type, guard, optsCapture);
          t.removeEventListener(type, guard, optsBubble);
        }
      }
    };
  }, []);
}

export default function Layout({ children, currentPageName }) {
  useInputShield();
  
  const location = useLocation();
  const { currentUser, permissions, isLoading } = usePermissions();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebar_collapsed');
    return saved === 'true';
  });
  const [hoveredMenu, setHoveredMenu] = useState(null);
  const [isCheckingOnboarding, setIsCheckingOnboarding] = useState(true);

  useEffect(() => {
    if (!isLoading && currentUser) {
      // Check if user needs onboarding (missing first_name or last_name)
      const needsOnboarding = !currentUser.first_name || !currentUser.last_name;
      const isOnOnboardingPage = location.pathname.includes('Onboarding');
      
      // Redirect to onboarding if needed and not already there
      if (needsOnboarding && !isOnOnboardingPage) {
        const nextSearch = location.search || '';
        window.location.href = `${createPageUrl('Onboarding')}${nextSearch}`;
        return;
      }
      
      setIsCheckingOnboarding(false);
    } else if (!isLoading && !currentUser) {
      setIsCheckingOnboarding(false);
    }
  }, [isLoading, currentUser, location.pathname]);

  const navigationItems = [
    {
      title: "Dashboard",
      url: createPageUrl("Dashboard"),
      icon: LayoutDashboard,
      show: permissions.canViewDashboard,
    },
    {
      title: "Applications",
      url: createPageUrl("Applications"),
      icon: ClipboardList,
      show: true, // Everyone can see applications (filtered by permissions)
    },
    {
      title: "Loans",
      url: createPageUrl("Loans"),
      icon: FileText,
      show: true, // Everyone can see loans (filtered by permissions)
    },
    {
      title: "Messages",
      url: createPageUrl("Messages"),
      icon: MessageSquare,
      show: true, // Everyone can access messages
    },
    {
      title: "Contacts",
      url: createPageUrl("Contacts"),
      icon: Users,
      show: permissions.canViewContactsPage, // Rule 4, 5, 10
      submenu: [
        {
          title: "Borrowers",
          url: createPageUrl("Contacts") + "?tab=borrowers",
        },
        {
          title: "Loan Partners",
          url: createPageUrl("Contacts") + "?tab=partners",
        },
        {
          title: "Entities",
          url: createPageUrl("Contacts") + "?tab=entities",
        }
      ]
    },
    {
      title: "Loan Officer Queue",
      url: createPageUrl("LoanOfficerQueue"),
      icon: Briefcase,
      show: permissions.canViewLoanOfficerQueue, // Rule 14
    },
    {
      title: "My Profile",
      url: createPageUrl("MyProfile"),
      icon: UserCircle,
      show: permissions.canViewMyProfile, // Rule 6
    },
    {
      title: "Settings",
      url: createPageUrl("Settings"),
      icon: Settings,
      show: permissions.canAccessSettings, // Rule 11
    },
  ];

  const toggleSidebar = () => {
    const newState = !sidebarCollapsed;
    setSidebarCollapsed(newState);
    localStorage.setItem('sidebar_collapsed', newState.toString());
  };

  const filteredNavItems = navigationItems.filter(item => item.show);

  // Show loading state while checking onboarding or loading permissions
  if (isCheckingOnboarding || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900"></div>
      </div>
    );
  }

  // If on onboarding page, render without sidebar/header
  const isOnOnboardingPage = location.pathname.includes('Onboarding');
  if (isOnOnboardingPage) {
    return <div className="min-h-screen">{children}</div>;
  }

  return (
    <TooltipProvider>
      <SidebarProvider>
        <ProductTour currentUser={currentUser} pageName={null} />
        <div className="min-h-screen flex w-full bg-gradient-to-br from-slate-50 to-slate-100">
          {/* Sidebar with fixed positioning */}
          <div 
            className="fixed left-0 top-0 h-full z-50 transition-all duration-300 bg-white border-r border-slate-200 shadow-lg"
            style={{ width: sidebarCollapsed ? '64px' : '256px' }}
          >
            <div className="h-full flex flex-col">
              <div className={`flex items-center ${sidebarCollapsed ? 'justify-center p-2' : 'justify-between p-4'}`}>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleSidebar}
                  className="hover:bg-slate-100 text-slate-600 transition-colors duration-200"
                  title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                >
                  {sidebarCollapsed ? (
                    <ChevronRight className="w-4 h-4" />
                  ) : (
                    <ChevronLeft className="w-4 h-4" />
                  )}
                </Button>
              </div>

              <div className={`flex-1 overflow-y-auto ${sidebarCollapsed ? 'py-2' : 'p-2'}`}>
                <div className={`space-y-1 ${sidebarCollapsed ? 'flex flex-col items-center' : ''}`}>
                  {filteredNavItems.map((item) => (
                    <React.Fragment key={item.title}>
                      {item.submenu ? (
                        <div
                          onMouseEnter={() => !sidebarCollapsed && setHoveredMenu(item.title)}
                          onMouseLeave={() => setHoveredMenu(null)}
                        >
                          {sidebarCollapsed ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <a
                                  href={item.url + "?tab=all"}
                                  className="flex items-center justify-center w-12 h-12 rounded-xl hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors"
                                >
                                  <item.icon className="w-5 h-5" />
                                </a>
                              </TooltipTrigger>
                              <TooltipContent side="right">
                                <p>{item.title}</p>
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <>
                              <a
                                href={item.url + "?tab=all"}
                                className="flex items-center justify-between px-4 py-3 rounded-xl hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors font-medium"
                              >
                                <div className="flex items-center gap-3">
                                  <item.icon className="w-5 h-5" />
                                  <span>{item.title}</span>
                                </div>
                                <ChevronRight className={`w-4 h-4 transition-transform ${hoveredMenu === item.title ? 'rotate-90' : ''}`} />
                              </a>
                              {hoveredMenu === item.title && (
                                <div className="ml-6 mt-1 space-y-1">
                                  {item.submenu.map((subitem) => (
                                    <a
                                      key={subitem.title}
                                      href={subitem.url}
                                      className={`block px-4 py-2 rounded-xl text-sm hover:bg-slate-100 transition-colors ${
                                        location.pathname === new URL(subitem.url, window.location.origin).pathname && location.search === new URL(subitem.url, window.location.origin).search
                                          ? 'bg-slate-100 text-slate-900'
                                          : 'text-slate-600 hover:text-slate-900'
                                      }`}
                                    >
                                      {subitem.title}
                                    </a>
                                  ))}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      ) : (
                        sidebarCollapsed ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <a
                                    href={item.url}
                                    className={`flex items-center justify-center w-12 h-12 rounded-xl transition-colors ${
                                      location.pathname === new URL(item.url, window.location.origin).pathname
                                        ? 'bg-slate-700 text-white shadow-lg'
                                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                                    }`}
                                  >
                                    <item.icon className="w-5 h-5" />
                                  </a>
                                </TooltipTrigger>
                                <TooltipContent side="right">
                                  <p>{item.title}</p>
                                </TooltipContent>
                              </Tooltip>
                            ) : (
                              <a
                                href={item.url}
                                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors font-medium ${
                                  location.pathname === new URL(item.url, window.location.origin).pathname
                                    ? 'bg-slate-700 text-white shadow-lg'
                                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                                }`}
                              >
                                <item.icon className="w-5 h-5" />
                                <span>{item.title}</span>
                              </a>
                            )
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Main content area with dynamic margin */}
          <main 
            className="flex-1 flex flex-col min-w-0 w-full transition-all duration-300"
            style={{ 
              marginLeft: sidebarCollapsed ? '64px' : '256px' 
            }}
          >
            <div className="fixed top-0 z-40 bg-white border-b border-slate-200 transition-all duration-300" style={{ 
              left: sidebarCollapsed ? '64px' : '256px',
              right: 0
            }}>
              <UniversalHeader currentUser={currentUser} />
            </div>

            <div className="flex-1 overflow-auto" style={{ marginTop: '64px' }}>
              {children}
            </div>
          </main>
        </div>
      </SidebarProvider>
    </TooltipProvider>
  );
}
