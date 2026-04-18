import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const TOORAK_BASE_UAT = "https://public-api-uat.toorakcapital.info";
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
      return Response.json({ error: "TOORAK_API_KEY secret not set" }, { status: 500 });
    }

    const body = await req.json();
    const { loanFact } = body;

    if (!loanFact) {
      return Response.json({ error: "Missing loanFact in request body" }, { status: 400 });
    }

    // Step 1: Get JWT token using X-API-Key
    const authResponse = await fetch(`${TOORAK_BASE_UAT}/public-api/getToken`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({}),
    });

    if (!authResponse.ok) {
      const authErr = await authResponse.text();
      return Response.json(
        { error: "Authentication failed", status: authResponse.status, details: authErr },
        { status: 502 }
      );
    }

    const authData = await authResponse.json();
    const authToken = authData.token || authData.access_token || authData.accessToken;

    if (!authToken) {
      return Response.json(
        { error: "No token returned from authentication endpoint", raw: authData },
        { status: 502 }
      );
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

    // Step 2: Call the rule evaluation API using the JWT token
    const evalResponse = await fetch(`${TOORAK_BASE_UAT}/ruleevaluation/v1.0`, {
      method: "POST",
      headers: {
        "Authorization": authToken,
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
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