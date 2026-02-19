import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ChecklistItem } from "@/entities/all";
import { Loader2, Lock, Filter, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { base44 } from "@/api/base44Client";
import { usePermissions } from "@/components/hooks/usePermissions";

import ChecklistItemModal from "./ChecklistItemModal";
import { DOCUMENT_CHECKLIST_ITEMS, ACTION_ITEM_CHECKLIST_ITEMS } from "./checklistData";

const ACTION_STATUS_COLORS = {
  not_started: "bg-slate-100 text-slate-800",
  in_progress: "bg-blue-100 text-blue-800",
  on_hold: "bg-amber-100 text-amber-800",
  flagged: "bg-red-100 text-red-800",
  completed: "bg-emerald-100 text-emerald-800"
};

const DOCUMENT_STATUS_COLORS = {
  pending: "bg-slate-100 text-slate-800",
  submitted: "bg-blue-100 text-blue-800",
  under_review: "bg-amber-100 text-amber-800",
  first_review_done: "bg-purple-100 text-purple-800",
  second_review_done: "bg-indigo-100 text-indigo-800",
  approved: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-100 text-red-800",
  approved_with_condition: "bg-violet-100 text-violet-800"
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const checklistKey = (type, name) => `${type}::${name}`.toLowerCase().trim();

export default function LoanChecklistTab({ loan, onUpdate, openTaskId, onTaskOpened }) {
  const { currentUser, permissions, isLoading: permissionsLoading } = usePermissions();
  
  const [checklistItems, setChecklistItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showItemModal, setShowItemModal] = useState(false);

  useEffect(() => {
    console.log('[LoanChecklistTab] State changed:', { 
      showItemModal, 
      selectedItemId: selectedItem?.id,
      checklistItemsCount: checklistItems.length 
    });
  }, [showItemModal, selectedItem, checklistItems]);
  const [activeChecklistType, setActiveChecklistType] = useState(
    permissions.canViewActionChecklist ? "action_item" : "document"
  );
  const [activeCategory, setActiveCategory] = useState("all");
  const [isInitializing, setIsInitializing] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const [assignableUsers, setAssignableUsers] = useState([]);
  const [teamDirectory, setTeamDirectory] = useState({});
  const [showMyTasksOnly, setShowMyTasksOnly] = useState(false);
  const [filters, setFilters] = useState({
    assigned: 'all',
    status: 'all',
    updatedDate: 'all',
    dueDate: 'all'
  });

  useEffect(() => {
    loadUsers();
    loadChecklistItems();
  }, [loan.id, currentUser?.id]);

  useEffect(() => {
    if (currentUser && checklistItems.length > 0) {
      const storageKey = `checklist_category_${currentUser.id}_${loan.id}_${activeChecklistType}`;
      const saved = localStorage.getItem(storageKey);
      
      const categories = [...new Set(checklistItems
        .filter(item => item.checklist_type === activeChecklistType)
        .map(item => item.category))];
      
      if (saved && (saved === "all" || categories.includes(saved))) {
        setActiveCategory(saved);
      } else {
        setActiveCategory("all");
      }
    }
  }, [currentUser, checklistItems, activeChecklistType, loan.id]);

  useEffect(() => {
    if (openTaskId && checklistItems.length > 0) {
      const taskToOpen = checklistItems.find(item => item.id === openTaskId);
      if (taskToOpen) {
        setSelectedItem(taskToOpen);
        setShowItemModal(true);
        if (onTaskOpened) {
          onTaskOpened();
        }
      }
    }
  }, [openTaskId, checklistItems, onTaskOpened]);

  const loadUsers = async () => {
    let allUsers = [];
    let allBorrowers = [];
    let allLoanPartners = [];
    try {
      const response = await base44.functions.invoke('getAllUsers');
      allUsers = response.data.users || [];
      console.log('[LoanChecklistTab] Loaded all users:', allUsers.length, allUsers.slice(0, 3).map(u => ({ id: u.id, name: `${u.first_name} ${u.last_name}`, email: u.email })));
      setAllUsers(allUsers);
    } catch (error) {
      console.error('Error loading users:', error);
      setAllUsers([]);
    }

    try {
      allBorrowers = await base44.entities.Borrower.list();
    } catch (error) {
      console.error('Error loading borrowers:', error);
    }

    try {
      allLoanPartners = await base44.entities.LoanPartner.list();
    } catch (error) {
      console.error('Error loading loan partners:', error);
    }

    const teamIds = new Set([
      ...(loan.borrower_ids || []),
      ...(loan.loan_officer_ids || []),
      ...(loan.referrer_ids || []),
      ...(loan.liaison_ids || []),
      ...(loan.broker_ids || []),
      ...(loan.title_company_ids || []),
      ...(loan.insurance_company_ids || []),
      ...(loan.servicer_ids || []),
      currentUser?.id
    ].filter(Boolean));

    const directory = new Map();
    const setIfMissing = (id, name) => {
      if (!id || !name) return;
      if (!directory.has(id)) {
        directory.set(id, name);
      }
    };

    allUsers.forEach(user => {
      if (!teamIds.has(user.id)) return;
      const name = user.first_name && user.last_name
        ? `${user.first_name} ${user.last_name}`
        : user.full_name || user.email || 'Unknown User';
      setIfMissing(user.id, name);
    });

    allBorrowers.forEach(borrower => {
      const shouldInclude = teamIds.has(borrower.id) || (borrower.user_id && teamIds.has(borrower.user_id));
      if (!shouldInclude) return;
      const name = borrower.first_name && borrower.last_name
        ? `${borrower.first_name} ${borrower.last_name}`
        : borrower.name || borrower.email || 'Unknown Contact';
      setIfMissing(borrower.id, name);
      if (borrower.user_id) {
        setIfMissing(borrower.user_id, name);
      }
    });

    allLoanPartners.forEach(partner => {
      const shouldInclude = teamIds.has(partner.id) || (partner.user_id && teamIds.has(partner.user_id));
      if (!shouldInclude) return;
      const name = partner.name || partner.contact_person || partner.email || 'Unknown Partner';
      setIfMissing(partner.id, name);
      if (partner.user_id) {
        setIfMissing(partner.user_id, name);
      }
    });

    setTeamDirectory(Object.fromEntries(directory));

    const loanUserIds = new Set([
      ...(loan.borrower_ids || []),
      ...(loan.loan_officer_ids || []),
      ...(loan.referrer_ids || [])
    ]);

    const assignable = allUsers.filter(u => {
      if (u.role === 'admin') {
        return false;
      }
      return loanUserIds.has(u.id);
    });

    setAssignableUsers(assignable);
  };

  const ensureChecklistItems = async (existingItems) => {
    if (isInitializing || hasInitialized || !loan.loan_product) return;

    const existingKeys = new Set(
      existingItems.map((item) => checklistKey(item.checklist_type, item.item_name))
    );
    const templates = [
      { type: "action_item", items: ACTION_ITEM_CHECKLIST_ITEMS },
      { type: "document", items: DOCUMENT_CHECKLIST_ITEMS }
    ];

    const missingItems = [];

    templates.forEach(({ type, items }) => {
      items.forEach((templateItem) => {
        const key = checklistKey(type, templateItem.item);
        if (!existingKeys.has(key)) {
          missingItems.push({ type, templateItem });
        }
      });
    });

    if (missingItems.length === 0) {
      setHasInitialized(true);
      return;
    }

    setIsInitializing(true);
    setHasInitialized(true);

    try {
      for (const { type, templateItem } of missingItems) {
        await ChecklistItem.create({
          loan_id: loan.id,
          checklist_type: type,
          category: templateItem.category,
          item_name: templateItem.item,
          description: templateItem.description || '',
          provider: templateItem.provider || '',
          applicable_loan_types: templateItem.loan_types || [],
          document_category: templateItem.document_category || '',
          status: type === "action_item" ? "not_started" : "pending",
          activity_history: []
        });

        await sleep(200);
      }

      await loadChecklistItems({ skipEnsure: true });
    } catch (error) {
      console.error("Error ensuring checklist items:", error);
    } finally {
      setIsInitializing(false);
    }
  };

  const loadChecklistItems = async ({ skipEnsure = false } = {}) => {
    console.log('[LoanChecklistTab] loadChecklistItems called');
    try {
      const items = await ChecklistItem.filter({ loan_id: loan.id });
      console.log('[LoanChecklistTab] Setting checklist items, count:', items.length);
      setChecklistItems(items);
      
      // Only auto-initialize if loan_product is selected
      if (items.length === 0 && !hasInitialized && loan.loan_product) {
        await autoInitializeChecklists();
        return;
      }

      if (!skipEnsure && loan.loan_product) {
        await ensureChecklistItems(items);
      }
    } catch (error) {
      console.error("Error loading checklist items:", error);
    }
  };

  const autoInitializeChecklists = async () => {
    if (isInitializing || hasInitialized || !loan.loan_product) return;
    
    setIsInitializing(true);
    setHasInitialized(true);
    
    try {
      await initializeChecklist('action_item');
      await initializeChecklist('document');
      await loadChecklistItems();
    } catch (error) {
      console.error("Error auto-initializing checklists:", error);
    } finally {
      setIsInitializing(false);
    }
  };

  const initializeChecklist = async (type) => {
    const template = type === "action_item" ? ACTION_ITEM_CHECKLIST_ITEMS : DOCUMENT_CHECKLIST_ITEMS;
    
    try {
      for (let i = 0; i < template.length; i++) {
        const item = template[i];
        
        try {
          await ChecklistItem.create({
            loan_id: loan.id,
            checklist_type: type,
            category: item.category,
            item_name: item.item,
            description: item.description || '',
            provider: item.provider || '',
            applicable_loan_types: item.loan_types || [],
            document_category: item.document_category || '',
            status: type === "action_item" ? "not_started" : "pending",
            activity_history: []
          });
          
          await sleep(500);
        } catch (error) {
          console.error(`Error creating checklist item ${item.item}:`, error);
        }
      }
    } catch (error) {
      console.error("Error initializing checklist:", error);
    }
  };

  const handleItemClick = (item) => {
    console.log('[LoanChecklistTab] Opening modal for item:', item.id);
    if (item.checklist_type === 'action_item' && !permissions.canViewActionChecklist) {
      return;
    }
    
    setSelectedItem(item);
    setShowItemModal(true);
  };

  const handleCloseModal = async () => {
    console.log('[LoanChecklistTab] handleCloseModal called - closing modal');
    setSelectedItem(null);
    setShowItemModal(false);
    await loadChecklistItems();
  };

  const getAssignedUserName = (assignedTo) => {
    if (!assignedTo || assignedTo.length === 0) return 'Unassigned';

    const assignedNames = assignedTo.map(userId => {
      const user = allUsers.find(u => u.id === userId);
      if (user) {
        return user.first_name && user.last_name
          ? `${user.first_name} ${user.last_name}`
          : user.full_name || user.email || 'Unknown User';
      }
      return 'Unknown User';
    }).filter(name => name !== 'Unknown User');

    if (assignedNames.length === 0) return 'Unassigned';
    if (assignedNames.length === 1) return assignedNames[0];
    return assignedNames.join(', ');
  };

  const handleInlineStatusUpdate = async (itemId, newStatus) => {
    try {
      const item = checklistItems.find(i => i.id === itemId);
      if (!item) return;

      const activityEntry = {
        timestamp: new Date().toISOString(),
        user_id: currentUser.id,
        user_name: currentUser.first_name && currentUser.last_name 
          ? `${currentUser.first_name} ${currentUser.last_name}`
          : currentUser.full_name || currentUser.email,
        action: 'status_changed',
        details: `Status changed from "${formatStatus(item.status)}" to "${formatStatus(newStatus)}"`
      };

      await ChecklistItem.update(itemId, {
        status: newStatus,
        activity_history: [...(item.activity_history || []), activityEntry]
      });

      await loadChecklistItems();
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const filteredItems = checklistItems.filter(item => {
    if (item.checklist_type !== activeChecklistType) return false;
    if (activeCategory !== "all" && item.category !== activeCategory) return false;
    
    // My tasks filter
    if (showMyTasksOnly) {
      const isAssignedToMe = item.assigned_to && item.assigned_to.includes(currentUser.id);
      if (!isAssignedToMe) return false;
    }
    
    // Assigned filter
    if (filters.assigned !== 'all') {
      if (filters.assigned === 'unassigned') {
        if (item.assigned_to && item.assigned_to.length > 0) return false;
      } else {
        if (!item.assigned_to || !item.assigned_to.includes(filters.assigned)) return false;
      }
    }
    
    // Status filter
    if (filters.status !== 'all' && item.status !== filters.status) return false;
    
    // Due date filter
    if (filters.dueDate !== 'all') {
      if (!item.due_date) return false;
      const dueDate = new Date(item.due_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (filters.dueDate === 'overdue') {
        if (dueDate >= today) return false;
      } else if (filters.dueDate === 'today') {
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        if (dueDate < today || dueDate >= tomorrow) return false;
      } else if (filters.dueDate === 'this_week') {
        const weekEnd = new Date(today);
        weekEnd.setDate(weekEnd.getDate() + 7);
        if (dueDate < today || dueDate > weekEnd) return false;
      }
    }
    
    // Updated date filter
    if (filters.updatedDate !== 'all') {
      if (!item.updated_date) return false;
      const updatedDate = new Date(item.updated_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (filters.updatedDate === 'today') {
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        if (updatedDate < today || updatedDate >= tomorrow) return false;
      } else if (filters.updatedDate === 'this_week') {
        const weekStart = new Date(today);
        weekStart.setDate(weekStart.getDate() - 7);
        if (updatedDate < weekStart) return false;
      } else if (filters.updatedDate === 'this_month') {
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        if (updatedDate < monthStart) return false;
      }
    }
    
    return true;
  });

  // Sort items: completed/approved at bottom, others by status
  const sortedItems = [...filteredItems].sort((a, b) => {
    const aIsComplete = a.status === 'completed' || a.status === 'approved';
    const bIsComplete = b.status === 'completed' || b.status === 'approved';
    
    if (aIsComplete && !bIsComplete) return 1;
    if (!aIsComplete && bIsComplete) return -1;
    
    // Within same completion status, maintain original order
    return 0;
  });

  // Get category order from the configured checklist data (as set in Settings)
  const templateData = activeChecklistType === 'action_item' ? ACTION_ITEM_CHECKLIST_ITEMS : DOCUMENT_CHECKLIST_ITEMS;
  const templateCategoryOrder = [...new Set(templateData.map(item => item.category))];

  const rawCategories = [...new Set(checklistItems
    .filter(item => item.checklist_type === activeChecklistType)
    .map(item => item.category))];

  // Sort categories by their order in the template; any not in template go at the end
  const categories = rawCategories.sort((a, b) => {
    const aIdx = templateCategoryOrder.indexOf(a);
    const bIdx = templateCategoryOrder.indexOf(b);
    if (aIdx === -1 && bIdx === -1) return 0;
    if (aIdx === -1) return 1;
    if (bIdx === -1) return -1;
    return aIdx - bIdx;
  });

  const getStatusColors = (status, type) => {
    return type === "action_item" ? ACTION_STATUS_COLORS[status] : DOCUMENT_STATUS_COLORS[status];
  };

  const formatStatus = (status) => {
    return status?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Not Started';
  };

  if (permissionsLoading) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-slate-500" />
            <p className="text-slate-600">Loading...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isInitializing) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-slate-500" />
            <p className="text-slate-600">Initializing checklists...</p>
            <p className="text-xs text-slate-500">This may take a minute...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show message if loan product not selected
  if (!loan.loan_product) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center gap-4 text-center">
            <Lock className="w-12 h-12 text-slate-400" />
            <div>
              <p className="text-lg font-semibold text-slate-700 mb-2">Loan Product Required</p>
              <p className="text-sm text-slate-500">
                Please select a loan product in the Overview tab before checklists can be initialized.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Document Checklist</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={activeChecklistType} onValueChange={setActiveChecklistType}>
          {permissions.canViewActionChecklist && (
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="action_item">Action Item Checklist</TabsTrigger>
              <TabsTrigger value="document">Document Checklist</TabsTrigger>
            </TabsList>
          )}

          <TabsContent value={activeChecklistType} className="space-y-4">
            <div className="flex flex-wrap items-center gap-3 pb-4 border-b">
              <Button
                variant={showMyTasksOnly ? "default" : "outline"}
                onClick={() => setShowMyTasksOnly(!showMyTasksOnly)}
                size="sm"
                className={showMyTasksOnly ? "bg-slate-700 hover:bg-slate-800" : ""}
              >
                <UserIcon className="w-4 h-4 mr-2" />
                My Tasks
              </Button>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Filter className="w-4 h-4 mr-2" />
                    Filters
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80" align="start">
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-medium text-slate-700 mb-1.5 block">Assigned To</label>
                      <Select value={filters.assigned} onValueChange={(v) => setFilters({...filters, assigned: v})}>
                        <SelectTrigger className="h-9 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                          <SelectItem value="unassigned">Unassigned</SelectItem>
                          {assignableUsers.map(user => (
                            <SelectItem key={user.id} value={user.id}>
                              {user.first_name && user.last_name ? `${user.first_name} ${user.last_name}` : user.full_name || user.email}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-slate-700 mb-1.5 block">Status</label>
                      <Select value={filters.status} onValueChange={(v) => setFilters({...filters, status: v})}>
                        <SelectTrigger className="h-9 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Status</SelectItem>
                          {activeChecklistType === 'action_item' ? (
                            <>
                              <SelectItem value="not_started">Not Started</SelectItem>
                              <SelectItem value="in_progress">In Progress</SelectItem>
                              <SelectItem value="on_hold">On Hold</SelectItem>
                              <SelectItem value="flagged">Flagged</SelectItem>
                              <SelectItem value="completed">Completed</SelectItem>
                            </>
                          ) : (
                            <>
                              <SelectItem value="pending">Pending</SelectItem>
                              <SelectItem value="submitted">Submitted</SelectItem>
                              <SelectItem value="under_review">Under Review</SelectItem>
                              <SelectItem value="first_review_done">1st Review Done</SelectItem>
                              <SelectItem value="second_review_done">2nd Review Done</SelectItem>
                              <SelectItem value="approved">Approved</SelectItem>
                              <SelectItem value="rejected">Rejected</SelectItem>
                              <SelectItem value="approved_with_condition">Approved with Condition</SelectItem>
                            </>
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-slate-700 mb-1.5 block">Due Date</label>
                      <Select value={filters.dueDate} onValueChange={(v) => setFilters({...filters, dueDate: v})}>
                        <SelectTrigger className="h-9 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                          <SelectItem value="overdue">Overdue</SelectItem>
                          <SelectItem value="today">Due Today</SelectItem>
                          <SelectItem value="this_week">Due This Week</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-slate-700 mb-1.5 block">Last Updated</label>
                      <Select value={filters.updatedDate} onValueChange={(v) => setFilters({...filters, updatedDate: v})}>
                        <SelectTrigger className="h-9 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Time</SelectItem>
                          <SelectItem value="today">Today</SelectItem>
                          <SelectItem value="this_week">This Week</SelectItem>
                          <SelectItem value="this_month">This Month</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setFilters({ assigned: 'all', status: 'all', updatedDate: 'all', dueDate: 'all' })}
                      className="w-full"
                    >
                      Clear Filters
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {categories.length > 0 && (
              <Tabs value={activeCategory} onValueChange={(value) => {
                setActiveCategory(value);
                const storageKey = `checklist_category_${currentUser?.id}_${loan.id}_${activeChecklistType}`;
                localStorage.setItem(storageKey, value);
              }}>
                <TabsList className="flex-wrap h-auto">
                  <TabsTrigger value="all">All</TabsTrigger>
                  {categories.map(cat => (
                    <TabsTrigger key={cat} value={cat}>{cat}</TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            )}

            {sortedItems.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <p className="text-sm">
                  {checklistItems.length === 0 ? 'Loading checklist items...' : 'No items match the current filters'}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Assigned To</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedItems.map((item) => (
                    <TableRow 
                      key={item.id} 
                      className="hover:bg-slate-50"
                    >
                      <TableCell 
                        className="font-medium cursor-pointer"
                        onClick={() => handleItemClick(item)}
                      >
                        {item.item_name}
                        {activeChecklistType === "document" && item.description && (
                          <p className="text-xs text-slate-500 mt-1">{item.description}</p>
                        )}
                      </TableCell>
                      <TableCell onClick={() => handleItemClick(item)} className="cursor-pointer">
                        <Badge variant="outline">{item.category}</Badge>
                      </TableCell>
                      <TableCell 
                        className="text-sm text-slate-600 cursor-pointer"
                        onClick={() => handleItemClick(item)}
                      >
                        {getAssignedUserName(item.assigned_to)}
                      </TableCell>
                      <TableCell 
                        className="text-sm text-slate-600 cursor-pointer"
                        onClick={() => handleItemClick(item)}
                      >
                        {item.due_date ? format(new Date(item.due_date), 'MMM d, yyyy') : '-'}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Select
                          value={item.status}
                          onValueChange={(newStatus) => handleInlineStatusUpdate(item.id, newStatus)}
                          disabled={!permissions.canManageChecklists}
                        >
                          <SelectTrigger className={`h-8 text-xs border-0 ${getStatusColors(item.status, item.checklist_type)}`}>
                            <SelectValue>{formatStatus(item.status)}</SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {activeChecklistType === 'action_item' ? (
                              <>
                                <SelectItem value="not_started">Not Started</SelectItem>
                                <SelectItem value="in_progress">In Progress</SelectItem>
                                <SelectItem value="on_hold">On Hold</SelectItem>
                                <SelectItem value="flagged">Flagged</SelectItem>
                                <SelectItem value="completed">Completed</SelectItem>
                              </>
                            ) : (
                              <>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="submitted">Submitted</SelectItem>
                                <SelectItem value="under_review">Under Review</SelectItem>
                                <SelectItem value="first_review_done">1st Review Done</SelectItem>
                                <SelectItem value="second_review_done">2nd Review Done</SelectItem>
                                <SelectItem value="approved">Approved</SelectItem>
                                <SelectItem value="rejected">Rejected</SelectItem>
                                <SelectItem value="approved_with_condition">Approved with Condition</SelectItem>
                              </>
                            )}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>

      {showItemModal && (
        <ChecklistItemModal
          isOpen={showItemModal}
          onClose={handleCloseModal}
          item={selectedItem}
          loanId={loan.id}
          loan={loan}
          assignableUsersList={assignableUsers}
          allUsersList={allUsers}
          teamDirectory={teamDirectory}
          currentUser={currentUser}
          canManage={permissions.canManageChecklists}
        />
      )}
      {console.log('[LoanChecklistTab] Rendering ChecklistItemModal with allUsers:', allUsers.length)}
    </Card>
  );
}
