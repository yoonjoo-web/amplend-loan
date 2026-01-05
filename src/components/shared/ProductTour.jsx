import React, { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { X, ChevronRight, ChevronLeft, Check, MousePointer } from 'lucide-react';
import {
  STEP_TYPE,
  getNavTourSteps,
  getPageTourSteps,
  isFirstLogin,
  shouldShowPageTour,
  completeNavTour,
  completePageTour,
  resetAllTours
} from './tourConfig';

export default function ProductTour({ currentUser, pageName, onComplete, forceShow = false }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [targetRect, setTargetRect] = useState(null);
  const [tourSteps, setTourSteps] = useState([]);
  const [actionCompleted, setActionCompleted] = useState(false);
  const clickHandlerRef = useRef(null);

  useEffect(() => {
    if (!currentUser) return;

    // Force show bypasses all checks (used from Settings replay)
    if (forceShow) {
      const steps = pageName 
        ? getPageTourSteps(pageName, currentUser.app_role)
        : getNavTourSteps(currentUser.app_role);
      
      if (steps.length > 0) {
        setTourSteps(steps);
        setCurrentStep(0);
        setTimeout(() => {
          setIsVisible(true);
          updateTargetPosition(steps[0]);
        }, 500);
      }
      return;
    }

    // Auto-trigger only on first login
    if (!isFirstLogin(currentUser.id)) {
      setIsVisible(false);
      return;
    }

    // If pageName is provided, show page-specific tour
    if (pageName) {
      if (!shouldShowPageTour(currentUser.id, pageName)) {
        setIsVisible(false);
        return;
      }

      const steps = getPageTourSteps(pageName, currentUser.app_role);
      if (steps.length > 0) {
        setTourSteps(steps);
        setTimeout(() => {
          setIsVisible(true);
          updateTargetPosition(steps[0]);
        }, 800);
      }
      return;
    }

    // Show main navigation tour on first login
    const steps = getNavTourSteps(currentUser.app_role);
    setTourSteps(steps);

    if (steps.length > 0) {
      setTimeout(() => {
        setIsVisible(true);
        updateTargetPosition(steps[0]);
      }, 1000);
    }
  }, [currentUser, pageName, forceShow]);

  useEffect(() => {
    if (isVisible && tourSteps.length > 0 && currentStep < tourSteps.length) {
      updateTargetPosition(tourSteps[currentStep]);
      setActionCompleted(false);
      
      // Set up action listeners for interactive steps
      const step = tourSteps[currentStep];
      if (step.type === STEP_TYPE.CLICK) {
        setupClickListener(step);
      }
    }
    
    return () => {
      if (clickHandlerRef.current) {
        document.removeEventListener('click', clickHandlerRef.current, true);
        clickHandlerRef.current = null;
      }
    };
  }, [currentStep, isVisible, tourSteps]);

  const setupClickListener = (step) => {
    if (!step?.target) return;
    
    if (clickHandlerRef.current) {
      document.removeEventListener('click', clickHandlerRef.current, true);
    }
    
    clickHandlerRef.current = (e) => {
      try {
        const target = document.querySelector(step.target);
        if (target && (target.contains(e.target) || target === e.target)) {
          setActionCompleted(true);
          // Auto-advance after short delay
          setTimeout(() => {
            if (currentStep < tourSteps.length - 1) {
              setCurrentStep(prev => prev + 1);
            } else {
              completeTour();
            }
          }, 500);
        }
      } catch (error) {
        console.error('Tour click listener error:', error);
      }
    };
    
    document.addEventListener('click', clickHandlerRef.current, true);
  };



  const updateTargetPosition = (step) => {
    if (!step?.target) return;
    
    const target = document.querySelector(step.target);
    if (target) {
      const rect = target.getBoundingClientRect();
      setTargetRect(rect);
      
      // Highlight the target
      target.style.position = 'relative';
      target.style.zIndex = '9999';
      target.style.boxShadow = '0 0 0 4px rgba(59, 130, 246, 0.5), 0 0 0 9999px rgba(0, 0, 0, 0.5)';
      target.style.borderRadius = '8px';

      // Cleanup previous highlights
      document.querySelectorAll('[data-tour-highlight]').forEach(el => {
        if (el !== target) {
          el.style.boxShadow = '';
          el.style.zIndex = '';
          el.removeAttribute('data-tour-highlight');
        }
      });
      target.setAttribute('data-tour-highlight', 'true');

      // Scroll into view
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      // Target not found, hide tour
      setIsVisible(false);
    }
  };

  const clearHighlights = () => {
    document.querySelectorAll('[data-tour-highlight]').forEach(el => {
      el.style.boxShadow = '';
      el.style.zIndex = '';
      el.removeAttribute('data-tour-highlight');
    });
  };

  const handleNext = () => {
    const step = tourSteps[currentStep];
    if (!step) return;
    
    // For action steps, check if action was completed
    if (step.type === STEP_TYPE.CLICK && !actionCompleted) {
      // Highlight the target more prominently
      try {
        const target = document.querySelector(step.target);
        if (target) {
          target.style.boxShadow = '0 0 0 4px rgba(239, 68, 68, 0.7), 0 0 0 9999px rgba(0, 0, 0, 0.6)';
        }
      } catch (error) {
        console.error('Tour highlight error:', error);
      }
      return;
    }
    
    if (currentStep < tourSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      completeTour();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    completeTour(false); // Mark as complete even when closed early
  };

  const completeTour = (skipped = false) => {
    clearHighlights();
    setIsVisible(false);
    
    if (clickHandlerRef.current) {
      document.removeEventListener('click', clickHandlerRef.current, true);
      clickHandlerRef.current = null;
    }
    
    // Only mark tour as complete if user finished all steps (not skipped)
    if (!skipped) {
      if (pageName) {
        completePageTour(currentUser.id, pageName);
      } else {
        completeNavTour(currentUser.id);
      }
    }
    
    if (onComplete) onComplete();
  };

  // Expose reset function globally for Settings page
  useEffect(() => {
    window.resetProductTours = () => resetAllTours(currentUser?.id);
    return () => {
      delete window.resetProductTours;
    };
  }, [currentUser]);

  if (!isVisible || tourSteps.length === 0 || !targetRect) {
    return null;
  }

  const step = tourSteps[currentStep];
  const isActionStep = step.type === STEP_TYPE.CLICK || step.type === STEP_TYPE.INTERACT || step.type === STEP_TYPE.UPLOAD;
  
  // Calculate tooltip position with viewport boundary checks
  const getTooltipStyle = () => {
    const offset = 20;
    const tooltipWidth = 360;
    const tooltipHeight = 200; // Approximate height
    const padding = 20; // Minimum distance from viewport edges
    
    const style = {
      position: 'fixed',
      zIndex: 10000,
      maxWidth: `${tooltipWidth}px`
    };

    let placement = step.placement;
    
    // Check if preferred placement would go off-screen and adjust
    const wouldOverflowBottom = targetRect.bottom + offset + tooltipHeight > window.innerHeight - padding;
    const wouldOverflowTop = targetRect.top - offset - tooltipHeight < padding;
    const wouldOverflowRight = targetRect.right + offset + tooltipWidth > window.innerWidth - padding;
    const wouldOverflowLeft = targetRect.left - offset - tooltipWidth < padding;
    
    // Auto-adjust placement if it would overflow
    if (placement === 'bottom' && wouldOverflowBottom) {
      placement = 'top';
    } else if (placement === 'top' && wouldOverflowTop) {
      placement = 'bottom';
    } else if (placement === 'right' && wouldOverflowRight) {
      placement = 'left';
    } else if (placement === 'left' && wouldOverflowLeft) {
      placement = 'right';
    }

    switch (placement) {
      case 'right':
        style.left = `${Math.min(targetRect.right + offset, window.innerWidth - tooltipWidth - padding)}px`;
        style.top = `${Math.max(padding, Math.min(targetRect.top + (targetRect.height / 2), window.innerHeight - tooltipHeight - padding))}px`;
        style.transform = 'translateY(-50%)';
        break;
      case 'left':
        style.right = `${Math.min(window.innerWidth - targetRect.left + offset, window.innerWidth - padding)}px`;
        style.top = `${Math.max(padding, Math.min(targetRect.top + (targetRect.height / 2), window.innerHeight - tooltipHeight - padding))}px`;
        style.transform = 'translateY(-50%)';
        break;
      case 'top':
        style.left = `${Math.max(padding, Math.min(targetRect.left + (targetRect.width / 2), window.innerWidth - tooltipWidth / 2 - padding))}px`;
        style.bottom = `${Math.max(padding, window.innerHeight - targetRect.top + offset)}px`;
        style.transform = 'translateX(-50%)';
        break;
      case 'bottom':
        style.left = `${Math.max(padding, Math.min(targetRect.left + (targetRect.width / 2), window.innerWidth - tooltipWidth / 2 - padding))}px`;
        style.top = `${Math.min(targetRect.bottom + offset, window.innerHeight - tooltipHeight - padding)}px`;
        style.transform = 'translateX(-50%)';
        break;
      default:
        style.left = `${Math.min(targetRect.right + offset, window.innerWidth - tooltipWidth - padding)}px`;
        style.top = `${Math.max(padding, targetRect.top)}px`;
    }

    return style;
  };

  return (
    <>
      <Card className="shadow-2xl border-2 border-blue-500" style={getTooltipStyle()}>
        <CardContent className="p-5">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-bold text-lg text-slate-900">{step.title}</h3>
                {isActionStep && (
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-xs font-medium rounded-full flex items-center gap-1">
                    <MousePointer className="w-3 h-3" />
                    Action
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">{step.content}</p>
              
              {isActionStep && step.actionLabel && (
                <div className={`mt-3 p-2 rounded-lg flex items-center gap-2 ${
                  actionCompleted 
                    ? 'bg-green-50 border border-green-200' 
                    : 'bg-amber-50 border border-amber-200'
                }`}>
                  {actionCompleted ? (
                    <>
                      <Check className="w-4 h-4 text-green-600" />
                      <span className="text-sm text-green-700 font-medium">Action completed!</span>
                    </>
                  ) : (
                    <>
                      <MousePointer className="w-4 h-4 text-amber-600" />
                      <span className="text-sm text-amber-700 font-medium">{step.actionLabel}</span>
                    </>
                  )}
                </div>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSkip}
              className="h-8 w-8 -mt-1 -mr-1 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex items-center justify-between pt-3 border-t">
            <div className="text-xs text-slate-500">
              Step {currentStep + 1} of {tourSteps.length}
            </div>
            <div className="flex gap-2">
              {currentStep > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrevious}
                  className="h-8 px-3"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Back
                </Button>
              )}
              <Button
                size="sm"
                onClick={handleNext}
                disabled={isActionStep && !actionCompleted}
                className={`h-8 px-3 ${
                  isActionStep && !actionCompleted 
                    ? 'bg-slate-400 cursor-not-allowed' 
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {currentStep < tourSteps.length - 1 ? (
                  <>
                    {isActionStep && !actionCompleted ? 'Complete Action' : 'Next'}
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </>
                ) : (
                  'Finish'
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}