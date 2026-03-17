import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronRight, History } from "lucide-react";
import { base44 } from "@/api/base44Client";
import VersionHistoryModal from "./VersionHistoryModal";

export default function RecentChangesPanel({
  loan,
  hideLoanOfficerDetails = false,
  loanOfficerNameSet = new Set(),
  className = "",
}) {
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [modificationHistory, setModificationHistory] = useState([]);
  const [fieldConfigMap, setFieldConfigMap] = useState({});

  useEffect(() => {
    const history = loan?.modification_history || [];
    setModificationHistory(history.slice(-3).reverse());
  }, [loan?.modification_history]);

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

    loadFieldConfigs();
  }, []);

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

  return (
    <>
      <Card className={`border-0 shadow-sm ${className}`}>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <History className="w-5 h-5 text-slate-600" />
            Recent Changes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {modificationHistory.length > 0 ? (
              modificationHistory.map((mod, index) => {
                const hasFieldChanges = mod.field_changes && mod.field_changes.length > 0;
                const changeSummary = hasFieldChanges
                  ? mod.field_changes.map((change) => getFieldDisplayName(change.field_name)).join(", ")
                  : mod.fields_changed?.map((field) => getFieldDisplayName(field)).join(", ") || "loan data";
                const changeCount = hasFieldChanges
                  ? mod.field_changes.length
                  : mod.fields_changed?.length || 0;

                return (
                  <div key={index} className="text-sm border-l-2 border-blue-500 pl-3 py-2">
                    <p className="text-slate-900">
                      {hideLoanOfficerDetails && loanOfficerNameSet.has((mod.modified_by_name || "").trim().toLowerCase())
                        ? "Loan Officer"
                        : (mod.modified_by_name || "System")}
                    </p>
                    <p className="text-xs text-slate-600 mt-1">
                      Updated {changeCount} field{changeCount !== 1 ? "s" : ""}: {changeSummary}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
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

            <Button
              variant="ghost"
              className="w-full justify-between text-sm"
              onClick={() => setShowHistoryModal(true)}
            >
              View Full History
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <VersionHistoryModal
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        loan={loan}
        hideLoanOfficerNames={hideLoanOfficerDetails}
        loanOfficerNameSet={loanOfficerNameSet}
      />
    </>
  );
}
