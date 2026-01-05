import React from 'react';
import DynamicFormRenderer from '../forms/DynamicFormRenderer';

export default React.memo(function LoanTypeStep({ data, onChange, isReadOnly }) {
  return (
    <DynamicFormRenderer
      context="application"
      categoryFilter="loanType"
      data={data}
      onChange={onChange}
      isReadOnly={isReadOnly}
      showTabs={false}
    />
  );
});