import React, { useEffect, useState } from "react";
import { format, isAfter, subDays } from "date-fns";
import { AlertCircle, Download } from "lucide-react";

import { LoanDocument } from "@/entities/all";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

const getDocumentDate = (document) =>
  document?.uploaded_date || document?.updated_date || document?.created_date || null;

const formatCommentTimestamp = (value) => {
  if (!value) {
    return "Unknown";
  }

  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "Unknown";
    }

    return isAfter(date, subDays(new Date(), 7))
      ? format(date, "EEEE h:mm a")
      : format(date, "M/d/yy h:mm a");
  } catch (error) {
    return "Unknown";
  }
};

const formatActivityDate = (value) => {
  if (!value) {
    return "Unknown";
  }

  try {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "Unknown" : format(date, "M/d/yyyy");
  } catch (error) {
    return "Unknown";
  }
};

const getFileUrl = (document) =>
  document?.file_url || document?.document_url || document?.url || document?.fileUrl || null;

export default function DocumentViewer({
  isOpen,
  onClose,
  document,
  documentRow,
  currentUser,
  onUpdate,
  onUploadAdditional,
}) {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");

  useEffect(() => {
    if (!document || !isOpen) {
      return;
    }

    setComments(Array.isArray(document.comments) ? document.comments : []);
    setNewComment("");
  }, [document, isOpen]);

  const handleAddComment = async (event) => {
    event?.preventDefault();
    event?.stopPropagation();

    if (!newComment.trim() || !document) {
      return;
    }

    const comment = {
      id: `comment-${Date.now()}`,
      text: newComment.trim(),
      author: currentUser?.full_name || currentUser?.email || "Current User",
      timestamp: new Date().toISOString(),
    };

    const updatedComments = [...comments, comment];
    setComments(updatedComments);
    setNewComment("");

    try {
      await LoanDocument.update(document.id, { comments: updatedComments });
      if (onUpdate) {
        await onUpdate();
      }
    } catch (error) {
      console.error("Error saving comment:", error);
    }
  };

  const handleDownload = (event) => {
    event?.preventDefault();
    event?.stopPropagation();

    const url = getFileUrl(document);
    if (!url) {
      return;
    }

    const link = window.document.createElement("a");
    link.href = url;
    link.download = document.document_name || "document";
    link.target = "_blank";
    window.document.body.appendChild(link);
    link.click();
    window.document.body.removeChild(link);
  };

  if (!document) {
    return null;
  }

  const fileUrl = getFileUrl(document);
  const uploadedAt = getDocumentDate(document);
  const uploadedBy =
    document?.uploader_name ||
    document?.uploaded_by_name ||
    document?.uploaded_by ||
    document?.created_by ||
    "Unknown";
  const isPdf =
    Boolean(fileUrl) &&
    (fileUrl.toLowerCase().endsWith(".pdf") ||
      fileUrl.toLowerCase().includes(".pdf?") ||
      fileUrl.toLowerCase().includes(".pdf&"));
  const isImage = Boolean(fileUrl) && /\.(jpg|jpeg|png|gif|webp)($|\?)/i.test(fileUrl);

  if (!fileUrl) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              Document Error
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              No file URL is available for this document.
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <p>Document name: {document.document_name || "Unknown"}</p>
              <p>Category: {document.category || "Unknown"}</p>
              <p>Status: {document.status || "Unknown"}</p>
            </div>
            <div className="flex justify-end">
              <Button type="button" variant="outline" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="h-[calc(100vh-2rem)] max-w-[1240px] gap-0 overflow-hidden rounded-[4px] p-0">
        <div className="flex h-full flex-col bg-white">
          <DialogHeader className="border-b border-[#e5e5e5] px-6 py-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <DialogTitle className="truncate text-base font-bold tracking-[-0.5px] text-black">
                  {documentRow?.title || document.document_name || "Document title"}
                </DialogTitle>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 rounded-[8px] border-[#d1d1d6] px-4 text-base font-normal tracking-[-0.5px] text-black shadow-none hover:bg-slate-50"
                  onClick={() => onUploadAdditional?.(documentRow)}
                >
                  Upload Additional Document
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 w-[156px] rounded-[8px] border-2 border-[#3463dd] px-4 text-base font-normal tracking-[-0.5px] text-black shadow-none hover:bg-[#f4f7ff]"
                  onClick={handleDownload}
                >
                  Download
                </Button>
                <Button
                  type="button"
                  className="h-10 rounded-[8px] border-2 border-[#3463dd] bg-[#3463dd] px-4 text-base font-normal tracking-[-0.5px] text-white shadow-none hover:bg-[#2850ba]"
                >
                  Start underwriting
                </Button>
              </div>
            </div>
          </DialogHeader>

          <div className="grid min-h-0 flex-1 gap-0 lg:grid-cols-[minmax(0,1fr)_420px]">
            <div className="min-h-0 overflow-auto bg-white p-6">
              {isImage ? (
                <img
                  src={fileUrl}
                  alt={document.document_name || "Document preview"}
                  className="mx-auto max-w-full rounded border border-[#ededed]"
                />
              ) : isPdf ? (
                <iframe
                  src={`https://docs.google.com/gview?url=${encodeURIComponent(fileUrl)}&embedded=true`}
                  className="min-h-[900px] w-full rounded border-0"
                  title={document.document_name || "Document preview"}
                />
              ) : (
                <div className="flex h-full min-h-[480px] flex-col items-center justify-center gap-4 rounded border border-[#ededed] bg-slate-50 p-8 text-center text-slate-600">
                  <p className="text-lg">Preview not available for this file type</p>
                  <Button type="button" variant="outline" onClick={handleDownload}>
                    <Download className="mr-2 h-4 w-4" />
                    Download to View
                  </Button>
                </div>
              )}
            </div>

            <div className="flex min-h-0 flex-col border-l border-[#e5e5e5] bg-white px-6 py-6">
              <div className="min-h-0 flex-1 overflow-y-auto">
                <h3 className="text-2xl font-bold tracking-[-0.5px] text-black">Comments</h3>

                <div className="mt-8 space-y-5 pr-2">
                  {comments.length === 0 ? (
                    <p className="text-base text-[#8e8e93]">No comments yet</p>
                  ) : (
                    comments.map((comment) => (
                      <div key={comment.id} className="space-y-1">
                        <div className="flex flex-wrap items-end gap-x-2 gap-y-1 text-xs tracking-[-0.5px]">
                          <span className="font-bold text-[#171717]">
                            {comment.author || "Unknown"}
                          </span>
                          <span className="text-[#8e8e93]">
                            {formatCommentTimestamp(comment.timestamp)}
                          </span>
                        </div>
                        <p className="text-base leading-6 tracking-[-0.5px] text-[#171717]">
                          {comment.text}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="mt-8">
                <div className="flex min-h-[80px] items-end gap-4 overflow-hidden rounded-[8px] border border-[#d1d1d6] bg-white p-2">
                  <Textarea
                    value={newComment}
                    onChange={(event) => setNewComment(event.target.value)}
                    placeholder="Add comments and notes here (use @ to mention someone)"
                    className="min-h-[64px] flex-1 resize-none border-0 p-0 text-base tracking-[-0.5px] text-[#171717] shadow-none focus-visible:ring-0"
                    rows={3}
                  />
                  <Button
                    type="button"
                    className="h-11 rounded-[8px] bg-[#e5e5ea] px-4 text-base font-normal tracking-[-0.5px] text-black shadow-none hover:bg-[#d9d9df]"
                    onClick={handleAddComment}
                    disabled={!newComment.trim()}
                  >
                    Send
                  </Button>
                </div>

                <div className="mt-8 space-y-1">
                  <p className="text-base font-bold tracking-[-0.5px] text-[#8e8e93]">
                    Activity history
                  </p>
                  <div className="flex flex-wrap gap-x-8 gap-y-2 text-xs tracking-[-0.5px] text-[#8e8e93]">
                    <div className="flex items-center gap-2">
                      <span>Uploaded date:</span>
                      <span>{formatActivityDate(uploadedAt)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span>Uploaded by:</span>
                      <span>{uploadedBy}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
