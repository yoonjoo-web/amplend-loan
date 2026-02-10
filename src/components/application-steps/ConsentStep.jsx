import React, { useState, useEffect, useRef } from 'react';
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FileText, PenTool, Check, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import FieldChangeIndicator from "./FieldChangeIndicator";

export default React.memo(function ConsentStep({ data, onChange, isReadOnly, borrowerData, onSubmit, isProcessing, isCoBorrowerConsent = false, coBorrowerUserId = null, canManage = false, canSignApplication = true, canSubmitApplication = true }) {
  const { toast } = useToast();
  const hasInitialized = useRef(false);

  const [outstandingJudgments, setOutstandingJudgments] = useState('');
  const [bankruptcy36Months, setBankruptcy36Months] = useState('');
  const [foreclosure36Months, setForeclosure36Months] = useState('');
  const [lawsuit, setLawsuit] = useState('');
  const [mortgageLate, setMortgageLate] = useState('');
  const [downPaymentBorrowed, setDownPaymentBorrowed] = useState('');
  const [felonyConvictions, setFelonyConvictions] = useState('');
  const [usCitizen, setUsCitizen] = useState('');
  const [primaryResidence, setPrimaryResidence] = useState('');
  const [acknowledgementAgreed, setAcknowledgementAgreed] = useState(false);
  const [authorizationAgreed, setAuthorizationAgreed] = useState(false);
  const [esignature, setEsignature] = useState('');
  const [esignatureDate, setEsignatureDate] = useState(null);

  const [declarationErrors, setDeclarationErrors] = useState({});
  const [acknowledgementError, setAcknowledgementError] = useState('');
  const [authorizationError, setAuthorizationError] = useState('');
  const [signatureError, setSignatureError] = useState('');

  // Get co-borrower data if this is a co-borrower consent view
  const getCoBorrowerData = () => {
    if (!isCoBorrowerConsent || !coBorrowerUserId || !data?.co_borrowers) return null;
    return data.co_borrowers.find(cb => cb.user_id === coBorrowerUserId);
  };

  const coBorrowerData = getCoBorrowerData();

  useEffect(() => {
    if (data && !hasInitialized.current) {
      // For co-borrowers, use their own consent data from the co_borrowers array
      if (isCoBorrowerConsent && coBorrowerData) {
        setOutstandingJudgments(coBorrowerData.outstanding_judgments || '');
        setBankruptcy36Months(coBorrowerData.bankruptcy_36_months || '');
        setForeclosure36Months(coBorrowerData.foreclosure_36_months || '');
        setLawsuit(coBorrowerData.lawsuit || '');
        setMortgageLate(coBorrowerData.mortgage_late || '');
        setDownPaymentBorrowed(coBorrowerData.down_payment_borrowed || '');
        setFelonyConvictions(coBorrowerData.felony_convictions || '');
        setUsCitizen(coBorrowerData.us_citizen || '');
        setPrimaryResidence(coBorrowerData.primary_residence || '');
        setAcknowledgementAgreed(coBorrowerData.acknowledgement_agreed || false);
        setAuthorizationAgreed(coBorrowerData.authorization_agreed || false);
        setEsignature(coBorrowerData.esignature || '');
        setEsignatureDate(coBorrowerData.esignature_date || null);
      } else {
        // Primary borrower consent data
        setOutstandingJudgments(data.outstanding_judgments || '');
        setBankruptcy36Months(data.bankruptcy_36_months || '');
        setForeclosure36Months(data.foreclosure_36_months || '');
        setLawsuit(data.lawsuit || '');
        setMortgageLate(data.mortgage_late || '');
        setDownPaymentBorrowed(data.down_payment_borrowed || '');
        setFelonyConvictions(data.felony_convictions || '');
        setUsCitizen(data.us_citizen || '');
        setPrimaryResidence(data.primary_residence || '');
        setAcknowledgementAgreed(data.acknowledgement_agreed || false);
        setAuthorizationAgreed(data.authorization_agreed || false);

        if (isReadOnly) {
          setEsignature(data.esignature || '');
          setEsignatureDate(data.esignature_date || null);
        } else {
          if (data.status === 'review_completed' && data.esignature) {
            setEsignature('');
            setEsignatureDate(null);
            onChange({
              esignature: '',
              esignature_date: null
            });
          } else {
            setEsignature(data.esignature || '');
            setEsignatureDate(data.esignature_date || null);
          }
        }
      }

      hasInitialized.current = true;
    }
  }, [data, isReadOnly, isCoBorrowerConsent, coBorrowerData]);

  const handleDeclarationChange = (key, value) => {
    if (isReadOnly && !canManage) return;

    switch (key) {
      case 'outstanding_judgments':setOutstandingJudgments(value);break;
      case 'bankruptcy_36_months':setBankruptcy36Months(value);break;
      case 'foreclosure_36_months':setForeclosure36Months(value);break;
      case 'lawsuit':setLawsuit(value);break;
      case 'mortgage_late':setMortgageLate(value);break;
      case 'down_payment_borrowed':setDownPaymentBorrowed(value);break;
      case 'felony_convictions':setFelonyConvictions(value);break;
      case 'us_citizen':setUsCitizen(value);break;
      case 'primary_residence':setPrimaryResidence(value);break;
      default:break;
    }

    // For co-borrowers, update their specific consent data in the co_borrowers array
    if (isCoBorrowerConsent && coBorrowerUserId && data?.co_borrowers) {
      const updatedCoBorrowers = data.co_borrowers.map(cb => {
        if (cb.user_id === coBorrowerUserId) {
          return { ...cb, [key]: value };
        }
        return cb;
      });
      onChange({ co_borrowers: updatedCoBorrowers });
    } else {
      onChange({ [key]: value });
    }
    setDeclarationErrors((prev) => ({ ...prev, [key]: '' }));
  };

  const handleAcknowledgementChange = (checked) => {
    if (isReadOnly && !canManage) return;
    setAcknowledgementAgreed(checked);
    
    if (isCoBorrowerConsent && coBorrowerUserId && data?.co_borrowers) {
      const updatedCoBorrowers = data.co_borrowers.map(cb => {
        if (cb.user_id === coBorrowerUserId) {
          return { ...cb, acknowledgement_agreed: checked };
        }
        return cb;
      });
      onChange({ co_borrowers: updatedCoBorrowers });
    } else {
      onChange({ acknowledgement_agreed: checked });
    }
    setAcknowledgementError(checked ? '' : 'You must agree to the acknowledgement');
  };

  const handleAuthorizationChange = (checked) => {
    if (isReadOnly && !canManage) return;
    setAuthorizationAgreed(checked);
    
    if (isCoBorrowerConsent && coBorrowerUserId && data?.co_borrowers) {
      const updatedCoBorrowers = data.co_borrowers.map(cb => {
        if (cb.user_id === coBorrowerUserId) {
          return { ...cb, authorization_agreed: checked };
        }
        return cb;
      });
      onChange({ co_borrowers: updatedCoBorrowers });
    } else {
      onChange({ authorization_agreed: checked });
    }
    setAuthorizationError(checked ? '' : 'You must agree to the authorization');
  };

  const handleEsignatureChange = (e) => {
    if ((isReadOnly && !canManage) || !canSignApplication) return;
    const value = e.target.value;
    setEsignature(value);
    setSignatureError('');

    const newDate = value.trim() ? new Date().toISOString() : null;
    setEsignatureDate(newDate);

    if (isCoBorrowerConsent && coBorrowerUserId && data?.co_borrowers) {
      const updatedCoBorrowers = data.co_borrowers.map(cb => {
        if (cb.user_id === coBorrowerUserId) {
          return { ...cb, esignature: value, esignature_date: newDate };
        }
        return cb;
      });
      onChange({ co_borrowers: updatedCoBorrowers });
    } else {
      onChange({
        esignature: value,
        esignature_date: newDate
      });
    }
  };

  const validateDeclarations = () => {
    const errors = {};
    if (!outstandingJudgments) errors.outstanding_judgments = 'Please select Yes or No';
    if (!bankruptcy36Months) errors.bankruptcy_36_months = 'Please select Yes or No';
    if (!foreclosure36Months) errors.foreclosure_36_months = 'Please select Yes or No';
    if (!lawsuit) errors.lawsuit = 'Please select Yes or No';
    if (!mortgageLate) errors.mortgage_late = 'Please select Yes or No';
    if (!downPaymentBorrowed) errors.down_payment_borrowed = 'Please select Yes or No';
    if (!felonyConvictions) errors.felony_convictions = 'Please select Yes or No';
    if (!usCitizen) errors.us_citizen = 'Please select Yes or No';
    if (!primaryResidence) errors.primary_residence = 'Please select Yes or No';
    return errors;
  };

  const handleSubmit = async () => {
    if (isReadOnly || isProcessing || !data) return;
    if (!canSubmitApplication || !canSignApplication) {
      toast({
        variant: "destructive",
        title: "Action Not Allowed",
        description: "Liaisons cannot sign or submit applications. Please contact the primary borrower.",
      });
      return;
    }

    const declarationValidationErrors = validateDeclarations();
    const acknowledgementValidation = acknowledgementAgreed ? '' : 'You must agree to the acknowledgement';
    const authorizationValidation = authorizationAgreed ? '' : 'You must agree to the authorization';
    const signatureValidation = esignature.trim() ? '' : 'Please type your full legal name to sign';

    setDeclarationErrors(declarationValidationErrors);
    setAcknowledgementError(acknowledgementValidation);
    setAuthorizationError(authorizationValidation);
    setSignatureError(signatureValidation);

    if (
    Object.keys(declarationValidationErrors).length > 0 ||
    acknowledgementValidation ||
    authorizationValidation ||
    signatureValidation)
    {
      toast({
        variant: "destructive",
        title: "Incomplete Form",
        description: "Please complete all required fields and agreements before submitting."
      });
      return;
    }

    // For co-borrowers, they just save their consent - they don't submit the full application
    if (isCoBorrowerConsent) {
      toast({
        title: "Consent Saved",
        description: "Your consent and signature have been saved. The primary borrower will submit the application when all borrowers are ready."
      });
      return;
    }

    onSubmit('submitted');
  };

  if (!data) {
    return <div>Loading...</div>;
  }

  const DeclarationQuestionItem = ({ questionKey, label, value, onChangeHandler, error }) => {
    return (
      <div className="space-y-3 relative">
        <div className="flex items-start justify-between gap-2">
          <Label className="text-sm font-medium text-slate-900">{label} *</Label>
          <FieldChangeIndicator fieldName={questionKey} applicationData={data} />
        </div>
        <RadioGroup
          value={value}
          onValueChange={(val) => onChangeHandler(questionKey, val)}
          className="flex space-x-6"
          disabled={isReadOnly && !canManage}>

          <div className="flex items-center space-x-2">
            <RadioGroupItem value="yes" id={`${questionKey}-yes`} />
            <Label htmlFor={`${questionKey}-yes`} className="cursor-pointer">Yes</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="no" id={`${questionKey}-no`} />
            <Label htmlFor={`${questionKey}-no`} className="cursor-pointer">No</Label>
          </div>
        </RadioGroup>
        {error &&
        <p className="text-red-500 text-sm">{error}</p>
        }
      </div>);

  };

  return (
    <div className="space-y-8">
      {/* Borrower Declaration */}
      <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Borrower Declaration
          </CardTitle>
          <CardDescription>Please answer the following questions truthfully</CardDescription>
        </CardHeader>
        <CardContent className="pr-6 pb-6 pl-6 space-y-6">
          <DeclarationQuestionItem
            questionKey="outstanding_judgments"
            label="Are there any outstanding judgments against you?"
            value={outstandingJudgments}
            onChangeHandler={handleDeclarationChange}
            error={declarationErrors.outstanding_judgments} />

          <DeclarationQuestionItem
            questionKey="bankruptcy_36_months"
            label="Have you been declared bankrupt within the past 36 months?"
            value={bankruptcy36Months}
            onChangeHandler={handleDeclarationChange}
            error={declarationErrors.bankruptcy_36_months} />

          <DeclarationQuestionItem
            questionKey="foreclosure_36_months"
            label="Have you had property foreclosed upon, short sale, or deed in lieu thereof in the last 36 months?"
            value={foreclosure36Months}
            onChangeHandler={handleDeclarationChange}
            error={declarationErrors.foreclosure_36_months} />

          <DeclarationQuestionItem
            questionKey="lawsuit"
            label="Are you a party to a lawsuit at the moment?"
            value={lawsuit}
            onChangeHandler={handleDeclarationChange}
            error={declarationErrors.lawsuit} />

          <DeclarationQuestionItem
            questionKey="mortgage_late"
            label="Have you had mortgage late payment in last 12 months OR mortgage delinquencies of 60+ days in last 24 months?"
            value={mortgageLate}
            onChangeHandler={handleDeclarationChange}
            error={declarationErrors.mortgage_late} />

          <DeclarationQuestionItem
            questionKey="down_payment_borrowed"
            label="Is any part of the down payment borrowed?"
            value={downPaymentBorrowed}
            onChangeHandler={handleDeclarationChange}
            error={declarationErrors.down_payment_borrowed} />

          <DeclarationQuestionItem
            questionKey="felony_convictions"
            label="Have you had previous felony convictions, misdemeanors involving fraud, embezzlement, or other similar crimes?"
            value={felonyConvictions}
            onChangeHandler={handleDeclarationChange}
            error={declarationErrors.felony_convictions} />

          <DeclarationQuestionItem
            questionKey="us_citizen"
            label="Are you a U.S. citizen or a permanent resident alien?"
            value={usCitizen}
            onChangeHandler={handleDeclarationChange}
            error={declarationErrors.us_citizen} />

          <DeclarationQuestionItem
            questionKey="primary_residence"
            label="Do you intend to occupy the property as your primary residence?"
            value={primaryResidence}
            onChangeHandler={handleDeclarationChange}
            error={declarationErrors.primary_residence} />

        </CardContent>
      </Card>

      {/* Acknowledgement and Agreement */}
      <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Acknowledgement and Agreement
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 max-h-64 overflow-y-auto">
            <p className="text-sm text-slate-700 leading-relaxed">
              Each of the undersigned specifically represents to Lender and to Lender's actual or potential agents, brokers, processors, attorneys, insurers, servicers, successors and assigns and agrees and acknowledges that: (1) the information provided in this application is true and correct as of the date set forth opposite my signature and that any intentional or negligent misrepresentation of this information contained in this application may result in civil liability, including monetary damages, to any person who may suffer any loss due to reliance upon any misrepresentation that I have made on this application, and/or in criminal penalties including, but not limited to, fine or imprisonment or both under the provisions of Title 18, United States Code, Sec. 1001, et seq.; (2) the loan requested pursuant to this application (the "Loan") will be secured by a mortgage or deed of trust on the property described in this application; (3) the property will not be used for any illegal or prohibited purpose or use; (4) all statements made in this application are made for the purpose of obtaining a residential mortgage loan; (5) the property will be occupied as indicated in this application; (6) the Lender, its servicers, successors or assigns may retain the original and/or an electronic record of this application, whether or not the Loan is approved; (7) the Lender and its agents, brokers, insurers, servicers, and assigns may continuously rely on the information contained in the application, and I am obligated to amend and/or supplement the information provided in this application if any of the material facts that I have represented should change prior to closing of the Loan; (8) in the event that my payments on the Loan become delinquent, the Lender, its servicers, successors or assigns may, in addition to any other rights and remedies that it may have relating to such delinquency, report my name and account information to one or more consumer reporting agencies; (9) ownership of the Loan and/or administration of the Loan account may be transferred with such notice as may be required by law; (10) neither Lender nor its agents, brokers, insurers, servicers, successors or assigns has made any representation or warranty, express or implied, to me regarding the property or the condition or value of the property; and (11) my transmission of this application as an "electronic record" containing my "electronic signature," as those terms are defined in applicable federal and/or state laws (excluding audio and video recordings), or my facsimile transmission of this application containing a facsimile of my signature, shall be as effective, enforceable and valid as if a paper version of this application were delivered containing my original written signature.
            </p>
          </div>
          <div className="flex items-start space-x-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <Checkbox
              id="acknowledgement"
              checked={acknowledgementAgreed}
              onCheckedChange={handleAcknowledgementChange}
              disabled={isReadOnly && !canManage} />

            <div className="flex-1">
              <Label htmlFor="acknowledgement" className="text-sm leading-relaxed cursor-pointer font-medium">
                I acknowledge that I have read and agree to the above Acknowledgement and Agreement *
              </Label>
              {acknowledgementError && <p className="text-red-500 text-sm mt-2">{acknowledgementError}</p>}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Borrower's Authorization to Release Information */}
      <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Authorization to Release Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 max-h-64 overflow-y-auto">
            <p className="text-sm text-slate-700 leading-relaxed mb-4">
              I/We understand that by signing this application, I/We hereby authorize Lender on its own or through its service provider to conduct:
            </p>
            <ol className="list-decimal ml-5 space-y-2 text-sm text-slate-700">
              <li>A consumer credit report to verify other credit information, including past and present</li>
              <li>A Background investigation report and verify both criminal and civil records.</li>
            </ol>
            <p className="text-sm text-slate-700 leading-relaxed mt-4">
              It is understood that a copy of this form will also serve as authorization to conduct these checks. The information gathered is connected with a credit transaction involving me/us. The information that Lender obtains is only to be used in conjunction with this application for the Loan.
            </p>
            <p className="text-sm text-slate-700 leading-relaxed mt-4">
              I understand the information collected as part of the credit and background investigation will be shared with the Lender on behalf of me/us to evaluate the commercial mortgage I/We consider. This investigation is authorized irrespective of the person(s) or entity(s) that pays for said investigation. This investigation authorization expires 60 days from the signed date.
            </p>
          </div>
          <div className="flex items-start space-x-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <Checkbox
              id="authorization"
              checked={authorizationAgreed}
              onCheckedChange={handleAuthorizationChange}
              disabled={isReadOnly && !canManage} />

            <div className="flex-1">
              <Label htmlFor="authorization" className="text-sm leading-relaxed cursor-pointer font-medium">
                I authorize the Lender to conduct credit and background investigations as described above *
              </Label>
              {authorizationError && <p className="text-red-500 text-sm mt-2">{authorizationError}</p>}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Additional Comments */}
      <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Additional Comments
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            id="overall_notes"
            value={data.notes || ''}
            onChange={(e) => onChange({ notes: e.target.value })}
            placeholder="Add any additional comments, questions, or information here..."
            className="h-32 resize-none"
            readOnly={isReadOnly && !canManage} />

        </CardContent>
      </Card>

      {/* Electronic Signature */}
      <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <PenTool className="w-5 h-5" />
            Electronic Signature
          </CardTitle>
          <CardDescription>
            {isReadOnly ?
            "Application signature" :
            data.status === 'review_completed' ?
            "Please re-sign the application to resubmit" :
            "Type your full legal name to sign this application electronically"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!canSignApplication && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              Liaisons cannot sign or submit applications. Please contact the primary borrower.
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="signature">Your Full Legal Name *</Label>
            <Input
              id="signature"
              placeholder="John Smith"
              value={esignature}
              onChange={handleEsignatureChange}
              disabled={(isReadOnly && !canManage) || !canSignApplication}
              className="font-serif text-lg" />

            {signatureError && <p className="text-red-500 text-sm">{signatureError}</p>}
          </div>

          {esignature.trim() &&
          <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-200">
              <div className="flex items-center gap-2 text-emerald-700 mb-2">
                <Check className="w-5 h-5" />
                <span className="font-semibold">Electronically signed</span>
              </div>
              <p className="text-sm text-emerald-700">
                Signature: <span className="font-serif text-base">{esignature}</span>
              </p>
              {esignatureDate &&
            <p className="text-xs text-emerald-600 mt-1">
                  Signed on: {new Date(esignatureDate).toLocaleDateString()} at {new Date(esignatureDate).toLocaleTimeString()}
                </p>
            }
            </div>
          }

          {/* Submit Button */}
          {!isReadOnly &&
          <div className="pt-6 border-t-2 border-slate-200">
              <Button
              onClick={handleSubmit}
              disabled={isProcessing || !canSubmitApplication || !canSignApplication}
              className="w-full bg-slate-900 hover:bg-slate-800 text-lg py-6">

                {isProcessing ?
              <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    {isCoBorrowerConsent ? 'Saving...' : 'Submitting Application...'}
                  </> :

              isCoBorrowerConsent 
                ? 'Save My Consent & Signature'
                : data.status === 'review_completed' 
                  ? 'Resubmit Application' 
                  : 'Submit Application'
              }
              </Button>
              {isCoBorrowerConsent && (
                <p className="text-sm text-slate-500 text-center mt-3">
                  The primary borrower will submit the full application once all borrowers have signed.
                </p>
              )}
            </div>
          }
        </CardContent>
      </Card>
    </div>);

});
