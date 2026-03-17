import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { History } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function RecentChangesModal({
  open,
  onOpenChange,
  loan,
}) {
  const [fieldConfigMap, setFieldConfigMap] = useState({});

  useEffect(() => {
    const loadFieldConfigs = async () => {
      try {
        const configs = await base44.entities.FieldConfiguration.filter({ context: "loan" });
        const map = {};
        configs.forEach((config) => {
          map[config.field_name] = config.field_label;
        });
        setFieldConfigMap(map);
      } catch (error) {
        console.error("Error loading field configurations:", error);
      }
    };

    if (open) {
      loadFieldConfigs();
    }
  }, [open]);

  const getFieldDisplayName = (fieldName) => {
    if (fieldConfigMap[fieldName]) {
      return fieldConfigMap[fieldName];
    }

    return String(fieldName || "")
      .replace(/_/g, " ")
      .replace(/([A-Z])/g, " $1")
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ")
      .trim();
  };

  const history = Array.isArray(loan?.modification_history)
    ? [...loan.modification_history].reverse()
    : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Recent Changes</DialogTitle>
        </DialogHeader>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <History className="w-5 h-5 text-slate-600" />
              Recent Changes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-[60vh] pr-4">
              <div className="space-y-3">
                {history.length > 0 ? (
                  history.map((mod, index) => {
                    const explicitFieldChanges = Array.isArray(mod.field_changes)
                      ? mod.field_changes
                      : [];
                    const fallbackFields = Array.isArray(mod.fields_changed)
                      ? mod.fields_changed
                      : [];
                    const changeSummary = explicitFieldChanges.length > 0
                      ? explicitFieldChanges.map((change) => getFieldDisplayName(change.field_name)).join(", ")
                      : fallbackFields.map((field) => getFieldDisplayName(field)).join(", ") || "loan data";
                    const changeCount = explicitFieldChanges.length > 0
                      ? explicitFieldChanges.length
                      : fallbackFields.length;

                    return (
                      <div key={index} className="text-sm border-l-2 border-blue-500 pl-3 py-2">
                        <p className="text-slate-900">
                          {mod.modified_by_name || "System"}
                        </p>
                        <p className="text-xs text-slate-600 mt-1">
                          Updated {changeCount} field{changeCount !== 1 ? "s" : ""}: {changeSummary}
                        </p>
                        {explicitFieldChanges.length > 0 ? (
                          <div className="mt-2 space-y-1">
                            {explicitFieldChanges.map((change, changeIndex) => (
                              <p key={changeIndex} className="text-xs text-slate-500">
                                Field changed: {getFieldDisplayName(change.field_name)}
                              </p>
                            ))}
                          </div>
                        ) : null}
                        <p className="text-xs text-slate-500 mt-2">
                          {new Date(mod.timestamp).toLocaleString()}
                        </p>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-sm text-slate-600 bg-slate-50 p-3 rounded-lg">
                    <p className="text-slate-900">Last Modified</p>
                    <p className="text-xs">{new Date(loan.updated_date).toLocaleString()}</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  );
}
