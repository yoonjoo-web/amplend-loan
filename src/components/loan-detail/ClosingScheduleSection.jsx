import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Save } from "lucide-react";

const normalizeDateValue = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString().split('T')[0];
};

const formatDateDisplay = (value) => {
  if (!value) return 'Not set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
};

export default function ClosingScheduleSection({ loan, onUpdate, currentUser }) {
  const [actualClosingDate, setActualClosingDate] = useState(
    normalizeDateValue(loan.actual_closing_date)
  );
  const [isSaving, setIsSaving] = useState(false);

  const canEdit = currentUser && (
    currentUser.role === 'admin' ||
    currentUser.app_role === 'Administrator' ||
    currentUser.app_role === 'Loan Officer'
  );

  useEffect(() => {
    setActualClosingDate(normalizeDateValue(loan.actual_closing_date));
  }, [loan.actual_closing_date]);

  const handleSave = async () => {
    if (!canEdit) return;
    const normalizedExisting = normalizeDateValue(loan.actual_closing_date);
    const normalizedNext = normalizeDateValue(actualClosingDate);
    if (normalizedNext === normalizedExisting) return;

    setIsSaving(true);
    try {
      await onUpdate({ actual_closing_date: normalizedNext || null });
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges =
    normalizeDateValue(actualClosingDate) !== normalizeDateValue(loan.actual_closing_date);

  return (
    <Card className="border-0 shadow-sm bg-white">
      <CardHeader className="border-b border-slate-100">
        <CardTitle className="text-xl font-bold text-slate-900">
          Closing Schedule
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Target Closing Date
            </div>
            <div className="mt-2 text-sm font-semibold text-slate-900">
              {formatDateDisplay(loan.target_closing_date)}
            </div>
          </div>
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Actual Closing Date
            </div>
            {canEdit ? (
              <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Input
                  type="date"
                  value={actualClosingDate || ''}
                  onChange={(event) => setActualClosingDate(event.target.value)}
                  className="sm:max-w-[220px]"
                />
                <Button
                  onClick={handleSave}
                  disabled={isSaving || !hasChanges}
                  className="bg-slate-700 hover:bg-slate-800"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {isSaving ? 'Saving...' : 'Save'}
                </Button>
              </div>
            ) : (
              <div className="mt-2 text-sm font-semibold text-slate-900">
                {formatDateDisplay(loan.actual_closing_date)}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
