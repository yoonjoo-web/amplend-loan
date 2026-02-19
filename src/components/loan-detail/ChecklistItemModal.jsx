import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Upload, Trash2, FileText, Send, Loader2, Download, Clock, Mail } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/components/ui/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const providerOptions = [
  "Borrower",
  "Amplend",
  "Title Company",
  "Appraiser",
  "Inspector",
  "Attorney",
  "Third Party"
];

export default function ChecklistItemModal({ isOpen, onClose, item, loanId, loan, assignableUsersList, allUsersList, teamDirectory, currentUser, canManage }) {
  console.log('[ChecklistModal] Props received:', {
    isOpen,
    loanId,
    assignableUsersCount: assignableUsersList?.length,
    allUsersCount: allUsersList?.length,
    currentUser: currentUser?.email,
    hasLoan: !!loan
  });
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    status: 'not_started',
    due_date: '',
    assigned_to: [],
    notes: [],
    uploaded_files: [],
    provider: '',
    activity_history: [],
    first_review_completed_by: null,
    first_review_completed_date: null,
    second_review_completed_by: null,
    second_review_completed_date: null
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [mentionStartPos, setMentionStartPos] = useState(null);
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
  const [firstReviewChecked, setFirstReviewChecked] = useState(false);
  const [secondReviewChecked, setSecondReviewChecked] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showLOEDialog, setShowLOEDialog] = useState(false);
  const [isRequestingLOE, setIsRequestingLOE] = useState(false);
  const textareaRef = useRef(null);

  useEffect(() => {
    console.log('[ChecklistModal] useEffect triggered', { 
      isOpen, 
      itemId: item?.id,
      itemTimestamp: item?.updated_date,
      isUploading 
    });
    if (isOpen && item && !isUploading) {
      console.log('[ChecklistModal] Initializing form data (not during upload)');
      setFormData({
        id: item.id,
        item_name: item.item_name || '',
        description: item.description || '',
        category: item.category || '',
        status: item.status || (item.checklist_type === 'action_item' ? 'not_started' : 'pending'),
        due_date: item.due_date || '',
        assigned_to: Array.isArray(item.assigned_to) ? item.assigned_to : [],
        provider: item.provider || '',
        notes: Array.isArray(item.notes) ? item.notes : [],
        uploaded_files: Array.isArray(item.uploaded_files) ? item.uploaded_files : [],
        activity_history: Array.isArray(item.activity_history) ? item.activity_history : [],
        template_url: item.template_url || '',
        first_review_completed_by: item.first_review_completed_by || null,
        first_review_completed_date: item.first_review_completed_date || null,
        second_review_completed_by: item.second_review_completed_by || null,
        second_review_completed_date: item.second_review_completed_date || null
      });
      setFirstReviewChecked(!!item.first_review_completed_by);
      setSecondReviewChecked(!!item.second_review_completed_by);
      setHasChanges(false);
      setNewComment('');
    } else if (isUploading) {
      console.log('[ChecklistModal] Skipping form reset during upload');
    }
  }, [isOpen, item?.id]);

  const handleCommentChange = (e) => {
    const text = e.target.value;
    setNewComment(text);

    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = text.substring(0, cursorPos);
    const lastAtSymbol = textBeforeCursor.lastIndexOf('@');

    if (lastAtSymbol !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtSymbol + 1);
      if (!textAfterAt.includes(' ') && textAfterAt.length >= 0) {
        setMentionSearch(textAfterAt);
        setMentionStartPos(lastAtSymbol);
        setShowMentionDropdown(true);
        setSelectedMentionIndex(0);
      } else {
        setShowMentionDropdown(false);
      }
    } else {
      setShowMentionDropdown(false);
    }
  };

  const filteredMentionUsers = React.useMemo(() => {
    console.log('[Mentions] Computing filtered users', {
      allUsersCount: allUsersList?.length,
      currentUser: currentUser?.email,
      currentUserRole: currentUser?.app_role,
      loanId: loan?.id,
      mentionSearch
    });

    if (!allUsersList || !currentUser) {
      console.log('[Mentions] Missing allUsersList or currentUser');
      return [];
    }

    const isAdminOrLO = currentUser.app_role === 'Administrator' || currentUser.app_role === 'Loan Officer';
    console.log('[Mentions] User is admin or LO:', isAdminOrLO);
    
    // Get team member IDs from loan
    const teamMemberIds = new Set([
      ...(loan?.borrower_ids || []),
      ...(loan?.loan_officer_ids || []),
      ...(loan?.referrer_ids || [])
    ]);
    console.log('[Mentions] Team member IDs:', Array.from(teamMemberIds));
    console.log('[Mentions] Sample users from allUsersList:', allUsersList.slice(0, 3).map(u => ({ 
      id: u.id, 
      name: `${u.first_name} ${u.last_name}`,
      app_role: u.app_role 
    })));

    // Filter mentionable users
    const mentionableUsers = allUsersList.filter(u => {
      if (isAdminOrLO) {
        // Admins and LOs can mention all team members + all loan officers
        const isTeamMember = teamMemberIds.has(u.id);
        const isLoanOfficer = u.app_role === 'Loan Officer';
        const canMention = isTeamMember || isLoanOfficer;
        if (canMention) {
          console.log('[Mentions] Can mention user:', { id: u.id, name: `${u.first_name} ${u.last_name}`, isTeamMember, isLoanOfficer });
        }
        return canMention;
      } else {
        // Other users can only mention team members
        const canMention = teamMemberIds.has(u.id);
        if (canMention) {
          console.log('[Mentions] Can mention user:', { id: u.id, name: `${u.first_name} ${u.last_name}`, isTeamMember: true });
        }
        return canMention;
      }
    });
    console.log('[Mentions] Mentionable users count:', mentionableUsers.length);

    // Apply search filter
    const filtered = mentionableUsers.filter(u => {
      const fullName = `${u.first_name || ''} ${u.last_name || ''}`.toLowerCase();
      const email = (u.email || '').toLowerCase();
      const search = mentionSearch.toLowerCase();
      return fullName.includes(search) || email.includes(search);
    });
    console.log('[Mentions] After search filter:', filtered.length);
    
    return filtered;
  }, [allUsersList, currentUser, loan, mentionSearch]);

  const handleSelectMention = (user) => {
    const beforeMention = newComment.substring(0, mentionStartPos);
    const afterMention = newComment.substring(textareaRef.current.selectionStart);
    const mentionText = `@${user.first_name} ${user.last_name} `;
    const newText = beforeMention + mentionText + afterMention;
    
    setNewComment(newText);
    setShowMentionDropdown(false);
    setMentionSearch('');
    
    setTimeout(() => {
      if (textareaRef.current) {
        const newCursorPos = (beforeMention + mentionText).length;
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  };

  const handleKeyDown = (e) => {
    if (showMentionDropdown && filteredMentionUsers.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedMentionIndex((prev) => 
          prev < filteredMentionUsers.length - 1 ? prev + 1 : 0
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedMentionIndex((prev) => 
          prev > 0 ? prev - 1 : filteredMentionUsers.length - 1
        );
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        handleSelectMention(filteredMentionUsers[selectedMentionIndex]);
      } else if (e.key === 'Escape') {
        setShowMentionDropdown(false);
      }
    }
  };

  const extractMentions = (text) => {
    const mentions = new Set();
    const mentionRegex = /@([A-Za-zÀ-ÖØ-öø-ÿ'\-]+)\s+([A-Za-zÀ-ÖØ-öø-ÿ'\-]+)/g;
    let match;
    
    while ((match = mentionRegex.exec(text)) !== null) {
      const firstName = match[1];
      const lastName = match[2];
      const fullName = `${firstName} ${lastName}`.trim().toLowerCase();
      
      const matchedUser = (allUsersList || []).find(u => {
        const userName = `${u.first_name || ''} ${u.last_name || ''}`.trim().toLowerCase();
        return userName === fullName;
      });
      
      if (matchedUser) {
        mentions.add(matchedUser.id);
      }
    }
    return Array.from(mentions);
  };

  const addActivity = (action, details) => {
    const activity = {
      timestamp: new Date().toISOString(),
      user_id: currentUser.id,
      user_name: `${currentUser.first_name} ${currentUser.last_name}`,
      action,
      details
    };
    return [...(formData.activity_history || []), activity];
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !currentUser) return;

    const mentions = extractMentions(newComment);

    const comment = {
      id: Date.now().toString(),
      text: newComment.trim(),
      author: currentUser.id,
      author_name: `${currentUser.first_name} ${currentUser.last_name}`,
      mentions: mentions,
      timestamp: new Date().toISOString()
    };

    const updatedComments = [...(formData.notes || []), comment];
    const updatedHistory = addActivity('comment_added', `Added a comment`);
    
    setFormData(prev => ({ ...prev, notes: updatedComments, activity_history: updatedHistory }));
    setNewComment('');
    setHasChanges(true);
    
    toast({
      title: "Comment Added",
      description: mentions.length > 0 
        ? `Your comment has been added and ${mentions.length} user(s) were mentioned.`
        : "Your comment has been added successfully.",
    });
  };

  const handleDeleteComment = async (commentId) => {
    if (!confirm('Are you sure you want to delete this comment?')) return;

    const updatedComments = formData.notes.filter(note => note.id !== commentId);
    const updatedHistory = addActivity('comment_deleted', `Deleted a comment`);
    
    setFormData(prev => ({ ...prev, notes: updatedComments, activity_history: updatedHistory }));
    setHasChanges(true);
    
    toast({
      title: "Comment Deleted",
      description: "The comment has been removed successfully.",
    });
  };

  const handleFileUpload = async (files) => {
    console.log('[ChecklistModal] handleFileUpload START', { filesCount: files?.length });
    if (!files || files.length === 0) return;

    setIsUploading(true);
    console.log('[ChecklistModal] setIsUploading(true)');
    try {
      const uploadedFilesData = [];
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        
        uploadedFilesData.push({
          file_url,
          file_name: file.name,
          uploaded_by: currentUser.id,
          uploaded_date: new Date().toISOString()
        });

        // Map ChecklistItem category to LoanDocument category
        const categoryMap = {
          'Borrower Document': 'borrower_document',
          'Property Document': 'property_document',
          'Closing Document': 'closing_document',
          'Post-Closing Document': 'post_closing_document'
        };
        const category = categoryMap[formData.category] || categoryMap[item.category] || 'application';
        await base44.entities.LoanDocument.create({
          loan_id: loanId,
          document_name: file.name,
          file_url: file_url,
          category: category,
          status: formData.status || item.status || 'pending',
          uploaded_by: currentUser.id,
          uploaded_date: new Date().toISOString(),
          notes: `Uploaded from checklist item: ${formData.item_name || item.item_name}`,
          checklist_item_id: item.id
        });
      }

      const updatedFiles = [...(formData.uploaded_files || []), ...uploadedFilesData];
      const updatedHistory = addActivity('file_uploaded', `Uploaded ${files.length} file(s)`);
      
      setFormData(prev => ({ ...prev, uploaded_files: updatedFiles, activity_history: updatedHistory }));
      setHasChanges(true);
      
      console.log('[ChecklistModal] Files uploaded successfully, modal should stay open');
      toast({
        title: "Files Uploaded",
        description: `${files.length} file(s) uploaded successfully. Click Save to apply changes.`,
      });
    } catch (error) {
      console.error('[ChecklistModal] Error uploading files:', error);
      toast({
        variant: "destructive",
        title: "Upload Failed",
        description: "Failed to upload files. Please try again.",
      });
    }
    console.log('[ChecklistModal] setIsUploading(false)');
    setIsUploading(false);
    console.log('[ChecklistModal] handleFileUpload END - modal should remain open');
  };

  const handleFileInputChange = async (event) => {
    const files = event.target.files;
    await handleFileUpload(files);
    event.target.value = '';
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget === e.target) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e) => {
    console.log('[ChecklistModal] handleDrop triggered');
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    console.log('[ChecklistModal] Files dropped, calling handleFileUpload');
    await handleFileUpload(files);
    console.log('[ChecklistModal] handleDrop END');
  };

  const handleRemoveFile = async (index) => {
    if (!confirm('Are you sure you want to remove this file?')) return;

    try {
      const fileToRemove = formData.uploaded_files[index];
      const updatedFiles = formData.uploaded_files.filter((_, i) => i !== index);
      const updatedHistory = addActivity('file_removed', `Removed file: ${fileToRemove.file_name}`);
      
      const documents = await base44.entities.LoanDocument.filter({ 
        loan_id: loanId, 
        checklist_item_id: item.id,
        file_url: fileToRemove.file_url
      });
      
      for (const doc of documents) {
        await base44.entities.LoanDocument.delete(doc.id);
      }

      await base44.entities.ChecklistItem.update(item.id, {
        uploaded_files: updatedFiles,
        activity_history: updatedHistory
      });

      setFormData(prev => ({ ...prev, uploaded_files: updatedFiles, activity_history: updatedHistory }));
      setHasChanges(false);

      if (window.refreshLoanDocuments) {
        window.refreshLoanDocuments();
      }

      toast({
        title: "File Removed",
        description: "The file has been removed successfully.",
      });
    } catch (error) {
      console.error("Error removing file:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to remove file. Please try again.",
      });
    }
  };

  const getStatusDisplayName = (status) => {
    const statusNames = {
      not_started: 'Not Started',
      in_progress: 'In Progress',
      on_hold: 'On Hold',
      flagged: 'Flagged',
      completed: 'Completed',
      pending: 'Pending',
      submitted: 'Submitted',
      under_review: 'Under Review',
      first_review_done: '1st Review Done',
      second_review_done: '2nd Review Done',
      approved: 'Approved',
      rejected: 'Rejected',
      approved_with_condition: 'Approved with Condition',
      letter_of_explanation_requested: 'Letter of Explanation Requested'
    };
    return statusNames[status] || status;
  };

  const handleRequestLOE = async () => {
    setIsRequestingLOE(true);
    try {
      // Get all borrowers from the loan
      const borrowerIds = loan?.borrower_ids || [];
      
      if (borrowerIds.length === 0) {
        toast({
          variant: "destructive",
          title: "No Borrowers Found",
          description: "There are no borrowers assigned to this loan.",
        });
        setIsRequestingLOE(false);
        return;
      }

      // Update checklist item status
      const statusDisplayName = getStatusDisplayName('letter_of_explanation_requested');
      const updatedHistory = addActivity('loe_requested', `Requested letter of explanation from borrower(s)`);
      await base44.entities.ChecklistItem.update(item.id, { 
        status: 'letter_of_explanation_requested', 
        activity_history: updatedHistory 
      });
      setFormData(prev => ({ ...prev, status: 'letter_of_explanation_requested', activity_history: updatedHistory }));
      
      // Update related documents
      const documents = await base44.entities.LoanDocument.filter({ 
        loan_id: loanId, 
        checklist_item_id: item.id 
      });
      
      for (const doc of documents) {
        await base44.entities.LoanDocument.update(doc.id, { status: 'letter_of_explanation_requested' });
      }

      if (window.refreshLoanDocuments) {
        window.refreshLoanDocuments();
      }

      // Send notifications to all borrowers
      await base44.functions.invoke('createNotification', {
        user_ids: borrowerIds,
        message: `A letter of explanation has been requested for: ${formData.item_name || item.item_name}`,
        type: 'document_update',
        entity_type: 'ChecklistItem',
        entity_id: item.id,
        link_url: `/LoanDetail?id=${loanId}&openTask=${item.id}`,
        priority: 'high'
      });

      // Send emails to all borrowers
      const borrowerUsers = (allUsersList || []).filter(u => borrowerIds.includes(u.id));
      for (const borrower of borrowerUsers) {
        if (borrower.email) {
          try {
            await base44.integrations.Core.SendEmail({
              to: borrower.email,
              subject: `Letter of Explanation Requested - Loan #${loan?.loan_number || loanId}`,
              body: `Dear ${borrower.first_name || 'Borrower'},

A letter of explanation has been requested for the following item:

Document: ${formData.item_name || item.item_name}
Loan Number: ${loan?.loan_number || loanId}

Please log in to your account to provide the requested explanation.

Best regards,
Amplend Team`
            });
          } catch (emailError) {
            console.error('Error sending email to borrower:', emailError);
          }
        }
      }
      
      toast({
        title: "Letter of Explanation Requested",
        description: `All borrowers have been notified via email and in-app notification.`,
      });

      setShowLOEDialog(false);
    } catch (error) {
      console.error('Error requesting letter of explanation:', error);
      toast({
        variant: "destructive",
        title: "Request Failed",
        description: "Failed to request letter of explanation. Please try again.",
      });
    }
    setIsRequestingLOE(false);
  };

  const handleStatusChange = async (newStatus) => {
    try {
      const statusDisplayName = getStatusDisplayName(newStatus);
      const updatedHistory = addActivity('status_changed', `Changed status to '${statusDisplayName}'`);
      await base44.entities.ChecklistItem.update(item.id, { status: newStatus, activity_history: updatedHistory });
      setFormData(prev => ({ ...prev, status: newStatus, activity_history: updatedHistory }));
      
      const documents = await base44.entities.LoanDocument.filter({ 
        loan_id: loanId, 
        checklist_item_id: item.id 
      });
      
      for (const doc of documents) {
        await base44.entities.LoanDocument.update(doc.id, { status: newStatus });
      }

      if (window.refreshLoanDocuments) {
        window.refreshLoanDocuments();
      }
      
      toast({
        title: "Status Updated",
        description: "Status updated for checklist item and related documents.",
      });
    } catch (error) {
      console.error('Error updating status:', error);
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: "Failed to update status. Please try again.",
      });
    }
  };

  const handleFirstReviewChange = async (checked) => {
    setFirstReviewChecked(checked);
    
    const updates = {
      first_review_completed_by: checked ? currentUser.id : null,
      first_review_completed_date: checked ? new Date().toISOString() : null,
      status: checked ? 'first_review_done' : formData.status
    };
    
    const updatedHistory = addActivity(
      checked ? 'first_review_completed' : 'first_review_unchecked',
      checked ? 'Completed first underwriting review' : 'Unchecked first review'
    );
    
    setFormData(prev => ({ ...prev, ...updates, activity_history: updatedHistory }));
    setHasChanges(true);
  };

  const handleSecondReviewChange = async (checked) => {
    setSecondReviewChecked(checked);
    
    const updates = {
      second_review_completed_by: checked ? currentUser.id : null,
      second_review_completed_date: checked ? new Date().toISOString() : null,
      status: checked ? 'second_review_done' : formData.status
    };
    
    const updatedHistory = addActivity(
      checked ? 'second_review_completed' : 'second_review_unchecked',
      checked ? 'Completed second underwriting review' : 'Unchecked second review'
    );
    
    setFormData(prev => ({ ...prev, ...updates, activity_history: updatedHistory }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const oldAssignedIds = item?.assigned_to || [];
      const newAssignedIds = formData.assigned_to || [];
      const newlyAssignedIds = newAssignedIds.filter(id => !oldAssignedIds.includes(id));
      
      const fieldsToSave = {
        due_date: formData.due_date,
        assigned_to: formData.assigned_to,
        provider: formData.provider,
        notes: formData.notes,
        status: formData.status,
        first_review_completed_by: formData.first_review_completed_by,
        first_review_completed_date: formData.first_review_completed_date,
        second_review_completed_by: formData.second_review_completed_by,
        second_review_completed_date: formData.second_review_completed_date,
        activity_history: formData.activity_history
      };
      await base44.entities.ChecklistItem.update(item.id, fieldsToSave);
      
      setHasChanges(false);
      
      if (newlyAssignedIds.length > 0) {
        try {
          await base44.functions.invoke('createNotification', {
            user_ids: newlyAssignedIds,
            message: `You have been assigned to task: ${formData.item_name || item.item_name}`,
            type: 'task_assigned',
            entity_type: 'ChecklistItem',
            entity_id: item.id,
            link_url: `/LoanDetail?id=${loanId}&openTask=${item.id}`,
            priority: 'normal'
          });
        } catch (notifError) {
          console.error('Error creating task assignment notification:', notifError);
        }
      }
      
      toast({
        title: "Changes Saved",
        description: "Checklist item has been updated successfully.",
      });
      
      onClose();
    } catch (error) {
      console.error('Error saving checklist item:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save checklist item. Please try again.",
      });
    }
    setIsSaving(false);
  };

  const getUserName = (userId) => {
    if (teamDirectory && userId && teamDirectory[userId]) {
      return teamDirectory[userId];
    }
    const user = (allUsersList || []).find(u => u.id === userId);
    if (user) {
      return user.first_name && user.last_name
        ? `${user.first_name} ${user.last_name}`
        : user.full_name || user.email || 'Unknown User';
    }
    return 'Unknown User';
  };

  const getCommentAuthorName = (note) => {
    const rawAuthorName = (note?.author_name || '').trim();
    const isUnknownAuthor = rawAuthorName.length === 0 || rawAuthorName.toLowerCase() === 'unknown user';
    if (!isUnknownAuthor) return rawAuthorName;
    return getUserName(note?.author);
  };

  const renderCommentText = (text) => {
    const parts = [];
    let lastIndex = 0;
    const mentionRegex = /@([A-Za-zÀ-ÖØ-öø-ÿ'\-]+)\s+([A-Za-zÀ-ÖØ-öø-ÿ'\-]+)/g;

    let match;
    while ((match = mentionRegex.exec(text)) !== null) {
      const mentionStart = match.index;
      const mentionEnd = match.index + match[0].length;
      const mentionedName = match[0].substring(1).trim().toLowerCase();

      if (mentionStart > lastIndex) {
        parts.push(<span key={`text-${lastIndex}`}>{text.substring(lastIndex, mentionStart)}</span>);
      }

      const matchedUser = (allUsersList || []).find(u =>
        `${u.first_name || ''} ${u.last_name || ''}`.trim().toLowerCase() === mentionedName
      );

      if (matchedUser) {
        parts.push(
          <span key={`mention-${mentionStart}`} className="bg-blue-100 text-blue-800 px-1 rounded font-medium">
            {match[0]}
          </span>
        );
      } else {
        parts.push(<span key={`text-${mentionStart}`}>{match[0]}</span>);
      }
      lastIndex = mentionEnd;
    }

    if (lastIndex < text.length) {
      parts.push(<span key={`text-${lastIndex}`}>{text.substring(lastIndex)}</span>);
    }
    
    return parts;
  };

  const handleFieldChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  if (!isOpen || !item) {
    console.log('[ChecklistModal] Not rendering - isOpen:', isOpen, 'item:', !!item);
    return null;
  }

  console.log('[ChecklistModal] Rendering modal', { isOpen, itemId: item.id, isUploading });
  return (
    <Dialog 
      open={isOpen} 
      onOpenChange={(open) => {
        console.log('[ChecklistModal] Dialog onOpenChange called', { open });
        if (!open) {
          console.log('[ChecklistModal] Dialog closing, calling onClose');
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader className="pb-3">
          <DialogTitle className="text-lg font-bold">{formData.item_name || 'Checklist Item'}</DialogTitle>
          <div className="flex items-center gap-2 pt-1">
            {formData.category && (
              <Badge variant="outline" className="text-xs">
                {formData.category}
              </Badge>
            )}
            {item?.checklist_type === 'action_item' && (
              <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                Action Item
              </Badge>
            )}
            {item?.checklist_type === 'document' && (
              <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
                Document
              </Badge>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Status and Due Date Row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Status</Label>
              <Select
                value={formData.status}
                onValueChange={handleStatusChange}
                disabled={!canManage}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {item?.checklist_type === 'action_item' ? (
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
                      <SelectItem value="letter_of_explanation_requested">Letter of Explanation Requested</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Due Date</Label>
              <Input
                type="date"
                value={formData.due_date || ''}
                onChange={(e) => handleFieldChange('due_date', e.target.value)}
                disabled={!canManage}
                className="h-9"
              />
            </div>
          </div>

          {/* Description/Title Suggestion - Only for action items */}
          {item?.checklist_type === 'action_item' && (
            <div className="space-y-1.5">
              <Label className="text-xs">Description/Title Suggestion</Label>
              <Textarea
                value={formData.description || ''}
                onChange={(e) => handleFieldChange('description', e.target.value)}
                placeholder="leave suggestions"
                rows={2}
                className="text-xs resize-none"
              />
            </div>
          )}

          {/* Assigned To and Provider Row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Assigned To</Label>
              <Select
                value={formData.assigned_to && formData.assigned_to.length > 0 ? formData.assigned_to[0] : ''}
                onValueChange={(value) => handleFieldChange('assigned_to', value ? [value] : [])}
                disabled={!canManage}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select assignee..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>Unassigned</SelectItem>
                  {(assignableUsersList || []).map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.first_name && user.last_name 
                        ? `${user.first_name} ${user.last_name}`
                        : user.full_name || user.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {item?.checklist_type === 'document' && (
              <div className="space-y-1.5">
                <Label className="text-xs">Provider</Label>
                <Select
                  value={formData.provider || ''}
                  onValueChange={(value) => handleFieldChange('provider', value)}
                  disabled={!canManage}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select provider..." />
                  </SelectTrigger>
                  <SelectContent>
                    {providerOptions.map((provider) => (
                      <SelectItem key={provider} value={provider}>
                        {provider}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Request Letter of Explanation - Only for document checklist items */}
          {item?.checklist_type === 'document' && canManage && (
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowLOEDialog(true)}
                className="h-8 text-xs gap-2"
              >
                <Mail className="w-3.5 h-3.5" />
                Request Letter of Explanation
              </Button>
            </div>
          )}

          {/* Underwriting Reviews - Only for document checklist items */}
          {item?.checklist_type === 'document' && canManage && (
            <Card className="bg-slate-50 border-slate-200">
              <CardContent className="p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="first-review"
                      checked={firstReviewChecked}
                      onCheckedChange={handleFirstReviewChange}
                    />
                    <Label htmlFor="first-review" className="text-xs font-medium cursor-pointer">
                      1st Underwriting Review Complete
                    </Label>
                  </div>
                  {formData.first_review_completed_by && (
                    <div className="text-xs text-slate-600">
                      {getUserName(formData.first_review_completed_by)} • {format(new Date(formData.first_review_completed_date), 'MMM d')}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="second-review"
                      checked={secondReviewChecked}
                      onCheckedChange={handleSecondReviewChange}
                      disabled={!firstReviewChecked}
                    />
                    <Label htmlFor="second-review" className="text-xs font-medium cursor-pointer">
                      2nd Underwriting Review Complete
                    </Label>
                  </div>
                  {formData.second_review_completed_by && (
                    <div className="text-xs text-slate-600">
                      {getUserName(formData.second_review_completed_by)} • {format(new Date(formData.second_review_completed_date), 'MMM d')}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          <Separator />

          {/* Uploaded Files */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">Uploaded Files</Label>
              {canManage && (
                <div>
                  <input
                    type="file"
                    id="file-upload"
                    className="hidden"
                    onChange={handleFileInputChange}
                    disabled={isUploading}
                    multiple
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => document.getElementById('file-upload').click()}
                    disabled={isUploading}
                    className="h-7 text-xs"
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="w-3 h-3 mr-1" />
                        Upload
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>

            <div 
              className={`relative ${canManage ? 'border-2 border-dashed rounded-lg transition-colors' : ''} ${
                isDragging ? 'border-blue-400 bg-blue-50' : 'border-slate-200'
              }`}
              onDragEnter={canManage ? handleDragEnter : undefined}
              onDragLeave={canManage ? handleDragLeave : undefined}
              onDragOver={canManage ? handleDragOver : undefined}
              onDrop={canManage ? handleDrop : undefined}
            >
              {isDragging && canManage && (
                <div className="absolute inset-0 bg-blue-50 bg-opacity-90 rounded-lg z-10 flex items-center justify-center">
                  <div className="text-center">
                    <Upload className="w-8 h-8 mx-auto mb-1 text-blue-600" />
                    <p className="text-xs font-semibold text-blue-600">Drop files here</p>
                  </div>
                </div>
              )}

              {formData.uploaded_files && formData.uploaded_files.length > 0 ? (
                <div className="space-y-1.5 p-2">
                  {formData.uploaded_files.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-slate-50 rounded">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <FileText className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{file.file_name}</p>
                          <p className="text-xs text-slate-500">
                            {file.uploaded_date ? format(new Date(file.uploaded_date), 'MMM d, yyyy') : 'recently'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open(file.file_url, '_blank')}
                          className="h-6 w-6 p-0"
                        >
                          <Download className="w-3 h-3" />
                        </Button>
                        {canManage && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveFile(index)}
                            className="h-6 w-6 p-0"
                          >
                            <Trash2 className="w-3 h-3 text-red-500" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 text-center py-6 bg-slate-50 rounded">
                  {canManage ? 'No files uploaded yet • Drag and drop files here' : 'No files uploaded yet'}
                </p>
              )}
            </div>
          </div>

          <Separator />

          {/* Comments */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Comments</Label>

            <div className="space-y-2 max-h-48 overflow-y-auto">
              {formData.notes && formData.notes.length > 0 ? (
                formData.notes.map((note) => (
                  <div key={note.id} className="bg-slate-50 p-2 rounded">
                    <div className="flex items-start justify-between mb-1">
                      <p className="font-semibold text-xs">{getCommentAuthorName(note)}</p>
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-slate-500">
                          {format(new Date(note.timestamp), 'MMM d, h:mm a')}
                        </p>
                        {canManage && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteComment(note.id)}
                            className="h-5 w-5 p-0"
                          >
                            <Trash2 className="w-3 h-3 text-red-500" />
                          </Button>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-slate-700 whitespace-pre-wrap">{renderCommentText(note.text)}</p>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-500 text-center py-3">No comments yet</p>
              )}
            </div>

            <div className="space-y-1.5 relative">
              <Textarea
                ref={textareaRef}
                value={newComment}
                onChange={handleCommentChange}
                onKeyDown={handleKeyDown}
                placeholder="Add a comment... (Use @ to mention someone)"
                rows={2}
                className="text-xs resize-none"
              />
              
              {showMentionDropdown && filteredMentionUsers.length > 0 && (
                <div className="absolute bottom-full left-0 mb-1 w-56 bg-white border border-slate-200 rounded shadow-lg z-50 max-h-40 overflow-y-auto">
                  {filteredMentionUsers.map((user, index) => (
                    <div
                      key={user.id}
                      className={`p-1.5 cursor-pointer hover:bg-slate-100 ${index === selectedMentionIndex ? 'bg-slate-100' : ''}`}
                      onClick={() => handleSelectMention(user)}
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-xs font-semibold text-blue-700">
                          {user.first_name?.[0]}{user.last_name?.[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{user.first_name} {user.last_name}</p>
                          <p className="text-xs text-slate-500 truncate">{user.email}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <Button
                onClick={handleAddComment}
                disabled={!newComment.trim()}
                size="sm"
                className="w-full h-7 text-xs"
              >
                <Send className="w-3 h-3 mr-1.5" />
                Add Comment
              </Button>
            </div>
          </div>

          <Separator />

          {/* Activity History */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Activity History</Label>
            <div className="max-h-40 overflow-y-auto space-y-1.5">
              {formData.activity_history && formData.activity_history.length > 0 ? (
                formData.activity_history.slice().reverse().map((activity, index) => (
                  <div key={index} className="flex items-start gap-2 text-xs text-slate-600 p-2 bg-slate-50 rounded">
                    <Clock className="w-3 h-3 flex-shrink-0 mt-0.5 text-slate-400" />
                    <div className="flex-1 min-w-0">
                      <span className="font-medium">{activity.user_name}</span>
                      <span className="text-slate-500"> {activity.action.replace(/_/g, ' ')}</span>
                      {activity.details && <span className="text-slate-500"> - {activity.details}</span>}
                      <p className="text-xs text-slate-400 mt-0.5">
                        {format(new Date(activity.timestamp), 'MMM d, yyyy h:mm a')}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-500 text-center py-3">No activity yet</p>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex justify-end gap-2 pt-3 border-t">
          <Button variant="outline" onClick={onClose} size="sm">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !hasChanges} size="sm">
            {isSaving ? (
              <>
                <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        </div>
      </DialogContent>

      {/* Letter of Explanation Request Dialog */}
      <AlertDialog open={showLOEDialog} onOpenChange={setShowLOEDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Request Letter of Explanation</AlertDialogTitle>
            <AlertDialogDescription>
              This will notify all borrowers that a letter of explanation is required for: <strong>{formData.item_name || item.item_name}</strong>.
              <br /><br />
              Borrowers will receive both an email and an in-app notification.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRequestingLOE}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRequestLOE} disabled={isRequestingLOE}>
              {isRequestingLOE ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                'Send Request'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
