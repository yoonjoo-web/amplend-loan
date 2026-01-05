import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only admin, Administrator, or Loan Officer can update profiles from loan
    if (user.role !== 'admin' && user.app_role !== 'Administrator' && user.app_role !== 'Loan Officer') {
      return Response.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { loan_id } = await req.json();

    if (!loan_id) {
      return Response.json({ error: 'loan_id is required' }, { status: 400 });
    }

    // Get the loan data
    const loan = await base44.asServiceRole.entities.Loan.get(loan_id);
    if (!loan) {
      return Response.json({ error: 'Loan not found' }, { status: 404 });
    }

    const updates = {
      borrowers: [],
      entities: []
    };

    console.log('[updateProfileFromLoan] ====== LOAN DATA ======');
    console.log('[updateProfileFromLoan] Loan ID:', loan_id);
    console.log('[updateProfileFromLoan] Borrower type:', loan.borrower_type);
    console.log('[updateProfileFromLoan] Borrower IDs:', loan.borrower_ids);
    console.log('[updateProfileFromLoan] Individual information array length:', loan.individual_information?.length || 0);
    console.log('[updateProfileFromLoan] Individual information:', JSON.stringify(loan.individual_information, null, 2));

    // Get all borrowers first
    const allBorrowers = await base44.asServiceRole.entities.Borrower.list();
    console.log('[updateProfileFromLoan] Total borrowers in system:', allBorrowers.length);

    // Update individual borrowers (process for both individual and entity borrower types)
    if (loan.individual_information && loan.individual_information.length > 0) {
      console.log('[updateProfileFromLoan] ====== PROCESSING INDIVIDUAL BORROWERS ======');
      
      for (let i = 0; i < loan.individual_information.length; i++) {
        const individualData = loan.individual_information[i];
        console.log(`[updateProfileFromLoan] Processing individual #${i + 1}:`, JSON.stringify(individualData, null, 2));
        
        try {
          const borrowerEmail = individualData.individual_email;
          console.log('[updateProfileFromLoan] Looking for borrower with email:', borrowerEmail);
          
          const borrower = allBorrowers.find(b => b.email === borrowerEmail);
          
          if (!borrower) {
            console.log('[updateProfileFromLoan] ❌ NO BORROWER FOUND for email:', borrowerEmail);
            console.log('[updateProfileFromLoan] Available borrower emails:', allBorrowers.map(b => b.email).join(', '));
            continue;
          }
          
          console.log('[updateProfileFromLoan] ✓ Found borrower:', {
            id: borrower.id,
            name: `${borrower.first_name} ${borrower.last_name}`,
            email: borrower.email,
            user_id: borrower.user_id
          });

          const updatedData = {};
          
          if (individualData.first_name) updatedData.first_name = individualData.first_name;
          if (individualData.last_name) updatedData.last_name = individualData.last_name;
          if (individualData.individual_email) updatedData.email = individualData.individual_email;
          if (individualData.individual_phone_number) updatedData.phone = individualData.individual_phone_number;
          if (individualData.rehab_experience !== undefined) {
            updatedData.rehabs_done_36_months = individualData.rehab_experience;
          }
          if (individualData.individual_construction_experience !== undefined) {
            updatedData.rentals_owned_36_months = individualData.individual_construction_experience;
          }
          if (individualData.credit_score_median) updatedData.credit_score = individualData.credit_score_median;
          if (individualData.credit_expiration_date) updatedData.credit_expiration_date = individualData.credit_expiration_date;
          if (individualData.credit_expiration_date) updatedData.credit_expiration_date = individualData.credit_expiration_date;

          console.log('[updateProfileFromLoan] Update data prepared:', JSON.stringify(updatedData, null, 2));

          if (Object.keys(updatedData).length > 0) {
            console.log('[updateProfileFromLoan] Updating borrower...');
            await base44.asServiceRole.entities.Borrower.update(borrower.id, updatedData);
            updates.borrowers.push(borrower.id);
            console.log('[updateProfileFromLoan] ✓ Successfully updated borrower:', borrower.id);
          } else {
            console.log('[updateProfileFromLoan] No data to update for borrower');
          }
        } catch (error) {
          console.error('[updateProfileFromLoan] ❌ Error updating borrower:', error);
        }
      }
    } else {
      console.log('[updateProfileFromLoan] ====== NO INDIVIDUAL INFORMATION TO PROCESS ======');
      console.log('[updateProfileFromLoan] has individual_information=' + (!!loan.individual_information) + ', length=' + (loan.individual_information?.length || 0));
    }

    // Update entity
    if (loan.borrower_type === 'entity' && loan.borrower_entity_name) {
      try {
        // Find entity by name
        const entities = await base44.asServiceRole.entities.BorrowerEntity.list();
        const entity = entities.find(e => e.entity_name === loan.borrower_entity_name);

        if (entity) {
          const updatedData = {};

          if (loan.borrower_email) updatedData.email = loan.borrower_email;
          if (loan.borrower_phone) updatedData.phone = loan.borrower_phone;

          // Update billing address if it's for entity
          if (loan.borrower_billing_address_street) {
            updatedData.address_street = loan.borrower_billing_address_street;
            updatedData.address_unit = loan.borrower_billing_address_unit;
            updatedData.address_city = loan.borrower_billing_address_city;
            updatedData.address_state = loan.borrower_billing_address_state;
            updatedData.address_zip = loan.borrower_billing_address_zip;
          }

          if (Object.keys(updatedData).length > 0) {
            await base44.asServiceRole.entities.BorrowerEntity.update(entity.id, updatedData);
            updates.entities.push(entity.id);
          }
        }
      } catch (error) {
        console.error('Error updating entity:', error);
      }
    }

    return Response.json({ 
      success: true,
      updates
    });

  } catch (error) {
    console.error('Error updating profiles from loan:', error);
    return Response.json({ 
      error: error.message || 'Unknown error'
    }, { status: 500 });
  }
});