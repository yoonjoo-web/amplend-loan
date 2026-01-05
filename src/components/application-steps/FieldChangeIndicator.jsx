import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { History } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export default function FieldChangeIndicator({ fieldName, applicationData }) {
  if (!applicationData?.submission_snapshots || applicationData.submission_snapshots.length < 1) {
    return null;
  }

  const changes = [];
  const snapshots = [...(applicationData.submission_snapshots || [])].sort((a, b) => a.submission_number - b.submission_number);
  
  // Build full history by comparing each submission with the next
  for (let i = 0; i < snapshots.length; i++) {
    const currentSnapshot = snapshots[i];
    const nextSnapshot = i < snapshots.length - 1 ? snapshots[i + 1] : { data_snapshot: applicationData };
    
    const prevData = currentSnapshot.data_snapshot || {};
    const nextData = nextSnapshot.data_snapshot || applicationData;
    
    const prevValue = prevData[fieldName];
    const nextValue = nextData[fieldName];
    
    if (JSON.stringify(prevValue) !== JSON.stringify(nextValue)) {
      changes.push({
        submission_number: currentSnapshot.submission_number,
        submission_date: currentSnapshot.submission_date,
        old_value: prevValue,
        new_value: nextValue
      });
    }
  }

  if (changes.length === 0) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-6 px-2 py-0 text-xs bg-orange-100 text-orange-700 border-orange-300 hover:bg-orange-200"
        >
          <History className="w-3 h-3 mr-1" />
          Changed
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96" align="end">
        <div className="space-y-2">
          <h4 className="font-semibold text-sm text-slate-900">Change History</h4>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {changes.map((change, idx) => (
              <div key={idx} className="text-xs border-l-2 border-orange-500 pl-3 py-2 bg-slate-50 rounded">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className="text-xs">
                    Submission #{change.submission_number}
                  </Badge>
                  <span className="text-slate-500">
                    {new Date(change.submission_date).toLocaleDateString()}
                  </span>
                </div>
                <div className="space-y-1">
                  <div>
                    <span className="font-medium text-slate-600">Previous: </span>
                    <span className="text-slate-900">{change.old_value?.toString() || '(empty)'}</span>
                  </div>
                  <div>
                    <span className="font-medium text-slate-600">Current: </span>
                    <span className="text-slate-900">{change.new_value?.toString() || '(empty)'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}