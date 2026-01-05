import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Download, MessageSquare, AlertCircle } from "lucide-react";
import { LoanDocument } from "@/entities/all";

export default function DocumentViewer({ isOpen, onClose, document, currentUser, onUpdate }) {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');

  useEffect(() => {
    if (document && isOpen) {
      console.log("[DocumentViewer] Document received:", document);
      console.log("[DocumentViewer] File URL:", document.file_url);
      setComments(document.comments || []);
    }
  }, [document, isOpen]);

  const handleAddComment = async (e) => {
    e?.preventDefault();
    e?.stopPropagation();
    
    if (!newComment.trim()) return;

    const comment = {
      id: Date.now().toString(),
      text: newComment,
      author: currentUser?.full_name || currentUser?.email || 'Current User',
      timestamp: new Date().toISOString()
    };

    const updatedComments = [...comments, comment];
    setComments(updatedComments);
    setNewComment('');

    try {
      await LoanDocument.update(document.id, { comments: updatedComments });
      if (onUpdate) await onUpdate();
    } catch (error) {
      console.error("Error saving comment:", error);
    }
  };

  const getFileUrl = () => {
    if (!document) {
      console.error("[DocumentViewer] No document provided");
      return null;
    }
    
    const url = document.file_url || document.document_url || document.url || document.fileUrl;
    
    console.log("[DocumentViewer] Resolved URL:", url);
    
    if (!url || url === '' || url === null) {
      console.error("[DocumentViewer] No valid file URL found");
      return null;
    }
    
    return url;
  };

  const handleDownload = (e) => {
    e?.preventDefault();
    e?.stopPropagation();
    
    const url = getFileUrl();
    if (url) {
      const link = window.document.createElement('a');
      link.href = url;
      link.download = document.document_name || 'document';
      link.target = '_blank';
      window.document.body.appendChild(link);
      link.click();
      window.document.body.removeChild(link);
    }
  };

  if (!document) {
    return null;
  }

  const fileUrl = getFileUrl();
  
  if (!fileUrl) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="w-5 h-5" />
              Document Error
            </DialogTitle>
          </DialogHeader>
          <div className="p-6">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <p className="text-red-800 font-semibold mb-2">No file URL available for this document.</p>
              <p className="text-red-700 text-sm">
                The document "{document.document_name}" doesn't have a valid file URL. 
                This usually means the file was not properly uploaded.
              </p>
            </div>
            
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-4">
              <p className="font-semibold text-sm text-slate-700 mb-2">Document Information:</p>
              <div className="space-y-1 text-xs font-mono text-slate-600">
                <p><span className="font-semibold">Document Name:</span> {document.document_name}</p>
                <p><span className="font-semibold">Category:</span> {document.category}</p>
                <p><span className="font-semibold">Status:</span> {document.status}</p>
                <p><span className="font-semibold">Uploaded By:</span> {document.uploaded_by || document.created_by}</p>
                <p><span className="font-semibold">File URL:</span> {document.file_url || '(empty)'}</p>
              </div>
            </div>

            <div className="flex gap-3">
              <Button onClick={onClose} variant="outline" className="flex-1">
                Close
              </Button>
              <Button 
                onClick={() => {
                  if (confirm('This document has no file. Would you like to delete it?')) {
                    LoanDocument.delete(document.id).then(() => {
                      if (onUpdate) onUpdate();
                      onClose();
                    });
                  }
                }}
                variant="destructive"
                className="flex-1"
              >
                Delete Document
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const isPdf = fileUrl.toLowerCase().endsWith('.pdf') || fileUrl.toLowerCase().includes('.pdf?') || fileUrl.toLowerCase().includes('.pdf&');
  const isImage = fileUrl.match(/\.(jpg|jpeg|png|gif)($|\?)/i);

  console.log("[DocumentViewer] isPdf:", isPdf, "isImage:", isImage);
  console.log("[DocumentViewer] Will use Google Viewer URL:", `https://docs.google.com/gview?url=${encodeURIComponent(fileUrl)}&embedded=true`);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl h-[90vh] p-0 gap-0">
        <DialogHeader className="p-6 pr-12 border-b">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle>{document.document_name}</DialogTitle>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="outline">{document.category}</Badge>
                <Badge className={
                  document.status === 'approved' ? 'bg-green-100 text-green-800' :
                  document.status === 'rejected' ? 'bg-red-100 text-red-800' :
                  document.status === 'under_review' ? 'bg-blue-100 text-blue-800' :
                  'bg-amber-100 text-amber-800'
                }>
                  {document.status?.replace(/_/g, ' ')}
                </Badge>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={handleDownload}>
              <Download className="w-4 h-4 mr-2" />
              Download
            </Button>
          </div>
        </DialogHeader>

        <div className="flex h-full overflow-hidden">
          {/* Document Preview */}
          <div className="flex-1 bg-slate-50 overflow-auto">
            {isImage ? (
              <div className="p-4">
                <img 
                  src={fileUrl} 
                  alt={document.document_name}
                  className="max-w-full h-auto mx-auto"
                />
              </div>
            ) : isPdf ? (
              <iframe
                src={`https://docs.google.com/gview?url=${encodeURIComponent(fileUrl)}&embedded=true`}
                className="w-full h-full border-0"
                style={{ minHeight: '800px', height: 'calc(90vh - 150px)' }}
                title={document.document_name}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-600 p-8">
                <p className="mb-4 text-lg">Preview not available for this file type</p>
                <Button onClick={handleDownload} variant="outline" size="lg">
                  <Download className="w-4 h-4 mr-2" />
                  Download to View
                </Button>
              </div>
            )}
          </div>

          {/* Comments Sidebar */}
          <div className="w-80 border-l bg-white p-4 overflow-y-auto">
            <div className="flex items-center gap-2 mb-4">
              <MessageSquare className="w-4 h-4" />
              <h3 className="font-semibold">Comments</h3>
            </div>

            <div className="space-y-4 mb-4">
              {comments.map((comment) => (
                <div key={comment.id} className="bg-slate-50 p-3 rounded-lg">
                  <div className="flex items-start justify-between mb-2">
                    <p className="font-semibold text-sm">{comment.author}</p>
                    <p className="text-xs text-slate-500">
                      {new Date(comment.timestamp).toLocaleString()}
                    </p>
                  </div>
                  <p className="text-sm text-slate-700">{comment.text}</p>
                </div>
              ))}

              {comments.length === 0 && (
                <p className="text-sm text-slate-500 text-center py-4">
                  No comments yet
                </p>
              )}
            </div>

            <div className="border-t pt-4">
              <Textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a comment..."
                className="mb-2"
                rows={3}
              />
              <Button 
                onClick={handleAddComment} 
                className="w-full" 
                size="sm"
                type="button"
              >
                Add Comment
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}