import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import DynamicFormRenderer from '../forms/DynamicFormRenderer';
import AddLiaisonModal from './AddLiaisonModal';
import { normalizeAppRole } from '@/components/utils/appRoles';

export default React.memo(function LoanTypeStep({ data, onChange, isReadOnly, currentUser, permissions }) {
  const [showAddLiaisonModal, setShowAddLiaisonModal] = useState(false);
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

  const handleAddLiaison = (liaisonId) => {
    if (!liaisonId) return;
    const existing = Array.isArray(data?.liaison_ids) ? data.liaison_ids : [];
    if (existing.includes(liaisonId)) return;
    onChange({ liaison_ids: [...existing, liaisonId] });
  };

  return (
    <>
      {canShowAddLiaison && (
        <div className="flex justify-end mb-4">
          <Button variant="outline" onClick={() => setShowAddLiaisonModal(true)}>
            Add Liaison
          </Button>
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
        onClose={() => setShowAddLiaisonModal(false)}
        applicationData={data}
        onAddLiaison={handleAddLiaison}
        permissions={permissions}
      />
    </>
  );
});
