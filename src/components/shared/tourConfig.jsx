// Centralized tour configuration for all pages
// Tour step types
export const STEP_TYPE = {
  INFO: 'info',           // Just read information
  CLICK: 'click',         // Must click target element
  INTERACT: 'interact',   // Must interact (fill, toggle, etc.)
  UPLOAD: 'upload',       // Must upload a file
  WAIT: 'wait'            // Wait for action completion
};

// Navigation tour steps by role
const NAV_TOUR_STEPS = {
  admin: [
    {
      target: '[href*="Messages"]',
      title: 'Messages',
      content: 'Communicate with team members and clients.',
      placement: 'right',
      type: STEP_TYPE.INFO
    },
    {
      target: '[href*="Applications"]',
      title: 'Applications',
      content: 'Review and manage loan applications. You can filter, sort, and take actions on applications.',
      placement: 'right',
      type: STEP_TYPE.INFO
    },
    {
      target: '[href*="Loans"]',
      title: 'Loans',
      content: 'View and manage all loans. Track status, documents, checklists, and more.',
      placement: 'right',
      type: STEP_TYPE.INFO
    },
    {
      target: '[href*="Contacts"]',
      title: 'Contacts',
      content: 'Manage borrowers, entities, and loan partners in one place.',
      placement: 'right',
      type: STEP_TYPE.INFO
    },
    {
      target: '[href*="LoanOfficerQueue"]',
      title: 'Loan Officer Queue',
      content: 'Manage loan officer assignments and workload distribution. Officers at the top of the queue receive new applications first.',
      placement: 'right',
      type: STEP_TYPE.INFO
    },
    {
      target: '[href*="Settings"]',
      title: 'Settings',
      content: 'Configure field configurations, manage users, and customize your system. You can replay this tour from Settings anytime!',
      placement: 'right',
      type: STEP_TYPE.INFO
    }
  ],
  borrower: [
    {
      target: '[href*="Messages"]',
      title: 'Messages',
      content: 'Communicate with team members and clients.',
      placement: 'right',
      type: STEP_TYPE.INFO
    },
    {
      target: '[href*="Applications"]',
      title: 'Your Applications',
      content: 'View the status of your loan applications and complete any pending items.',
      placement: 'right',
      type: STEP_TYPE.INFO
    },
    {
      target: '[href*="Loans"]',
      title: 'Your Loans',
      content: 'Access your active loans, view documents, and track payment schedules.',
      placement: 'right',
      type: STEP_TYPE.INFO
    },
    {
      target: '[href*="MyProfile"]',
      title: 'My Profile',
      content: 'Update your preferences and view your entity information.',
      placement: 'right',
      type: STEP_TYPE.INFO
    }
  ]
};

// Page-specific tour steps
const PAGE_TOUR_STEPS = {
  Settings: {
    admin: [
      {
        target: '[data-tour="tab-users"]',
        title: 'User Management',
        content: 'View all users, including your team and clients.',
        placement: 'bottom',
        type: STEP_TYPE.INFO
      },
      {
        target: '[data-tour="tab-fields"]',
        title: 'Fields Configuration',
        content: 'Customize form fields for applications and loans.',
        placement: 'bottom',
        type: STEP_TYPE.INFO
      },
      {
        target: '[data-tour="tab-checklist"]',
        title: 'Checklist Templates',
        content: 'Configure checklist items and document requirements for different loan types.',
        placement: 'bottom',
        type: STEP_TYPE.INFO
      }
    ]
  },
  Loans: {
    admin: [
      {
        target: '[data-tour="loans-table"]',
        title: 'Loans Overview',
        content: 'Loans are created only when a loan application is successfully approved and accepted. You can view and manage all active loans here.',
        placement: 'left',
        type: STEP_TYPE.INFO
      }
    ],
    borrower: [
      {
        target: '[data-tour="loans-table"]',
        title: 'Your Loans',
        content: 'Loans appear here after your application has been approved. You can view loan details, documents, and payment schedules.',
        placement: 'left',
        type: STEP_TYPE.INFO
      }
    ]
  },
  NewConversationModal: {
    admin: [
      {
        target: '[data-tour="direct-message-tab"]',
        title: 'Direct Message',
        content: 'Use direct messages for private one-on-one conversations with any team member or client.',
        placement: 'bottom',
        type: STEP_TYPE.INFO
      },
      {
        target: '[data-tour="loan-channel-tab"]',
        title: 'Loan Channel',
        content: 'Use loan channels for group discussions about a specific loan. All stakeholders (borrowers, loan officers, referrers) can be included.',
        placement: 'bottom',
        type: STEP_TYPE.INFO
      }
    ]
  },
  NewApplication: {
    admin: [
      {
        target: '[data-tour="step-indicators"]',
        title: 'Application Progress',
        content: 'Track which sections are complete. Each step must be completed to submit.',
        placement: 'bottom',
        type: STEP_TYPE.INFO
      },
      {
        target: '[data-tour="save-draft"]',
        title: 'Save Your Progress',
        content: 'Click "Save Draft" anytime to save your work and return later.',
        placement: 'left',
        type: STEP_TYPE.INFO
      }
    ],
    borrower: [
      {
        target: '[data-tour="step-indicators"]',
        title: 'Application Steps',
        content: 'Complete each section to submit your loan application. Your progress is automatically saved.',
        placement: 'bottom',
        type: STEP_TYPE.INFO
      }
    ]
  },
  MyProfile: {
    borrower: [
      {
        target: '[value="entity"]',
        title: 'My Entity Tab',
        content: 'Click here to view your entity/company information if you own one.',
        placement: 'bottom',
        type: STEP_TYPE.CLICK,
        actionLabel: 'Click the My Entity tab'
      },
      {
        target: '[value="preferences"]',
        title: 'Preferences Tab',
        content: 'Click here to manage your email notification settings.',
        placement: 'bottom',
        type: STEP_TYPE.CLICK,
        actionLabel: 'Click the Preferences tab'
      }
    ]
  },

  Contacts: {
    admin: [
      {
        target: '[data-tour="contact-tabs"]',
        title: 'Contact Types',
        content: 'Switch between Borrowers, Entities, and Loan Partners tabs.',
        placement: 'bottom',
        type: STEP_TYPE.INFO
      },
      {
        target: '[data-tour="add-contact"]',
        title: 'Add New Contact',
        content: 'Click here to create a new borrower, entity, or loan partner.',
        placement: 'left',
        type: STEP_TYPE.INFO
      },
      {
        target: '[data-tour="search-contacts"]',
        title: 'Search Contacts',
        content: 'Find any contact quickly by name, email, or company.',
        placement: 'bottom',
        type: STEP_TYPE.INFO
      }
    ]
  },
  ContactDetail: {
    admin: [
      {
        target: '[data-tour="contact-info"]',
        title: 'Contact Information',
        content: 'View and edit contact details here.',
        placement: 'right',
        type: STEP_TYPE.INFO
      },
      {
        target: '[data-tour="related-loans"]',
        title: 'Related Loans',
        content: 'See all loans associated with this contact.',
        placement: 'top',
        type: STEP_TYPE.INFO
      },
      {
        target: '[data-tour="edit-contact"]',
        title: 'Edit Contact',
        content: 'Click here to update contact information.',
        placement: 'left',
        type: STEP_TYPE.INFO
      }
    ]
  }
};

/**
 * Get navigation tour steps for a user role
 * @param {string} role - User's app_role
 * @returns {Array} Tour steps for navigation
 */
export function getNavTourSteps(role) {
  const roleKey = (role === 'Administrator' || role === 'Loan Officer') ? 'admin' : 'borrower';
  return NAV_TOUR_STEPS[roleKey] || NAV_TOUR_STEPS.borrower;
}

/**
 * Get page-specific tour steps
 * @param {string} pageName - Name of the page
 * @param {string} role - User's app_role
 * @returns {Array} Tour steps for the page
 */
export function getPageTourSteps(pageName, role) {
  const roleKey = (role === 'Administrator' || role === 'Loan Officer') ? 'admin' : 'borrower';
  return PAGE_TOUR_STEPS[pageName]?.[roleKey] || [];
}

/**
 * Check if this is user's first login (no nav tour completed)
 * @param {string} userId - User's ID
 * @returns {boolean}
 */
export function isFirstLogin(userId) {
  if (!userId) return false;
  const navTourCompleted = localStorage.getItem(`nav_tour_completed_${userId}`);
  return navTourCompleted !== 'true';
}

/**
 * Check if page tour should show
 * @param {string} userId - User's ID
 * @param {string} pageName - Page name
 * @returns {boolean}
 */
export function shouldShowPageTour(userId, pageName) {
  if (!userId || !pageName) return false;
  if (!isFirstLogin(userId)) return false;
  const pageTourKey = `page_tour_${pageName}_${userId}`;
  return localStorage.getItem(pageTourKey) !== 'true';
}

/**
 * Mark navigation tour as complete
 * @param {string} userId - User's ID
 */
export function completeNavTour(userId) {
  if (userId) {
    localStorage.setItem(`nav_tour_completed_${userId}`, 'true');
  }
}

/**
 * Mark page tour as complete
 * @param {string} userId - User's ID
 * @param {string} pageName - Page name
 */
export function completePageTour(userId, pageName) {
  if (userId && pageName) {
    localStorage.setItem(`page_tour_${pageName}_${userId}`, 'true');
  }
}

/**
 * Reset all tours for a user (for replay from Settings)
 * @param {string} userId - User's ID
 */
export function resetAllTours(userId) {
  if (!userId) return;
  
  // Clear nav tour
  localStorage.removeItem(`nav_tour_completed_${userId}`);
  
  // Clear all page tours
  const pagesToReset = Object.keys(PAGE_TOUR_STEPS);
  pagesToReset.forEach(page => {
    localStorage.removeItem(`page_tour_${page}_${userId}`);
  });
}
