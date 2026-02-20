import React, { useState, useEffect } from "react";
import { ChecklistItem, Loan } from "@/entities/all";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { GripVertical, Search, MessageSquare, ExternalLink, Calendar, Building2, ArrowLeft } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useToast } from "@/components/ui/use-toast";
import { usePermissions } from "@/components/hooks/usePermissions";

import SendTaskMessageModal from "../components/tasks/SendTaskMessageModal";

const STATUS_COLORS = {
  not_started: "bg-slate-100 text-slate-800",
  in_progress: "bg-blue-100 text-blue-800",
  on_hold: "bg-amber-100 text-amber-800",
  flagged: "bg-red-100 text-red-800",
  completed: "bg-emerald-100 text-emerald-800",
  pending: "bg-slate-100 text-slate-800",
  submitted: "bg-blue-100 text-blue-800",
  under_review: "bg-amber-100 text-amber-800",
  approved: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-100 text-red-800",
  approved_with_condition: "bg-purple-100 text-purple-800"
};

export default function MyTasks() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { currentUser, permissions, isLoading: permissionsLoading } = usePermissions();
  
  const [tasks, setTasks] = useState([]);
  const [loans, setLoans] = useState({});
  const [filteredTasks, setFilteredTasks] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState(null);
  const [showMessageModal, setShowMessageModal] = useState(false);

  useEffect(() => {
    if (!permissionsLoading && currentUser) {
      loadData();
    }
  }, [permissionsLoading, currentUser]);

  useEffect(() => {
    filterTasks();
  }, [tasks, searchTerm, statusFilter]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      console.log('[MyTasks] Starting data load...');
      console.log('[MyTasks] Current user ID:', currentUser.id);
      const borrowerAccessIds = permissions.borrowerAccessIds || [currentUser.id];
      
      // First load all loans
      const allLoans = await Loan.list('-created_date');
      console.log('[MyTasks] All loans loaded:', allLoans?.length || 0);

      // Filter loans where user is assigned (loan officer, borrower, or referrer)
      const userLoans = (allLoans || []).filter(loan => {
        const isLoanOfficer = loan.loan_officer_ids?.includes(currentUser.id);
        const isBorrower = loan.borrower_ids?.some((id) => borrowerAccessIds.includes(id));
        const isReferrer = loan.referrer_ids?.includes(currentUser.id);
        return isLoanOfficer || isBorrower || isReferrer;
      });
      console.log('[MyTasks] User loans:', userLoans.length);

      // Build loan lookup map
      const loanData = {};
      userLoans.forEach(loan => {
        loanData[loan.id] = loan;
      });
      setLoans(loanData);

      // Get loan IDs for filtering tasks
      const userLoanIds = userLoans.map(loan => loan.id);
      
      if (userLoanIds.length === 0) {
        console.log('[MyTasks] No loans assigned to user, no tasks to load');
        setTasks([]);
        setIsLoading(false);
        return;
      }

      // Load tasks for user's loans
      const taskPromises = userLoanIds.map(loanId => 
        ChecklistItem.filter({ loan_id: loanId })
      );
      const taskResults = await Promise.all(taskPromises);
      const allTasks = taskResults.flat();
      console.log('[MyTasks] Tasks from user loans:', allTasks.length);

      // Filter tasks assigned to current user (exclude completed, approved, approved_with_condition, rejected)
      const excludedStatuses = ['completed', 'approved', 'approved_with_condition', 'rejected'];
      const myTasks = allTasks.filter(task => {
        if (!task.assigned_to) return false;
        if (excludedStatuses.includes(task.status)) return false;
        const assignedTo = Array.isArray(task.assigned_to) ? task.assigned_to : [task.assigned_to];
        return assignedTo.includes(currentUser.id);
      });

      console.log('[MyTasks] Filtered tasks assigned to user:', myTasks.length);

      // Sort by user's custom priority (stored in local storage) or by due date
      const savedOrder = localStorage.getItem(`task_order_${currentUser.id}`);
      if (savedOrder) {
        const orderMap = JSON.parse(savedOrder);
        myTasks.sort((a, b) => {
          const indexA = orderMap[a.id] !== undefined ? orderMap[a.id] : 9999;
          const indexB = orderMap[b.id] !== undefined ? orderMap[b.id] : 9999;
          return indexA - indexB;
        });
      } else {
        // Default sort by due date
        myTasks.sort((a, b) => {
          if (!a.due_date) return 1;
          if (!b.due_date) return -1;
          return new Date(a.due_date) - new Date(b.due_date);
        });
      }

      setTasks(myTasks);
    } catch (error) {
      console.error('[MyTasks] Error loading tasks:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load tasks. Please try again.",
      });
    }
    setIsLoading(false);
  };

  const filterTasks = () => {
    let filtered = [...tasks];

    if (searchTerm) {
      filtered = filtered.filter(task =>
        task.item_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (loans[task.loan_id]?.loan_number || '').toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(task => task.status === statusFilter);
    }

    setFilteredTasks(filtered);
  };

  const handleDragEnd = (result) => {
    if (!result.destination || !currentUser) return;

    const items = Array.from(filteredTasks);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    setFilteredTasks(items);

    // Save order to localStorage
    const orderMap = {};
    items.forEach((item, index) => {
      orderMap[item.id] = index;
    });
    localStorage.setItem(`task_order_${currentUser.id}`, JSON.stringify(orderMap));

    toast({
      title: "Priority Updated",
      description: "Your task order has been saved.",
    });
  };

  const handleViewDetails = (task) => {
    console.log('[MyTasks] handleViewDetails called for task:', task.item_name);
    console.log('[MyTasks] Task loan_id:', task.loan_id);
    console.log('[MyTasks] Current loans state:', loans);
    console.log('[MyTasks] Loans keys:', Object.keys(loans));
    
    // Check if loan data exists for this task
    if (!task.loan_id) {
      console.log('[MyTasks] No loan_id on task');
      toast({
        variant: "destructive",
        title: "Error",
        description: "No loan associated with this task.",
      });
      return;
    }
    
    const loan = loans[task.loan_id];
    console.log('[MyTasks] Found loan:', loan);
    
    // Navigate even if loan data isn't in our local cache - the LoanDetail page will load it
    navigate(createPageUrl('LoanDetail') + `?id=${task.loan_id}&openTask=${task.id}`);
  };

  const handleSendMessage = (task) => {
    setSelectedTask(task);
    setShowMessageModal(true);
  };

  const getLastUpdateInfo = (task) => {
    const dates = [];
    
    if (task.updated_date) {
      dates.push(new Date(task.updated_date));
    }
    
    if (task.notes && task.notes.length > 0) {
      const lastNote = task.notes[task.notes.length - 1];
      if (lastNote.timestamp) {
        dates.push(new Date(lastNote.timestamp));
      }
    }
    
    if (task.uploaded_files && task.uploaded_files.length > 0) {
      const lastFile = task.uploaded_files[task.uploaded_files.length - 1];
      if (lastFile.uploaded_date) {
        dates.push(new Date(lastFile.uploaded_date));
      }
    }
    
    if (dates.length === 0) return 'No updates';
    
    const mostRecent = new Date(Math.max(...dates));
    return formatDistanceToNow(mostRecent, { addSuffix: true });
  };

  const formatStatus = (status) => {
    return status?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Unknown';
  };

  if (permissionsLoading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate(createPageUrl('Dashboard'))}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          
          <h1 className="text-3xl font-bold text-slate-900 mb-2">My Tasks</h1>
          <p className="text-slate-600">Drag and drop to prioritize your tasks</p>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder="Search tasks or loan numbers..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="not_started">Not Started</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="on_hold">On Hold</SelectItem>
                  <SelectItem value="flagged">Flagged</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="submitted">Submitted</SelectItem>
                  <SelectItem value="under_review">Under Review</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Tasks List */}
        <Card>
          <CardHeader>
            <CardTitle>
              {filteredTasks.length} {filteredTasks.length === 1 ? 'Task' : 'Tasks'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {filteredTasks.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <p>No tasks found</p>
              </div>
            ) : (
              <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId="tasks">
                  {(provided) => (
                    <div
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                      className="space-y-3"
                    >
                      {filteredTasks.map((task, index) => (
                        <Draggable
                          key={task.id}
                          draggableId={task.id}
                          index={index}
                        >
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              className={`bg-white border border-slate-200 rounded-lg p-4 transition-all ${
                                snapshot.isDragging ? 'shadow-lg' : 'hover:shadow-md'
                              }`}
                            >
                              <div className="flex items-start gap-4">
                                {/* Drag Handle */}
                                <div
                                  {...provided.dragHandleProps}
                                  className="mt-1 cursor-grab active:cursor-grabbing"
                                >
                                  <GripVertical className="w-5 h-5 text-slate-400" />
                                </div>

                                {/* Task Content */}
                                <div className="flex-1">
                                  <div className="flex items-start justify-between mb-2">
                                    <div className="flex-1">
                                      <h3 className="font-semibold text-slate-900 mb-1">
                                        {task.item_name}
                                      </h3>
                                      {task.description && (
                                        <p className="text-sm text-slate-600 mb-2">
                                          {task.description}
                                        </p>
                                      )}
                                    </div>
                                    <Badge className={STATUS_COLORS[task.status]}>
                                      {formatStatus(task.status)}
                                    </Badge>
                                  </div>

                                  <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600 mb-3">
                                    {loans[task.loan_id] && (
                                      <div className="flex items-center gap-1">
                                        <Building2 className="w-4 h-4" />
                                        <span>{loans[task.loan_id].loan_number}</span>
                                      </div>
                                    )}
                                    
                                    <div className="flex items-center gap-1">
                                      <Calendar className="w-4 h-4" />
                                      <span>
                                        Due: {task.due_date ? format(new Date(task.due_date), 'MMM d, yyyy') : 'N/A'}
                                      </span>
                                    </div>

                                    <span className="text-slate-500">
                                      Updated {getLastUpdateInfo(task)}
                                    </span>
                                  </div>

                                  {/* Action Buttons */}
                                  <div className="flex gap-2">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleViewDetails(task)}
                                    >
                                      <ExternalLink className="w-4 h-4 mr-1" />
                                      View Details
                                    </Button>
                                    
                                    {permissions.canCreateDirectMessage && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleSendMessage(task)}
                                      >
                                        <MessageSquare className="w-4 h-4 mr-1" />
                                        Send Message
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Send Message Modal */}
      {selectedTask && permissions.canCreateDirectMessage && (
        <SendTaskMessageModal
          isOpen={showMessageModal}
          onClose={() => {
            setShowMessageModal(false);
            setSelectedTask(null);
          }}
          task={selectedTask}
          loan={loans[selectedTask.loan_id]}
          currentUser={currentUser}
        />
      )}
    </div>
  );
}
