import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FlaskConical, ArrowRight } from "lucide-react";
import { createPageUrl } from "@/utils";

export default function Quotes() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Quotes</h1>
          <p className="text-sm text-slate-500 mt-1">
            Select a quote tool to begin.
          </p>
        </div>

        <Card className="border border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FlaskConical className="w-4 h-4" />
              Toorak Evaluation
            </CardTitle>
            <CardDescription>
              Run Toorak Capital bridge loan rule evaluation in the UAT environment.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="bg-slate-900 hover:bg-slate-800">
              <a href={createPageUrl("ToorakEvaluation")}>
                Open Toorak Evaluation
                <ArrowRight className="w-4 h-4" />
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
