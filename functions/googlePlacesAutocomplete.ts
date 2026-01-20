import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { input, placeId, types } = await req.json();
        const apiKey = Deno.env.get("address-api");

        if (!apiKey) {
            return Response.json({ error: 'Google Places API key not configured' }, { status: 500 });
        }

        // If placeId is provided, get place details
        if (placeId) {
            const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=address_components&key=${apiKey}`;
            const detailsResponse = await fetch(detailsUrl);
            const detailsData = await detailsResponse.json();

            if (detailsData.status !== 'OK') {
                return Response.json({ error: 'Failed to fetch place details' }, { status: 400 });
            }

            const addressComponents = detailsData.result.address_components;
            
            // Parse address components
            const parsedAddress = {
                street_number: '',
                route: '',
                subpremise: '',
                locality: '',
                administrative_area_level_1: '',
                administrative_area_level_2: '',
                administrative_area_level_3: '',
                postal_town: '',
                postal_code: '',
                country: ''
            };

            addressComponents.forEach(component => {
                const type = component.types[0];
                // Use a safer check instead of hasOwnProperty
                if (type in parsedAddress) {
                    // For state, use short_name to get abbreviation (e.g., "CA" instead of "California")
                    if (type === 'administrative_area_level_1') {
                        parsedAddress[type] = component.short_name;
                    } else {
                        parsedAddress[type] = component.long_name || component.short_name;
                    }
                }
            });

            // Format the response
            const city =
                parsedAddress.locality ||
                parsedAddress.postal_town ||
                parsedAddress.administrative_area_level_3 ||
                parsedAddress.administrative_area_level_2;

            return Response.json({
                street: `${parsedAddress.street_number} ${parsedAddress.route}`.trim(),
                unit: parsedAddress.subpremise,
                city,
                state: parsedAddress.administrative_area_level_1,
                zip: parsedAddress.postal_code
            });
        }

        // Otherwise, get autocomplete suggestions
        if (input) {
            // Require minimum 3 characters for autocomplete
            if (input.length < 3) {
                return Response.json({ suggestions: [] });
            }

            const placeTypes = types || 'address';
            const autocompleteUrl = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&types=${encodeURIComponent(placeTypes)}&components=country:us&key=${apiKey}`;
            const autocompleteResponse = await fetch(autocompleteUrl);
            const autocompleteData = await autocompleteResponse.json();

            console.log('Google Places API Response Status:', autocompleteData.status);
            console.log('Google Places API Full Response:', JSON.stringify(autocompleteData));

            // Return empty array for zero results
            if (autocompleteData.status === 'ZERO_RESULTS') {
                return Response.json({ suggestions: [] });
            }

            // Handle errors
            if (autocompleteData.status !== 'OK') {
                console.error('Google Places API Error Status:', autocompleteData.status);
                console.error('Google Places API Error Details:', autocompleteData);
                return Response.json({ 
                    error: `Google Places API error: ${autocompleteData.status}`,
                    details: autocompleteData.error_message || 'Unknown error'
                }, { status: 400 });
            }

            const suggestions = (autocompleteData.predictions || []).map(prediction => ({
                description: prediction.description,
                placeId: prediction.place_id
            }));

            return Response.json({ suggestions });
        }

        return Response.json({ error: 'Either input or placeId must be provided' }, { status: 400 });

    } catch (error) {
        console.error('Error in Google Places API:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});
