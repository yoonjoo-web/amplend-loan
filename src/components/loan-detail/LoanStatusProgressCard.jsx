import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { LOAN_PROGRESS_STATUS_OPTIONS } from "./loanStatusConfig";

export default function LoanStatusProgressCard({ loan }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const progressIndex = LOAN_PROGRESS_STATUS_OPTIONS.findIndex(
    (status) => status.value === loan.status
  );

  const visibleStatuses = isExpanded
    ? LOAN_PROGRESS_STATUS_OPTIONS
    : LOAN_PROGRESS_STATUS_OPTIONS.slice(0, 5);

  const formatCompactDate = (value) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;

    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const year = String(date.getFullYear()).slice(-2);
    return `${month}/${day}/${year}`;
  };

  return (
    <Card className="border-slate-200 bg-white">
      <CardContent className="px-4 py-4">
        <div className="flex flex-col items-start gap-[10px]">
          <div className="flex w-full items-center justify-between whitespace-nowrap">
            <p className="text-[14px] font-normal leading-5 tracking-[-0.5px] text-black">
              Progress
            </p>
            <p className="text-[12px] font-normal leading-4 tracking-[-0.5px] text-[#737373]">
              Step {Math.max(progressIndex + 1, 1)} of {LOAN_PROGRESS_STATUS_OPTIONS.length}
            </p>
          </div>

          <div className="flex w-full items-center gap-2">
            {visibleStatuses.map((status) => {
              const originalIndex = LOAN_PROGRESS_STATUS_OPTIONS.findIndex(
                (item) => item.value === status.value
              );
              const isComplete = progressIndex >= originalIndex || progressIndex === -1;

              return (
                <div
                  key={status.value}
                  className={`h-2 min-h-px min-w-px flex-1 rounded-[9999px] ${
                    isComplete ? "bg-black" : "bg-[#E5E7EB]"
                  }`}
                />
              );
            })}
          </div>

          <div className={`w-full ${isExpanded ? "overflow-x-auto" : ""}`}>
            <div
              className={`flex w-full items-center gap-4 ${
                isExpanded ? "min-w-max" : ""
              }`}
            >
              {visibleStatuses.map((status) => {
                const originalIndex = LOAN_PROGRESS_STATUS_OPTIONS.findIndex(
                  (item) => item.value === status.value
                );
                const isDone = progressIndex > originalIndex || progressIndex === -1;
                const isCurrent = progressIndex === originalIndex;
                const isFuture = !isDone && !isCurrent;
                const showDate = originalIndex === 0 && isDone;
                const createdDate = showDate
                  ? formatCompactDate(loan.created_date || loan.updated_date)
                  : null;

                if (originalIndex === 0) {
                  return (
                    <div
                      key={status.value}
                      className={`flex min-h-px min-w-px flex-1 items-start gap-[6px] ${
                        isExpanded ? "min-w-[120px]" : "min-w-0"
                      }`}
                    >
                      <div className="flex h-4 shrink-0 items-start pt-[2px]">
                        {isDone ? (
                          <div className="flex h-[12px] w-[10.5px] items-center justify-center">
                            <Check className="h-[12px] w-[10.5px] text-black stroke-[2.25]" />
                          </div>
                        ) : (
                          <div
                            className={`h-[6px] w-[6px] rounded-full border ${
                              isCurrent
                                ? "border-black bg-black"
                                : "border-[#E5E7EB] bg-white"
                            }`}
                          />
                        )}
                      </div>
                      <div className="flex shrink-0 flex-col items-start whitespace-nowrap text-[12px] font-normal tracking-[-0.6271px] text-[#525252]">
                        <p className="leading-4">{status.label}</p>
                        {createdDate ? <p className="leading-[14px]">{createdDate}</p> : null}
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={status.value}
                    className={`relative h-4 min-h-px min-w-px flex-1 ${
                      isExpanded ? "min-w-[120px]" : ""
                    }`}
                  >
                    <div className="absolute left-0 top-[5px] h-[6px] w-[6px]">
                      {isDone ? (
                        <div className="h-[6px] w-[6px] rounded-full bg-black" />
                      ) : (
                        <div
                          className={`h-[6px] w-[6px] rounded-full border ${
                            isCurrent
                              ? "border-black bg-black"
                              : "border-[#E5E7EB] bg-white"
                          }`}
                        />
                      )}
                    </div>
                    <p
                      className={`absolute left-[12px] top-[-2px] whitespace-nowrap text-[12px] font-normal leading-4 ${
                        status.label === "Report revision"
                          ? "tracking-[-0.5938px]"
                          : "tracking-[-0.5px]"
                      } ${
                        isFuture ? "text-[#525252]" : "text-black"
                      }`}
                    >
                      {status.label}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {LOAN_PROGRESS_STATUS_OPTIONS.length > 5 ? (
            <div className="flex w-full items-center justify-end pt-1">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsExpanded((value) => !value)}
                className="h-auto px-0 py-0 text-[12px] font-normal leading-4 tracking-[-0.5px] text-[#737373] hover:bg-transparent hover:text-black"
              >
                {isExpanded ? "Collapse" : `${LOAN_PROGRESS_STATUS_OPTIONS.length - 5} more`}
              </Button>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
