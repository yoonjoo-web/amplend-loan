import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { ChecklistItem } from "@/entities/all";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowUpDown,
  Calendar,
  CheckCircle2,
  Download,
  FileText,
  Loader2,
  Search,
  Upload,
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/components/ui/use-toast";

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
  first_review_done: "bg-purple-100 text-purple-800",
  second_review_done: "bg-indigo-100 text-indigo-800",
};

const REVIEW_STATUSES = [
  "under_review",
  "review_completed",
  "approved_with_condition",
  "letter_of_explanation_requested",
  "first_review_done",
  "second_review_done",
];

const PREVIEWABLE_IMAGE_TYPES = /\.(jpg|jpeg|png|gif|webp|bmp|svg)($|\?)/i;

const formatStatus = (status) =>
  status?.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) || "Unknown";

const formatDateLabel = (value) => {
  if (!value) return "N/A";

  try {
    return format(new Date(value), "MMM d, yyyy");
  } catch (error) {
    return "N/A";
  }
};

const getTaskAction = (task) => (REVIEW_STATUSES.includes(task.status) ? "review" : "submit");
const getTaskInstruction = (task) => task.instruction || task.instructions || task.description || "";
const getTaskComments = (task) => (Array.isArray(task.notes) ? task.notes : []);
const getTaskFiles = (task) => (Array.isArray(task.uploaded_files) ? task.uploaded_files : []);
const getTaskRequestedDate = (task) => task.requested_date || task.created_date || null;
const getTaskDeadline = (task) => task.deadline || task.due_date || null;
const getTaskTemplateName = (task) => task.template_name || (task.template_url ? "Download template" : null);

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

const TAB_GUIDANCE = {
  submit: {
    className: "border-sky-200 bg-sky-50 text-sky-900",
    text: "Upload documents, leave comments if needed, and submit this item for review.",
  },
  review: {
    className: "border-amber-200 bg-amber-50 text-amber-900",
    text: "Review the document, confirm it, or file an appeal with supporting information.",
  },
};

const DEMO_REVIEW_PREVIEW =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1600" viewBox="0 0 1200 1600">
      <rect width="1200" height="1600" fill="#f8fafc" />
      <rect x="120" y="96" width="960" height="1408" rx="28" fill="#ffffff" stroke="#cbd5e1" stroke-width="8" />
      <rect x="180" y="170" width="320" height="34" rx="10" fill="#0f172a" opacity="0.92" />
      <rect x="180" y="240" width="840" height="18" rx="9" fill="#cbd5e1" />
      <rect x="180" y="280" width="760" height="18" rx="9" fill="#cbd5e1" />
      <rect x="180" y="320" width="680" height="18" rx="9" fill="#cbd5e1" />
      <rect x="180" y="400" width="220" height="220" rx="18" fill="#e0f2fe" />
      <rect x="430" y="420" width="420" height="18" rx="9" fill="#94a3b8" />
      <rect x="430" y="466" width="500" height="18" rx="9" fill="#cbd5e1" />
      <rect x="430" y="512" width="460" height="18" rx="9" fill="#cbd5e1" />
      <rect x="180" y="700" width="840" height="18" rx="9" fill="#cbd5e1" />
      <rect x="180" y="740" width="790" height="18" rx="9" fill="#cbd5e1" />
      <rect x="180" y="780" width="700" height="18" rx="9" fill="#cbd5e1" />
      <rect x="180" y="900" width="380" height="220" rx="18" fill="#fee2e2" />
      <rect x="590" y="900" width="430" height="220" rx="18" fill="#fef3c7" />
      <rect x="180" y="1190" width="840" height="18" rx="9" fill="#cbd5e1" />
      <rect x="180" y="1230" width="620" height="18" rx="9" fill="#cbd5e1" />
      <rect x="180" y="1320" width="220" height="52" rx="14" fill="#0f172a" />
    </svg>
  `);

const createDemoTasks = (currentUser) => {
  const now = new Date();
  const actorName =
    `${currentUser?.first_name || ""} ${currentUser?.last_name || ""}`.trim() ||
    currentUser?.full_name ||
    "Current User";

  return [
    {
      id: "demo-submit-income-docs",
      loan_id: "demo-loan",
      assigned_to: [currentUser?.id].filter(Boolean),
      item_name: "Updated bank statements",
      category: "Borrower Documents",
      checklist_type: "document",
      status: "pending",
      description: "Please provide the most recent two months of statements for all operating accounts.",
      instruction:
        "Upload one or multiple statements. Include all pages. Add a short note if balances changed materially since the initial submission.",
      template_url: "",
      template_name: "",
      requested_date: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      due_date: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      uploaded_files: [],
      notes: [
        {
          id: "demo-note-1",
          author: "admin-demo",
          author_name: "Loan Officer",
          text: "Please make sure the ending balance and account holder name are visible.",
          timestamp: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        },
      ],
      updated_date: new Date(now.getTime() - 18 * 60 * 60 * 1000).toISOString(),
      is_demo: true,
      demo_label: "Sample Submit Task",
    },
    {
      id: "demo-review-insurance-cert",
      loan_id: "demo-loan",
      assigned_to: [currentUser?.id].filter(Boolean),
      item_name: "Insurance certificate review",
      category: "Review Queue",
      checklist_type: "document",
      status: "under_review",
      description: "Review the uploaded certificate and either confirm or file an appeal.",
      instruction:
        "Confirm if coverage is accurate. If something is missing, appeal with supporting files and a written explanation.",
      template_url: "",
      template_name: "",
      requested_date: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString(),
      due_date: new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000).toISOString(),
      uploaded_files: [
        {
          file_name: "insurance-certificate-sample.png",
          file_url: DEMO_REVIEW_PREVIEW,
          uploaded_by: currentUser?.id || "demo-user",
          uploaded_by_name: actorName,
          uploaded_date: new Date(now.getTime() - 36 * 60 * 60 * 1000).toISOString(),
        },
      ],
      notes: [
        {
          id: "demo-note-2",
          author: "lo-demo",
          author_name: "Admin Review",
          text: "Use this sample item to preview the confirm and appeal states in the modal.",
          timestamp: new Date(now.getTime() - 26 * 60 * 60 * 1000).toISOString(),
        },
      ],
      updated_date: new Date(now.getTime() - 12 * 60 * 60 * 1000).toISOString(),
      is_demo: true,
      demo_label: "Sample Review Task",
    },
  ];
};

export default function LoanTasksTab({ loan, currentUser, openTaskId, onTaskOpened }) {
  const { toast } = useToast();

  const [tasks, setTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [demoTasks, setDemoTasks] = useState([]);
  const [activeTaskTab, setActiveTaskTab] = useState("all");
  const [deadlineSortOrder, setDeadlineSortOrder] = useState("asc");

  const [selectedTask, setSelectedTask] = useState(null);
  const [selectedTaskMode, setSelectedTaskMode] = useState(null);

  const [submitComment, setSubmitComment] = useState("");
  const [submitFiles, setSubmitFiles] = useState([]);
  const [isSubmittingTask, setIsSubmittingTask] = useState(false);

  const [reviewFileIndex, setReviewFileIndex] = useState(0);
  const [appealMode, setAppealMode] = useState(false);
  const [appealExplanation, setAppealExplanation] = useState("");
  const [appealFiles, setAppealFiles] = useState([]);
  const [isReviewSaving, setIsReviewSaving] = useState(false);
  useEffect(() => {
    setDemoTasks(createDemoTasks(currentUser));
  }, [currentUser]);

  useEffect(() => {
    if (loan?.id && currentUser?.id) {
      loadTasks();
    }
  }, [loan?.id, currentUser?.id]);

  useEffect(() => {
    if (!openTaskId || !tasks.length) return;

    const taskToOpen = tasks.find((task) => task.id === openTaskId);
    if (taskToOpen) {
      openTask(taskToOpen);
      if (onTaskOpened) {
        onTaskOpened();
      }
    }
  }, [openTaskId, tasks, onTaskOpened]);

  const filteredTasks = useMemo(() => {
    const visibleTasks = [...demoTasks, ...tasks].filter(
      (task) => !["completed", "approved", "rejected"].includes(task.status)
    );

    if (!searchTerm) return visibleTasks;

    return visibleTasks.filter((task) => {
      const haystack = [task.item_name, task.category, getTaskInstruction(task)]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(searchTerm.toLowerCase());
    });
  }, [demoTasks, tasks, searchTerm]);

  const submitTasks = useMemo(
    () => filteredTasks.filter((task) => getTaskAction(task) === "submit"),
    [filteredTasks]
  );

  const reviewTasks = useMemo(
    () => filteredTasks.filter((task) => getTaskAction(task) === "review"),
    [filteredTasks]
  );

  const applySort = (taskList) => {
    const sorted = [...taskList];

    sorted.sort((a, b) => {
      const deadlineA = getTaskDeadline(a);
      const deadlineB = getTaskDeadline(b);
      const timeA = deadlineA ? new Date(deadlineA).getTime() : null;
      const timeB = deadlineB ? new Date(deadlineB).getTime() : null;

      if (timeA === null && timeB === null) return (a.item_name || "").localeCompare(b.item_name || "");
      if (timeA === null) return 1;
      if (timeB === null) return -1;

      if (deadlineSortOrder === "desc") {
        return timeB - timeA;
      }

      return timeA - timeB;
    });

    return sorted;
  };

  const visibleTasks = useMemo(() => {
    let nextTasks;

    if (activeTaskTab === "submit") {
      nextTasks = submitTasks;
    } else if (activeTaskTab === "review") {
      nextTasks = reviewTasks;
    } else {
      nextTasks = filteredTasks;
    }

    return applySort(nextTasks);
  }, [activeTaskTab, deadlineSortOrder, filteredTasks, reviewTasks, submitTasks]);

  const loadTasks = async () => {
    setIsLoading(true);
    try {
      const allTasks = await ChecklistItem.filter({ loan_id: loan.id });
      const assignedTasks = allTasks.filter((task) => {
        if (!task.assigned_to) return false;
        const assignedTo = Array.isArray(task.assigned_to) ? task.assigned_to : [task.assigned_to];
        return assignedTo.includes(currentUser.id);
      });

      assignedTasks.sort((a, b) => {
        const deadlineA = getTaskDeadline(a);
        const deadlineB = getTaskDeadline(b);
        if (!deadlineA) return 1;
        if (!deadlineB) return -1;
        return new Date(deadlineA) - new Date(deadlineB);
      });

      setTasks(assignedTasks);
    } catch (error) {
      console.error("[LoanTasksTab] Error loading tasks:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load tasks for this loan.",
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

  const updateTaskInState = (taskId, updates) => {
    setTasks((currentTasks) =>
      currentTasks.map((task) => (task.id === taskId ? { ...task, ...updates } : task))
    );
    setDemoTasks((currentTasks) =>
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
      if (selectedTask.is_demo) {
        const nextFiles = [
          ...existingFiles,
          ...submitFiles.map((file) => ({
            file_name: file.name,
            file_url: "#",
            uploaded_by: currentUser.id,
            uploaded_date: new Date().toISOString(),
          })),
        ];
        const nextNotes = [...getTaskComments(selectedTask)];

        if (submitComment.trim()) {
          nextNotes.push(buildTaskNote(currentUser, submitComment));
        }

        updateTaskInState(selectedTask.id, {
          uploaded_files: nextFiles,
          notes: nextNotes,
          status: "submitted",
        });

        toast({
          title: "Sample task updated",
          description: "This demo item updates locally so you can review the design.",
        });

        closeTaskModal();
        setIsSubmittingTask(false);
        return;
      }

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
      console.error("[LoanTasksTab] Error submitting task:", error);
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
      if (selectedTask.is_demo) {
        setDemoTasks((currentTasks) => currentTasks.filter((task) => task.id !== selectedTask.id));
        toast({
          title: "Sample review confirmed",
          description: "This demo item was cleared locally.",
        });
        closeTaskModal();
        setIsReviewSaving(false);
        return;
      }

      await ChecklistItem.update(selectedTask.id, { status: "approved" });
      setTasks((currentTasks) => currentTasks.filter((task) => task.id !== selectedTask.id));

      toast({
        title: "Review confirmed",
        description: `"${selectedTask.item_name}" has been confirmed.`,
      });

      closeTaskModal();
    } catch (error) {
      console.error("[LoanTasksTab] Error confirming review:", error);
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
      if (selectedTask.is_demo) {
        const nextFiles = [
          ...getTaskFiles(selectedTask),
          ...appealFiles.map((file) => ({
            file_name: file.name,
            file_url: "#",
            uploaded_by: currentUser.id,
            uploaded_date: new Date().toISOString(),
          })),
        ];
        const nextNotes = [
          ...getTaskComments(selectedTask),
          buildTaskNote(currentUser, appealExplanation, "Appeal: "),
        ];

        updateTaskInState(selectedTask.id, {
          uploaded_files: nextFiles,
          notes: nextNotes,
          status: "under_review",
        });

        toast({
          title: "Sample appeal submitted",
          description: "This demo item updates locally so you can inspect the UI.",
        });

        closeTaskModal();
        setIsReviewSaving(false);
        return;
      }

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
      console.error("[LoanTasksTab] Error submitting appeal:", error);
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
        <div className="flex min-h-[420px] items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-slate-500">
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

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex min-h-[480px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <CardTitle>My Tasks</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="overflow-x-auto">
              <Tabs value={activeTaskTab} onValueChange={setActiveTaskTab}>
                <TabsList className="inline-flex h-auto rounded-xl bg-[#ededed] p-1">
                  <TabsTrigger value="all" className="rounded-lg px-5 py-2">
                    All
                    <span className="ml-2 text-xs text-slate-500">{filteredTasks.length}</span>
                  </TabsTrigger>
                  <TabsTrigger value="submit" className="rounded-lg px-5 py-2">
                    Submit
                    <span className="ml-2 text-xs text-slate-500">{submitTasks.length}</span>
                  </TabsTrigger>
                  <TabsTrigger value="review" className="rounded-lg px-5 py-2">
                    Review
                    <span className="ml-2 text-xs text-slate-500">{reviewTasks.length}</span>
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <div className="relative w-full lg:max-w-md">
              <Search className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
              <Input
                placeholder="Search tasks..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="h-14 rounded-2xl border-2 border-[#d9d9d9] bg-white pl-14 text-base"
              />
            </div>
          </div>

          {TAB_GUIDANCE[activeTaskTab] ? (
            <div className={`rounded-2xl border p-4 ${TAB_GUIDANCE[activeTaskTab].className}`}>
              <p className="text-sm leading-6">{TAB_GUIDANCE[activeTaskTab].text}</p>
            </div>
          ) : null}

          {visibleTasks.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 py-16 text-center text-slate-500">
              No tasks found for this view.
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-[#e5e5e5] bg-white">
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse">
                  <thead>
                    <tr className="border-b-2 border-[#e5e5e5]">
                      <th className="px-6 py-3 text-left text-sm text-[#171717]">Item</th>
                      <th className="px-6 py-3 text-left text-sm text-[#171717]">Type</th>
                      <th className="px-6 py-3 text-left text-sm text-[#171717]">
                        <button
                          type="button"
                          className="flex items-center gap-2"
                          onClick={() =>
                            setDeadlineSortOrder((current) => (current === "asc" ? "desc" : "asc"))
                          }
                        >
                          <span>Deadline</span>
                          <ArrowUpDown className="h-4 w-4" />
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleTasks.map((task) => {
                      const taskType = getTaskAction(task) === "review" ? "Review" : "Submit";

                      return (
                        <tr
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
                          className="cursor-pointer border-b border-[#e5e5e5] transition hover:bg-slate-50"
                        >
                          <td className="px-6 py-4 align-middle">
                            <div className="min-w-0">
                              {task.is_demo ? (
                                <p className="mb-1 text-xs uppercase tracking-[0.18em] text-fuchsia-700">
                                  {task.demo_label || "Sample"}
                                </p>
                              ) : null}
                              <p className="text-sm text-slate-900">{task.item_name}</p>
                            </div>
                          </td>
                          <td className="px-6 py-4 align-middle">
                            <Badge
                              className={
                                taskType === "Review"
                                  ? "border-0 bg-amber-100 text-amber-800"
                                  : "border-0 bg-sky-100 text-sky-800"
                              }
                            >
                              {taskType}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 align-middle">
                            <div className="flex items-center gap-1.5 text-sm text-slate-600">
                              <Calendar className="h-4 w-4" />
                              <span>{formatDateLabel(getTaskDeadline(task))}</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={selectedTaskMode === "submit" && !!selectedTask} onOpenChange={(open) => !open && closeTaskModal()}>
        <DialogContent className="max-w-3xl rounded-[32px] border-white/70 p-0">
          {selectedTask && (
            <div className="max-h-[88vh] overflow-y-auto">
              <DialogHeader className="border-b border-slate-200 px-6 py-5">
                <DialogTitle className="text-2xl text-slate-900">{selectedTask.item_name}</DialogTitle>
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
                  <Label>Instruction</Label>
                  <div className="rounded-3xl border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-700">
                    {getTaskInstruction(selectedTask) || "No additional instruction was provided for this item."}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Template</Label>
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
                  <Label>Comments From Admin / LO</Label>
                  {renderNotes(selectedTask)}
                </div>

                <Separator />

                <div className="space-y-3">
                  <Label htmlFor="task-submit-files">Attach Documents</Label>
                  <input
                    id="task-submit-files"
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
                  <Label htmlFor="task-submit-comment">Comments</Label>
                  <Textarea
                    id="task-submit-comment"
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
                    <Label>Instruction</Label>
                    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                      {getTaskInstruction(selectedTask) || "No additional instruction was provided for this review item."}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Comments From Admin / LO</Label>
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
                          <Label htmlFor="task-appeal-files">Supporting Files</Label>
                          <input
                            id="task-appeal-files"
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
                          <Label htmlFor="task-appeal-explanation">Explanation</Label>
                          <Textarea
                            id="task-appeal-explanation"
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
    </>
  );
}