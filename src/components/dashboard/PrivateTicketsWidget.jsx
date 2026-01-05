import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, CheckCircle, Circle, AlertCircle, Clock } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

const STATUS_COLORS = {
  not_started: "bg-slate-100 text-slate-700",
  in_progress: "bg-blue-100 text-blue-700",
  flagged: "bg-red-100 text-red-700",
  completed: "bg-green-100 text-green-700"
};

const STATUS_ICONS = {
  not_started: Circle,
  in_progress: Clock,
  flagged: AlertCircle,
  completed: CheckCircle
};

const STATUS_LABELS = {
  not_started: "Not Started",
  in_progress: "In Progress",
  flagged: "Flagged",
  completed: "Completed"
};

export default function PrivateTicketsWidget({ currentUser }) {
  const [newTicketName, setNewTicketName] = useState("");
  const [editingNote, setEditingNote] = useState(null);
  const queryClient = useQueryClient();

  const { data: tickets = [] } = useQuery({
    queryKey: ['private-tickets', currentUser?.id],
    queryFn: async () => {
      if (!currentUser) return [];
      const items = await base44.entities.ChecklistItem.filter({
        is_private: true,
        owner_id: currentUser.id
      }, '-created_date');
      return items || [];
    },
    enabled: !!currentUser,
  });

  const createTicketMutation = useMutation({
    mutationFn: async (name) => {
      await base44.entities.ChecklistItem.create({
        item_name: name,
        is_private: true,
        owner_id: currentUser.id,
        status: 'not_started',
        description: ''
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['private-tickets'] });
      setNewTicketName("");
    },
  });

  const updateTicketMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      await base44.entities.ChecklistItem.update(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['private-tickets'] });
    },
  });

  const deleteTicketMutation = useMutation({
    mutationFn: async (id) => {
      await base44.entities.ChecklistItem.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['private-tickets'] });
    },
  });

  const handleAddTicket = () => {
    if (newTicketName.trim()) {
      createTicketMutation.mutate(newTicketName.trim());
    }
  };

  const handleStatusChange = (ticketId, newStatus) => {
    updateTicketMutation.mutate({ id: ticketId, data: { status: newStatus } });
  };

  const handleNoteChange = (ticketId, note) => {
    updateTicketMutation.mutate({ id: ticketId, data: { description: note } });
    setEditingNote(null);
  };

  const handleDelete = (ticketId) => {
    if (window.confirm('Are you sure you want to delete this ticket?')) {
      deleteTicketMutation.mutate(ticketId);
    }
  };

  const activeTickets = tickets.filter(t => t.status !== 'completed');
  const completedTickets = tickets.filter(t => t.status === 'completed');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">My Private Tickets</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add New Ticket */}
        <div className="flex gap-2">
          <Input
            placeholder="New ticket name..."
            value={newTicketName}
            onChange={(e) => setNewTicketName(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAddTicket()}
          />
          <Button
            onClick={handleAddTicket}
            disabled={!newTicketName.trim() || createTicketMutation.isPending}
            size="sm"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>

        {/* Active Tickets */}
        <div className="space-y-2">
          {activeTickets.length === 0 && completedTickets.length === 0 && (
            <p className="text-sm text-slate-500 text-center py-4">No tickets yet. Add one above!</p>
          )}
          
          {activeTickets.map((ticket) => {
            const StatusIcon = STATUS_ICONS[ticket.status];
            return (
              <div key={ticket.id} className="border rounded-lg p-3 space-y-2 hover:bg-slate-50 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <StatusIcon className="w-4 h-4 text-slate-600" />
                      <span className="font-medium text-sm">{ticket.item_name}</span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Select
                        value={ticket.status}
                        onValueChange={(value) => handleStatusChange(ticket.id, value)}
                      >
                        <SelectTrigger className="h-7 w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="not_started">Not Started</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="flagged">Flagged</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                        </SelectContent>
                      </Select>
                      <Badge className={`${STATUS_COLORS[ticket.status]} border-0 text-xs`}>
                        {STATUS_LABELS[ticket.status]}
                      </Badge>
                    </div>

                    {editingNote === ticket.id ? (
                      <Textarea
                        autoFocus
                        placeholder="Add notes..."
                        defaultValue={ticket.description || ''}
                        onBlur={(e) => handleNoteChange(ticket.id, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') setEditingNote(null);
                          if (e.key === 'Enter' && e.ctrlKey) {
                            handleNoteChange(ticket.id, e.target.value);
                          }
                        }}
                        className="text-xs min-h-[60px]"
                      />
                    ) : (
                      <div
                        onClick={() => setEditingNote(ticket.id)}
                        className="text-xs text-slate-600 cursor-pointer hover:bg-slate-100 p-2 rounded border border-transparent hover:border-slate-200 min-h-[40px]"
                      >
                        {ticket.description || 'Click to add notes...'}
                      </div>
                    )}
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(ticket.id)}
                    className="h-7 w-7 text-slate-400 hover:text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Completed Tickets */}
        {completedTickets.length > 0 && (
          <div className="space-y-2 pt-4 border-t">
            <h4 className="text-xs font-semibold text-slate-500 uppercase">Completed</h4>
            {completedTickets.map((ticket) => (
              <div key={ticket.id} className="border rounded-lg p-2 bg-slate-50 opacity-60">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span className="text-sm line-through">{ticket.item_name}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(ticket.id)}
                    className="h-6 w-6 text-slate-400 hover:text-red-600"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}