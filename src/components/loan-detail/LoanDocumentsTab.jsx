import React, { useEffect, useRef, useState } from "react";
import { addDays, format } from "date-fns";
import {
  ArrowUpDown,
  Bell,
  ChevronDown,
  ChevronRight,
  Download,
  Loader2,
  Search,
  Upload,
} from "lucide-react";

import { base44 } from "@/api/base44Client";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";

import DocumentViewer from "./DocumentViewer";
import { ACTION_ITEM_CHECKLIST_ITEMS, DOCUMENT_CHECKLIST_ITEMS } from "./checklistData";
import { normalizeAppRole } from "@/components/utils/appRoles";

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
const FOLLOWUP_ACTIVITY_TYPE = "document_request_followup";
const REQUEST_CADENCE_DAYS = 2;
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

const sortDocumentsByDateDesc = (documents = []) =>
  [...documents].sort(
    (left, right) =>
      new Date(getDocumentDate(right) || 0).getTime() -
      new Date(getDocumentDate(left) || 0).getTime()
  );

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

const toIsoStringOrNull = (value) => {
  if (!value) return null;

  try {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  } catch (error) {
    return null;
  }
};

const getAssignedUserIds = (checklistItem) => {
  if (Array.isArray(checklistItem?.assigned_to)) {
    return checklistItem.assigned_to.filter(Boolean).map(String);
  }

  if (checklistItem?.assigned_to) {
    return [String(checklistItem.assigned_to)];
  }

  return [];
};

const isMatchingActivityType = (entry, type) =>
  entry?.type === type || entry?.action === type || entry?.activity_type === type;

const getSortedRequestEntries = (activityHistory, type) => {
  if (!Array.isArray(activityHistory)) {
    return [];
  }

  return [...activityHistory]
    .filter((entry) => isMatchingActivityType(entry, type))
    .sort((a, b) => new Date(a?.timestamp || 0).getTime() - new Date(b?.timestamp || 0).getTime());
};

const getLatestRequestRelatedEntry = (activityHistory) => {
  if (!Array.isArray(activityHistory) || activityHistory.length === 0) {
    return null;
  }

  return [...activityHistory]
    .filter(
      (entry) =>
        isMatchingActivityType(entry, REQUEST_ACTIVITY_TYPE) ||
        isMatchingActivityType(entry, FOLLOWUP_ACTIVITY_TYPE)
    )
    .sort((a, b) => new Date(b?.timestamp || 0).getTime() - new Date(a?.timestamp || 0).getTime())[0] || null;
};

const getLatestPendingScheduledReminder = (activityHistory) => {
  if (!Array.isArray(activityHistory) || activityHistory.length === 0) {
    return null;
  }

  return [...activityHistory]
    .filter(
      (entry) =>
        (isMatchingActivityType(entry, REQUEST_ACTIVITY_TYPE) ||
          isMatchingActivityType(entry, FOLLOWUP_ACTIVITY_TYPE)) &&
        entry?.scheduled_email_id &&
        !entry?.canceled_at
    )
    .sort((a, b) => new Date(b?.timestamp || 0).getTime() - new Date(a?.timestamp || 0).getTime())[0] || null;
};

const getRowProviderLabel = ({ checklistItem, directory }) => {
  const assignedNames = getAssignedUserIds(checklistItem)
    .map((id) => directory[id])
    .filter(Boolean)
    .join(", ");

  return assignedNames || "Not Assigned";
};

const getRequestActivitySummary = (row) => {
  const activityHistory = row?.checklistItem?.activity_history;
  const initialRequest = getSortedRequestEntries(activityHistory, REQUEST_ACTIVITY_TYPE)[0] || null;
  const followups = getSortedRequestEntries(activityHistory, FOLLOWUP_ACTIVITY_TYPE);

  const fallbackDueDate = toIsoStringOrNull(row?.checklistItem?.due_date);
  const fallbackRecipientIds = getAssignedUserIds(row?.checklistItem);
  const fallbackRequestedAt =
    initialRequest?.timestamp ||
    row?.checklistItem?.updated_date ||
    row?.checklistItem?.created_date ||
    null;

  const desiredDueAt =
    initialRequest?.desired_due_at ||
    fallbackDueDate ||
    (fallbackRequestedAt
      ? addDays(new Date(fallbackRequestedAt), REQUEST_CADENCE_DAYS).toISOString()
      : null);
  const lastFollowupAt = followups.length > 0 ? followups[followups.length - 1].timestamp : null;
  const overdue =
    Boolean(desiredDueAt) &&
    !row?.hasFile &&
    new Date().getTime() > new Date(desiredDueAt).getTime();

  return {
    initialRequest,
    firstRequestedAt: fallbackRequestedAt,
    desiredDueAt,
    lastFollowupAt,
    overdue,
    hasRequestData:
      Boolean(initialRequest) || Boolean(fallbackDueDate) || fallbackRecipientIds.length > 0,
  };
};

const shouldPreferChecklistItem = (currentItem, nextItem) => {
  if (!currentItem) {
    return true;
  }

  const currentRequestAt = getLatestRequestRelatedEntry(currentItem?.activity_history)?.timestamp;
  const nextRequestAt = getLatestRequestRelatedEntry(nextItem?.activity_history)?.timestamp;

  if (Boolean(nextRequestAt) !== Boolean(currentRequestAt)) {
    return Boolean(nextRequestAt);
  }

  const currentAssignedCount = getAssignedUserIds(currentItem).length;
  const nextAssignedCount = getAssignedUserIds(nextItem).length;
  if (currentAssignedCount !== nextAssignedCount) {
    return nextAssignedCount > currentAssignedCount;
  }

  const currentTime = new Date(
    currentRequestAt ||
      currentItem?.updated_date ||
      currentItem?.created_date ||
      currentItem?.due_date ||
      0
  ).getTime();
  const nextTime = new Date(
    nextRequestAt ||
      nextItem?.updated_date ||
      nextItem?.created_date ||
      nextItem?.due_date ||
      0
  ).getTime();

  return nextTime > currentTime;
};

const createRowFromTemplate = ({
  template,
  rowType,
  tabValue,
  checklistItem,
  documents = [],
  directory,
}) => {
  const sortedDocuments = sortDocumentsByDateDesc(documents);
  const primaryDocument = sortedDocuments[0] || null;
  const uploadedAt = getDocumentDate(primaryDocument);
  const latestRequestRelatedEntry = getLatestRequestRelatedEntry(checklistItem?.activity_history);
  const requestTimestamp = latestRequestRelatedEntry?.timestamp || null;
  const latestPendingReminder = getLatestPendingScheduledReminder(checklistItem?.activity_history);
  const hasOutstandingAssignment = getAssignedUserIds(checklistItem).length > 0;
  const hasActiveRequest =
    Boolean(latestPendingReminder) ||
    hasOutstandingAssignment ||
    Boolean(requestTimestamp) &&
    (!uploadedAt || new Date(requestTimestamp).getTime() > new Date(uploadedAt).getTime());

  return {
    id: `${rowType}-${template.category}-${normalizeText(template.item)}`,
    title: template.item,
    tabValue,
    rowType,
    providerLabel: getRowProviderLabel({ checklistItem, directory }),
    uploadedAt,
    uploadedDateLabel: resolveDateLabel(uploadedAt),
    hasFile: sortedDocuments.length > 0,
    hasActiveRequest,
    document: primaryDocument,
    documents: sortedDocuments,
    fileCount: sortedDocuments.length,
    hasMultipleFiles: sortedDocuments.length > 1,
    template,
    checklistItem,
    checklistItemId: checklistItem?.id || null,
    loanDocumentCategory:
      DOC_CATEGORY_LABEL_TO_VALUE[template.category] ||
      DOC_CATEGORY_LABEL_TO_VALUE[
        tabValue === "post_closing" ? "Post-Closing Document" : "Closing Document"
      ],
  };
};

const createRowFromUploadedDocument = ({ documents = [], directory }) => {
  const sortedDocuments = sortDocumentsByDateDesc(documents);
  const primaryDocument = sortedDocuments[0] || null;
  const uploadedAt = getDocumentDate(primaryDocument);
  const uploaderName = directory[String(primaryDocument?.uploaded_by)] || "Uploaded document";

  return {
    id: `uploaded-${primaryDocument?.id || Math.random()}`,
    title: primaryDocument?.document_name || "Uploaded document",
    tabValue: DOC_VALUE_TO_TAB[primaryDocument?.category] || "all",
    rowType: "uploaded",
    providerLabel: uploaderName,
    uploadedAt,
    uploadedDateLabel: resolveDateLabel(uploadedAt),
    hasFile: sortedDocuments.length > 0,
    hasActiveRequest: false,
    document: primaryDocument,
    documents: sortedDocuments,
    fileCount: sortedDocuments.length,
    hasMultipleFiles: sortedDocuments.length > 1,
    template: null,
    checklistItem: null,
    checklistItemId: primaryDocument?.checklist_item_id || null,
    loanDocumentCategory: primaryDocument?.category,
  };
};

const REQUESTABLE_RECIPIENT_ROLES = new Set(["Borrower", "Loan Officer", "Broker", "Liaison"]);

const buildLinkedUserOptions = (
  loan,
  directory,
  userIdByLinkedId,
  roleByLinkedId,
  activeUserIds
) => {
  const rawIds = [
    ...(loan?.borrower_ids || []),
    ...(loan?.loan_officer_ids || []),
    ...(loan?.broker_id ? [loan.broker_id] : []),
    ...(loan?.liaison_id ? [loan.liaison_id] : []),
  ]
    .filter(Boolean)
    .map(String);

  const deduped = new Map();

  rawIds.forEach((linkedId) => {
    const recipientUserId = String(userIdByLinkedId[linkedId] || linkedId);
    const normalizedRole = normalizeAppRole(roleByLinkedId[linkedId] || roleByLinkedId[recipientUserId] || "");

    if (!REQUESTABLE_RECIPIENT_ROLES.has(normalizedRole)) {
      return;
    }

    if (!activeUserIds.has(recipientUserId)) {
      return;
    }

    const label = directory[linkedId] || directory[recipientUserId] || "Unknown user";

    if (!deduped.has(recipientUserId)) {
      deduped.set(recipientUserId, {
        value: recipientUserId,
        label,
      });
    }
  });

  return [...deduped.values()].sort((a, b) => a.label.localeCompare(b.label));
};

const triggerDocumentDownload = (document) => {
  const url = document?.file_url || document?.document_url || document?.url || document?.fileUrl;

  if (!url) {
    return false;
  }

  const link = window.document.createElement("a");
  link.href = url;
  link.download = document.document_name || "document";
  link.target = "_blank";
  window.document.body.appendChild(link);
  link.click();
  window.document.body.removeChild(link);
  return true;
};

export default function LoanDocumentsTab({ loan, currentUser }) {
  const { toast } = useToast();
  const hiddenFileInputRef = useRef(null);
  const downloadZoneRef = useRef(null);

  const [isLoading, setIsLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [checklistItems, setChecklistItems] = useState([]);
  const [directory, setDirectory] = useState({});
  const [userIdByLinkedId, setUserIdByLinkedId] = useState({});
  const [roleByLinkedId, setRoleByLinkedId] = useState({});
  const [activeUserIds, setActiveUserIds] = useState(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [providerFilter, setProviderFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState("latest");
  const [viewerState, setViewerState] = useState(null);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [pendingUploads, setPendingUploads] = useState([]);
  const [uploadTargetRow, setUploadTargetRow] = useState(null);
  const [isDraggingUpload, setIsDraggingUpload] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [requestRow, setRequestRow] = useState(null);
  const [selectedRecipientId, setSelectedRecipientId] = useState("");
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [activityRow, setActivityRow] = useState(null);
  const [isDownloadMode, setIsDownloadMode] = useState(false);
  const [selectedDownloadDocumentIds, setSelectedDownloadDocumentIds] = useState([]);
  const [expandedRowIds, setExpandedRowIds] = useState([]);

  const loadDirectory = async () => {
    const namesById = {};
    const nextUserIdByLinkedId = {};
    const nextRoleByLinkedId = {};
    const nextActiveUserIds = new Set();

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
      const userId = String(user.id);
      const role = normalizeAppRole(user.app_role || user.role || "");
      const label =
        user.first_name || user.last_name
          ? `${user.first_name || ""} ${user.last_name || ""}`.trim()
          : user.full_name || user.email;

      if (label) {
        namesById[userId] = label;
        nextUserIdByLinkedId[userId] = userId;
      }
      if (role) {
        nextRoleByLinkedId[userId] = role;
      }
      nextActiveUserIds.add(userId);
    });

    borrowers.forEach((borrower) => {
      const borrowerId = String(borrower.id);
      const linkedUserId = borrower.user_id ? String(borrower.user_id) : borrowerId;
      const label =
        borrower.first_name || borrower.last_name
          ? `${borrower.first_name || ""} ${borrower.last_name || ""}`.trim()
          : borrower.name || borrower.email;

      if (label) {
        namesById[borrowerId] = label;
        namesById[linkedUserId] = namesById[linkedUserId] || label;
      }

      nextUserIdByLinkedId[borrowerId] = linkedUserId;
      nextUserIdByLinkedId[linkedUserId] = linkedUserId;
      nextRoleByLinkedId[borrowerId] = "Borrower";
      nextRoleByLinkedId[linkedUserId] = "Borrower";
    });

    loanPartners.forEach((partner) => {
      const partnerId = String(partner.id);
      const linkedUserId = partner.user_id ? String(partner.user_id) : partnerId;
      const role = normalizeAppRole(partner.app_role || partner.type || "");
      const label = partner.name || partner.contact_person || partner.email;

      if (label) {
        namesById[partnerId] = label;
        namesById[linkedUserId] = namesById[linkedUserId] || label;
      }

      nextUserIdByLinkedId[partnerId] = linkedUserId;
      nextUserIdByLinkedId[linkedUserId] = linkedUserId;
      if (role) {
        nextRoleByLinkedId[partnerId] = role;
        nextRoleByLinkedId[linkedUserId] = role;
      }
    });

    return {
      namesById,
      userIdByLinkedId: nextUserIdByLinkedId,
      roleByLinkedId: nextRoleByLinkedId,
      activeUserIds: nextActiveUserIds,
    };
  };

  const buildRows = ({
    checklistItems: allChecklistItems,
    allDocuments,
    directory: nameDirectory,
  }) => {
    const loanTypeFilters = getLoanTypeFilters(loan);
    const checklistByKey = new Map();
    const checklistIdsUsedByTemplate = new Set();
    const templateKeys = new Set();
    const documentsByChecklistId = new Map();
    const documentsByKey = new Map();
    const sortedDocuments = sortDocumentsByDateDesc(allDocuments);

    allChecklistItems.forEach((item) => {
      const key = buildTemplateKey(item.category, item.item_name);
      if (shouldPreferChecklistItem(checklistByKey.get(key), item)) {
        checklistByKey.set(key, item);
      }
    });

    sortedDocuments.forEach((document) => {
      if (document?.checklist_item_id) {
        const checklistDocuments = documentsByChecklistId.get(document.checklist_item_id) || [];
        checklistDocuments.push(document);
        documentsByChecklistId.set(document.checklist_item_id, checklistDocuments);
      }

      const categoryLabel = Object.keys(DOC_CATEGORY_LABEL_TO_VALUE).find(
        (label) => DOC_CATEGORY_LABEL_TO_VALUE[label] === document.category
      );

      if (categoryLabel) {
        const key = buildTemplateKey(categoryLabel, document.document_name);
        const keyedDocuments = documentsByKey.get(key) || [];
        keyedDocuments.push(document);
        documentsByKey.set(key, keyedDocuments);
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
        const documents =
          (checklistItem?.id && documentsByChecklistId.get(checklistItem.id)) ||
          documentsByKey.get(templateKey) ||
          [];

        if (checklistItem?.id) {
          checklistIdsUsedByTemplate.add(checklistItem.id);
        }
        templateKeys.add(templateKey);

        templateRows.push(
          createRowFromTemplate({
            template,
            rowType: "document",
            tabValue,
            checklistItem,
            documents,
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
      const documents =
        (checklistItem?.id && documentsByChecklistId.get(checklistItem.id)) ||
        documentsByKey.get(buildTemplateKey(fallbackCategory, template.item)) ||
        [];

      if (checklistItem?.id) {
        checklistIdsUsedByTemplate.add(checklistItem.id);
      }
      templateKeys.add(templateKey);

      templateRows.push(
        createRowFromTemplate({
          template,
            rowType: "action",
            tabValue,
            checklistItem,
            documents,
            directory: nameDirectory,
          })
        );
    });

    const uploadedOnlyDocumentsByKey = new Map();

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
      const groupedDocuments = uploadedOnlyDocumentsByKey.get(uniquenessKey) || [];
      groupedDocuments.push(document);
      uploadedOnlyDocumentsByKey.set(uniquenessKey, groupedDocuments);
    });

    const uploadedOnlyRows = [...uploadedOnlyDocumentsByKey.values()].map((documents) =>
      createRowFromUploadedDocument({ documents, directory: nameDirectory })
    );

    return [...templateRows, ...uploadedOnlyRows];
  };

  const loadWorkspace = async () => {
    setIsLoading(true);

    try {
      const [allDocuments, allChecklistItems, directoryData] = await Promise.all([
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
        directory: directoryData.namesById,
      });

      setChecklistItems(allChecklistItems);
      setRows(nextRows);
      setDirectory(directoryData.namesById);
      setUserIdByLinkedId(directoryData.userIdByLinkedId);
      setRoleByLinkedId(directoryData.roleByLinkedId);
      setActiveUserIds(directoryData.activeUserIds);
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

  const exitDownloadMode = () => {
    setIsDownloadMode(false);
    setSelectedDownloadDocumentIds([]);
  };

  useEffect(() => {
    if (!isDownloadMode) {
      return undefined;
    }

    const handlePointerDown = (event) => {
      const target = event.target;

      if (
        showUploadDialog ||
        requestRow ||
        activityRow ||
        viewerState ||
        !downloadZoneRef.current ||
        downloadZoneRef.current.contains(target)
      ) {
        return;
      }

      exitDownloadMode();
    };

    document.addEventListener("mousedown", handlePointerDown, true);
    return () => document.removeEventListener("mousedown", handlePointerDown, true);
  }, [activityRow, isDownloadMode, requestRow, showUploadDialog, viewerState]);

  const providerOptions = Array.from(
    new Set(
      rows
        .filter((row) => activeTab === "all" || row.tabValue === activeTab)
        .map((row) => row.providerLabel)
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b));

  let visibleRows = rows.filter((row) => {
    const providerLabel = row.providerLabel || "";
    const matchesTab = activeTab === "all" || row.tabValue === activeTab;
    const matchesSearch =
      !searchTerm ||
      row.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      providerLabel.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesProvider = providerFilter === "all" || providerLabel === providerFilter;

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

  if (isDownloadMode) {
    visibleRows = visibleRows.filter((row) => row.hasFile);
  }

  useEffect(() => {
    if (!isDownloadMode) {
      return;
    }

    const visibleDownloadableIds = new Set(
      visibleRows.flatMap((row) => (row.documents || []).map((document) => document.id))
    );

    setSelectedDownloadDocumentIds((currentIds) => {
      const nextIds = currentIds.filter((documentId) =>
        visibleDownloadableIds.has(documentId)
      );
      if (
        nextIds.length === currentIds.length &&
        nextIds.every((documentId, index) => documentId === currentIds[index])
      ) {
        return currentIds;
      }

      return nextIds;
    });
  }, [isDownloadMode, visibleRows]);

  const linkedUserOptions = buildLinkedUserOptions(
    loan,
    directory,
    userIdByLinkedId,
    roleByLinkedId,
    activeUserIds
  );

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
      assigned_to: [],
      activity_history: [],
    });

    return createdItem?.id || null;
  };

  const createPendingUploads = (files, linkedRow = null) => {
    const defaultCategory =
      linkedRow?.tabValue && linkedRow.tabValue !== "all"
        ? linkedRow.tabValue
        : activeTab === "all"
          ? "borrower"
          : activeTab;

    return files.map((file, index) => ({
      id: `${Date.now()}-${index}-${file.name}`,
      file,
      title: stripFileExtension(file.name),
      category: defaultCategory,
      linkedRowId: linkedRow?.id || "none",
      checklistItemId: linkedRow?.checklistItemId || null,
      comment: "",
    }));
  };

  const appendPendingUploads = (files, linkedRow = null) => {
    if (!files.length) {
      return;
    }

    setPendingUploads((currentUploads) => [
      ...currentUploads,
      ...createPendingUploads(files, linkedRow),
    ]);
  };

  const handleOpenUploadDialog = (linkedRow = null) => {
    setUploadTargetRow(linkedRow);
    setShowUploadDialog(true);
  };

  const handleUploadToRow = (row) => {
    setUploadTargetRow(row);
    hiddenFileInputRef.current?.click();
  };

  const handleFileSelection = (event) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) {
      return;
    }

    appendPendingUploads(files, uploadTargetRow);
    setShowUploadDialog(true);
    setUploadTargetRow(null);
    event.target.value = "";
  };

  const handleUploadDragEnter = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingUpload(true);
  };

  const handleUploadDragLeave = (event) => {
    event.preventDefault();
    event.stopPropagation();

    if (event.currentTarget === event.target) {
      setIsDraggingUpload(false);
    }
  };

  const handleUploadDragOver = (event) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const handleUploadDrop = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingUpload(false);

    const files = Array.from(event.dataTransfer.files || []);
    appendPendingUploads(files);
    setShowUploadDialog(true);
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

  const toggleRowExpansion = (rowId) => {
    setExpandedRowIds((currentRowIds) =>
      currentRowIds.includes(rowId)
        ? currentRowIds.filter((currentRowId) => currentRowId !== rowId)
        : [...currentRowIds, rowId]
    );
  };

  const handleOpenViewer = (row, document = row.document) => {
    if (!document) {
      return;
    }

    setViewerState({
      row,
      document: {
        ...document,
        uploader_name:
          directory[String(document?.uploaded_by)] ||
          document.uploader_name ||
          document.uploaded_by_name ||
          row.providerLabel,
      },
    });
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
        const linkedChecklistItem =
          (checklistItemId && checklistItems.find((item) => item.id === checklistItemId)) ||
          linkedRow?.checklistItem ||
          null;

        const { file_url: fileUrl } = await base44.integrations.Core.UploadFile({
          file: upload.file,
        });

        const initialComments = upload.comment.trim()
          ? [
              {
                id: `comment-${Date.now()}-${upload.id}`,
                text: upload.comment.trim(),
                author: getCurrentUserName(currentUser),
                timestamp: new Date().toISOString(),
              },
            ]
          : [];

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
          comments: initialComments,
        });

        const pendingReminder = getLatestPendingScheduledReminder(
          linkedChecklistItem?.activity_history
        );

        if (checklistItemId && pendingReminder) {
          try {
            await base44.functions.invoke("cancelDocumentRequestFollowup", {
              checklist_item_id: checklistItemId,
              canceled_reason: "linked_document_uploaded",
              canceled_at: new Date().toISOString(),
            });
          } catch (cancelError) {
            console.error("Error canceling scheduled document followup:", cancelError);
          }
        }
      }

      setShowUploadDialog(false);
      setPendingUploads([]);
      setIsDraggingUpload(false);
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

  const handleOpenRequestModal = (row) => {
    const assignedRecipientId = getAssignedUserIds(row.checklistItem)
      .map((id) => String(userIdByLinkedId[id] || id))
      .find((id) => linkedUserOptions.some((option) => option.value === id));

    setRequestRow(row);
    setSelectedRecipientId(assignedRecipientId || linkedUserOptions[0]?.value || "");
  };

  const handleSendRequest = async () => {
    if (!requestRow) {
      return;
    }

    if (!selectedRecipientId) {
      toast({
        variant: "destructive",
        title: "Recipient required",
        description: "Select a recipient before sending the request.",
      });
      return;
    }

    setIsSubmittingRequest(true);

    try {
      const checklistItemId = await ensureChecklistItem(requestRow);
      if (!checklistItemId) {
        throw new Error("This row is not linked to a requestable checklist item.");
      }

      const recipientOption = linkedUserOptions.find((option) => option.value === selectedRecipientId);
      if (!recipientOption) {
        throw new Error(
          "Select a linked borrower, loan officer, broker, or liaison before sending the request."
        );
      }

      const recipientName =
        recipientOption?.label || directory[selectedRecipientId] || "Selected recipient";
      const timestamp = new Date().toISOString();
      const desiredDueAt = addDays(new Date(timestamp), REQUEST_CADENCE_DAYS).toISOString();

      const notificationResult = await base44.functions.invoke("sendDocumentRequestNotification", {
        loan_id: loan.id,
        checklist_item_id: checklistItemId,
        document_title: requestRow.title,
        recipient_user_id: selectedRecipientId,
        desired_due_at: desiredDueAt,
        recipient_name: recipientName,
        mode: "request",
        actor_user_id: currentUser?.id || "",
        actor_user_name: getCurrentUserName(currentUser),
        link_url: `/LoanDetail?id=${loan.id}&tab=documents`,
      });

      const checklistItem =
        checklistItems.find((item) => item.id === checklistItemId) || requestRow.checklistItem;
      const activityHistory = Array.isArray(checklistItem?.activity_history)
        ? [...checklistItem.activity_history]
        : [];

      activityHistory.push({
        type: REQUEST_ACTIVITY_TYPE,
        timestamp,
        user_id: currentUser?.id || "",
        user_name: getCurrentUserName(currentUser),
        label: `Requested ${requestRow.title} from ${recipientName}`,
        recipient_user_id: selectedRecipientId,
        recipient_name: recipientName,
        desired_due_at: desiredDueAt,
        cadence_days: REQUEST_CADENCE_DAYS,
        scheduled_email_id: notificationResult?.scheduled_followup_email_id || null,
        scheduled_for: notificationResult?.scheduled_followup_at || null,
        source: "loan_documents_tab",
      });

      await base44.entities.ChecklistItem.update(checklistItemId, {
        assigned_to: [selectedRecipientId],
        activity_history: activityHistory,
        due_date: desiredDueAt.split("T")[0],
      });

      const updatedChecklistItem = {
        ...(checklistItems.find((item) => item.id === checklistItemId) || requestRow.checklistItem || {}),
        id: checklistItemId,
        assigned_to: [selectedRecipientId],
        activity_history: activityHistory,
        due_date: desiredDueAt.split("T")[0],
      };

      setChecklistItems((currentItems) => {
        const existingIndex = currentItems.findIndex((item) => item.id === checklistItemId);
        if (existingIndex === -1) {
          return [...currentItems, updatedChecklistItem];
        }

        const nextItems = [...currentItems];
        nextItems[existingIndex] = updatedChecklistItem;
        return nextItems;
      });

      setRows((currentRows) =>
        currentRows.map((row) => {
          if (row.id !== requestRow.id) {
            return row;
          }

          return {
            ...row,
            checklistItem: updatedChecklistItem,
            checklistItemId,
            providerLabel: recipientName,
            hasActiveRequest: true,
          };
        })
      );

      setRequestRow(null);
      setSelectedRecipientId("");
      toast({
        title: "Request sent",
        description: `${requestRow.title} was requested from ${recipientName}.`,
      });

      await loadWorkspace();
    } catch (error) {
      console.error("Error requesting document:", error);
      toast({
        variant: "destructive",
        title: "Request failed",
        description: error.message || "The request could not be sent.",
      });
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  const visibleDownloadableDocuments = visibleRows.flatMap((row) =>
    isDownloadMode ? row.documents || [] : row.hasFile && row.document ? [row.document] : []
  );
  const allVisibleDownloadableIds = visibleDownloadableDocuments.map((document) => document.id);
  const allVisibleDownloadableSelected =
    allVisibleDownloadableIds.length > 0 &&
    allVisibleDownloadableIds.every((documentId) =>
      selectedDownloadDocumentIds.includes(documentId)
    );
  const someVisibleDownloadableSelected =
    !allVisibleDownloadableSelected &&
    allVisibleDownloadableIds.some((documentId) =>
      selectedDownloadDocumentIds.includes(documentId)
    );

  const handleToggleAllDownloadable = (checked) => {
    if (checked) {
      setSelectedDownloadDocumentIds(allVisibleDownloadableIds);
      return;
    }

    setSelectedDownloadDocumentIds([]);
  };

  const handleToggleDownloadDocument = (documentId, checked) => {
    setSelectedDownloadDocumentIds((currentIds) =>
      checked
        ? currentIds.includes(documentId)
          ? currentIds
          : [...currentIds, documentId]
        : currentIds.filter((id) => id !== documentId)
    );
  };

  const handleDownloadSelected = () => {
    const selectedDocuments = visibleRows.flatMap((row) =>
      (row.documents || []).filter((document) => selectedDownloadDocumentIds.includes(document.id))
    );

    if (selectedDocuments.length === 0) {
      toast({
        variant: "destructive",
        title: "No files selected",
        description: "Select at least one uploaded document to download.",
      });
      return;
    }

    let downloadedCount = 0;
    selectedDocuments.forEach((document) => {
      if (triggerDocumentDownload(document)) {
        downloadedCount += 1;
      }
    });

    exitDownloadMode();
    toast({
      title: "Download started",
      description: `${downloadedCount} file${downloadedCount === 1 ? "" : "s"} queued for download.`,
    });
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
      <Card>
        <CardHeader className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <CardTitle>Documents</CardTitle>
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
        </CardHeader>

        <CardContent className="space-y-6">
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
                  "flex-1 whitespace-nowrap rounded-lg border px-5 py-2 text-sm  transition-colors",
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

        <div ref={downloadZoneRef} className="space-y-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:gap-6">
            <div className="grid flex-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div className="flex items-center gap-2">
                <Label className="shrink-0 text-base leading-6 tracking-[-0.5px] text-[#171717]">
                  Provider
                </Label>
                <Select value={providerFilter} onValueChange={setProviderFilter}>
                  <SelectTrigger className="h-10 rounded-[8px] border-[#d9d9d9] bg-white px-4 py-2 text-base leading-7 tracking-[-0.5px] text-black shadow-none [&>svg]:h-6 [&>svg]:w-6 [&>svg]:opacity-100">
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

              <div className="flex items-center gap-2">
                <Label className="shrink-0 text-base leading-6 tracking-[-0.5px] text-[#171717]">
                  Uploaded date
                </Label>
                <Select value={sortOrder} onValueChange={setSortOrder}>
                  <SelectTrigger className="h-10 rounded-[8px] border-[#d9d9d9] bg-white px-4 py-2 text-base leading-7 tracking-[-0.5px] text-black shadow-none [&>svg]:h-6 [&>svg]:w-6 [&>svg]:opacity-100">
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

            <div className="flex items-center gap-6 xl:self-stretch">
              <Button
                type="button"
                variant="outline"
                className={cn(
                  "h-10 rounded-[8px] border-0 bg-[#e5e5ea] px-4 py-1 text-black shadow-none hover:bg-[#d9d9df]",
                  isDownloadMode
                    ? "min-w-[220px] justify-between gap-4"
                    : "w-32 justify-center"
                )}
                onClick={isDownloadMode ? handleDownloadSelected : () => setIsDownloadMode(true)}
              >
                <span className="flex items-center gap-2">
                  <Download className="h-6 w-6" />
                  {isDownloadMode ? (
                    <span className="text-base leading-7 tracking-[-0.5px] text-black">
                      Download
                    </span>
                  ) : null}
                </span>
                {isDownloadMode ? (
                  <span className="text-sm text-[#4a4a50]">
                    {selectedDownloadDocumentIds.length} selected
                  </span>
                ) : null}
              </Button>

              <input
                ref={hiddenFileInputRef}
                type="file"
                multiple
                accept={ALLOWED_FILE_TYPES}
                className="hidden"
                onChange={handleFileSelection}
              />
              {!isDownloadMode ? (
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 min-w-[132px] rounded-[8px] border-2 border-[#3463dd] bg-white px-4 py-1 text-base font-normal leading-7 tracking-[-0.5px] text-black shadow-none hover:bg-[#f4f7ff]"
                  onClick={() => handleOpenUploadDialog()}
                >
                  Upload
                  <Upload className="ml-2 h-6 w-6" />
                </Button>
              ) : null}
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-[#e5e5e5] bg-white">
            <div className="overflow-x-auto">
              <table className="min-w-[920px] w-full border-collapse">
                <thead>
                  <tr className="border-b-2 border-[#e5e5e5]">
                    <th className="px-6 py-3 text-left align-middle  text-[#171717]">
                      <div className="flex items-center gap-4">
                        {isDownloadMode ? (
                          <Checkbox
                            checked={
                              allVisibleDownloadableSelected
                                ? true
                                : someVisibleDownloadableSelected
                                  ? "indeterminate"
                                  : false
                            }
                            onCheckedChange={handleToggleAllDownloadable}
                            aria-label="Select all downloadable rows"
                          />
                        ) : null}
                        <span className="text-lg">Title</span>
                      </div>
                    </th>
                    <th className="w-[220px] px-6 py-3 text-left text-base  text-[#171717]">
                      Provider
                    </th>
                    <th className="w-[220px] px-6 py-3 text-left text-base  text-[#171717]">
                      Uploaded date
                    </th>
                    <th className="w-[220px] px-6 py-3 text-left text-base  text-[#171717]">
                      <div className="flex items-center gap-2">
                        <span className="flex-1">Action</span>
                        <ArrowUpDown className="h-4 w-4" />
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((row) => {
                    const isExpanded = isDownloadMode || expandedRowIds.includes(row.id);

                    return (
                      <React.Fragment key={row.id}>
                        <tr
                          className={cn(
                            "border-b border-[#ededed]",
                            isDownloadMode ? "bg-white" : row.hasMultipleFiles && isExpanded ? "bg-[#f4f4f4]" : "bg-white"
                          )}
                        >
                          <td className="px-6 py-4 text-[17px] text-[#171717]">
                            <div className="flex items-center gap-4">
                              {isDownloadMode ? (
                                <span className="h-6 w-6 shrink-0" />
                              ) : null}
                              <span>{row.title}</span>
                            </div>
                          </td>
                          <td
                            className={cn(
                              "px-6 py-4 text-[17px]",
                              row.providerLabel === "Not Assigned"
                                ? "text-[#8e8e93]"
                                : "text-[#171717]"
                            )}
                          >
                            {isDownloadMode && row.hasFile ? row.providerLabel : row.providerLabel}
                          </td>
                          <td
                            className={cn(
                              "px-6 py-4 text-[17px]",
                              row.hasFile ? "text-[#171717]" : "text-[#8e8e93]"
                            )}
                          >
                            {row.uploadedDateLabel}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-4">
                              {isDownloadMode ? (
                                <div className="ml-auto flex h-6 w-6 items-center justify-center">
                                  {row.hasFile ? <ChevronDown className="h-6 w-6" /> : null}
                                </div>
                              ) : row.hasFile ? (
                                row.hasMultipleFiles ? (
                                  <button
                                    type="button"
                                    className="flex w-[160px] items-center justify-between text-left text-base font-normal tracking-[-0.5px] text-[#171717]"
                                    onClick={() => toggleRowExpansion(row.id)}
                                    aria-expanded={isExpanded}
                                    aria-label={`${isExpanded ? "Collapse" : "Expand"} files for ${row.title}`}
                                  >
                                    <span>View files</span>
                                    {isExpanded ? (
                                      <ChevronDown className="h-6 w-6" />
                                    ) : (
                                      <ChevronRight className="h-6 w-6" />
                                    )}
                                  </button>
                                ) : (
                                  <Button
                                    type="button"
                                    className="h-10 w-[160px] rounded-[8px] bg-[#3463dd] text-base font-normal tracking-[-0.5px] text-white hover:bg-[#2850ba]"
                                    onClick={() => handleOpenViewer(row)}
                                  >
                                    View file
                                  </Button>
                                )
                              ) : (
                                <Button
                                  type="button"
                                  variant="outline"
                                  disabled={row.hasActiveRequest || isSubmittingRequest}
                                  className={cn(
                                    "h-10 w-[160px] rounded-[8px] border-2 text-base font-normal tracking-[-0.5px] shadow-none",
                                    row.hasActiveRequest
                                      ? "border-[#d1d1d6] bg-[#e5e5ea] text-black hover:bg-[#e5e5ea] hover:text-black"
                                      : "border-[#3463dd] bg-white text-black hover:bg-slate-50"
                                  )}
                                  onClick={() => handleOpenRequestModal(row)}
                                >
                                  {row.hasActiveRequest ? "Requested" : "Request document"}
                                </Button>
                              )}

                              {!isDownloadMode ? (
                                <div className="flex h-6 w-6 items-center justify-center">
                                  {row.hasActiveRequest && !row.hasFile ? (
                                    <button
                                      type="button"
                                      className="flex h-6 w-6 items-center justify-center rounded-full bg-[#b3261e] text-white"
                                      onClick={() => setActivityRow(row)}
                                      aria-label={`View request activity for ${row.title}`}
                                    >
                                      <Bell className="h-3.5 w-3.5 fill-current" />
                                    </button>
                                  ) : null}
                                </div>
                              ) : null}
                            </div>
                          </td>
                        </tr>

                        {row.hasFile && isExpanded
                          ? row.documents.map((document) => (
                              <tr
                                key={`${row.id}-${document.id}`}
                                className="border-b border-[#e5e5e5] bg-[#f4f4f4] last:border-b-0"
                              >
                                <td className="px-6 py-4 text-[17px] text-[#171717]">
                                  <div className="flex items-center gap-4">
                                    {isDownloadMode ? (
                                      <Checkbox
                                        checked={selectedDownloadDocumentIds.includes(document.id)}
                                        onCheckedChange={(checked) =>
                                          handleToggleDownloadDocument(document.id, Boolean(checked))
                                        }
                                        aria-label={`Select ${document.document_name || row.title} for download`}
                                      />
                                    ) : null}
                                    <span>{document.document_name || row.title}</span>
                                  </div>
                                </td>
                                <td className="px-6 py-4 text-[17px] text-[#8e8e93]" />
                                <td className="px-6 py-4 text-[17px] text-[#171717]">
                                  {resolveDateLabel(getDocumentDate(document))}
                                </td>
                                <td className="px-6 py-4">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    className={cn(
                                      "h-10 w-[160px] rounded-[8px] border-2 border-[#3463dd] text-base font-normal tracking-[-0.5px] text-black shadow-none hover:bg-[#f4f7ff]",
                                      !isDownloadMode && "bg-[#3463dd] text-white hover:bg-[#2850ba] hover:text-white"
                                    )}
                                    onClick={() => handleOpenViewer(row, document)}
                                  >
                                    View file
                                  </Button>
                                </td>
                              </tr>
                            ))
                          : null}
                      </React.Fragment>
                    );
                  })}

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
        </div>
        </CardContent>
      </Card>

      <Dialog
        open={showUploadDialog}
        onOpenChange={(open) => {
          setShowUploadDialog(open);
          if (!open) {
            setIsDraggingUpload(false);
            setUploadTargetRow(null);
          }
        }}
      >
        <DialogContent className="max-h-[calc(100vh-2rem)] max-w-3xl overflow-hidden p-0">
          <div className="flex max-h-[calc(100vh-2rem)] flex-col">
            <div className="shrink-0 px-6 pb-4 pt-6">
              <DialogHeader>
                <DialogTitle>Upload documents</DialogTitle>
                <DialogDescription>
                  Match each file to a document row when possible so the page can keep request state in sync.
                </DialogDescription>
              </DialogHeader>
            </div>

            <div className="flex-1 overflow-y-auto px-6 pb-4">
              <div
                className={cn(
                  "rounded-xl border-2 border-dashed p-6 text-center transition-colors",
                  isDraggingUpload
                    ? "border-[#3463dd] bg-[#f4f7ff]"
                    : "border-slate-300 bg-slate-50"
                )}
                onDragEnter={handleUploadDragEnter}
                onDragLeave={handleUploadDragLeave}
                onDragOver={handleUploadDragOver}
                onDrop={handleUploadDrop}
              >
                <Upload className="mx-auto h-8 w-8 text-[#3463dd]" />
                <p className="mt-3 text-sm text-slate-700">Drag and drop files here</p>
                <p className="mt-1 text-xs text-slate-500">
                  PDF, Word, Excel, and image files are supported.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-4"
                  onClick={() => hiddenFileInputRef.current?.click()}
                >
                  Choose files
                </Button>
              </div>

              <div className="mt-4 space-y-4">
                {pendingUploads.length === 0 ? (
                  <div className="rounded-xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
                    No files selected yet.
                  </div>
                ) : (
                  pendingUploads.map((upload) => (
                    <div key={upload.id} className="rounded-xl border border-slate-200 p-4">
                      <div className="mb-4">
                        <p className=" text-slate-900">{upload.file.name}</p>
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

                        <div className="space-y-2 md:col-span-2">
                          <Label>Comment</Label>
                          <Textarea
                            value={upload.comment}
                            onChange={(event) =>
                              updatePendingUpload(upload.id, "comment", event.target.value)
                            }
                            placeholder="Optional comment for the document viewer sidebar"
                            rows={3}
                          />
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="flex shrink-0 justify-end gap-3 border-t border-slate-200 px-6 py-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowUploadDialog(false);
                  setPendingUploads([]);
                  setIsDraggingUpload(false);
                  setUploadTargetRow(null);
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
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(requestRow)}
        onOpenChange={(open) => {
          if (!open) {
            setRequestRow(null);
            setSelectedRecipientId("");
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Request document</DialogTitle>
            <DialogDescription>
              Choose who should receive the request for {requestRow?.title || "this document"}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Recipient</Label>
              <Select value={selectedRecipientId} onValueChange={setSelectedRecipientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a recipient" />
                </SelectTrigger>
                <SelectContent>
                  {linkedUserOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setRequestRow(null);
                setSelectedRecipientId("");
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSendRequest}
              disabled={isSubmittingRequest || !selectedRecipientId}
            >
              {isSubmittingRequest ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending
                </>
              ) : (
                "Send request"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(activityRow)} onOpenChange={(open) => !open && setActivityRow(null)}>
        <DialogContent className="max-w-[560px] rounded-[4px] px-6 pb-12 pt-8">
          <DialogHeader>
            <DialogTitle className="text-base   text-black">
              Request document activity
            </DialogTitle>
          </DialogHeader>

          {activityRow ? (
            <div className="space-y-6">
              {(() => {
                const summary = getRequestActivitySummary(activityRow);
                return (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-base  text-black">
                        First document followup date
                      </span>
                      <span className="text-right text-base  text-black">
                        {summary.firstRequestedAt
                          ? resolveDateLabel(summary.firstRequestedAt)
                          : "Not available"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex flex-col items-start justify-center">
                        <span className="text-base  text-black">
                          Desired due date
                        </span>
                        {summary.overdue ? (
                          <span className="text-xs  text-[#b3261e]">
                            Due date is past
                          </span>
                        ) : null}
                      </div>
                      <span className="text-right text-base  text-black">
                        {summary.desiredDueAt
                          ? resolveDateLabel(summary.desiredDueAt)
                          : "Not available"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex flex-col items-start justify-center">
                        <span className="text-base  text-black">
                          Last document followup date
                        </span>
                        <span className="text-xs  text-black">
                          Reminder sent every 2 days
                        </span>
                      </div>
                      <span className="text-right text-base  text-black">
                        {summary.lastFollowupAt
                          ? resolveDateLabel(summary.lastFollowupAt)
                          : "Not sent yet"}
                      </span>
                    </div>
                  </div>
                );
              })()}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <DocumentViewer
        isOpen={Boolean(viewerState)}
        onClose={() => setViewerState(null)}
        document={viewerState?.document || null}
        documentRow={viewerState?.row || null}
        currentUser={currentUser}
        onUpdate={loadWorkspace}
        onUploadAdditional={(row) => {
          setViewerState(null);
          handleUploadToRow(row);
        }}
      />
    </>
  );
}
