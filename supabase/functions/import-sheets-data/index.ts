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
  priority: string;
  applicant: string | null;
  executor: string | null;
  availability_delivery_time: string | null;
  contractor: string | null;
  invoice_number: string | null;
  payment_percentage: number;
  shipment_date: string | null;
  delivery_date: string | null;
  transport_company: string | null;
  waybill_number: string | null;
  comments: string | null;
  photo_url: string | null;
  document_url: string | null;
}

async function getAccessToken(): Promise<string> {
  const serviceAccountJson = Deno.env.get('GOOGLE_SHEETS_SERVICE_ACCOUNT');
  
  if (!serviceAccountJson) {
    throw new Error('GOOGLE_SHEETS_SERVICE_ACCOUNT environment variable is not set');
  }

  console.log('Service account JSON length:', serviceAccountJson.length);
  console.log('First 50 chars:', serviceAccountJson.substring(0, 50));
  
  let serviceAccount;
  try {
    serviceAccount = JSON.parse(serviceAccountJson);
  } catch (e) {
    console.error('Failed to parse service account JSON:', e);
    console.error('Raw value:', serviceAccountJson);
    const errorMessage = e instanceof Error ? e.message : String(e);
    throw new Error(`Invalid service account JSON: ${errorMessage}`);
  }
  
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

function normalizeStatus(status: string): string {
  const statusMap: Record<string, string> = {
    'Новая': 'Новая заявка',
    'Альтернативу!': 'На согласовании',
    'Доставлено ': 'Доставлено',
    'В пути в НСК': 'В пути',
    'Готов к отгрузке': 'В пути',
    'Счёт в бух': 'Счёт',
    'Плановый': 'В работе',
    'Аварийно': 'В работе'
  };
  
  return statusMap[status] || status || 'Новая заявка';
}

function determinePriority(priorityStr: string, statusStr: string): string {
  // Сначала проверяем явно указанный приоритет
  const priorityLower = priorityStr?.toLowerCase().trim() || '';
  if (priorityLower.includes('аварийн')) return 'Аварийно';
  if (priorityLower.includes('приоритет')) return 'Приоритетно';
  if (priorityLower.includes('планов')) return 'Планово';
  
  // Если приоритет не указан, определяем по статусу
  const statusLower = statusStr?.toLowerCase().trim() || '';
  if (statusLower.includes('аварийн')) return 'Аварийно';
  if (statusLower.includes('приоритет')) return 'Приоритетно';
  
  return 'Планово';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { spreadsheetId, range, year } = await req.json();
    
    // Get user from authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // Get current user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error('User not authenticated');
    }

    // Get user's organization
    const { data: userOrg, error: orgError } = await supabaseClient
      .from('user_organizations')
      .select('organization_id')
      .eq('user_id', user.id)
      .single();

    if (orgError || !userOrg) {
      throw new Error('User organization not found');
    }

    console.log('Importing data from sheet:', { spreadsheetId, range, year });

    const accessToken = await getAccessToken();
    
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`;
    console.log('Fetching from URL:', url);
    
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    console.log('Response status:', response.status);
    
    if (!response.ok) {
      const errorBody = await response.text();
      console.error('Error response:', errorBody);
      throw new Error(`Failed to fetch sheet data: ${response.statusText}. Details: ${errorBody}`);
    }

    const data = await response.json();
    const rows = data.values || [];
    
    console.log(`Found ${rows.length} rows in sheet`);

    const requests: SheetRow[] = [];
    
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length < 2) continue;

      const dateStr = String(row[0] || '').trim();
      const description = String(row[1] || '').trim();
      
      if (!dateStr || !description) continue;
      
      const requestDate = parseDate(dateStr);
      
      if (requestDate && requestDate.startsWith(year)) {
        // Generate request number from row index if not available
        const requestNumber = `REQ-${year}-${i}`;
        const originalStatus = String(row[3] || 'Новая').trim();
        const priorityColumn = String(row[12] || '').trim(); // Колонка с приоритетом
        
        requests.push({
          request_number: requestNumber,
          request_date: requestDate,
          description: description,
          status: normalizeStatus(originalStatus),
          priority: determinePriority(priorityColumn, originalStatus),
          applicant: row[2] || null,
          executor: null,
          availability_delivery_time: row[4] || null,
          contractor: row[5] || null,
          invoice_number: row[6] || null,
          payment_percentage: parsePayment(row[7]),
          shipment_date: parseDate(row[8]),
          delivery_date: parseDate(row[9]),
          transport_company: row[10] || null,
          waybill_number: row[11] || null,
          comments: row[13] || null,
          photo_url: null,
          document_url: null,
        });
      }
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

    // Add organization_id and created_by to all requests
    const requestsWithOrg = requests.map(req => ({
      ...req,
      organization_id: userOrg.organization_id,
      created_by: user.id,
    }));

    const { error } = await supabase.from('requests').insert(requestsWithOrg);

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
