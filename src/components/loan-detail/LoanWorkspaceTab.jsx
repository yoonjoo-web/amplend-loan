import React, { useEffect, useMemo, useState } from "react";
import { ChecklistItem } from "@/entities/all";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ArrowRight,
  CheckSquare,
  ClipboardCheck,
  FilePlus2,
  Files,
  Layers3,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { getLoanDetailTabUrl } from "./loanDetailSubpages";

const REVIEW_STATUS_STYLES = {
  pending: "bg-slate-100 text-slate-800",
  submitted: "bg-blue-100 text-blue-800",
  under_review: "bg-amber-100 text-amber-800",
  review_completed: "bg-cyan-100 text-cyan-800",
  approved: "bg-emerald-100 text-emerald-800",
  approved_with_condition: "bg-purple-100 text-purple-800",
  rejected: "bg-red-100 text-red-800",
  in_progress: "bg-sky-100 text-sky-800",
  draft: "bg-slate-100 text-slate-800",
};

const REVIEW_QUEUE_STATUSES = new Set([
  "pending",
  "submitted",
  "under_review",
  "review_completed",
  "approved_with_condition",
  "in_progress",
]);

const formatStatus = (status) =>
  status ? status.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) : "Unknown";

const formatRelativeDate = (value) => {
  if (!value) return "Pending";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Pending";
  return formatDistanceToNow(date, { addSuffix: true });
};

export default function LoanWorkspaceTab({ loan, navigate }) {
  const [checklistItems, setChecklistItems] = useState([]);

  useEffect(() => {
    let isMounted = true;

    const loadChecklistItems = async () => {
      try {
        const items = await ChecklistItem.filter({ loan_id: loan.id });
        if (isMounted) {
          setChecklistItems(Array.isArray(items) ? items : []);
        }
      } catch (error) {
        console.error("Error loading workspace checklist items:", error);
        if (isMounted) {
          setChecklistItems([]);
        }
      }
    };

    if (loan?.id) {
      loadChecklistItems();
    }

    return () => {
      isMounted = false;
    };
  }, [loan?.id]);

  const reviewRows = useMemo(() => {
    const checklistRows = checklistItems
      .filter((item) => REVIEW_QUEUE_STATUSES.has(item.status))
      .map((item) => ({
        id: `checklist-${item.id}`,
        item: item.item_name || item.title || "Checklist item",
        type: item.checklist_type === "action_item" ? "Task" : "Review",
        owner: item.assigned_to_name || item.assigned_to_label || item.category || "Loan team",
        status: item.status || "pending",
        updatedAt: item.updated_date || item.due_date || item.created_date,
        onOpen: () =>
          navigate(getLoanDetailTabUrl(loan.id, "tasks", { openTask: item.id })),
      }));

    const drawRequestRows = (loan.draw_requests || [])
      .filter((request) => !["funded", "archived"].includes(request.status))
      .map((request) => ({
        id: `draw-${request.id}`,
        item: request.item_name || "Draw request",
        type: "Draw",
        owner: request.requested_by_name || "Borrower",
        status: request.status || "submitted",
        updatedAt: request.updated_date || request.created_date || request.requested_date,
        onOpen: () => navigate(getLoanDetailTabUrl(loan.id, "draws")),
      }));

    const documentRows = (loan.uploaded_documents || [])
      .slice(-4)
      .map((document, index) => ({
        id: `document-${document.id || index}`,
        item: document.document_name || document.title || "Uploaded document",
        type: "Document",
        owner: document.uploaded_by_name || document.category || "Loan file",
        status: "submitted",
        updatedAt: document.uploaded_date || document.created_date,
        onOpen: () => navigate(getLoanDetailTabUrl(loan.id, "documents")),
      }));

    return [...checklistRows, ...drawRequestRows, ...documentRows]
      .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))
      .slice(0, 8);
  }, [checklistItems, loan.draw_requests, loan.id, loan.uploaded_documents, navigate]);

  const createActions = [
    {
      key: "task",
      title: "Create Task",
      description: "Open team tasks and add the next execution item for this loan.",
      icon: ClipboardCheck,
      accent: "from-slate-900 via-slate-800 to-slate-700",
      onClick: () => navigate(getLoanDetailTabUrl(loan.id, "tasks")),
    },
    {
      key: "upload",
      title: "Upload Document",
      description: "Go to documents and add new files into the loan record.",
      icon: FilePlus2,
      accent: "from-sky-700 via-cyan-600 to-sky-400",
      onClick: () => navigate(getLoanDetailTabUrl(loan.id, "documents")),
    },
    {
      key: "request",
      title: "Request Document",
      description: "Jump into documents and send a targeted request to the borrower or team.",
      icon: Files,
      accent: "from-emerald-700 via-emerald-600 to-teal-500",
      onClick: () => navigate(getLoanDetailTabUrl(loan.id, "documents")),
    },
    {
      key: "checklist",
      title: "Create Checklist Step",
      description: "Move into the checklist flow to add or manage review requirements.",
      icon: CheckSquare,
      accent: "from-amber-600 via-orange-500 to-amber-400",
      onClick: () => navigate(getLoanDetailTabUrl(loan.id, "checklist")),
    },
    {
      key: "draw",
      title: "Create Draw Request",
      description: "Open draw tracking and start a new request or draft draw.",
      icon: TrendingUp,
      accent: "from-violet-700 via-fuchsia-600 to-rose-500",
      onClick: () => navigate(getLoanDetailTabUrl(loan.id, "draws")),
    },
  ];

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="grid grid-cols-1 gap-6 xl:grid-cols-[1.55fr_0.95fr]"
      >
        <Card className="overflow-hidden border-slate-200 bg-white shadow-xl shadow-slate-200/70">
          <CardHeader className="border-b border-slate-100 bg-[linear-gradient(135deg,#f8fafc,white_45%,#eef2ff)]">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs text-slate-600">
                  <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                  Review Space
                </div>
                <CardTitle className="text-2xl text-slate-900">Loan review queue</CardTitle>
                <p className="text-sm text-slate-600">
                  Current reviews, submissions, and draw activity gathered into one table.
                </p>
              </div>
              <Badge className="bg-slate-900 text-white hover:bg-slate-900">
                {reviewRows.length} items
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {reviewRows.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-100 bg-slate-50/80">
                      <TableHead className="pl-6">Item</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Owner</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Updated</TableHead>
                      <TableHead className="pr-6 text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reviewRows.map((row) => (
                      <TableRow key={row.id} className="border-slate-100">
                        <TableCell className="pl-6 font-medium text-slate-900">{row.item}</TableCell>
                        <TableCell className="text-slate-600">{row.type}</TableCell>
                        <TableCell className="text-slate-500">{row.owner}</TableCell>
                        <TableCell>
                          <Badge className={REVIEW_STATUS_STYLES[row.status] || REVIEW_STATUS_STYLES.pending}>
                            {formatStatus(row.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-slate-500">{formatRelativeDate(row.updatedAt)}</TableCell>
                        <TableCell className="pr-6 text-right">
                          <Button variant="ghost" size="sm" onClick={row.onOpen}>
                            Open
                            <ArrowRight className="ml-2 h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="flex min-h-[320px] flex-col items-center justify-center px-6 py-12 text-center">
                <Layers3 className="mb-4 h-12 w-12 text-slate-300" />
                <p className="text-base font-medium text-slate-900">No active review items</p>
                <p className="mt-2 max-w-md text-sm text-slate-500">
                  As checklist reviews, document submissions, or draw requests start coming in, they will appear here.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-0 bg-[linear-gradient(160deg,#0f172a,#1e293b_42%,#334155)] text-white shadow-2xl shadow-slate-300/50">
          <CardHeader className="border-b border-white/10">
            <div className="space-y-1">
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs text-slate-100">
                <FilePlus2 className="h-3.5 w-3.5" />
                Create Space
              </div>
              <CardTitle className="text-2xl text-white">Start new work</CardTitle>
              <p className="text-sm text-slate-300">
                Five actions tuned for the most common things created from a loan workspace.
              </p>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 p-4">
            {createActions.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.key}
                  type="button"
                  onClick={action.onClick}
                  className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-4 text-left transition duration-200 hover:border-white/25 hover:bg-white/10"
                >
                  <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${action.accent}`} />
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="font-medium text-white">{action.title}</p>
                      <p className="text-sm leading-5 text-slate-300">{action.description}</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/10 p-2">
                      <Icon className="h-4 w-4 text-white" />
                    </div>
                  </div>
                </button>
              );
            })}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
