import React from "react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export default function LoanDetailPlaceholderView({ title, description, icon: Icon }) {
  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between"
      >
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
            Loan Workspace
          </p>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-lg shadow-slate-300/60">
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-3xl font-bold tracking-tight text-slate-900">
                {title}
              </h2>
              <p className="mt-1 max-w-2xl text-sm text-slate-600 md:text-base">
                {description}
              </p>
            </div>
          </div>
        </div>
        <Badge className="w-fit border-0 bg-amber-100 px-3 py-1 text-amber-800">
          Placeholder
        </Badge>
      </motion.div>

      <Card className="border-0 bg-white/90 shadow-xl shadow-slate-200/70 backdrop-blur-sm">
        <CardContent className="p-8 md:p-10">
          <div className="max-w-3xl space-y-8">
            <div className="space-y-3">
              <h3 className="text-xl font-semibold text-slate-900">
                This subpage is ready for build-out.
              </h3>
              <p className="text-sm leading-6 text-slate-600 md:text-base">
                The loan detail navigation and route state are in place. Detailed
                content for {title.toLowerCase()} can be added without changing
                the page structure again.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-sm font-semibold text-slate-900">
                  Included now
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Dedicated subpage state, navigation, and a consistent shell for
                  the loan detail workspace.
                </p>
              </div>
              <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-5">
                <p className="text-sm font-semibold text-slate-900">
                  Next build step
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Replace this placeholder with the actual {title.toLowerCase()} workflow and data views.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
