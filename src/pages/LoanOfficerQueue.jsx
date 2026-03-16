import React, { useEffect } from "react";
import { createPageUrl } from "@/utils";

export default function LoanOfficerQueue() {
  useEffect(() => {
    window.location.replace(`${createPageUrl("Settings")}?tab=loan-officer-queue`);
  }, []);

  return null;
}
