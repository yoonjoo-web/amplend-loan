import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const ACTION_ITEM_CHECKLIST_ITEMS = [
  { category: "Underwriting Document", item: "Background", provider: "Amplend", loan_types: ["Fix & Flip", "Bridge", "Refinance", "New Construction", "DSCR Purchase", "DSCR Refinance"] },
  { category: "Underwriting Document", item: "Credit", provider: "Amplend", loan_types: ["Fix & Flip", "Bridge", "Refinance", "New Construction", "DSCR Purchase", "DSCR Refinance"] },
  { category: "Underwriting Document", item: "Appraisal/Valuation", provider: "Amplend", loan_types: ["Fix & Flip", "Bridge", "Refinance", "New Construction", "DSCR Purchase", "DSCR Refinance"] },
  { category: "Underwriting Document", item: "Contractor/Scope", provider: "Amplend", loan_types: ["Fix & Flip", "Bridge", "Refinance", "New Construction"] },
  { category: "Underwriting Document", item: "Title", provider: "Amplend", loan_types: ["Fix & Flip", "Bridge", "Refinance", "New Construction", "DSCR Purchase", "DSCR Refinance"] },
  { category: "Underwriting Document", item: "Send Indicative Terms", provider: "Amplend", loan_types: ["Fix & Flip", "Bridge", "Refinance", "New Construction", "DSCR Purchase", "DSCR Refinance"] },
  { category: "Legal Document", item: "Legal Docs", provider: "Amplend", loan_types: ["Fix & Flip", "Bridge", "Refinance", "New Construction", "DSCR Purchase", "DSCR Refinance"] },
  { category: "Processing", item: "Appraisal Fee Request", provider: "Amplend", loan_types: ["Fix & Flip", "Bridge", "Refinance", "New Construction", "DSCR Purchase", "DSCR Refinance"] },
  { category: "Processing", item: "Schedule Appraisal", provider: "Amplend", loan_types: ["Fix & Flip", "Bridge", "Refinance", "New Construction", "DSCR Purchase", "DSCR Refinance"] },
  { category: "Processing", item: "Schedule Title", provider: "Amplend", loan_types: ["Fix & Flip", "Bridge", "Refinance", "New Construction", "DSCR Purchase", "DSCR Refinance"] },
  { category: "Processing", item: "Schedule Background", provider: "Amplend", loan_types: ["Fix & Flip", "Bridge", "Refinance", "New Construction", "DSCR Purchase", "DSCR Refinance"] },
  { category: "Processing", item: "Schedule Insurance", provider: "Amplend", loan_types: ["Fix & Flip", "Bridge", "Refinance", "New Construction", "DSCR Purchase", "DSCR Refinance"] },
  { category: "Processing", item: "Appraisal Received", provider: "Borrower", loan_types: ["Fix & Flip", "Bridge", "Refinance", "New Construction", "DSCR Purchase", "DSCR Refinance"] },
  { category: "Processing", item: "Term Sheet Final", provider: "Amplend", loan_types: ["Fix & Flip", "Bridge", "Refinance", "New Construction", "DSCR Purchase", "DSCR Refinance"] },
  { category: "Processing", item: "Background Received", provider: "Amplend", loan_types: ["Fix & Flip", "Bridge", "Refinance", "New Construction", "DSCR Purchase", "DSCR Refinance"] },
  { category: "Processing", item: "Final Terms Agreed", provider: "Borrower", loan_types: ["Fix & Flip", "Bridge", "Refinance", "New Construction", "DSCR Purchase", "DSCR Refinance"] },
  { category: "Processing", item: "Final CD", provider: "Amplend", loan_types: ["Fix & Flip", "Bridge", "Refinance", "New Construction", "DSCR Purchase", "DSCR Refinance"] },
  { category: "Processing", item: "Schedule Closing", provider: "Title Company", loan_types: ["Fix & Flip", "Bridge", "Refinance", "New Construction", "DSCR Purchase", "DSCR Refinance"] },
  { category: "Post-Close", item: "Invoice Title/Attorney", provider: "Amplend", loan_types: ["Fix & Flip", "Bridge", "Refinance", "New Construction", "DSCR Purchase", "DSCR Refinance"] },
  { category: "Post-Close", item: "Invoice Appraisal", provider: "Amplend", loan_types: ["Fix & Flip", "Bridge", "Refinance", "New Construction", "DSCR Purchase", "DSCR Refinance"] },
  { category: "Post-Close", item: "Warehouse Advance", provider: "Amplend", loan_types: ["Fix & Flip", "Bridge", "Refinance", "New Construction", "DSCR Purchase", "DSCR Refinance"] },
  { category: "Post-Close", item: "Send to Servicer", provider: "Amplend", loan_types: ["Fix & Flip", "Bridge", "Refinance", "New Construction", "DSCR Purchase", "DSCR Refinance"] },
  { category: "Post-Close", item: "Send to Buyer", provider: "Amplend", loan_types: ["Fix & Flip", "Bridge", "Refinance", "New Construction", "DSCR Purchase", "DSCR Refinance"] }
];

const DOCUMENT_CHECKLIST_ITEMS = [
  { category: "Property Document", item: "Valuation Review", provider: "Amplend", loan_types: ["Fix & Flip", "Bridge", "Refinance", "New Construction", "DSCR Purchase", "DSCR Refinance"], document_category: "valuations" },
  { category: "Property Document", item: "Appraisal", provider: "Borrower", loan_types: ["Fix & Flip", "Bridge", "Refinance", "New Construction", "DSCR Purchase", "DSCR Refinance"], document_category: "valuations" },
  { category: "Property Document", item: "Property Insurance", provider: "Borrower", loan_types: ["Fix & Flip", "Bridge", "Refinance", "New Construction", "DSCR Purchase", "DSCR Refinance"], document_category: "insurance" },
  { category: "Property Document", item: "Feasibility Review", provider: "Amplend", loan_types: ["Fix & Flip", "Bridge", "Refinance", "New Construction"], document_category: "property" },
  { category: "Property Document", item: "Survey", provider: "Borrower", loan_types: ["Fix & Flip", "Bridge", "Refinance", "New Construction", "DSCR Purchase", "DSCR Refinance"], document_category: "property" },
  { category: "Closing Document", item: "Closing Protection Letter", provider: "Title Company", loan_types: ["Fix & Flip", "Bridge", "Refinance", "New Construction", "DSCR Purchase", "DSCR Refinance"], document_category: "title" },
  { category: "Closing Document", item: "HUD", provider: "Title Company", loan_types: ["Fix & Flip", "Bridge", "Refinance", "New Construction", "DSCR Purchase", "DSCR Refinance"], document_category: "closing" },
  { category: "Closing Document", item: "Loan Docs", provider: "Amplend", loan_types: ["Fix & Flip", "Bridge", "Refinance", "New Construction", "DSCR Purchase", "DSCR Refinance"], document_category: "legal" },
  { category: "Closing Document", item: "Title Commitment", provider: "Title Company", loan_types: ["Fix & Flip", "Bridge", "Refinance", "New Construction", "DSCR Purchase", "DSCR Refinance"], document_category: "title" },
  { category: "Closing Document", item: "Initial Payment Notice", provider: "Amplend", loan_types: ["Fix & Flip", "Bridge", "Refinance", "New Construction", "DSCR Purchase", "DSCR Refinance"], document_category: "closing" },
  { category: "Closing Document", item: "ACH Form", provider: "Borrower", loan_types: ["Fix & Flip", "Bridge", "Refinance", "New Construction", "DSCR Purchase", "DSCR Refinance"], document_category: "closing" },
  { category: "Closing Document", item: "Title Wiring Info", provider: "Title Company", loan_types: ["Fix & Flip", "Bridge", "Refinance", "New Construction", "DSCR Purchase", "DSCR Refinance"], document_category: "title" },
  { category: "Closing Document", item: "Deed", provider: "Title Company", loan_types: ["Fix & Flip", "Bridge", "Refinance", "New Construction", "DSCR Purchase", "DSCR Refinance"], document_category: "closing" },
  { category: "Closing Document", item: "Contractor Review", provider: "Borrower", loan_types: ["Fix & Flip", "Bridge", "New Construction"], document_category: "construction_facility_pre_close" },
  { category: "Closing Document", item: "Title E&O", provider: "Title Company", loan_types: ["Fix & Flip", "Bridge", "Refinance", "New Construction", "DSCR Purchase", "DSCR Refinance"], document_category: "title" },
  { category: "Post-Close Document", item: "Recorded Deed", provider: "Title Company", loan_types: ["Fix & Flip", "Bridge", "Refinance", "New Construction", "DSCR Purchase", "DSCR Refinance"], document_category: "post_close_funding" },
  { category: "Post-Close Document", item: "Final Title Policy", provider: "Title Company", loan_types: ["Fix & Flip", "Bridge", "Refinance", "New Construction", "DSCR Purchase", "DSCR Refinance"], document_category: "title" },
  { category: "Post-Close Document", item: "Recorded AOM", provider: "Title Company", loan_types: ["Fix & Flip", "Bridge", "Refinance", "New Construction", "DSCR Purchase", "DSCR Refinance"], document_category: "post_close_funding" },
  { category: "Post-Close Document", item: "Recorded ALR", provider: "Title Company", loan_types: ["Fix & Flip", "Bridge", "Refinance", "New Construction", "DSCR Purchase", "DSCR Refinance"], document_category: "post_close_funding" },
  { category: "Post-Close Document", item: "Recorded Mortgage", provider: "Title Company", loan_types: ["Fix & Flip", "Bridge", "Refinance", "New Construction", "DSCR Purchase", "DSCR Refinance"], document_category: "post_close_funding" }
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has permission
    const canManage = user.role === 'admin' || 
                      user.app_role === 'Administrator' || 
                      user.app_role === 'Loan Officer';

    if (!canManage) {
      return Response.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { loan_id } = await req.json();

    if (!loan_id) {
      return Response.json({ error: 'loan_id is required' }, { status: 400 });
    }

    // Delete all existing checklist items for this loan
    const existingItems = await base44.asServiceRole.entities.ChecklistItem.filter({ loan_id });
    
    for (const item of existingItems) {
      await base44.asServiceRole.entities.ChecklistItem.delete(item.id);
      await sleep(200); // Small delay between deletions
    }

    // Reinitialize action items
    for (let i = 0; i < ACTION_ITEM_CHECKLIST_ITEMS.length; i++) {
      const item = ACTION_ITEM_CHECKLIST_ITEMS[i];
      
      try {
        await base44.asServiceRole.entities.ChecklistItem.create({
          loan_id: loan_id,
          checklist_type: 'action_item',
          category: item.category,
          item_name: item.item,
          description: item.item,
          provider: item.provider || '',
          applicable_loan_types: item.loan_types || [],
          comments: item.comments || '',
          document_category: '',
          status: 'not_started'
        });
        
        await sleep(500); // Wait 500ms between items
      } catch (error) {
        console.error(`Error creating action item ${item.item}:`, error);
      }
    }

    // Reinitialize document items
    for (let i = 0; i < DOCUMENT_CHECKLIST_ITEMS.length; i++) {
      const item = DOCUMENT_CHECKLIST_ITEMS[i];
      
      try {
        await base44.asServiceRole.entities.ChecklistItem.create({
          loan_id: loan_id,
          checklist_type: 'document',
          category: item.category,
          item_name: item.item,
          description: item.item,
          provider: item.provider || '',
          applicable_loan_types: item.loan_types || [],
          comments: item.comments || '',
          document_category: item.document_category || '',
          status: 'pending'
        });
        
        await sleep(500); // Wait 500ms between items
      } catch (error) {
        console.error(`Error creating document item ${item.item}:`, error);
      }
    }

    return Response.json({ 
      success: true,
      message: 'Checklists reinitialized successfully'
    });

  } catch (error) {
    console.error('Error reinitializing checklist:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});