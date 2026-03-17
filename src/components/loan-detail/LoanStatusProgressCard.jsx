import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { LOAN_PROGRESS_STATUS_OPTIONS } from "./loanStatusConfig";

export default function LoanStatusProgressCard({ loan }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const progressIndex = LOAN_PROGRESS_STATUS_OPTIONS.findIndex(
    (status) => status.value === loan.status
  );

  const formatCompactDate = (value) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;

    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const year = String(date.getFullYear()).slice(-2);
    return `${month}/${day}/${year}`;
  };

  const visibleStatuses = isExpanded
    ? LOAN_PROGRESS_STATUS_OPTIONS
    : LOAN_PROGRESS_STATUS_OPTIONS.slice(0, 5);

  return (
    <Card className="border-slate-200 bg-white">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <CardTitle className="text-[14px] font-normal leading-5 tracking-[-0.5px] text-black">
            Progress
          </CardTitle>
          <p className="text-[12px] font-normal leading-4 tracking-[-0.5px] text-neutral-500">
            Step {Math.max(progressIndex + 1, 1)} of {LOAN_PROGRESS_STATUS_OPTIONS.length}
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 px-4 pb-4 pt-0">
        <div className="flex gap-2">
          {visibleStatuses.map((status) => {
            const originalIndex = LOAN_PROGRESS_STATUS_OPTIONS.findIndex(
              (item) => item.value === status.value
            );
            const isFilled = progressIndex >= originalIndex || progressIndex === -1;

            return (
              <div
                key={status.value}
                className={`h-2 flex-1 rounded-full ${
                  isFilled ? "bg-black" : "bg-[#E5E5E5]"
                }`}
              />
            );
          })}
        </div>

        <div className={isExpanded ? "overflow-x-auto pb-1" : ""}>
          <div className={`flex items-center ${isExpanded ? "min-w-max gap-4" : "gap-4"}`}>
            {visibleStatuses.map((status) => {
              const originalIndex = LOAN_PROGRESS_STATUS_OPTIONS.findIndex(
                (item) => item.value === status.value
              );
              const isCompleted = progressIndex > originalIndex || progressIndex === -1;
              const isCurrent = progressIndex === originalIndex;
              const createdDate = originalIndex === 0 && isCompleted
                ? formatCompactDate(loan.created_date || loan.updated_date)
                : null;
              const isFirstItem = originalIndex === 0;

              return (
                <div
                  key={status.value}
                  className={isExpanded ? "min-w-[140px] flex-1" : "min-w-0 flex-1"}
                >
                  {isFirstItem ? (
                    <div className="flex min-w-0 items-start gap-[6px]">
                      <div className="flex shrink-0 items-center py-[2px]">
                        {isCompleted ? (
                          <Check className="h-[12px] w-[10.5px] text-black stroke-[2.25]" />
                        ) : (
                          <div
                            className={`mt-[3px] h-[6px] w-[6px] rounded-full border ${
                              isCurrent
                                ? "border-black bg-black"
                                : "border-[#A3A3A3] bg-white"
                            }`}
                          />
                        )}
                      </div>
                      <div className="flex min-w-0 flex-col items-start justify-center text-[12px] font-normal leading-4 tracking-[-0.627px] text-[#525252]">
                        <p className="truncate">{status.label}</p>
                        {createdDate && <p className="truncate">{createdDate}</p>}
                      </div>
                    </div>
                  ) : (
                    <div className="relative h-4 min-h-px min-w-px">
                      <div className="absolute left-0 top-[5px] h-[6px] w-[6px]">
                        {isCompleted ? (
                          <div className="flex h-[6px] w-[6px] items-center justify-center">
                            <div className="h-[6px] w-[6px] rounded-full bg-black" />
                          </div>
                        ) : (
                          <div
                            className={`h-[6px] w-[6px] rounded-full border ${
                              isCurrent
                                ? "border-black bg-black"
                                : "border-[#A3A3A3] bg-white"
                            }`}
                          />
                        )}
                      </div>
                      <p
                        className={`absolute left-[12px] top-[-2px] whitespace-nowrap text-[12px] font-normal leading-4 tracking-[-0.5px] ${
                          isCurrent ? "text-black" : "text-[#525252]"
                        }`}
                      >
                        {status.label}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-1">
          {LOAN_PROGRESS_STATUS_OPTIONS.length > 5 && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsExpanded((value) => !value)}
              className="h-auto px-0 text-[12px] font-normal leading-4 tracking-[-0.5px] text-neutral-500 hover:bg-transparent hover:text-black"
            >
              {isExpanded ? "Collapse" : `${LOAN_PROGRESS_STATUS_OPTIONS.length - 5} more`}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
