import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Clock, Users } from "lucide-react";

export default function CoBorrowerSummaryView({ coBorrowers = [], applicationStatus }) {
  if (!coBorrowers || coBorrowers.length === 0) {
    return (
      <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-5 h-5" />
            Co-Borrowers
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-slate-500 text-center py-8">No co-borrowers added to this application.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Users className="w-5 h-5" />
          Co-Borrowers ({coBorrowers.length})
        </CardTitle>
        <p className="text-sm text-slate-600 mt-1">
          Track the status of co-borrowers participating in this application
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {coBorrowers.map((coBorrower, index) => {
          const hasSignedConsent = coBorrower.esignature && coBorrower.esignature.trim() !== '';
          const hasBorrowerInfo = coBorrower.first_name && coBorrower.last_name;
          
          return (
            <div 
              key={coBorrower.id || index}
              className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold">
                  {index + 1}
                </div>
                <div>
                  <p className="font-semibold text-slate-900">
                    {coBorrower.first_name && coBorrower.last_name 
                      ? `${coBorrower.first_name} ${coBorrower.last_name}`
                      : coBorrower.email || `Co-Borrower ${index + 1}`}
                  </p>
                  {coBorrower.email && coBorrower.first_name && (
                    <p className="text-sm text-slate-500">{coBorrower.email}</p>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {/* Borrower Info Status */}
                <Badge 
                  className={hasBorrowerInfo 
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300' 
                    : 'bg-amber-100 text-amber-800 border-amber-300'
                  }
                >
                  {hasBorrowerInfo ? (
                    <>
                      <Check className="w-3 h-3 mr-1" />
                      Info Completed
                    </>
                  ) : (
                    <>
                      <Clock className="w-3 h-3 mr-1" />
                      Info Pending
                    </>
                  )}
                </Badge>
                
                {/* Consent & E-Sign Status */}
                <Badge 
                  className={hasSignedConsent 
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300' 
                    : 'bg-amber-100 text-amber-800 border-amber-300'
                  }
                >
                  {hasSignedConsent ? (
                    <>
                      <Check className="w-3 h-3 mr-1" />
                      Signed
                    </>
                  ) : (
                    <>
                      <Clock className="w-3 h-3 mr-1" />
                      Not Signed
                    </>
                  )}
                </Badge>
              </div>
            </div>
          );
        })}
        
        {/* Summary */}
        <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-sm text-blue-800">
            <strong>Note:</strong> All co-borrowers must complete their borrower information and sign their consent forms before you can submit the application.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}