import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { ChecklistItem, Loan } from "@/entities/all";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Building2,
  Calendar,
  CheckCircle2,
  Clock3,
  Download,
  FileText,
  Loader2,
  MessageSquare,
  Search,
  Upload,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useToast } from "@/components/ui/use-toast";
import { usePermissions } from "@/components/hooks/usePermissions";
import { isUserOnLoanTeam } from "@/components/utils/teamAccess";

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
  review_completed: "bg-cyan-100 text-cyan-800",
  approved: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-100 text-red-800",
  approved_with_condition: "bg-purple-100 text-purple-800",
  letter_of_explanation_requested: "bg-orange-100 text-orange-800",
};

const REVIEW_STATUSES = [
  "under_review",
  "review_completed",
  "approved_with_condition",
  "letter_of_explanation_requested",
];

const PREVIEWABLE_IMAGE_TYPES = /\.(jpg|jpeg|png|gif|webp|bmp|svg)($|\?)/i;

const formatStatus = (status) =>
  status?.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) || "Unknown";

const getTaskAction = (task) => (REVIEW_STATUSES.includes(task.status) ? "review" : "submit");

const getTaskInstruction = (task) => task.instruction || task.instructions || task.description || "";

const getTaskTemplateName = (task) => task.template_name || (task.template_url ? "Download template" : null);

const getTaskRequestedDate = (task) => task.requested_date || task.created_date || null;

const getTaskDeadline = (task) => task.deadline || task.due_date || null;

const getTaskComments = (task) => (Array.isArray(task.notes) ? task.notes : []);

const getTaskFiles = (task) => (Array.isArray(task.uploaded_files) ? task.uploaded_files : []);

const getLastUpdateInfo = (task) => {
  const dates = [];

  if (task.updated_date) {
    dates.push(new Date(task.updated_date));
  }

  if (task.notes?.length) {
    const lastNote = task.notes[task.notes.length - 1];
    if (lastNote.timestamp) {
      dates.push(new Date(lastNote.timestamp));
    }
  }

  if (task.uploaded_files?.length) {
    const lastFile = task.uploaded_files[task.uploaded_files.length - 1];
    if (lastFile.uploaded_date) {
      dates.push(new Date(lastFile.uploaded_date));
    }
  }

  if (!dates.length) return "No updates";

  const mostRecent = new Date(Math.max(...dates));
  return formatDistanceToNow(mostRecent, { addSuffix: true });
};

const formatDateLabel = (value) => {
  if (!value) return "N/A";

  try {
    return format(new Date(value), "MMM d, yyyy");
  } catch (error) {
    return "N/A";
  }
};

const getFilePreviewType = (fileUrl = "") => {
  if (!fileUrl) return "none";
  if (fileUrl.toLowerCase().includes(".pdf")) return "pdf";
  if (PREVIEWABLE_IMAGE_TYPES.test(fileUrl)) return "image";
  return "download";
};

const buildTaskNote = (currentUser, text, prefix = "") => ({
  id: Date.now().toString(),
  text: `${prefix}${text}`.trim(),
  author: currentUser?.id,
  author_name:
    `${currentUser?.first_name || ""} ${currentUser?.last_name || ""}`.trim() ||
    currentUser?.full_name ||
    currentUser?.email ||
    "Current User",
  timestamp: new Date().toISOString(),
});

export default function MyTasks() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { currentUser, permissions, isLoading: permissionsLoading } = usePermissions();

  const [tasks, setTasks] = useState([]);
  const [loans, setLoans] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);

  const [selectedTask, setSelectedTask] = useState(null);
  const [selectedTaskMode, setSelectedTaskMode] = useState(null);
  const [showMessageModal, setShowMessageModal] = useState(false);

  const [submitComment, setSubmitComment] = useState("");
  const [submitFiles, setSubmitFiles] = useState([]);
  const [isSubmittingTask, setIsSubmittingTask] = useState(false);

  const [reviewFileIndex, setReviewFileIndex] = useState(0);
  const [appealMode, setAppealMode] = useState(false);
  const [appealExplanation, setAppealExplanation] = useState("");
  const [appealFiles, setAppealFiles] = useState([]);
  const [isReviewSaving, setIsReviewSaving] = useState(false);

  useEffect(() => {
    if (!permissionsLoading && currentUser) {
      loadData();
    }
  }, [permissionsLoading, currentUser]);

  const filteredTasks = useMemo(() => {
    let filtered = [...tasks];

    if (searchTerm) {
      filtered = filtered.filter((task) => {
        const loanNumber = loans[task.loan_id]?.loan_number || "";
        return (
          task.item_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          loanNumber.toLowerCase().includes(searchTerm.toLowerCase())
        );
      });
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter((task) => task.status === statusFilter);
    }

    return filtered;
  }, [tasks, loans, searchTerm, statusFilter]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const borrowerAccessIds = permissions.borrowerAccessIds || [currentUser.id];
      const allLoans = await Loan.list("-created_date");

      const userLoans = (allLoans || []).filter((loan) => {
        const isLoanOfficer = loan.loan_officer_ids?.includes(currentUser.id);
        const isBorrower = loan.borrower_ids?.some((id) => borrowerAccessIds.includes(id));
        const isLoanPartner = permissions.isLoanPartner && isUserOnLoanTeam(loan, currentUser, permissions);
        return isLoanOfficer || isBorrower || isLoanPartner;
      });

      const loanData = {};
      userLoans.forEach((loan) => {
        loanData[loan.id] = loan;
      });
      setLoans(loanData);

      const userLoanIds = userLoans.map((loan) => loan.id);
      if (!userLoanIds.length) {
        setTasks([]);
        setIsLoading(false);
        return;
      }

      const taskResults = await Promise.all(userLoanIds.map((loanId) => ChecklistItem.filter({ loan_id: loanId })));
      const allTasks = taskResults.flat();

      const excludedStatuses = ["completed", "approved", "rejected"];
      const myTasks = allTasks.filter((task) => {
        if (!task.assigned_to) return false;
        if (excludedStatuses.includes(task.status)) return false;
        const assignedTo = Array.isArray(task.assigned_to) ? task.assigned_to : [task.assigned_to];
        return assignedTo.includes(currentUser.id);
      });

      myTasks.sort((a, b) => {
        const deadlineA = getTaskDeadline(a);
        const deadlineB = getTaskDeadline(b);
        if (!deadlineA) return 1;
        if (!deadlineB) return -1;
        return new Date(deadlineA) - new Date(deadlineB);
      });

      setTasks(myTasks);
    } catch (error) {
      console.error("[MyTasks] Error loading tasks:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load tasks. Please try again.",
      });
    }
    setIsLoading(false);
  };

  const openTask = (task) => {
    setSelectedTask(task);
    setSelectedTaskMode(getTaskAction(task));
    setSubmitComment("");
    setSubmitFiles([]);
    setReviewFileIndex(0);
    setAppealMode(false);
    setAppealExplanation("");
    setAppealFiles([]);
  };

  const closeTaskModal = () => {
    setSelectedTask(null);
    setSelectedTaskMode(null);
    setSubmitComment("");
    setSubmitFiles([]);
    setReviewFileIndex(0);
    setAppealMode(false);
    setAppealExplanation("");
    setAppealFiles([]);
  };

  const handleSendMessage = (task) => {
    setSelectedTask(task);
    setShowMessageModal(true);
  };

  const updateTaskInState = (taskId, updates) => {
    setTasks((currentTasks) =>
      currentTasks.map((task) => (task.id === taskId ? { ...task, ...updates } : task))
    );
    setSelectedTask((currentTask) =>
      currentTask?.id === taskId ? { ...currentTask, ...updates } : currentTask
    );
  };

  const uploadFiles = async (files) => {
    const uploadedFiles = [];

    for (const file of files) {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      uploadedFiles.push({
        file_url,
        file_name: file.name,
        uploaded_by: currentUser.id,
        uploaded_date: new Date().toISOString(),
      });
    }

    return uploadedFiles;
  };

  const handleSubmitTask = async () => {
    if (!selectedTask) return;

    const existingFiles = getTaskFiles(selectedTask);
    if (!existingFiles.length && !submitFiles.length) {
      toast({
        variant: "destructive",
        title: "Documents required",
        description: "Attach at least one document before submitting this item.",
      });
      return;
    }

    setIsSubmittingTask(true);
    try {
      const uploadedFiles = submitFiles.length ? await uploadFiles(submitFiles) : [];
      const nextFiles = [...existingFiles, ...uploadedFiles];
      const nextNotes = [...getTaskComments(selectedTask)];

      if (submitComment.trim()) {
        nextNotes.push(buildTaskNote(currentUser, submitComment));
      }

      const updates = {
        uploaded_files: nextFiles,
        notes: nextNotes,
        status: "submitted",
      };

      await ChecklistItem.update(selectedTask.id, updates);
      updateTaskInState(selectedTask.id, updates);

      toast({
        title: "Task submitted",
        description: `"${selectedTask.item_name}" is ready for review.`,
      });

      closeTaskModal();
    } catch (error) {
      console.error("[MyTasks] Error submitting task:", error);
      toast({
        variant: "destructive",
        title: "Submit failed",
        description: "Unable to submit this task right now.",
      });
    }
    setIsSubmittingTask(false);
  };

  const handleConfirmReview = async () => {
    if (!selectedTask) return;

    setIsReviewSaving(true);
    try {
      await ChecklistItem.update(selectedTask.id, { status: "approved" });
      setTasks((currentTasks) => currentTasks.filter((task) => task.id !== selectedTask.id));

      toast({
        title: "Review confirmed",
        description: `"${selectedTask.item_name}" has been confirmed.`,
      });

      closeTaskModal();
    } catch (error) {
      console.error("[MyTasks] Error confirming review:", error);
      toast({
        variant: "destructive",
        title: "Confirm failed",
        description: "Unable to confirm this review right now.",
      });
    }
    setIsReviewSaving(false);
  };

  const handleAppealSubmit = async () => {
    if (!selectedTask) return;
    if (!appealExplanation.trim()) {
      toast({
        variant: "destructive",
        title: "Explanation required",
        description: "Add an explanation before submitting your appeal.",
      });
      return;
    }

    setIsReviewSaving(true);
    try {
      const uploadedFiles = appealFiles.length ? await uploadFiles(appealFiles) : [];
      const nextFiles = [...getTaskFiles(selectedTask), ...uploadedFiles];
      const nextNotes = [
        ...getTaskComments(selectedTask),
        buildTaskNote(currentUser, appealExplanation, "Appeal: "),
      ];

      const updates = {
        uploaded_files: nextFiles,
        notes: nextNotes,
        status: "under_review",
      };

      await ChecklistItem.update(selectedTask.id, updates);
      updateTaskInState(selectedTask.id, updates);

      toast({
        title: "Appeal submitted",
        description: "Your supporting documents and explanation were added.",
      });

      closeTaskModal();
    } catch (error) {
      console.error("[MyTasks] Error submitting appeal:", error);
      toast({
        variant: "destructive",
        title: "Appeal failed",
        description: "Unable to submit your appeal right now.",
      });
    }
    setIsReviewSaving(false);
  };

  const renderNotes = (task) => {
    const notes = getTaskComments(task);

    if (!notes.length) {
      return <p className="text-sm text-slate-500">No admin or loan officer comments yet.</p>;
    }

    return (
      <div className="space-y-3">
        {notes.map((note) => (
          <div key={note.id || note.timestamp} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <div className="mb-1 flex items-center justify-between gap-3">
              <p className="text-sm text-slate-900">{note.author_name || "Team member"}</p>
              <p className="text-xs text-slate-500">{formatDateLabel(note.timestamp)}</p>
            </div>
            <p className="text-sm leading-6 text-slate-700">{note.text}</p>
          </div>
        ))}
      </div>
    );
  };

  const renderFilePreview = (file) => {
    if (!file?.file_url) {
      return (
        <div className="flex h-full min-h-[420px] items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-slate-500">
          No preview available for this item.
        </div>
      );
    }

    const previewType = getFilePreviewType(file.file_url);

    if (previewType === "image") {
      return (
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white p-4">
          <img src={file.file_url} alt={file.file_name} className="max-h-[65vh] w-full rounded-2xl object-contain" />
        </div>
      );
    }

    if (previewType === "pdf") {
      return (
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
          <iframe
            src={`https://docs.google.com/gview?url=${encodeURIComponent(file.file_url)}&embedded=true`}
            className="h-[65vh] w-full border-0"
            title={file.file_name || "Document preview"}
          />
        </div>
      );
    }

    return (
      <div className="flex min-h-[420px] flex-col items-center justify-center rounded-3xl border border-slate-200 bg-white p-8 text-center">
        <FileText className="mb-4 h-12 w-12 text-slate-400" />
        <p className="mb-4 text-slate-700">Preview not available for this file type.</p>
        <Button variant="outline" onClick={() => window.open(file.file_url, "_blank")}>
          <Download className="mr-2 h-4 w-4" />
          Download document
        </Button>
      </div>
    );
  };

  if (permissionsLoading || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-slate-900" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.12),_transparent_26%),linear-gradient(180deg,_#f8fafc_0%,_#eef2ff_100%)] p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 rounded-[28px] border border-white/70 bg-white/80 p-6 shadow-sm backdrop-blur">
          <Button variant="ghost" onClick={() => navigate(createPageUrl("Dashboard"))} className="mb-4 -ml-2">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="mb-2 text-3xl text-slate-900">My Tasks</h1>
              <p className="max-w-2xl text-slate-600">
                Every assigned submit or review item stays visible here. Open any task cell to complete the required workflow.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge className="border-0 bg-sky-100 px-3 py-1 text-sky-800">Submit workflow</Badge>
              <Badge className="border-0 bg-amber-100 px-3 py-1 text-amber-800">Review workflow</Badge>
            </div>
          </div>
        </div>

        <Card className="mb-6 border-white/70 bg-white/85 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-4">
              <div className="min-w-[220px] flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    placeholder="Search tasks or loan numbers..."
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    className="h-11 rounded-xl border-slate-200 pl-10"
                  />
                </div>
              </div>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-11 w-[220px] rounded-xl border-slate-200">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="not_started">Not Started</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="submitted">Submitted</SelectItem>
                  <SelectItem value="under_review">Under Review</SelectItem>
                  <SelectItem value="review_completed">Review Completed</SelectItem>
                  <SelectItem value="approved_with_condition">Approved With Condition</SelectItem>
                  <SelectItem value="letter_of_explanation_requested">Explanation Requested</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/70 bg-white/85 shadow-sm">
          <CardHeader>
            <CardTitle>{filteredTasks.length} {filteredTasks.length === 1 ? "Task" : "Tasks"}</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredTasks.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 py-16 text-center text-slate-500">
                No tasks found.
              </div>
            ) : (
              <div className="space-y-4">
                {filteredTasks.map((task) => {
                  const action = getTaskAction(task);
                  const loan = loans[task.loan_id];

                  return (
                    <div
                      key={task.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => openTask(task)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          openTask(task);
                        }
                      }}
                      className="w-full rounded-[28px] border border-slate-200 bg-white p-5 text-left transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="mb-3 flex flex-wrap items-center gap-2">
                            <Badge className={action === "review" ? "border-0 bg-amber-100 text-amber-800" : "border-0 bg-sky-100 text-sky-800"}>
                              {action === "review" ? "Review" : "Submit"}
                            </Badge>
                            <Badge className={STATUS_COLORS[task.status] || STATUS_COLORS.pending}>
                              {formatStatus(task.status)}
                            </Badge>
                          </div>

                          <h3 className="mb-2 text-lg text-slate-900">{task.item_name}</h3>
                          <p className="line-clamp-2 text-sm leading-6 text-slate-600">
                            {getTaskInstruction(task) || "Open this task to view the request details and complete the next step."}
                          </p>

                          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-600">
                            {loan && (
                              <div className="flex items-center gap-1.5">
                                <Building2 className="h-4 w-4" />
                                <span>{loan.loan_number || loan.primary_loan_id || "Loan"}</span>
                              </div>
                            )}

                            <div className="flex items-center gap-1.5">
                              <Calendar className="h-4 w-4" />
                              <span>Deadline: {formatDateLabel(getTaskDeadline(task))}</span>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <Clock3 className="h-4 w-4" />
                              <span>Updated {getLastUpdateInfo(task)}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col items-stretch gap-2 lg:min-w-[180px]">
                          <Button type="button" className="rounded-xl bg-slate-900 hover:bg-slate-800">
                            {action === "review" ? "Open Review" : "Open Submit"}
                          </Button>

                          {permissions.canCreateDirectMessage && (
                            <Button
                              type="button"
                              variant="outline"
                              className="rounded-xl"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleSendMessage(task);
                              }}
                            >
                              <MessageSquare className="mr-2 h-4 w-4" />
                              Send Message
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={selectedTaskMode === "submit" && !!selectedTask} onOpenChange={(open) => !open && closeTaskModal()}>
        <DialogContent className="max-w-3xl rounded-[32px] border-white/70 p-0">
          {selectedTask && (
            <div className="max-h-[88vh] overflow-y-auto">
              <DialogHeader className="border-b border-slate-200 px-6 py-5">
                <DialogTitle className="text-2xl text-slate-900">{selectedTask.item_name}</DialogTitle>
                <DialogDescription>
                  Upload documents, leave comments if needed, and submit this item for review.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6 px-6 py-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                    <p className="mb-1 text-xs uppercase tracking-[0.18em] text-slate-500">Requested Date</p>
                    <p className="text-sm text-slate-900">{formatDateLabel(getTaskRequestedDate(selectedTask))}</p>
                  </div>
                  <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                    <p className="mb-1 text-xs uppercase tracking-[0.18em] text-slate-500">Deadline</p>
                    <p className="text-sm text-slate-900">{formatDateLabel(getTaskDeadline(selectedTask))}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-700">Instruction</Label>
                  <div className="rounded-3xl border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-700">
                    {getTaskInstruction(selectedTask) || "No additional instruction was provided for this item."}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-700">Template</Label>
                  {selectedTask.template_url ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-xl"
                      onClick={() => window.open(selectedTask.template_url, "_blank")}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      {getTaskTemplateName(selectedTask)}
                    </Button>
                  ) : (
                    <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
                      No template attached.
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-700">Comments From Admin / LO</Label>
                  {renderNotes(selectedTask)}
                </div>

                <Separator />

                <div className="space-y-3">
                  <Label htmlFor="submit-files" className="text-slate-700">Attach Documents</Label>
                  <input
                    id="submit-files"
                    type="file"
                    multiple
                    onChange={(event) => setSubmitFiles(Array.from(event.target.files || []))}
                    className="block w-full rounded-2xl border border-slate-200 bg-white p-3 text-sm"
                  />
                  <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                    <p className="mb-3 text-sm text-slate-700">Existing files</p>
                    {getTaskFiles(selectedTask).length ? (
                      <div className="space-y-2">
                        {getTaskFiles(selectedTask).map((file, index) => (
                          <div key={`${file.file_url}-${index}`} className="flex items-center justify-between rounded-2xl bg-white px-3 py-2 text-sm">
                            <span className="truncate pr-3 text-slate-700">{file.file_name}</span>
                            <Button variant="ghost" size="sm" onClick={() => window.open(file.file_url, "_blank")}>
                              <Download className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500">No files uploaded yet.</p>
                    )}
                  </div>
                  {submitFiles.length > 0 && (
                    <div className="rounded-3xl border border-sky-200 bg-sky-50 p-4">
                      <p className="mb-2 text-sm text-sky-900">Ready to upload</p>
                      <div className="space-y-2">
                        {submitFiles.map((file) => (
                          <div key={`${file.name}-${file.size}`} className="flex items-center gap-2 text-sm text-sky-800">
                            <Upload className="h-4 w-4" />
                            <span>{file.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="submit-comment" className="text-slate-700">Comments</Label>
                  <Textarea
                    id="submit-comment"
                    value={submitComment}
                    onChange={(event) => setSubmitComment(event.target.value)}
                    rows={4}
                    placeholder="Add context for the reviewer if needed..."
                    className="rounded-2xl"
                  />
                </div>

                <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
                  <Button variant="outline" className="rounded-xl" onClick={closeTaskModal}>
                    Cancel
                  </Button>
                  <Button className="rounded-xl bg-slate-900 hover:bg-slate-800" onClick={handleSubmitTask} disabled={isSubmittingTask}>
                    {isSubmittingTask ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Submitting
                      </>
                    ) : (
                      "Submit"
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={selectedTaskMode === "review" && !!selectedTask} onOpenChange={(open) => !open && closeTaskModal()}>
        <DialogContent className="max-w-6xl rounded-[32px] border-white/70 p-0">
          {selectedTask && (
            <div className="max-h-[90vh] overflow-y-auto">
              <DialogHeader className="border-b border-slate-200 px-6 py-5">
                <DialogTitle className="text-2xl text-slate-900">{selectedTask.item_name}</DialogTitle>
                <DialogDescription>
                  Review the document, confirm it, or file an appeal with supporting information.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-0 lg:grid-cols-[1.4fr_0.8fr]">
                <div className="border-b border-slate-200 bg-slate-50 p-6 lg:border-b-0 lg:border-r">
                  {getTaskFiles(selectedTask).length > 0 ? (
                    <>
                      {renderFilePreview(getTaskFiles(selectedTask)[reviewFileIndex] || getTaskFiles(selectedTask)[0])}
                      {getTaskFiles(selectedTask).length > 1 && (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {getTaskFiles(selectedTask).map((file, index) => (
                            <Button
                              key={`${file.file_url}-${index}`}
                              type="button"
                              variant={index === reviewFileIndex ? "default" : "outline"}
                              className={index === reviewFileIndex ? "rounded-xl bg-slate-900 hover:bg-slate-800" : "rounded-xl"}
                              onClick={() => setReviewFileIndex(index)}
                            >
                              {file.file_name || `Document ${index + 1}`}
                            </Button>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex min-h-[420px] flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center">
                      <FileText className="mb-4 h-12 w-12 text-slate-400" />
                      <p className="text-slate-700">No uploaded document is available for preview yet.</p>
                    </div>
                  )}
                </div>

                <div className="space-y-6 p-6">
                  <div className="rounded-3xl border border-slate-200 bg-white p-4">
                    <p className="mb-3 text-xs uppercase tracking-[0.18em] text-slate-500">Task Details</p>
                    <div className="space-y-3 text-sm text-slate-700">
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-slate-500">Requested</span>
                        <span className="text-right text-slate-900">{formatDateLabel(getTaskRequestedDate(selectedTask))}</span>
                      </div>
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-slate-500">Deadline</span>
                        <span className="text-right text-slate-900">{formatDateLabel(getTaskDeadline(selectedTask))}</span>
                      </div>
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-slate-500">Status</span>
                        <Badge className={STATUS_COLORS[selectedTask.status] || STATUS_COLORS.pending}>
                          {formatStatus(selectedTask.status)}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-slate-700">Instruction</Label>
                    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                      {getTaskInstruction(selectedTask) || "No additional instruction was provided for this review item."}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-slate-700">Comments From Admin / LO</Label>
                    {renderNotes(selectedTask)}
                  </div>

                  <div className="flex flex-col gap-3">
                    <Button className="rounded-xl bg-emerald-600 hover:bg-emerald-700" onClick={handleConfirmReview} disabled={isReviewSaving}>
                      {isReviewSaving && !appealMode ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Confirming
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          Confirm
                        </>
                      )}
                    </Button>
                    <Button variant="outline" className="rounded-xl" onClick={() => setAppealMode((current) => !current)}>
                      {appealMode ? "Hide Appeal Form" : "Appeal"}
                    </Button>
                  </div>

                  {appealMode && (
                    <div className="rounded-[28px] border border-amber-200 bg-amber-50 p-4">
                      <p className="mb-4 text-sm text-amber-900">
                        Add supporting files and explain what should be reconsidered.
                      </p>

                      <div className="space-y-4">
                        {selectedTask.template_url && (
                          <Button
                            type="button"
                            variant="outline"
                            className="rounded-xl bg-white"
                            onClick={() => window.open(selectedTask.template_url, "_blank")}
                          >
                            <Download className="mr-2 h-4 w-4" />
                            {getTaskTemplateName(selectedTask)}
                          </Button>
                        )}

                        <div className="space-y-2">
                          <Label htmlFor="appeal-files">Supporting Files</Label>
                          <input
                            id="appeal-files"
                            type="file"
                            multiple
                            onChange={(event) => setAppealFiles(Array.from(event.target.files || []))}
                            className="block w-full rounded-2xl border border-amber-200 bg-white p-3 text-sm"
                          />
                          {appealFiles.length > 0 && (
                            <div className="space-y-2 rounded-2xl bg-white p-3">
                              {appealFiles.map((file) => (
                                <div key={`${file.name}-${file.size}`} className="text-sm text-slate-700">
                                  {file.name}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="appeal-explanation">Explanation</Label>
                          <Textarea
                            id="appeal-explanation"
                            value={appealExplanation}
                            onChange={(event) => setAppealExplanation(event.target.value)}
                            rows={5}
                            placeholder="Describe the issue, correction, or supporting context..."
                            className="rounded-2xl bg-white"
                          />
                        </div>

                        <Button className="w-full rounded-xl bg-slate-900 hover:bg-slate-800" onClick={handleAppealSubmit} disabled={isReviewSaving}>
                          {isReviewSaving ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Submitting Appeal
                            </>
                          ) : (
                            "Submit"
                          )}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

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
