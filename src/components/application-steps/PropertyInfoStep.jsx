import React, { useEffect, useState, useRef } from 'react';
import DynamicFormRenderer from '../forms/DynamicFormRenderer';
import { Button } from "@/components/ui/button";
import { History } from "lucide-react";
import PropertyChangeHistoryModal from './PropertyChangeHistoryModal';

export default React.memo(function PropertyInfoStep({ data, onChange, isReadOnly, currentUser, canManage, onAddComment, fieldComments }) {
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [lastViewedHistoryCount, setLastViewedHistoryCount] = useState(0);
  const saveTimeoutRef = useRef(null);
  const originalValuesRef = useRef({});
  const hasUnsavedChangesRef = useRef(false);

  useEffect(() => {
    const saved = localStorage.getItem(`property_history_viewed_${data?.id}`);
    if (saved) {
      setLastViewedHistoryCount(parseInt(saved, 10));
    }
  }, [data?.id]);

  const handlePropertyChange = (newData) => {
    const propertyFields = Object.keys(newData).filter(key => 
      key.startsWith('property_') || 
      key.startsWith('number_of_') || 
      key.startsWith('purchase_') || 
      key.startsWith('after_repair_') || 
      key.startsWith('rehab_') || 
      key.startsWith('completed_') || 
      key.startsWith('contact_')
    );
    
    propertyFields.forEach(field => {
      if (data[field] !== newData[field]) {
        if (!originalValuesRef.current.hasOwnProperty(field)) {
          originalValuesRef.current[field] = data[field] || '';
        }
        hasUnsavedChangesRef.current = true;
      }
    });

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    onChange(newData);

    saveTimeoutRef.current = setTimeout(() => {
      if (hasUnsavedChangesRef.current) {
        saveChangesToHistory(newData);
      }
    }, 2000);
  };

  const saveChangesToHistory = (newData) => {
    if (!currentUser || !hasUnsavedChangesRef.current) {
      return;
    }

    const changedFields = [];
    
    Object.keys(originalValuesRef.current).forEach(field => {
      const originalValue = originalValuesRef.current[field];
      const currentValue = newData[field] || '';
      
      if (originalValue !== currentValue) {
        changedFields.push({
          field_name: field,
          old_value: originalValue?.toString() || '',
          new_value: currentValue?.toString() || ''
        });
      }
    });

    if (changedFields.length > 0) {
      const existingHistory = data?.property_modification_history || [];
      
      const newHistory = changedFields.map(change => ({
        timestamp: new Date().toISOString(),
        modified_by: currentUser.id,
        modified_by_name: `${currentUser.first_name} ${currentUser.last_name}`,
        field_name: change.field_name,
        old_value: change.old_value,
        new_value: change.new_value
      }));
      
      const updatedHistory = [...existingHistory, ...newHistory];

      onChange({
        ...newData,
        property_modification_history: updatedHistory
      });
    }

    originalValuesRef.current = {};
    hasUnsavedChangesRef.current = false;
  };

  const handleViewHistory = () => {
    const currentHistoryCount = data?.property_modification_history?.length || 0;
    localStorage.setItem(`property_history_viewed_${data?.id}`, currentHistoryCount.toString());
    setLastViewedHistoryCount(currentHistoryCount);
    setShowHistoryModal(true);
  };

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  const historyCount = data?.property_modification_history?.length || 0;
  const newChangesCount = Math.max(0, historyCount - lastViewedHistoryCount);

  return (
    <div className="space-y-6 pb-8">
      {historyCount > 0 && (
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={handleViewHistory}
            className="gap-2"
          >
            <History className="w-4 h-4" />
            View Change History {newChangesCount > 0 && `(${newChangesCount})`}
          </Button>
        </div>
      )}

      <DynamicFormRenderer
        context="application"
        categoryFilter="propertyInformation"
        data={data}
        onChange={handlePropertyChange}
        isReadOnly={isReadOnly}
        onAddComment={onAddComment}
        fieldComments={fieldComments}
        canManage={canManage}
        applicationStatus={data?.status}
        showTabs={false}
      />

      <PropertyChangeHistoryModal
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        history={data?.property_modification_history}
      />
    </div>
  );
});