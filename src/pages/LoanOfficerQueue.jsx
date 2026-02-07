import React, { useState, useEffect } from "react";
import { LoanOfficerQueue as LoanOfficerQueueEntity, LoanApplication, Loan } from "@/entities/all";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GripVertical, UserCheck, Plus, AlertCircle, Unlock, RotateCcw } from "lucide-react";
import { motion } from "framer-motion";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { base44 } from "@/api/base44Client";
import { usePermissions } from "@/components/hooks/usePermissions";


export default function LoanOfficerQueue() {
  const { currentUser, permissions, isLoading: permissionsLoading } = usePermissions();
  
  const [queueItems, setQueueItems] = useState([]);
  const [loanOfficers, setLoanOfficers] = useState([]);
  const [availableOfficers, setAvailableOfficers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!permissionsLoading) {
      loadData();
    }
  }, [permissionsLoading]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      let users = [];
      try {
        const usersResponse = await base44.functions.invoke('getAllUsers');
        users = usersResponse.data.users || [];
      } catch (error) {
        console.error('LoanOfficerQueue - Error fetching visible users:', error);
      }

      const [queue, applications, loans] = await Promise.all([
        LoanOfficerQueueEntity.list('queue_position'),
        LoanApplication.list(),
        Loan.list()
      ]);

      const activeApplications = applications.filter(app =>
        !['approved', 'rejected'].includes(app.status)
      );
      const activeLoans = loans.filter(loan =>
        !['archived', 'dead'].includes(loan.status)
      );

      const officers = users.filter(u => u.app_role === 'Loan Officer');
      setLoanOfficers(officers);

      const officerWorkload = {};
      
      activeApplications.forEach(app => {
        if (app.assigned_loan_officer_id) {
          officerWorkload[app.assigned_loan_officer_id] = (officerWorkload[app.assigned_loan_officer_id] || 0) + 1;
        }
      });

      activeLoans.forEach(loan => {
        if (loan.loan_officer_ids && loan.loan_officer_ids.length > 0) {
          loan.loan_officer_ids.forEach(officerId => {
            officerWorkload[officerId] = (officerWorkload[officerId] || 0) + 1;
          });
        }
      });

      const queueWithData = queue.map(q => {
        const officer = officers.find(o => o.id === q.loan_officer_id);
        
        let officerName = 'Loan Officer';
        if (q.loan_officer_id === currentUser?.id) {
          officerName = currentUser.first_name && currentUser.last_name 
            ? `${currentUser.first_name} ${currentUser.last_name} (You)` 
            : currentUser.full_name 
            ? `${currentUser.full_name} (You)`
            : `${currentUser.email} (You)`;
        } else if (officer) {
          officerName = officer.first_name && officer.last_name 
            ? `${officer.first_name} ${officer.last_name}` 
            : officer.full_name || officer.email;
        }
        
        return {
          ...q,
          officer_name: officerName,
          officer_email: officer?.email,
          active_loan_count: officerWorkload[q.loan_officer_id] || 0,
          is_active: q.is_active === undefined ? true : q.is_active,
          is_manual_position: q.is_manual_position || false
        };
      });

      // Reorder queue based on workload for unlocked positions
      const reorderedQueue = reorderQueueByWorkload(queueWithData);
      setQueueItems(reorderedQueue);

      const officersInQueue = queue.map(q => q.loan_officer_id);
      const available = officers.filter(o => !officersInQueue.includes(o.id));
      setAvailableOfficers(available);

    } catch (error) {
      console.error('Error loading queue data:', error);
    }
    setIsLoading(false);
  };

  const reorderQueueByWorkload = (queueData) => {
    // Separate inactive officers - they go to the bottom regardless of lock status
    const inactive = queueData.filter(q => q.is_active === false);
    const active = queueData.filter(q => q.is_active !== false);
    
    // Among active officers, separate locked and unlocked
    const locked = active.filter(q => q.is_manual_position);
    const unlocked = active.filter(q => !q.is_manual_position);

    // Sort unlocked by workload (lowest first), then by original position
    unlocked.sort((a, b) => {
      if (a.active_loan_count !== b.active_loan_count) {
        return a.active_loan_count - b.active_loan_count;
      }
      return a.queue_position - b.queue_position;
    });

    // Build final queue for active officers: locked stay at their positions, unlocked fill the rest
    const result = [];
    const lockedPositions = new Set(locked.map(l => l.queue_position));
    
    let unlockedIndex = 0;
    for (let position = 1; position <= active.length; position++) {
      const lockedOfficer = locked.find(l => l.queue_position === position);
      if (lockedOfficer) {
        result.push({ ...lockedOfficer, queue_position: position });
      } else if (unlockedIndex < unlocked.length) {
        result.push({ ...unlocked[unlockedIndex], queue_position: position });
        unlockedIndex++;
      }
    }

    // Append inactive officers at the bottom
    inactive.forEach((officer, idx) => {
      result.push({ ...officer, queue_position: active.length + idx + 1 });
    });

    return result;
  };

  const handleDragEnd = async (result) => {
    if (!result.destination) return;
    if (result.source.index === result.destination.index) return;

    const items = Array.from(queueItems);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    // Mark the moved officer as manual and recalculate positions
    const updates = items.map((item, index) => ({
      ...item,
      queue_position: index + 1,
      is_manual_position: item.id === reorderedItem.id ? true : item.is_manual_position
    }));

    setQueueItems(updates);

    try {
      await Promise.all(
        updates.map(item =>
          LoanOfficerQueueEntity.update(item.id, { 
            queue_position: item.queue_position,
            is_manual_position: item.is_manual_position
          })
        )
      );
    } catch (error) {
      console.error('Error updating queue order:', error);
      loadData();
    }
  };

  const handleAddOfficer = async (officerId) => {
    try {
      const newPosition = queueItems.length + 1;
      await LoanOfficerQueueEntity.create({
        loan_officer_id: officerId,
        queue_position: newPosition,
        active_loan_count: 0,
        is_active: true,
      });

      loadData();
    } catch (error) {
      console.error('Error adding officer:', error);
    }
  };

  const handleStatusChange = async (queueItemId, isActive) => {
    try {
      await LoanOfficerQueueEntity.update(queueItemId, { is_active: isActive });
      setQueueItems(prevItems => 
        prevItems.map(item => 
          item.id === queueItemId ? { ...item, is_active: isActive } : item
        )
      );
    } catch (error) {
      console.error('Error updating status:', error);
      loadData();
    }
  };

  const handleUnlockPosition = async (queueItemId) => {
    try {
      await LoanOfficerQueueEntity.update(queueItemId, { is_manual_position: false });
      loadData(); // Reload to trigger reordering
    } catch (error) {
      console.error('Error unlocking position:', error);
    }
  };

  const handleResetAllPositions = async () => {
    try {
      await Promise.all(
        queueItems.map(item =>
          LoanOfficerQueueEntity.update(item.id, { is_manual_position: false })
        )
      );
      loadData(); // Reload to trigger reordering
    } catch (error) {
      console.error('Error resetting positions:', error);
    }
  };

  const getLoanOfficerName = (officerId) => {
    if (currentUser && officerId === currentUser.id) {
      if (currentUser.first_name || currentUser.last_name) {
        return `${currentUser.first_name || ''} ${currentUser.last_name || ''}`.trim() + ' (You)';
      }
      if (currentUser.full_name) {
        return `${currentUser.full_name} (You)`;
      }
      return `${currentUser.email} (You)`;
    }
    
    const officer = loanOfficers.find(lo => lo.id === officerId);
    if (!officer) return 'Loan Officer';
    
    if (officer.first_name || officer.last_name) {
      return `${officer.first_name || ''} ${officer.last_name || ''}`.trim();
    }
    
    if (officer.full_name) {
      return officer.full_name;
    }
    
    return officer.email || 'Loan Officer';
  };

  if (permissionsLoading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900"></div>
      </div>
    );
  }

  if (!permissions.canViewLoanOfficerQueue) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center">
            <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-slate-900 mb-2">Access Denied</h2>
            <p className="text-slate-600">Only administrators and loan officers can view the loan officer queue.</p>
            <p className="text-xs text-slate-400 mt-4">
              If you believe you should have access, please go to Settings to update your role.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 tracking-tight mb-2">
                Loan Officer Queue
              </h1>
              <p className="text-slate-600">
                Manage loan officer assignments and workload distribution
              </p>
            </div>
            {permissions.canManageLoanOfficerQueue && (
              <div className="flex gap-3 flex-wrap">
                {queueItems.some(q => q.is_manual_position) && (
                  <Button
                    variant="outline"
                    onClick={handleResetAllPositions}
                    className="gap-2"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Reset All to Auto-Sort
                  </Button>
                )}
                {availableOfficers.length > 0 && (
                  <Select
                    onValueChange={(officerId) => handleAddOfficer(officerId)}
                    value=""
                  >
                    <SelectTrigger className="w-auto min-w-[200px]">
                      <SelectValue placeholder="Add an officer" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableOfficers.map(officer => (
                        <SelectItem key={officer.id} value={officer.id}>
                          <div className="flex items-center gap-2">
                            <Plus className="w-4 h-4" />
                            {officer.first_name && officer.last_name 
                              ? `${officer.first_name} ${officer.last_name}`
                              : officer.full_name || officer.email}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}
          </div>
        </motion.div>

        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-900">
                <p className="font-semibold mb-1">How Auto-Assignment Works:</p>
                <ul className="list-disc list-inside space-y-1 text-blue-800">
                  <li>Officers are automatically sorted by workload (lowest first).</li>
                  <li>Drag-and-drop an officer to manually lock their position.</li>
                  <li>Locked positions stay fixed while unlocked officers are re-sorted by workload.</li>
                  <li>Workload counts applications except approved/rejected and loans except archived/dead.</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {queueItems.length > 0 && (
          <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>Loan Officer Queue ({queueItems.length} Officers)</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <DragDropContext onDragEnd={handleDragEnd}>
                <Table data-tour="queue-table">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[150px]">Position</TableHead>
                      <TableHead>Loan Officer</TableHead>
                      <TableHead className="w-[150px]">Active Workload</TableHead>
                      <TableHead className="w-[150px]">Availability</TableHead>
                      <TableHead className="w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <Droppable droppableId="queue">
                    {(provided) => (
                      <TableBody {...provided.droppableProps} ref={provided.innerRef}>
                        {queueItems.map((officer, index) => (
                          <Draggable key={officer.id} draggableId={officer.id} index={index}>
                            {(provided, snapshot) => (
                              <TableRow
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                className={snapshot.isDragging ? 'bg-slate-100' : ''}
                              >
                                <TableCell {...provided.dragHandleProps}>
                                  <div className="flex items-center gap-2" data-tour="drag-handle">
                                    <GripVertical className="w-4 h-4 text-slate-400 cursor-grab" />
                                    <Badge className={officer.is_manual_position ? "bg-amber-600 text-white" : "bg-slate-900 text-white"}>
                                      #{officer.queue_position}
                                      {officer.is_manual_position && " 🔒"}
                                    </Badge>
                                  </div>
                                </TableCell>
                                <TableCell className="font-medium">
                                  {officer.officer_name}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="text-slate-700 border-slate-300 bg-slate-50">
                                    {officer.active_loan_count} active
                                  </Badge>
                                </TableCell>
                                <TableCell data-tour="active-toggle">
                                  <Select
                                    value={officer.is_active === false ? 'inactive' : 'active'}
                                    onValueChange={(value) => handleStatusChange(officer.id, value === 'active')}
                                    disabled={!permissions.canManageLoanOfficerQueue}
                                  >
                                    <SelectTrigger className="w-32">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="active">
                                        <div className="flex items-center gap-2">
                                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                          Active
                                        </div>
                                      </SelectItem>
                                      <SelectItem value="inactive">
                                        <div className="flex items-center gap-2">
                                          <div className="w-2 h-2 bg-slate-400 rounded-full"></div>
                                          Inactive
                                        </div>
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                </TableCell>
                                <TableCell>
                                  {officer.is_manual_position && permissions.canManageLoanOfficerQueue && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleUnlockPosition(officer.id)}
                                      className="gap-2"
                                    >
                                      <Unlock className="w-4 h-4" />
                                      Unlock
                                    </Button>
                                  )}
                                </TableCell>
                              </TableRow>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </TableBody>
                    )}
                  </Droppable>
                </Table>
              </DragDropContext>
            </CardContent>
          </Card>
        )}

        {queueItems.length === 0 && (
          <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
            <CardContent className="p-12 text-center">
              <UserCheck className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-slate-600 mb-2">Queue is Empty</h3>
              <p className="text-slate-500">
                {permissions.canManageLoanOfficerQueue
                  ? "Add loan officers to the queue using the dropdown above."
                  : "There are no loan officers in the queue."
                }
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
