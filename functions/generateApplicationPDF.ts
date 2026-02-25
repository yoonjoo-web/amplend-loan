import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';
import { jsPDF } from 'npm:jspdf@2.5.1';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { application_id } = await req.json();

    if (!application_id) {
      return Response.json({ error: 'application_id is required' }, { status: 400 });
    }

    const application = await base44.asServiceRole.entities.LoanApplication.get(application_id);

    if (!application) {
      return Response.json({ error: 'Application not found' }, { status: 404 });
    }

    // Fetch and convert logo to base64
    const logoUrl = 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68878b9144eaa44fb7e1d2be/282a67438_AmplendLogowithTagline-White.png';
    let logoBase64 = null;
    try {
      const logoResponse = await fetch(logoUrl);
      const logoBlob = await logoResponse.blob();
      const logoArrayBuffer = await logoBlob.arrayBuffer();
      const logoBytes = new Uint8Array(logoArrayBuffer);
      logoBase64 = btoa(String.fromCharCode(...logoBytes));
    } catch (logoError) {
      console.error('Error fetching logo:', logoError);
      // Continue without logo if fetch fails
    }

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const contentIndent = margin + 5;
    let y = 20;

    const formatValue = (value) => {
      if (value === null || value === undefined || value === '') return 'N/A';
      return String(value);
    };

    const formatCurrency = (value) => {
      if (value === null || value === undefined || value === '') return 'N/A';
      return `$${Number(value).toLocaleString('en-US')}`;
    };

    const formatDate = (dateString) => {
      if (!dateString) return 'N/A';
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US');
    };

    const formatPhone = (phone) => {
      if (!phone) return 'N/A';
      const digits = phone.replace(/\D/g, '');
      if (digits.length === 10) {
        return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
      }
      return phone;
    };

    const formatSSN = (ssn) => {
      if (!ssn) return 'N/A';
      const digits = ssn.replace(/\D/g, '');
      if (digits.length === 9) {
        return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
      }
      return ssn;
    };

    const checkNewPage = (requiredSpace = 30) => {
      if (y + requiredSpace > pageHeight - margin) {
        doc.addPage();
        y = margin;
      }
    };

    const addSection = (title) => {
      checkNewPage(40);
      doc.setFillColor(240, 240, 240);
      doc.rect(margin, y, pageWidth - 2 * margin, 10, 'F');
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(title, contentIndent, y + 7);
      y += 15;
    };

    const addField = (label, value, isHalfWidth = false) => {
      checkNewPage();
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text(label, contentIndent, y);
      y += 5;
      doc.setFont('helvetica', 'normal');
      const displayValue = formatValue(value);
      const lines = doc.splitTextToSize((displayValue), (isHalfWidth ? (pageWidth - 2 * margin) / 2 - 10 : pageWidth - 2 * margin - 15));
      doc.text(lines, contentIndent + 5, y);
      y += lines.length * 5 + 5;
    };

    const addTwoColumnFields = (label1, value1, label2, value2) => {
      checkNewPage();
      const colWidth = (pageWidth - 2 * margin) / 2;
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text(label1, contentIndent, y);
      doc.text(label2, contentIndent + colWidth, y);
      y += 5;
      
      doc.setFont('helvetica', 'normal');
      doc.text(formatValue(value1), contentIndent + 5, y);
      doc.text(formatValue(value2), contentIndent + colWidth + 5, y);
      y += 10;
    };

    const addYesNoQuestion = (question, answer) => {
      checkNewPage(15);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      const questionLines = doc.splitTextToSize(question, pageWidth - 2 * margin - 35);
      doc.text(questionLines, contentIndent, y);
      
      const questionHeight = questionLines.length * 5;
      const checkY = y + questionHeight / 2 - 2;
      
      doc.rect(pageWidth - margin - 25, checkY - 2, 4, 4);
      if (answer === 'yes') {
        doc.setLineWidth(0.5);
        doc.line(pageWidth - margin - 24.5, checkY - 1.5, pageWidth - margin - 21.5, checkY + 1.5);
        doc.line(pageWidth - margin - 21.5, checkY - 1.5, pageWidth - margin - 24.5, checkY + 1.5);
      }
      doc.setFont('helvetica', 'normal');
      doc.text('Yes', pageWidth - margin - 18, checkY + 2);
      
      doc.rect(pageWidth - margin - 25, checkY + 5, 4, 4);
      if (answer === 'no') {
        doc.setLineWidth(0.5);
        doc.line(pageWidth - margin - 24.5, checkY + 5.5, pageWidth - margin - 21.5, checkY + 8.5);
        doc.line(pageWidth - margin - 21.5, checkY + 5.5, pageWidth - margin - 24.5, checkY + 8.5);
      }
      doc.setFont('helvetica', 'normal');
      doc.text('No', pageWidth - margin - 18, checkY + 9);
      
      y += questionHeight + 10;
    };

    const addTextBlock = (text) => {
      checkNewPage(30);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      const lines = doc.splitTextToSize(text, pageWidth - 2 * margin - 15);
      
      for (let i = 0; i < lines.length; i++) {
        checkNewPage();
        doc.text(lines[i], contentIndent + 5, y);
        y += 4;
      }
      y += 5;
    };

    const addCheckbox = (label, isChecked) => {
      checkNewPage(10);
      doc.setFontSize(9);
      doc.rect(contentIndent, y - 3, 4, 4);
      if (isChecked) {
        // Draw X inside the checkbox
        doc.setLineWidth(0.5);
        doc.line(contentIndent + 0.5, y - 2.5, contentIndent + 3.5, y + 0.5);
        doc.line(contentIndent + 3.5, y - 2.5, contentIndent + 0.5, y + 0.5);
      }
      doc.setFont('helvetica', 'normal');
      const lines = doc.splitTextToSize(label, pageWidth - 2 * margin - 15);
      doc.text(lines, contentIndent + 7, y);
      y += lines.length * 5 + 5;
    };

    // Header with logo
    doc.setFillColor(52, 73, 94);
    doc.rect(0, 0, pageWidth, 50, 'F');
    
    // Add title text on the left
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('LOAN APPLICATION', margin, 25);
    
    // Add logo on the right if successfully fetched
    if (logoBase64) {
      try {
        // Logo dimensions maintaining exact original aspect ratio
        // Original dimensions: 20897 × 6169 (aspect ratio = 3.3872446)
        const logoHeight = 18;
        const logoWidth = 18 * (20897 / 6169); // Exact aspect ratio maintained
        const logoX = pageWidth - margin - logoWidth; // Position at far right
        const logoY = 12;
        
        doc.addImage(`data:image/png;base64,${logoBase64}`, 'PNG', logoX, logoY, logoWidth, logoHeight);
      } catch (imageError) {
        console.error('Error adding logo to PDF:', imageError);
      }
    }
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Application #${application.application_number}`, margin, 35);
    doc.text(`Generated: ${formatDate(new Date())}`, margin, 43);
    doc.setTextColor(0, 0, 0);
    y = 60;

    // Basic Information
    addSection('Basic Information');
    const loanTypeLabels = {
      'fix_flip': 'Fix & Flip',
      'bridge': 'Bridge',
      'new_construction': 'New Construction',
      'dscr': 'DSCR'
    };
    const loanPurposeLabels = {
      'purchase': 'Purchase',
      'refinance': 'Refinance',
      'cash_out_refinance': 'Cash-Out Refinance'
    };
    const borrowerTypeLabels = {
      'individual': 'Individual',
      'entity': 'Entity'
    };
    
    addTwoColumnFields('Loan Type:', loanTypeLabels[application.loan_type] || formatValue(application.loan_type), 'Loan Purpose:', loanPurposeLabels[application.loan_purpose] || formatValue(application.loan_purpose));
    addTwoColumnFields('Borrower Type:', borrowerTypeLabels[application.borrower_type] || formatValue(application.borrower_type), 'Co-Borrower:', application.has_coborrowers === 'yes' ? 'Yes' : 'No');
    addField('Submitted Date:', formatDate(application.created_date));

    // Liaison Information (if assigned)
    if (application.liaison_ids && application.liaison_ids.length > 0) {
      addSection('Assigned Liaison');
      // Fetch liaison details for the first liaison
      try {
        const liaisons = await base44.asServiceRole.entities.LoanPartner.filter({ app_role: 'Liaison' });
        const assignedLiaison = liaisons.find(l => application.liaison_ids.includes(l.id));
        if (assignedLiaison) {
          addField('Name:', assignedLiaison.name);
          addField('Email:', assignedLiaison.email);
          addField('Phone:', formatPhone(assignedLiaison.phone));
        }
      } catch (liaisionError) {
        console.error('Error fetching liaison details:', liaisionError);
      }
    }

    // Primary Borrower Information
    addSection('Primary Borrower Information');
    addTwoColumnFields('First Name:', application.borrower_first_name, 'Last Name:', application.borrower_last_name);
    addTwoColumnFields('Email:', application.borrower_email, 'Phone:', formatPhone(application.borrower_phone));
    addTwoColumnFields('Date of Birth:', formatDate(application.borrower_date_of_birth), 'SSN:', formatSSN(application.borrower_ssn));
    
    // Current Address
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    checkNewPage();
    doc.text('Current Address', contentIndent, y);
    y += 7;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    
    addField('Street Address:', application.borrower_address_street);
    addTwoColumnFields('Unit/Apt:', application.borrower_address_unit, 'City:', application.borrower_address_city);
    addTwoColumnFields('State:', application.borrower_address_state, 'ZIP Code:', application.borrower_address_zip);
    
    // Mailing Address (if different)
    if (application.borrower_mailing_address_street) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      checkNewPage();
      doc.text('Mailing Address (if different)', contentIndent, y);
      y += 7;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      
      addField('Street Address:', application.borrower_mailing_address_street);
      addTwoColumnFields('Unit/Apt:', application.borrower_mailing_address_unit, 'City:', application.borrower_mailing_address_city);
      addTwoColumnFields('State:', application.borrower_mailing_address_state, 'ZIP Code:', application.borrower_mailing_address_zip);
    }

    // Borrower Financial Information
    addSection('Borrower Financial Information');
    addTwoColumnFields('Annual Gross Income:', formatCurrency(application.borrower_annual_gross_income), 'Liquidity Amount:', formatCurrency(application.borrower_liquidity_amount));
    addTwoColumnFields('Credit Score:', application.borrower_credit_score, 'Rehabs Done (36 months):', application.borrower_rehabs_done_36_months);
    addField('Rentals Owned (36 months):', application.borrower_rentals_owned_36_months);

    // Co-Borrowers (if any)
    if (application.has_coborrowers === 'yes' && application.co_borrowers && application.co_borrowers.length > 0) {
      application.co_borrowers.forEach((coBorrower, index) => {
        addSection(`Co-Borrower ${index + 1} Information`);
        addTwoColumnFields('First Name:', coBorrower.first_name, 'Last Name:', coBorrower.last_name);
        addTwoColumnFields('Email:', coBorrower.email, 'Phone:', formatPhone(coBorrower.phone));
        addTwoColumnFields('Date of Birth:', formatDate(coBorrower.date_of_birth), 'SSN:', formatSSN(coBorrower.ssn));
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        checkNewPage();
        doc.text('Current Address', contentIndent, y);
        y += 7;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        
        addField('Street Address:', coBorrower.address_street);
        addTwoColumnFields('Unit/Apt:', coBorrower.address_unit, 'City:', coBorrower.address_city);
        addTwoColumnFields('State:', coBorrower.address_state, 'ZIP Code:', coBorrower.address_zip);
        
        if (coBorrower.mailing_address_street) {
          doc.setFontSize(10);
          doc.setFont('helvetica', 'bold');
          checkNewPage();
          doc.text('Mailing Address (if different)', contentIndent, y);
          y += 7;
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          
          addField('Street Address:', coBorrower.mailing_address_street);
          addTwoColumnFields('Unit/Apt:', coBorrower.mailing_address_unit, 'City:', coBorrower.mailing_address_city);
          addTwoColumnFields('State:', coBorrower.mailing_address_state, 'ZIP Code:', coBorrower.mailing_address_zip);
        }
        
        addTwoColumnFields('Annual Gross Income:', formatCurrency(coBorrower.annual_gross_income), 'Liquidity Amount:', formatCurrency(coBorrower.liquidity_amount));
        addTwoColumnFields('Credit Score:', coBorrower.credit_score, 'Rehabs Done (36 months):', coBorrower.rehabs_done_36_months);
        addField('Rentals Owned (36 months):', coBorrower.rentals_owned_36_months);
      });
    }

    // Entity Information (if applicable)
    if (application.borrower_type === 'entity' && application.entity_name) {
      addSection('Entity Information');
      addTwoColumnFields('Entity Name:', application.entity_name, 'Entity Type:', application.entity_type);
      addField('EIN:', application.entity_ein);
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      checkNewPage();
      doc.text('Entity Address', contentIndent, y);
      y += 7;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      
      addField('Street Address:', application.entity_address_street);
      addTwoColumnFields('Unit/Apt:', application.entity_address_unit, 'City:', application.entity_address_city);
      addTwoColumnFields('State:', application.entity_address_state, 'ZIP Code:', application.entity_address_zip);
      
      if (application.entity_owners && application.entity_owners.length > 0) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        checkNewPage();
        doc.text('Entity Owners', contentIndent, y);
        y += 7;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        
        application.entity_owners.forEach((owner, index) => {
          addTwoColumnFields(`Owner ${index + 1} Name:`, owner.name, 'Ownership %:', owner.ownership_percentage ? `${owner.ownership_percentage}%` : 'N/A');
        });
      }
    }

    // Property Information
    addSection('Property Information');
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    checkNewPage();
    doc.text('Address', contentIndent, y);
    y += 7;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    
    addTwoColumnFields('Street Address:', application.property_address_street, 'Unit/Apt:', application.property_address_unit);
    addTwoColumnFields('City:', application.property_address_city, 'State:', application.property_address_state);
    addField('ZIP Code:', application.property_address_zip);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    checkNewPage();
    doc.text('Basic Information', contentIndent, y);
    y += 7;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    
    if (application.property_type_dscr == false) {
      addField('Property Type:', application.property_type_not_dscr || formatValue(application.property_type_not_dscr));
    } else if (application.property_type_not_dscr == false) {
      addField('Property Type:', application.property_type_dscr || formatValue(application.property_type_not_dscr));
    }
    addTwoColumnFields('Number of Units:', application.number_of_units, 'Number of Leased Units:', application.number_of_leased_units);
    addTwoColumnFields('Purchase Price:', formatCurrency(application.purchase_price), 'Estimated As-Is Value:', formatCurrency(application.estimated_asis_value)); 
    addTwoColumnFields('After Repair Value:', formatCurrency(application.after_repair_value), 'Rehab/Construction Budget:', formatCurrency(application.rehab_budget));
    addField('Completed Improvements:', formatCurrency(application.completed_improvements));

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    checkNewPage();
    doc.text('Additional Information', contentIndent, y);
    y += 7;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);

    addTwoColumnFields('Gross Monthly Rent:', formatCurrency(application.gross_monthly_rent), 'Annual Insurance:', formatCurrency(application.annual_insurance));
    addTwoColumnFields('Annual HOA Fees:', formatCurrency(application.annual_hoa_fees), 'Annual Property Tax:', formatCurrency(application.annual_property_tax));
    addTwoColumnFields('Purchase Date:', formatDate(application.purchase_date), 'Target Closing:', formatDate(application.target_closing_date));
    addField('Existing Mortgage Balance:', formatCurrency(application.existing_mortgage_answer_if_refi));

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    checkNewPage();
    doc.text('Property Contact Information', contentIndent, y);
    y += 7;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    
    addField('Contact Person:', application.contact_person_at_property);
    addTwoColumnFields('Contact Phone:', formatPhone(application.contact_phone_at_property), 'Contact Email:', application.contact_email_at_property);
    addTwoColumnFields('Property Accessible:', application.property_accessible ? 'Yes' : 'No', 'Lock Box #:', application.lockbox_number);

    // Borrower Declarations
    addSection('Borrower Declarations');
    addYesNoQuestion('Are there any outstanding judgments against you?', application.outstanding_judgments);
    addYesNoQuestion('Have you been declared bankrupt within the past 36 months?', application.bankruptcy_36_months);
    addYesNoQuestion('Have you had property foreclosed upon, short sale, or deed in lieu thereof in the last 36 months?', application.foreclosure_36_months);
    addYesNoQuestion('Are you a party to a lawsuit at the moment?', application.lawsuit);
    addYesNoQuestion('Have you had mortgage late payment in last 12 months OR mortgage delinquencies of 60+ days in last 24 months?', application.mortgage_late);
    addYesNoQuestion('Is any part of the down payment borrowed?', application.down_payment_borrowed);
    addYesNoQuestion('Have you had previous felony convictions, misdemeanors involving fraud, embezzlement, or other similar crimes?', application.felony_convictions);
    addYesNoQuestion('Are you a U.S. citizen or a permanent resident alien?', application.us_citizen);
    addYesNoQuestion('Do you intend to occupy the property as your primary residence?', application.primary_residence);

    // Acknowledgement and Agreement
    addSection('Acknowledgement and Agreement');
    addTextBlock('Each of the undersigned specifically represents to Lender and to Lender\'s actual or potential agents, brokers, processors, attorneys, insurers, servicers, successors and assigns and agrees and acknowledges that: (1) the information provided in this application is true and correct as of the date set forth opposite my signature and that any intentional or negligent misrepresentation of this information contained in this application may result in civil liability, including monetary damages, to any person who may suffer any loss due to reliance upon any misrepresentation that I have made on this application, and/or in criminal penalties including, but not limited to, fine or imprisonment or both under the provisions of Title 18, United States Code, Sec. 1001, et seq.; (2) the loan requested pursuant to this application (the "Loan") will be secured by a mortgage or deed of trust on the property described in this application; (3) the property will not be used for any illegal or prohibited purpose or use; (4) all statements made in this application are made for the purpose of obtaining a residential mortgage loan; (5) the property will be occupied as indicated in this application; (6) the Lender, its servicers, successors or assigns may retain the original and/or an electronic record of this application, whether or not the Loan is approved; (7) the Lender and its agents, brokers, insurers, servicers, and assigns may continuously rely on the information contained in the application, and I am obligated to amend and/or supplement the information provided in this application if any of the material facts that I have represented should change prior to closing of the Loan; (8) in the event that my payments on the Loan become delinquent, the Lender, its servicers, successors or assigns may, in addition to any other rights and remedies that it may have relating to such delinquency, report my name and account information to one or more consumer reporting agencies; (9) ownership of the Loan and/or administration of the Loan account may be transferred with such notice as may be required by law; (10) neither Lender nor its agents, brokers, insurers, servicers, successors or assigns has made any representation or warranty, express or implied, to me regarding the property or the condition or value of the property; and (11) my transmission of this application as an "electronic record" containing my "electronic signature," as those terms are defined in applicable federal and/or state laws (excluding audio and video recordings), or my facsimile transmission of this application containing a facsimile of my signature, shall be as effective, enforceable and valid as if a paper version of this application were delivered containing my original written signature.');
    addTextBlock('Each of the undersigned hereby acknowledges that any owner of the Loan, its servicers, successors and assigns, may verify or reverify any information contained in this application or obtain any information or data relating to the Loan, for any legitimate business purpose through any source, including a source named in this application or a consumer reporting agency.');
    
    addCheckbox('I acknowledge that I have read and agree to the above Acknowledgement and Agreement', application.acknowledgement_agreed);

    // Borrower's Authorization to Release Information
    addSection('Borrower\'s Authorization to Release Information');
    addTextBlock('I/We understand that by signing this application, I/We hereby authorize Lender on its own or through its service provider to conduct:');
    addTextBlock('1. A consumer credit report to verify other credit information, including past and present');
    addTextBlock('2. A Background investigation report and verify both criminal and civil records.');
    addTextBlock('It is understood that a copy of this form will also serve as authorization to conduct these checks. The information gathered is connected with a credit transaction involving me/us. The information that Lender obtains is only to be used in conjunction with this application for the Loan.');
    addTextBlock('I understand the information collected as part of the credit and background investigation will be shared with the Lender on behalf of me/us to evaluate the commercial mortgage I/We consider. This investigation is authorized irrespective of the person(s) or entity(s) that pays for said investigation. This investigation authorization expires 60 days from the signed date.');
    addTextBlock('Privacy Act Notice: This information will be used by its assignees from the Lender to determine whether you qualify as a prospective mortgagor under its program. It will not be disclosed outside the agency except as required and permitted by law. You do not have to provide this information, but if you do not, your application for approval as a prospective mortgagor or sponsor may be delayed or rejected.');
    
    addCheckbox('I authorize the Lender to conduct credit and background investigations as described above', application.authorization_agreed);

    // Additional Comments/Notes
    if (application.notes) {
      addSection('Additional Comments or Notes');
      addField('Comments:', application.notes);
    }

    // Electronic Signature
    addSection('Electronic Signature');
    
    let signerFirstName = formatValue(application.borrower_first_name);
    let signerLastName = formatValue(application.borrower_last_name);
    let signerEmail = formatValue(application.borrower_email);
    
    if (application.esignature) {
      checkNewPage(30);
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(100, 100, 100);
      doc.rect(contentIndent + 5, y, pageWidth - 2 * margin - 15, 20, 'S');
      
      doc.setFontSize(16);
      doc.setFont('helvetica', 'italic');
      doc.text(application.esignature, contentIndent + 10, y + 12);
      y += 25;
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      addField('Signed by:', `${signerFirstName} ${signerLastName}`);
      addField('Email:', signerEmail);
      addField('Electronically signed on:', formatDate(application.esignature_date) + (application.esignature_date ? `, ${new Date(application.esignature_date).toLocaleTimeString('en-US')}` : ''));
    } else {
      addField('Status:', 'Not yet signed');
    }

    // Generate PDF as ArrayBuffer
    const pdfBytes = doc.output('arraybuffer');
    
    // Convert ArrayBuffer to Uint8Array for Blob creation
    const pdfUint8Array = new Uint8Array(pdfBytes);
    
    // Create a File object
    const pdfFile = new File(
      [pdfUint8Array], 
      `Application_${application.application_number}.pdf`,
      { type: 'application/pdf' }
    );
    
    // Upload to public storage using Base44 integration
    const { file_url } = await base44.integrations.Core.UploadFile({
      file: pdfFile
    });

    // Return the file_url in JSON format
    return Response.json({ 
      success: true,
      file_url: file_url,
      application_number: application.application_number
    }, { status: 200 });

  } catch (error) {
    console.error('Error generating PDF:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});