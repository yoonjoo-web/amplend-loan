import React, { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import {
  ArrowUpDown,
  Bell,
  Download,
  Loader2,
  MoveRight,
  Search,
  Upload,
} from "lucide-react";

import { base44 } from "@/api/base44Client";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import DocumentViewer from "./DocumentViewer";
import { ACTION_ITEM_CHECKLIST_ITEMS, DOCUMENT_CHECKLIST_ITEMS } from "./checklistData";

const CATEGORY_TABS = [
  { value: "all", label: "All documents" },
  { value: "borrower", label: "Borrower information" },
  { value: "property", label: "Property information" },
  { value: "closing", label: "Closing information" },
  { value: "post_closing", label: "Post-closing information" },
];

const DOC_CATEGORY_LABEL_TO_VALUE = {
  "Borrower Document": "borrower_document",
  "Property Document": "property_document",
  "Closing Document": "closing_document",
  "Post-Closing Document": "post_closing_document",
};

const DOC_VALUE_TO_TAB = {
  borrower_document: "borrower",
  property_document: "property",
  closing_document: "closing",
  post_closing_document: "post_closing",
};

const REQUEST_ACTIVITY_TYPE = "document_requested";
const ALLOWED_FILE_TYPES = ".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif";
const SORT_OPTIONS = [
  { value: "latest", label: "Latest" },
  { value: "oldest", label: "Oldest" },
];

const normalizeText = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

const isRefinancePurpose = (purpose) =>
  ["refinance", "cash_out_refinance", "rate_term_refinance"].includes(purpose);

const stripFileExtension = (name) => String(name || "").replace(/\.[^/.]+$/, "");

const buildTemplateKey = (category, title) => `${category}::${normalizeText(title)}`;

const getDocumentDate = (document) =>
  document?.uploaded_date || document?.updated_date || document?.created_date || null;

const getCurrentUserName = (currentUser) => {
  if (!currentUser) return "Unknown User";
  if (currentUser.first_name || currentUser.last_name) {
    return `${currentUser.first_name || ""} ${currentUser.last_name || ""}`.trim();
  }
  return currentUser.full_name || currentUser.email || "Unknown User";
};

const getLoanTypeFilters = (loan) => {
  const baseTypeMap = {
    fix_flip: "Fix & Flip",
    bridge: "Bridge",
    new_construction: "New Construction",
    dscr: "DSCR",
  };

  const values = new Set();
  const baseLabel = baseTypeMap[loan?.loan_product];

  if (baseLabel) {
    values.add(baseLabel);
  }

  if (isRefinancePurpose(loan?.loan_purpose)) {
    values.add("Refinance");
    if (baseLabel) {
      values.add(`${baseLabel} Refinance`);
    }
  } else if (loan?.loan_purpose === "purchase" && baseLabel) {
    values.add(`${baseLabel} Purchase`);
  }

  if (loan?.loan_product === "dscr") {
    values.add(
      isRefinancePurpose(loan?.loan_purpose) ? "DSCR Refinance" : "DSCR Purchase"
    );
  }

  return values;
};

const isTemplateApplicable = (template, loanTypeFilters) => {
  if (!Array.isArray(template?.loan_types) || template.loan_types.length === 0) {
    return true;
  }

  return template.loan_types.some((loanType) => loanTypeFilters.has(loanType));
};

const resolveDateLabel = (value) => {
  if (!value) return "Not uploaded";

  try {
    return format(new Date(value), "M/d/yyyy");
  } catch (error) {
    return "Not uploaded";
  }
};

const getLastRequestTimestamp = (activityHistory) => {
  if (!Array.isArray(activityHistory) || activityHistory.length === 0) {
    return null;
  }

  const requestEntries = activityHistory
    .filter(
      (entry) =>
        entry?.type === REQUEST_ACTIVITY_TYPE ||
        entry?.action === REQUEST_ACTIVITY_TYPE ||
        entry?.activity_type === REQUEST_ACTIVITY_TYPE
    )
    .sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));

  return requestEntries[0]?.timestamp || null;
};

const getRowProviderLabel = ({ loan, template, checklistItem, directory }) => {
  const assignedNames = Array.isArray(checklistItem?.assigned_to)
    ? checklistItem.assigned_to
        .map((id) => directory[String(id)])
        .filter(Boolean)
        .join(", ")
    : "";

  if (assignedNames) {
    return assignedNames;
  }

  if (!template?.provider) {
    const loanOfficerNames = (loan?.loan_officer_ids || [])
      .map((id) => directory[String(id)])
      .filter(Boolean)
      .join(", ");
    return loanOfficerNames || "Amplend";
  }

  if (template.provider === "Borrower") {
    const borrowerNames = (loan?.borrower_ids || [])
      .map((id) => directory[String(id)])
      .filter(Boolean)
      .join(", ");
    return loan?.borrower_entity_name || borrowerNames || "Borrower";
  }

  if (template.provider === "Amplend") {
    const loanOfficerNames = (loan?.loan_officer_ids || [])
      .map((id) => directory[String(id)])
      .filter(Boolean)
      .join(", ");
    return loanOfficerNames || "Amplend";
  }

  if (template.provider === "Title Company") {
    const titleCompanyNames = (loan?.title_company_ids || [])
      .map((id) => directory[String(id)])
      .filter(Boolean)
      .join(", ");
    return titleCompanyNames || "Title Company";
  }

  return template.provider;
};

const createRowFromTemplate = ({
  loan,
  template,
  rowType,
  tabValue,
  checklistItem,
  document,
  directory,
}) => {
  const uploadedAt = getDocumentDate(document);
  const requestTimestamp = getLastRequestTimestamp(checklistItem?.activity_history);
  const hasActiveRequest =
    Boolean(requestTimestamp) &&
    (!uploadedAt || new Date(requestTimestamp).getTime() > new Date(uploadedAt).getTime());

  return {
    id: `${rowType}-${template.category}-${normalizeText(template.item)}`,
    title: template.item,
    tabValue,
    rowType,
    providerLabel: getRowProviderLabel({ loan, template, checklistItem, directory }),
    uploadedAt,
    uploadedDateLabel: resolveDateLabel(uploadedAt),
    hasFile: Boolean(document),
    hasActiveRequest,
    document,
    template,
    checklistItemId: checklistItem?.id || null,
    loanDocumentCategory:
      DOC_CATEGORY_LABEL_TO_VALUE[template.category] ||
      DOC_CATEGORY_LABEL_TO_VALUE[tabValue === "post_closing" ? "Post-Closing Document" : "Closing Document"],
  };
};

const createRowFromUploadedDocument = ({ document, directory }) => {
  const uploadedAt = getDocumentDate(document);
  const uploaderName = directory[String(document?.uploaded_by)] || "Uploaded document";

  return {
    id: `uploaded-${document.id}`,
    title: document.document_name || "Uploaded document",
    tabValue: DOC_VALUE_TO_TAB[document.category] || "all",
    rowType: "uploaded",
    providerLabel: uploaderName,
    uploadedAt,
    uploadedDateLabel: resolveDateLabel(uploadedAt),
    hasFile: true,
    hasActiveRequest: false,
    document,
    template: null,
    checklistItemId: document?.checklist_item_id || null,
    loanDocumentCategory: document.category,
  };
};

export default function LoanDocumentsTab({ loan, currentUser }) {
  const { toast } = useToast();
  const hiddenFileInputRef = useRef(null);

  const [isLoading, setIsLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [checklistItems, setChecklistItems] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [providerFilter, setProviderFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState("latest");
  const [viewingDocument, setViewingDocument] = useState(null);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [pendingUploads, setPendingUploads] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isRequestingId, setIsRequestingId] = useState(null);

  const loadDirectory = async () => {
    const nextDirectory = {};

    const [allUsers, borrowers, loanPartners] = await Promise.all([
      (async () => {
        try {
          const response = await base44.functions.invoke("getAllUsers");
          return response?.data?.users || response?.users || [];
        } catch (error) {
          try {
            return await base44.entities.User.list();
          } catch (fallbackError) {
            console.error("Error loading users for document directory:", fallbackError);
            return [];
          }
        }
      })(),
      base44.entities.Borrower.list().catch((error) => {
        console.error("Error loading borrowers for document directory:", error);
        return [];
      }),
      base44.entities.LoanPartner.list().catch((error) => {
        console.error("Error loading loan partners for document directory:", error);
        return [];
      }),
    ]);

    allUsers.forEach((user) => {
      const label =
        user.first_name || user.last_name
          ? `${user.first_name || ""} ${user.last_name || ""}`.trim()
          : user.full_name || user.email;

      if (label) {
        nextDirectory[String(user.id)] = label;
      }
    });

    borrowers.forEach((borrower) => {
      const label =
        borrower.first_name || borrower.last_name
          ? `${borrower.first_name || ""} ${borrower.last_name || ""}`.trim()
          : borrower.name || borrower.email;

      if (label) {
        nextDirectory[String(borrower.id)] = label;
        if (borrower.user_id) {
          nextDirectory[String(borrower.user_id)] = label;
        }
      }
    });

    loanPartners.forEach((partner) => {
      const label = partner.name || partner.contact_person || partner.email;

      if (label) {
        nextDirectory[String(partner.id)] = label;
        if (partner.user_id) {
          nextDirectory[String(partner.user_id)] = label;
        }
      }
    });

    return nextDirectory;
  };

  const buildRows = ({ checklistItems: allChecklistItems, allDocuments, directory: nameDirectory }) => {
    const loanTypeFilters = getLoanTypeFilters(loan);
    const checklistByKey = new Map();
    const checklistIdsUsedByTemplate = new Set();
    const templateKeys = new Set();
    const latestDocumentByChecklistId = new Map();
    const latestDocumentByKey = new Map();
    const sortedDocuments = [...allDocuments].sort(
      (a, b) => new Date(getDocumentDate(b) || 0).getTime() - new Date(getDocumentDate(a) || 0).getTime()
    );

    allChecklistItems.forEach((item) => {
      const key = buildTemplateKey(item.category, item.item_name);
      if (!checklistByKey.has(key)) {
        checklistByKey.set(key, item);
      }
    });

    sortedDocuments.forEach((document) => {
      if (document?.checklist_item_id && !latestDocumentByChecklistId.has(document.checklist_item_id)) {
        latestDocumentByChecklistId.set(document.checklist_item_id, document);
      }

      const categoryLabel = Object.keys(DOC_CATEGORY_LABEL_TO_VALUE).find(
        (label) => DOC_CATEGORY_LABEL_TO_VALUE[label] === document.category
      );

      if (categoryLabel) {
        const key = buildTemplateKey(categoryLabel, document.document_name);
        if (!latestDocumentByKey.has(key)) {
          latestDocumentByKey.set(key, document);
        }
      }
    });

    const templateRows = [];

    DOCUMENT_CHECKLIST_ITEMS.filter((item) => isTemplateApplicable(item, loanTypeFilters)).forEach(
      (template) => {
        const tabValue =
          template.category === "Borrower Document"
            ? "borrower"
            : template.category === "Property Document"
              ? "property"
              : template.category === "Closing Document"
                ? "closing"
                : "post_closing";

        const templateKey = buildTemplateKey(template.category, template.item);
        const checklistItem = checklistByKey.get(templateKey);
        const document =
          (checklistItem?.id && latestDocumentByChecklistId.get(checklistItem.id)) ||
          latestDocumentByKey.get(templateKey) ||
          null;

        if (checklistItem?.id) {
          checklistIdsUsedByTemplate.add(checklistItem.id);
        }
        templateKeys.add(templateKey);

        templateRows.push(
          createRowFromTemplate({
            loan,
            template,
            rowType: "document",
            tabValue,
            checklistItem,
            document,
            directory: nameDirectory,
          })
        );
      }
    );

    ACTION_ITEM_CHECKLIST_ITEMS.filter(
      (item) =>
        ["Closing", "Post-Close"].includes(item.category) &&
        isTemplateApplicable(item, loanTypeFilters)
    ).forEach((template) => {
      const tabValue = template.category === "Closing" ? "closing" : "post_closing";
      const templateKey = buildTemplateKey(template.category, template.item);
      const checklistItem = checklistByKey.get(templateKey);
      const fallbackCategory =
        tabValue === "closing" ? "Closing Document" : "Post-Closing Document";
      const document =
        (checklistItem?.id && latestDocumentByChecklistId.get(checklistItem.id)) ||
        latestDocumentByKey.get(buildTemplateKey(fallbackCategory, template.item)) ||
        null;

      if (checklistItem?.id) {
        checklistIdsUsedByTemplate.add(checklistItem.id);
      }
      templateKeys.add(templateKey);

      templateRows.push(
        createRowFromTemplate({
          loan,
          template,
          rowType: "action",
          tabValue,
          checklistItem,
          document,
          directory: nameDirectory,
        })
      );
    });

    const uploadedOnlyRows = [];
    const seenUploadedKeys = new Set();

    sortedDocuments.forEach((document) => {
      const categoryLabel = Object.keys(DOC_CATEGORY_LABEL_TO_VALUE).find(
        (label) => DOC_CATEGORY_LABEL_TO_VALUE[label] === document.category
      );
      const documentKey = categoryLabel
        ? buildTemplateKey(categoryLabel, document.document_name)
        : null;

      if (
        (document.checklist_item_id && checklistIdsUsedByTemplate.has(document.checklist_item_id)) ||
        (documentKey && templateKeys.has(documentKey))
      ) {
        return;
      }

      const uniquenessKey = `${document.category}::${normalizeText(document.document_name)}`;
      if (seenUploadedKeys.has(uniquenessKey)) {
        return;
      }

      seenUploadedKeys.add(uniquenessKey);
      uploadedOnlyRows.push(createRowFromUploadedDocument({ document, directory: nameDirectory }));
    });

    return [...templateRows, ...uploadedOnlyRows];
  };

  const loadWorkspace = async () => {
    setIsLoading(true);

    try {
      const [allDocuments, allChecklistItems, nameDirectory] = await Promise.all([
        base44.entities.LoanDocument.filter({ loan_id: loan.id }).catch((error) => {
          console.error("Error loading loan documents:", error);
          return [];
        }),
        base44.entities.ChecklistItem.filter({ loan_id: loan.id }).catch((error) => {
          console.error("Error loading checklist items for documents:", error);
          return [];
        }),
        loadDirectory(),
      ]);

      const nextRows = buildRows({
        checklistItems: allChecklistItems,
        allDocuments,
        directory: nameDirectory,
      });

      setChecklistItems(allChecklistItems);
      setRows(nextRows);
    } catch (error) {
      console.error("Error loading document workspace:", error);
      toast({
        variant: "destructive",
        title: "Unable to load documents",
        description: "The document workspace could not be loaded.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadWorkspace();
  }, [loan.id]);

  const providerOptions = Array.from(
    new Set(
      rows
        .filter((row) => activeTab === "all" || row.tabValue === activeTab)
        .map((row) => row.providerLabel)
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b));

  let visibleRows = rows.filter((row) => {
    const matchesTab = activeTab === "all" || row.tabValue === activeTab;
    const matchesSearch =
      !searchTerm ||
      row.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      row.providerLabel.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesProvider = providerFilter === "all" || row.providerLabel === providerFilter;

    return matchesTab && matchesSearch && matchesProvider;
  });

  visibleRows = visibleRows.sort((left, right) => {
    const leftTime = left.uploadedAt ? new Date(left.uploadedAt).getTime() : null;
    const rightTime = right.uploadedAt ? new Date(right.uploadedAt).getTime() : null;

    if (leftTime === null && rightTime === null) {
      return left.title.localeCompare(right.title);
    }

    if (leftTime === null) {
      return 1;
    }

    if (rightTime === null) {
      return -1;
    }

    return sortOrder === "latest" ? rightTime - leftTime : leftTime - rightTime;
  });

  const rowOptions = rows
    .filter((row) => row.rowType !== "uploaded")
    .map((row) => ({
      value: row.id,
      label: `${row.title} (${CATEGORY_TABS.find((tab) => tab.value === row.tabValue)?.label || row.tabValue})`,
      title: row.title,
      category: row.tabValue,
      checklistItemId: row.checklistItemId,
    }));

  const ensureChecklistItem = async (row) => {
    if (row?.checklistItemId) {
      return row.checklistItemId;
    }

    if (!row?.template) {
      return null;
    }

    const createdItem = await base44.entities.ChecklistItem.create({
      loan_id: loan.id,
      checklist_type: row.rowType === "action" ? "action_item" : "document",
      category: row.template.category,
      item_name: row.title,
      description: row.template.description || "",
      provider: row.template.provider || "",
      applicable_loan_types: row.template.loan_types || [],
      document_category: row.template.document_category || "",
      status: row.rowType === "action" ? "not_started" : "pending",
      activity_history: [],
    });

    return createdItem?.id || null;
  };

  const handleOpenUploadDialog = () => {
    hiddenFileInputRef.current?.click();
  };

  const handleFileSelection = (event) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) {
      return;
    }

    const defaultCategory = activeTab === "all" ? "borrower" : activeTab;
    const nextUploads = files.map((file, index) => ({
      id: `${Date.now()}-${index}`,
      file,
      title: stripFileExtension(file.name),
      category: defaultCategory,
      linkedRowId: "none",
      checklistItemId: null,
    }));

    setPendingUploads(nextUploads);
    setShowUploadDialog(true);
    event.target.value = "";
  };

  const updatePendingUpload = (uploadId, field, value) => {
    setPendingUploads((currentUploads) =>
      currentUploads.map((upload) => {
        if (upload.id !== uploadId) {
          return upload;
        }

        const nextUpload = { ...upload, [field]: value };

        if (field === "linkedRowId") {
          const selectedOption = rowOptions.find((option) => option.value === value);
          if (selectedOption) {
            nextUpload.title = selectedOption.title;
            nextUpload.category = selectedOption.category;
            nextUpload.checklistItemId = selectedOption.checklistItemId || null;
          } else {
            nextUpload.checklistItemId = null;
          }
        }

        return nextUpload;
      })
    );
  };

  const handleUploadDocuments = async () => {
    if (pendingUploads.length === 0) {
      return;
    }

    setIsUploading(true);

    try {
      for (const upload of pendingUploads) {
        if (!upload.title.trim()) {
          throw new Error("Every upload needs a title.");
        }

        const linkedRow =
          upload.linkedRowId && upload.linkedRowId !== "none"
            ? rows.find((row) => row.id === upload.linkedRowId)
            : null;

        const checklistItemId =
          upload.checklistItemId ||
          (linkedRow ? await ensureChecklistItem(linkedRow) : null);

        const { file_url: fileUrl } = await base44.integrations.Core.UploadFile({
          file: upload.file,
        });

        await base44.entities.LoanDocument.create({
          loan_id: loan.id,
          document_name: upload.title.trim(),
          file_url: fileUrl,
          category:
            linkedRow?.loanDocumentCategory ||
            DOC_CATEGORY_LABEL_TO_VALUE[
              upload.category === "borrower"
                ? "Borrower Document"
                : upload.category === "property"
                  ? "Property Document"
                  : upload.category === "closing"
                    ? "Closing Document"
                    : "Post-Closing Document"
            ] ||
            "borrower_document",
          status: "submitted",
          uploaded_by: currentUser?.id,
          uploaded_date: new Date().toISOString(),
          checklist_item_id: checklistItemId,
        });
      }

      setShowUploadDialog(false);
      setPendingUploads([]);
      toast({
        title: "Documents uploaded",
        description: "The selected files have been attached to this loan.",
      });
      await loadWorkspace();
    } catch (error) {
      console.error("Error uploading loan documents:", error);
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: error.message || "The documents could not be uploaded.",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleRequestDocument = async (row) => {
    setIsRequestingId(row.id);

    try {
      const checklistItemId = await ensureChecklistItem(row);
      if (!checklistItemId) {
        throw new Error("This row is not linked to a requestable checklist item.");
      }

      const checklistItem = checklistItems.find((item) => item.id === checklistItemId);
      const timestamp = new Date().toISOString();
      const activityHistory = Array.isArray(checklistItem?.activity_history)
        ? [...checklistItem.activity_history]
        : [];

      activityHistory.push({
        type: REQUEST_ACTIVITY_TYPE,
        timestamp,
        user_id: currentUser?.id || "",
        user_name: getCurrentUserName(currentUser),
        label: `Requested ${row.title}`,
      });

      await base44.entities.ChecklistItem.update(checklistItemId, {
        activity_history: activityHistory,
        due_date: checklistItem?.due_date || timestamp.split("T")[0],
      });

      if (row.template?.provider === "Borrower" && Array.isArray(loan.borrower_ids) && loan.borrower_ids.length > 0) {
        try {
          await base44.functions.invoke("createNotification", {
            user_ids: loan.borrower_ids,
            message: `Document requested: ${row.title}`,
            type: "document_request",
            entity_type: "Loan",
            entity_id: loan.id,
            link_url: `/LoanDetail?id=${loan.id}&tab=documents`,
            priority: "medium",
          });
        } catch (notificationError) {
          console.error("Error creating borrower document request notification:", notificationError);
        }
      }

      toast({
        title: "Request logged",
        description: `${row.title} has been marked as requested.`,
      });

      await loadWorkspace();
    } catch (error) {
      console.error("Error requesting document:", error);
      toast({
        variant: "destructive",
        title: "Request failed",
        description: error.message || "The request could not be saved.",
      });
    } finally {
      setIsRequestingId(null);
    }
  };

  const handleExport = () => {
    const header = ["Title", "Provider", "Uploaded date", "Action"];
    const body = visibleRows.map((row) => [
      row.title,
      row.providerLabel,
      row.uploadedDateLabel,
      row.hasFile ? "View file" : "Request document",
    ]);

    const csv = [header, ...body]
      .map((columns) =>
        columns
          .map((value) => `"${String(value || "").replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const link = window.document.createElement("a");
    link.href = url;
    link.download = `${loan.loan_number || loan.primary_loan_id || "loan"}-documents.csv`;
    window.document.body.appendChild(link);
    link.click();
    window.document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[480px] items-center justify-center rounded-2xl border border-slate-200 bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
      </div>
    );
  }

  return (
    <>
      <section className="space-y-6 rounded-[24px] bg-[#f8f9fb] pb-8">
        <header className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-2xl font-semibold tracking-[-0.5px] text-[#171717]">
              Documents
            </h2>
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search for documents"
              className="h-14 rounded-2xl border-2 border-[#d9d9d9] bg-white pl-14 text-base"
            />
          </div>
        </header>

        <div className="overflow-x-auto">
          <div className="inline-flex min-w-full rounded-xl bg-[#ededed] p-1">
            {CATEGORY_TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => {
                  setActiveTab(tab.value);
                  setProviderFilter("all");
                }}
                className={cn(
                  "flex-1 whitespace-nowrap rounded-lg border px-5 py-2 text-sm font-medium transition-colors",
                  activeTab === tab.value
                    ? "border-[#e5e5e5] bg-white text-black shadow-sm"
                    : "border-transparent bg-transparent text-black hover:bg-white/60"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <div className="grid flex-1 gap-4 md:grid-cols-2">
            <div className="flex items-center gap-3">
              <Label className="shrink-0 text-base font-normal text-[#171717]">Provider</Label>
              <Select value={providerFilter} onValueChange={setProviderFilter}>
                <SelectTrigger className="h-11 rounded-lg border-[#d9d9d9] bg-white">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {providerOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-3">
              <Label className="shrink-0 text-base font-normal text-[#171717]">
                Uploaded date
              </Label>
              <Select value={sortOrder} onValueChange={setSortOrder}>
                <SelectTrigger className="h-11 rounded-lg border-[#d9d9d9] bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Button
              type="button"
              variant="outline"
              className="h-11 min-w-28 rounded-lg border-0 bg-[#e5e5ea] text-black hover:bg-[#d9d9df]"
              onClick={handleExport}
            >
              <Download className="h-4 w-4" />
            </Button>

            <input
              ref={hiddenFileInputRef}
              type="file"
              multiple
              accept={ALLOWED_FILE_TYPES}
              className="hidden"
              onChange={handleFileSelection}
            />
            <Button
              type="button"
              variant="outline"
              className="h-11 min-w-32 rounded-lg border-2 border-[#3463dd] bg-white text-black hover:bg-[#f4f7ff]"
              onClick={handleOpenUploadDialog}
            >
              Upload
              <Upload className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-[#e5e5e5] bg-white">
          <div className="overflow-x-auto">
            <table className="min-w-[920px] w-full border-collapse">
              <thead>
                <tr className="border-b-2 border-[#e5e5e5]">
                  <th className="px-6 py-3 text-left align-middle font-normal text-[#171717]">
                    <div className="flex items-center gap-4">
                      <MoveRight className="h-5 w-5" />
                      <span className="text-lg">Title</span>
                    </div>
                  </th>
                  <th className="w-[220px] px-6 py-3 text-left text-base font-normal text-[#171717]">
                    Provider
                  </th>
                  <th className="w-[220px] px-6 py-3 text-left text-base font-normal text-[#171717]">
                    Uploaded date
                  </th>
                  <th className="w-[220px] px-6 py-3 text-left text-base font-normal text-[#171717]">
                    <div className="flex items-center gap-2">
                      <span className="flex-1">Action</span>
                      <ArrowUpDown className="h-4 w-4" />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => (
                  <tr key={row.id} className="border-b border-[#ededed] last:border-b-0">
                    <td className="px-6 py-4 text-[17px] tracking-[-0.3px] text-[#171717]">
                      {row.title}
                    </td>
                    <td className="px-6 py-4 text-[17px] tracking-[-0.3px] text-[#171717]">
                      {row.providerLabel}
                    </td>
                    <td
                      className={cn(
                        "px-6 py-4 text-[17px] tracking-[-0.3px]",
                        row.hasFile ? "text-[#171717]" : "text-[#8e8e93]"
                      )}
                    >
                      {row.uploadedDateLabel}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        {row.hasFile ? (
                          <Button
                            type="button"
                            className="h-10 min-w-[120px] rounded-lg bg-[#3463dd] text-white hover:bg-[#2850ba]"
                            onClick={() => setViewingDocument(row.document)}
                          >
                            View file
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            variant="outline"
                            disabled={isRequestingId === row.id}
                            className={cn(
                              "h-10 min-w-[120px] rounded-lg border-2 bg-white text-black hover:bg-slate-50",
                              row.hasActiveRequest ? "border-[#8e8e93] text-[#8e8e93]" : "border-[#3463dd]"
                            )}
                            onClick={() => handleRequestDocument(row)}
                          >
                            {isRequestingId === row.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              "Request document"
                            )}
                          </Button>
                        )}

                        <div className="flex h-6 w-6 items-center justify-center">
                          {row.hasActiveRequest && !row.hasFile ? (
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#b3261e] text-white">
                              <Bell className="h-3.5 w-3.5 fill-current" />
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}

                {visibleRows.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-16 text-center text-base text-slate-500">
                      No document rows match the current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Upload documents</DialogTitle>
            <DialogDescription>
              Match each file to a document row when possible so the page can keep request state in sync.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {pendingUploads.map((upload) => (
              <div key={upload.id} className="rounded-xl border border-slate-200 p-4">
                <div className="mb-4">
                  <p className="font-medium text-slate-900">{upload.file.name}</p>
                  <p className="text-sm text-slate-500">
                    {(upload.file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Document title</Label>
                    <Input
                      value={upload.title}
                      onChange={(event) =>
                        updatePendingUpload(upload.id, "title", event.target.value)
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select
                      value={upload.category}
                      onValueChange={(value) =>
                        updatePendingUpload(upload.id, "category", value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORY_TABS.filter((tab) => tab.value !== "all").map((tab) => (
                          <SelectItem key={tab.value} value={tab.value}>
                            {tab.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label>Match to document row</Label>
                    <Select
                      value={upload.linkedRowId}
                      onValueChange={(value) =>
                        updatePendingUpload(upload.id, "linkedRowId", value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Optional" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No linked row</SelectItem>
                        {rowOptions
                          .filter(
                            (option) =>
                              upload.category === "all" || option.category === upload.category
                          )
                          .map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowUploadDialog(false);
                setPendingUploads([]);
              }}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleUploadDocuments} disabled={isUploading}>
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading
                </>
              ) : (
                "Upload files"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <DocumentViewer
        isOpen={Boolean(viewingDocument)}
        onClose={() => setViewingDocument(null)}
        document={viewingDocument}
        currentUser={currentUser}
        onUpdate={loadWorkspace}
      />
    </>
  );
}
