import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SheetRow {
  request_number: string;
  request_date: string;
  description: string;
  status: string;
  availability_delivery_time: string | null;
  contractor: string | null;
  invoice_number: string | null;
  payment_percentage: number;
  shipment_date: string | null;
  delivery_date: string | null;
  transport_company: string | null;
  waybill_number: string | null;
  comments: string | null;
}

async function getAccessToken(): Promise<string> {
  const serviceAccount = JSON.parse(Deno.env.get('GOOGLE_SHEETS_SERVICE_ACCOUNT') || '{}');
  
  const header = {
    alg: 'RS256',
    typ: 'JWT',
  };

  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  const encoder = new TextEncoder();
  const headerBase64 = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const claimBase64 = btoa(JSON.stringify(claim)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  
  const message = `${headerBase64}.${claimBase64}`;
  
  // Import private key
  const privateKey = serviceAccount.private_key;
  const pemHeader = '-----BEGIN PRIVATE KEY-----';
  const pemFooter = '-----END PRIVATE KEY-----';
  const pemContents = privateKey.substring(
    pemHeader.length,
    privateKey.length - pemFooter.length - 1
  ).replace(/\s/g, '');
  
  const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
  
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryDer,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256',
    },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    encoder.encode(message)
  );

  const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  const jwt = `${message}.${signatureBase64}`;

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

function parseDate(dateStr: string): string | null {
  if (!dateStr || dateStr.trim() === '') return null;
  
  const parts = dateStr.split('.');
  if (parts.length === 3) {
    const day = parts[0].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    let year = parts[2];
    
    if (year.length === 2) {
      year = parseInt(year) < 50 ? `20${year}` : `19${year}`;
    }
    
    return `${year}-${month}-${day}`;
  }
  return null;
}

function parsePayment(paymentStr: string): number {
  if (!paymentStr) return 0;
  const match = paymentStr.match(/(\d+)/);
  return match ? parseInt(match[1]) : 0;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { spreadsheetId, range, year } = await req.json();

    console.log('Importing data from sheet:', { spreadsheetId, range, year });

    const accessToken = await getAccessToken();
    
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch sheet data: ${response.statusText}`);
    }

    const data = await response.json();
    const rows = data.values || [];
    
    console.log(`Found ${rows.length} rows in sheet`);

    const requests: SheetRow[] = [];
    
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length < 2) continue;

      const firstCell = row[0] || '';
      const match = firstCell.match(/(\d+)\/(\d+\.\d+\.\d+)\s+(.+)/);
      
      if (!match) continue;

      const requestNumber = match[1];
      const dateStr = match[2];
      const description = match[3];
      const requestDate = parseDate(dateStr);

      if (!requestDate || !requestDate.startsWith(year)) continue;

      requests.push({
        request_number: requestNumber,
        request_date: requestDate,
        description: description,
        status: row[1] || 'Новая',
        availability_delivery_time: row[2] || null,
        contractor: row[3] || null,
        invoice_number: row[4] || null,
        payment_percentage: parsePayment(row[5]),
        shipment_date: parseDate(row[6]),
        delivery_date: parseDate(row[7]),
        transport_company: row[8] || null,
        waybill_number: row[9] || null,
        comments: row[10] || null,
      });
    }

    console.log(`Parsed ${requests.length} requests for year ${year}`);

    if (requests.length === 0) {
      return new Response(
        JSON.stringify({ success: false, message: `Не найдено заявок за ${year} год`, count: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { error } = await supabase.from('requests').insert(requests);

    if (error) {
      console.error('Error inserting data:', error);
      throw error;
    }

    console.log(`Successfully imported ${requests.length} requests`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Импортировано ${requests.length} заявок за ${year} год`,
        count: requests.length 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in import-sheets-data function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
