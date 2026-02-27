import React, { useMemo, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';
import DynamicFormRenderer from '../forms/DynamicFormRenderer';
import AddLiaisonModal from './AddLiaisonModal';
import { normalizeAppRole } from '@/components/utils/appRoles';
import { base44 } from '@/api/base44Client';

export default React.memo(function LoanTypeStep({ data, onChange, isReadOnly, currentUser, permissions, onAddLiaisonSave, hideInlineLiaisonControls = false }) {
  const [showAddLiaisonModal, setShowAddLiaisonModal] = useState(false);
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

  const getLiaisonIds = () => {
    if (data?.liaison_id) return [data.liaison_id];
    return Array.isArray(data?.liaison_ids) ? data.liaison_ids.filter(Boolean) : [];
  };

  // Load and resolve liaison names whenever liaison_ids change
  useEffect(() => {
    const resolveLiaisonNames = async () => {
      const liaisonIds = getLiaisonIds();
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
  }, [data?.liaison_id, data?.liaison_ids]);

  const handleAddLiaison = async (liaisonId) => {
    if (!liaisonId || !data?.id) return;
    const currentLiaisonId = data?.liaison_id || (Array.isArray(data?.liaison_ids) ? data.liaison_ids[0] : null);
    if (currentLiaisonId === liaisonId) return;
    
    console.log('DEBUG - Saving liaison:', { appId: data.id, liaisonId });
    
    try {
      // Save to database first
      const result = await base44.entities.LoanApplication.update(data.id, {
        liaison_id: liaisonId
      });
      console.log('DEBUG - Database save result:', result);
      
      // Update local state
      onChange({ liaison_id: liaisonId });
      
      // Reload parent to ensure persistence
      if (onAddLiaisonSave) {
        await onAddLiaisonSave();
      }
    } catch (error) {
      console.error('ERROR - Failed to save liaison:', error);
      throw error;
    }
  };

  const handleRemoveLiaison = async (indexToRemove) => {
    if (!data?.id) return;
    const existing = getLiaisonIds();
    const idToRemove = existing[indexToRemove];
    if (!idToRemove) return;
    
    try {
      await base44.entities.LoanApplication.update(data.id, {
        liaison_id: null
      });
      onChange({ liaison_id: null });
      
      if (onAddLiaisonSave) {
        await onAddLiaisonSave();
      }
    } catch (error) {
      console.error('ERROR - Failed to remove liaison:', error);
      throw error;
    }
  };

  return (
    <>
      <DynamicFormRenderer
        context="application"
        categoryFilter="loanType"
        data={data}
        onChange={onChange}
        isReadOnly={isReadOnly}
        showTabs={false}
      />
      
      {/* Assigned Liaisons Display */}
      {liaisonNames.length > 0 && (
        <div className="mt-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
          <h4 className="text-sm font-semibold text-slate-900 mb-3">Assigned Liaison</h4>
          <div className="flex flex-wrap gap-2">
            {liaisonNames.map((name, index) => (
              <Badge key={index} variant="secondary" className="flex items-center gap-2 px-3 py-1">
                {name}
                {!isReadOnly && (
                  <button
                    onClick={() => handleRemoveLiaison(index)}
                    className="ml-1 hover:text-red-600 transition-colors"
                    title="Remove liaison"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Add Liaison Button */}
      {canShowAddLiaison && !isReadOnly && !hideInlineLiaisonControls && (
        <div className="mt-4">
          <Button
            onClick={() => setShowAddLiaisonModal(true)}
            size="sm"
            className="bg-slate-800 hover:bg-slate-900 text-white"
          >
            {liaisonNames.length > 0 ? 'Change Liaison' : '+ Add Liaison'}
          </Button>
        </div>
      )}

      {!hideInlineLiaisonControls && (
        <AddLiaisonModal
          isOpen={showAddLiaisonModal}
          onClose={() => setShowAddLiaisonModal(false)}
          applicationData={data}
          onAddLiaison={handleAddLiaison}
          permissions={permissions}
        />
      )}
    </>
  );
});
