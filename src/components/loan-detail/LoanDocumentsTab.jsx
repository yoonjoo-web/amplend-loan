import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Search, Upload, Eye, Download } from "lucide-react";
import { format } from "date-fns";
import { LoanDocument } from "@/entities/all"; // This import might become redundant for LoanDocument.update but is still used by LoanDocument.create
import { base44 } from "@/api/base44Client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import DocumentViewer from "./DocumentViewer";

const DOCUMENT_CATEGORIES = [
  { value: "application", label: "Application" },
  { value: "borrower_document", label: "Borrower Document" },
  { value: "property_document", label: "Property Document" },
  { value: "closing_document", label: "Closing Document" },
  { value: "post_closing_document", label: "Post-Closing Document" }
];

// Adjusted STATUS_COLORS for a lighter theme
const STATUS_COLORS = {
  pending: "bg-gray-100 text-gray-800 border border-gray-200",
  submitted: "bg-blue-100 text-blue-800 border border-blue-200",
  under_review: "bg-amber-100 text-amber-800 border border-amber-200",
  first_review_done: "bg-purple-100 text-purple-800 border border-purple-200",
  second_review_done: "bg-indigo-100 text-indigo-800 border border-indigo-200",
  approved: "bg-emerald-100 text-emerald-800 border border-emerald-200",
  rejected: "bg-red-100 text-red-800 border border-red-200",
  approved_with_condition: "bg-violet-100 text-violet-800 border border-violet-200",
  letter_of_explanation_requested: "bg-orange-100 text-orange-800 border border-orange-200",
  // Checklist item statuses (not directly used here but kept for context)
  not_started: "bg-slate-100 text-slate-800 border border-slate-200",
  in_progress: "bg-blue-100 text-blue-800 border border-blue-200",
  on_hold: "bg-amber-100 text-amber-800 border border-amber-200",
  flagged: "bg-red-100 text-red-800 border border-red-200",
  completed: "bg-emerald-100 text-emerald-800 border border-emerald-200"
};

const formatStatus = (status) => {
  if (!status) return 'Pending';
  return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

const ALLOWED_FILE_TYPES = ".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif";
const FILE_TYPE_DESCRIPTION = "PDF, Word, Excel, or Image files";

export default function LoanDocumentsTab({ loanId, documents, onDocumentsChange, currentUser }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [isUploading, setIsUploading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFiles, setUploadFiles] = useState([]);
  const [bulkCategory, setBulkCategory] = useState('');
  const [viewingDocument, setViewingDocument] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileSelect = (event) => {
    const files = Array.from(event.target.files);
    const filesWithCategory = files.map(file => ({
      file,
      name: file.name,
      category: bulkCategory || ''
    }));
    setUploadFiles(filesWithCategory);
    setShowUploadModal(true);
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

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    const filesWithCategory = files.map(file => ({
      file,
      name: file.name,
      category: bulkCategory || ''
    }));
    setUploadFiles(filesWithCategory);
    setShowUploadModal(true);
  };

  const handleCategoryChange = (index, category) => {
    const updated = [...uploadFiles];
    updated[index].category = category;
    setUploadFiles(updated);
  };

  const handleBulkCategoryChange = (category) => {
    setBulkCategory(category);
    const updated = uploadFiles.map(f => ({ ...f, category }));
    setUploadFiles(updated);
  };

  const handleUpload = async () => {
    setIsUploading(true);
    try {
      for (const fileObj of uploadFiles) {
        if (!fileObj.category) {
          alert(`Please select a category for ${fileObj.name}`);
          setIsUploading(false);
          return;
        }

        // Upload file
        const { file_url } = await base44.integrations.Core.UploadFile({ file: fileObj.file });

        // Create document record - FIXED: Use file_url instead of document_url
        await LoanDocument.create({
          loan_id: loanId,
          document_name: fileObj.name,
          file_url: file_url,  // Changed from document_url to file_url
          category: fileObj.category,
          status: "submitted",
          uploaded_by: currentUser.id,
          uploaded_date: new Date().toISOString()
        });
      }

      setShowUploadModal(false);
      setUploadFiles([]);
      setBulkCategory('');
      onDocumentsChange();
    } catch (error) {
      console.error("Error uploading documents:", error);
      alert("Failed to upload documents. Please try again.");
    }
    setIsUploading(false);
  };

  const handleStatusChange = async (docId, newStatus) => {
    try {
      const doc = documents.find(d => d.id === docId);
      await base44.entities.LoanDocument.update(docId, {
        status: newStatus,
        reviewed_by: currentUser.id,
        reviewed_date: new Date().toISOString()
      });
      
      if (doc && doc.checklist_item_id) {
        await base44.entities.ChecklistItem.update(doc.checklist_item_id, { status: newStatus });
      }
      
      await onDocumentsChange();
    } catch (error) {
      console.error("Error updating document status:", error);
    }
  };

  const handleCategoryUpdate = async (docId, newCategory) => {
    try {
      await LoanDocument.update(docId, { category: newCategory });
      await onDocumentsChange();
    } catch (error) {
      console.error("Error updating document category:", error);
    }
  };

  const handleViewDocument = (doc) => {
    console.log("[LoanDocumentsTab] Opening document viewer for:", doc);
    console.log("[LoanDocumentsTab] Document file_url:", doc.file_url);
    console.log("[LoanDocumentsTab] Document document_url:", doc.document_url);
    setViewingDocument(doc);
  };

  const handleCloseViewer = () => {
    console.log("[LoanDocumentsTab] Closing document viewer");
    setViewingDocument(null);
  };

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.document_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || doc.status === statusFilter;
    const matchesCategory = categoryFilter === 'all' || doc.category === categoryFilter;
    return matchesSearch && matchesStatus && matchesCategory;
  });

  const getCategoryLabel = (value) => {
    return DOCUMENT_CATEGORIES.find(c => c.value === value)?.label || value;
  };

  return (
    <>
      <Card 
        className="bg-white border-slate-200 relative"
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {isDragging && (
          <div className="absolute inset-0 bg-blue-50 bg-opacity-90 border-2 border-dashed border-blue-400 rounded-lg z-10 flex items-center justify-center">
            <div className="text-center">
              <Upload className="w-12 h-12 mx-auto mb-2 text-blue-600" />
              <p className="text-lg font-semibold text-blue-600">Drop files to upload</p>
            </div>
          </div>
        )}
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Documents</CardTitle>
            <div className="flex gap-3">
              <label htmlFor="file-upload">
                <Button asChild disabled={isUploading} className="bg-blue-600 hover:bg-blue-700 text-white">
                  <span>
                    <Upload className="w-4 h-4 mr-2" />
                    {isUploading ? 'Uploading...' : 'Upload Documents'}
                  </span>
                </Button>
              </label>
              <input
                id="file-upload"
                type="file"
                multiple
                accept={ALLOWED_FILE_TYPES}
                className="hidden"
                onChange={handleFileSelect}
                disabled={isUploading}
              />
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-2">Accepted file types: {FILE_TYPE_DESCRIPTION} • Drag and drop supported</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search documents..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="submitted">Submitted</SelectItem>
                <SelectItem value="under_review">Under Review</SelectItem>
                <SelectItem value="first_review_done">1st Review Done</SelectItem>
                <SelectItem value="second_review_done">2nd Review Done</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="approved_with_condition">Approved with Condition</SelectItem>
                <SelectItem value="letter_of_explanation_requested">Letter of Explanation Requested</SelectItem>
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {DOCUMENT_CATEGORIES.map(cat => (
                  <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Documents Table */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Document Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Uploaded</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDocuments.map((doc) => (
                <TableRow key={doc.id}>
                  <TableCell className="font-medium">{doc.document_name}</TableCell>
                  <TableCell>
                    <Select
                      value={doc.category}
                      onValueChange={(value) => handleCategoryUpdate(doc.id, value)}
                    >
                      <SelectTrigger className="w-[200px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DOCUMENT_CATEGORIES.map(cat => (
                          <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={doc.status}
                      onValueChange={(value) => handleStatusChange(doc.id, value)}
                    >
                      <SelectTrigger className={`w-[180px] ${STATUS_COLORS[doc.status]}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="submitted">Submitted</SelectItem>
                        <SelectItem value="under_review">Under Review</SelectItem>
                        <SelectItem value="first_review_done">1st Review Done</SelectItem> {/* New SelectItem */}
                        <SelectItem value="second_review_done">2nd Review Done</SelectItem> {/* New SelectItem */}
                        <SelectItem value="approved">Approved</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                        <SelectItem value="approved_with_condition">Approved with Condition</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-sm text-gray-500">
                    {format(new Date(doc.uploaded_date), 'MMM d, yyyy')}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleViewDocument(doc);
                        }}
                        className="text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                      >
                        <Eye className="w-3 h-3 mr-1" />
                        View
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const link = document.createElement('a');
                          link.href = doc.file_url || doc.document_url;
                          link.download = doc.document_name;
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                        }}
                        className="text-green-600 hover:bg-green-50 hover:text-green-700"
                      >
                        <Download className="w-3 h-3 mr-1" />
                        Download
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {filteredDocuments.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <p>No documents found</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload Modal */}
      <Dialog open={showUploadModal} onOpenChange={setShowUploadModal}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Upload Documents</DialogTitle>
            <DialogDescription>
              Select a category for each document before uploading
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Apply Category to All</Label>
              <Select value={bulkCategory} onValueChange={handleBulkCategoryChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category for all files" />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_CATEGORIES.map(cat => (
                    <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="border-t border-gray-200 pt-4 space-y-3">
              {uploadFiles.map((fileObj, index) => (
                <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium text-sm text-gray-900">{fileObj.name}</p>
                    <p className="text-xs text-gray-500">{(fileObj.file.size / 1024).toFixed(2)} KB</p>
                  </div>
                  <Select
                    value={fileObj.category}
                    onValueChange={(value) => handleCategoryChange(index, value)}
                  >
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {DOCUMENT_CATEGORIES.map(cat => (
                        <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
              <Button variant="outline" onClick={() => setShowUploadModal(false)}>
                Cancel
              </Button>
              <Button onClick={handleUpload} disabled={isUploading} className="bg-blue-600 hover:bg-blue-700 text-white">
                {isUploading ? 'Uploading...' : 'Upload All'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Document Viewer Modal */}
      {viewingDocument && (
        <DocumentViewer
          document={viewingDocument}
          currentUser={currentUser}
          isOpen={!!viewingDocument}
          onClose={handleCloseViewer}
          onUpdate={onDocumentsChange}
        />
      )}
    </>
  );
}