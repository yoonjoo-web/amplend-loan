import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { loan_product } = await req.json();

    // Determine prefix based on loan product
    let prefix = 'LFS'; // Default for Bridge, New Construction, Fix & Flip
    if (loan_product === 'dscr') {
      prefix = 'LFL';
    }

    // Get all existing loans with this prefix
    const allLoans = await base44.asServiceRole.entities.Loan.list();
    const loansWithPrefix = allLoans.filter(loan => 
      loan.loan_number && loan.loan_number.startsWith(prefix)
    );

    // Extract numeric parts and find used numbers
    const usedNumbers = new Set();
    loansWithPrefix.forEach(loan => {
      const match = loan.loan_number.match(/\d+$/);
      if (match) {
        usedNumbers.add(parseInt(match[0]));
      }
    });

    // Find the first available number starting from 1350
    let nextNumber = 1350;
    while (usedNumbers.has(nextNumber)) {
      nextNumber++;
    }

    const loanNumber = `${prefix}${nextNumber}`;

    return Response.json({ loan_number: loanNumber });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});