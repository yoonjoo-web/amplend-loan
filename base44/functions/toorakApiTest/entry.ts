import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const TOORAK_UAT_BASE = "https://public-api-uat.toorakcapital.info";
const ORIGINATOR_PARTY_ID = "a1a75814-b55e-4ed8-b9cb-092aa31b11a8";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const apiKey = Deno.env.get("TOORAK_API_KEY");
    if (!apiKey) {
      return Response.json({ error: "TOORAK_API_KEY secret is not set" }, { status: 500 });
    }

    const body = await req.json();
    const { loanFact } = body;

    if (!loanFact) {
      return Response.json({ error: "Missing loanFact in request body" }, { status: 400 });
    }

    // Enforce static originatorPartyId
    const enrichedLoanFact = {
      ...loanFact,
      loan: {
        ...loanFact.loan,
        loanDetail: {
          ...loanFact.loan?.loanDetail,
          originatorPartyId: ORIGINATOR_PARTY_ID,
        },
      },
    };

    const evalResponse = await fetch(`${TOORAK_UAT_BASE}/ruleevaluation/v1.0`, {
      method: "POST",
      headers: {
        "X-API-Key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ loanFact: enrichedLoanFact }),
    });

    const evalText = await evalResponse.text();
    let evalData;
    try {
      evalData = JSON.parse(evalText);
    } catch {
      evalData = { raw: evalText };
    }

    if (!evalResponse.ok) {
      return Response.json(
        { error: "Evaluation API call failed", status: evalResponse.status, details: evalData },
        { status: 502 }
      );
    }

    return Response.json({ success: true, result: evalData });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});