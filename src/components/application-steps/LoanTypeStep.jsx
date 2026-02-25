import React, { useMemo, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import DynamicFormRenderer from '../forms/DynamicFormRenderer';
import AddLiaisonModal from './AddLiaisonModal';
import { normalizeAppRole } from '@/components/utils/appRoles';
import { base44 } from '@/api/base44Client';

export default React.memo(function LoanTypeStep({ data, onChange, isReadOnly, currentUser, permissions, onAddLiaisonSave }) {
  const [showAddLiaisonModal, setShowAddLiaisonModal] = useState(false);
  const [replaceLiaisonOnSelect, setReplaceLiaisonOnSelect] = useState(false);
  const [liaisonNames, setLiaisonNames] = useState([]);
  const normalizedRole = normalizeAppRole(currentUser?.app_role);
  const canShowAddLiaison = useMemo(() => {
    if (isReadOnly) return false;
    if (!currentUser && !permissions) return false;
    if (currentUser?.role === 'admin') return true;
    return Boolean(
      permissions?.isBorrower ||
      permissions?.isAdministrator ||
      permissions?.isLoanOfficer ||
      ['Borrower', 'Administrator', 'Loan Officer'].includes(normalizedRole)
    );
  }, [currentUser?.role, isReadOnly, normalizedRole, permissions]);

  // Load and resolve liaison names whenever liaison_ids change
  useEffect(() => {
    const resolveLiaisonNames = async () => {
      const liaisonIds = data?.liaison_ids || [];
      if (liaisonIds.length === 0) {
        setLiaisonNames([]);
        return;
      }

      try {
        const allPartners = await base44.entities.LoanPartner.list();
        const resolved = liaisonIds.map((id) => {
          if (!id) return null;
          const match = allPartners.find((p) => p.id === id || p.user_id === id);
          return match ? (match.name || match.contact_person || match.email || id) : id;
        }).filter(Boolean);
        setLiaisonNames(resolved);
      } catch (error) {
        console.error('Error resolving liaison names:', error);
        setLiaisonNames(liaisonIds.filter(Boolean));
      }
    };

    resolveLiaisonNames();
  }, [data?.liaison_ids]);

  const handleAddLiaison = async (liaisonId) => {
    if (!liaisonId || !data?.id) return;
    const existing = Array.isArray(data?.liaison_ids) ? data.liaison_ids : [];
    if (!replaceLiaisonOnSelect && existing.includes(liaisonId)) return;
    const updated = replaceLiaisonOnSelect ? [liaisonId] : [...existing, liaisonId];
    
    console.log('DEBUG - Saving liaison:', { appId: data.id, updated });
    
    try {
      // Save to database first
      const result = await base44.entities.LoanApplication.update(data.id, { liaison_ids: updated });
      console.log('DEBUG - Database save result:', result);
      
      // Update local state
      onChange({ liaison_ids: updated });
      
      // Reload parent to ensure persistence
      if (onAddLiaisonSave) {
        await onAddLiaisonSave();
      }
      setReplaceLiaisonOnSelect(false);
      setShowAddLiaisonModal(false);
    } catch (error) {
      console.error('ERROR - Failed to save liaison:', error);
      throw error;
    }
  };

  const handleRemoveLiaison = async () => {
    if (!data?.id) return;

    try {
      await base44.entities.LoanApplication.update(data.id, { liaison_ids: [] });
      onChange({ liaison_ids: [] });
      if (onAddLiaisonSave) {
        await onAddLiaisonSave();
      }
    } catch (error) {
      console.error('ERROR - Failed to remove liaison:', error);
      throw error;
    }
  };

  const hasAssignedLiaison = Array.isArray(data?.liaison_ids) && data.liaison_ids.length > 0;

  return (
    <>
      {canShowAddLiaison && (
        <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-900">Assigned Liaison</p>
              {liaisonNames.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {liaisonNames.map((name) => (
                    <Badge key={name} variant="secondary">{name}</Badge>
                  ))}
                </div>
              ) : (
                <p className="mt-1 text-sm text-slate-600">No liaison assigned</p>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setReplaceLiaisonOnSelect(hasAssignedLiaison);
                  setShowAddLiaisonModal(true);
                }}
              >
                {hasAssignedLiaison ? 'Change Liaison' : 'Assign Liaison'}
              </Button>
              {hasAssignedLiaison && (
                <Button
                  type="button"
                  variant="ghost"
                  className="text-red-600 hover:text-red-700"
                  onClick={handleRemoveLiaison}
                >
                  Remove
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
      <DynamicFormRenderer
        context="application"
        categoryFilter="loanType"
        data={data}
        onChange={onChange}
        isReadOnly={isReadOnly}
        showTabs={false}
      />
      <AddLiaisonModal
        isOpen={showAddLiaisonModal}
        onClose={() => {
          setShowAddLiaisonModal(false);
          setReplaceLiaisonOnSelect(false);
        }}
        applicationData={data}
        onAddLiaison={handleAddLiaison}
        permissions={permissions}
      />
    </>
  );
});
