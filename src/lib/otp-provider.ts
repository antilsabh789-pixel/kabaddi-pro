/**
 * OTP Provider Abstraction Layer with Smart Auto-Fallback
 * 
 * Strategy: Try ALL available providers automatically until one succeeds.
 * Order: Fast2SMS (best for India, no DLT) → MSG91 → Twilio
 * 
 * If OTP_PROVIDER is set, that provider is tried FIRST, then falls back to others.
 * If OTP_PROVIDER is "auto" or not set, tries all providers in optimal order.
 * 
 * IMPORTANT for India:
 * - MSG91 requires DLT registration + SMS credits. Without both, API returns "success" but SMS NEVER delivers.
 * - Fast2SMS works WITHOUT DLT registration using Quick SMS route.
 * - Fast2SMS OTP route requires website verification in their dashboard.
 * - Recommended: Use Fast2SMS Quick route (route=q) - no verification needed.
 */

// ─── Types ──────────────────────────────────────────────────────
export interface OTPResult {
  success: boolean;
  message: string;
  provider: string;
  requestId?: string;
  apiResponse?: Record<string, unknown>;
  method?: string;
  attempts?: OTPAttempt[];
}

export interface OTPAttempt {
  provider: string;
  method: string;
  success: boolean;
  message: string;
  httpStatus?: number;
  apiResponse?: Record<string, unknown>;
}

export interface OTPProviderConfig {
  preferredProvider: 'auto' | 'fast2sms' | 'msg91' | 'twilio';
  // Fast2SMS
  fast2smsApiKey?: string;
  // MSG91
  msg91AuthKey?: string;
  msg91TemplateId?: string;
  // Twilio
  twilioAccountSid?: string;
  twilioAuthToken?: string;
  twilioPhoneNumber?: string;
  twilioVerifyServiceSid?: string;
}

// ─── Config ─────────────────────────────────────────────────────

function getConfig(): OTPProviderConfig {
  const raw = (process.env.OTP_PROVIDER || 'auto').toLowerCase();
  const preferredProvider = (['auto', 'fast2sms', 'msg91', 'twilio'].includes(raw) ? raw : 'auto') as OTPProviderConfig['preferredProvider'];
  return {
    preferredProvider,
    fast2smsApiKey: process.env.FAST2SMS_API_KEY,
    msg91AuthKey: process.env.MSG91_AUTH_KEY,
    msg91TemplateId: process.env.MSG91_TEMPLATE_ID,
    twilioAccountSid: process.env.TWILIO_ACCOUNT_SID,
    twilioAuthToken: process.env.TWILIO_AUTH_TOKEN,
    twilioPhoneNumber: process.env.TWILIO_PHONE_NUMBER,
    twilioVerifyServiceSid: process.env.TWILIO_VERIFY_SERVICE_SID,
  };
}

function getAvailableProviders(config: OTPProviderConfig): Array<'fast2sms' | 'msg91' | 'twilio'> {
  const available: Array<'fast2sms' | 'msg91' | 'twilio'> = [];
  
  if (config.preferredProvider !== 'auto') {
    if (hasCredentials(config, config.preferredProvider)) {
      available.push(config.preferredProvider);
    }
  }

  // Priority order by cost: MSG91 (~₹0.20/SMS) → Fast2SMS OTP (~₹0.30/SMS) → Fast2SMS Quick (~₹5/SMS)
  // MSG91 is cheapest when SMS credits are purchased from wallet balance
  const order: Array<'fast2sms' | 'msg91' | 'twilio'> = ['msg91', 'fast2sms', 'twilio'];
  for (const p of order) {
    if (!available.includes(p) && hasCredentials(config, p)) {
      available.push(p);
    }
  }

  return available;
}

function hasCredentials(config: OTPProviderConfig, provider: 'fast2sms' | 'msg91' | 'twilio'): boolean {
  switch (provider) {
    case 'fast2sms': return !!config.fast2smsApiKey;
    case 'msg91': return !!config.msg91AuthKey;
    case 'twilio': return !!(config.twilioAccountSid && config.twilioAuthToken);
  }
}

function sanitizePhone(phone: string): string {
  let cleaned = phone.replace(/[\s\-()]/g, '');
  if (cleaned.startsWith('+91')) cleaned = cleaned.substring(3);
  if (cleaned.startsWith('91') && cleaned.length === 12) cleaned = cleaned.substring(2);
  if (cleaned.startsWith('0') && cleaned.length === 11) cleaned = cleaned.substring(1);
  if (!/^\d{10}$/.test(cleaned)) {
    console.warn('[OTP] Unexpected phone format:', cleaned, '(original:', phone, ')');
  }
  return cleaned;
}

// ─── Fast2SMS Provider ──────────────────────────────────────────
// Fast2SMS routes (ORDERED BY COST - cheapest first):
// - OTP route: ~₹0.30/SMS (requires website verification in Fast2SMS dashboard)
// - Quick route (q): ~₹5/SMS (NO verification needed - EXPENSIVE, last resort only)
// - DLT route: Requires DLT registration

async function sendViaFast2SMS(
  phone: string,
  otp: string,
  config: OTPProviderConfig
): Promise<OTPResult> {
  const apiKey = config.fast2smsApiKey!;
  const mobile10 = sanitizePhone(phone);
  const otpMessage = `${otp} is your Kabaddi Pro verification code. Do not share with anyone.`;
  const routeErrors: string[] = [];

  // ── Method 1: OTP Route (~₹0.30/SMS - CHEAPEST, needs website verification) ──
  try {
    const otpBody = new URLSearchParams({
      route: 'otp',
      variables_values: otp,
      numbers: mobile10,
      flash: '0',
    });

    console.log('[Fast2SMS] Method 1: OTP route to:', mobile10, '(~₹0.30/SMS)');

    const response = await fetch('https://www.fast2sms.com/dev/bulkV2', {
      method: 'POST',
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: otpBody.toString(),
    });

    const data = await response.json();
    console.log('[Fast2SMS] OTP route full response:', JSON.stringify(data));

    if (data.return === true && data.status_code !== 996) {
      console.log('[Fast2SMS] ✅ OTP route SUCCESS (~₹0.30/SMS)');
      return {
        success: true,
        message: 'OTP sent via Fast2SMS OTP route',
        provider: 'fast2sms',
        requestId: data.request_id,
        method: 'otp-route',
        apiResponse: data,
      };
    }

    routeErrors.push(`OTP: "${data.message}" (code:${data.status_code})`);
    console.warn('[Fast2SMS] OTP route FAILED:', data.message, 'code:', data.status_code);
  } catch (error) {
    routeErrors.push(`OTP: Network error`);
    console.error('[Fast2SMS] OTP route error:', error);
  }

  // ── Method 2: DLT Route (variable cost, needs DLT registration) ──
  try {
    const dltBody = new URLSearchParams({
      route: 'dlt',
      message: otpMessage,
      language: 'english',
      numbers: mobile10,
      flash: '0',
      sender_id: 'FSTSMS',
    });

    console.log('[Fast2SMS] Method 2: DLT route to:', mobile10);

    const response = await fetch('https://www.fast2sms.com/dev/bulkV2', {
      method: 'POST',
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: dltBody.toString(),
    });

    const data = await response.json();
    console.log('[Fast2SMS] DLT route full response:', JSON.stringify(data));

    if (data.return === true) {
      console.log('[Fast2SMS] ✅ DLT route SUCCESS');
      return {
        success: true,
        message: 'OTP sent via Fast2SMS DLT route',
        provider: 'fast2sms',
        requestId: data.request_id,
        method: 'dlt-route',
        apiResponse: data,
      };
    }

    routeErrors.push(`DLT: "${data.message}" (code:${data.status_code})`);
    console.warn('[Fast2SMS] DLT route FAILED:', data.message);
  } catch (error) {
    routeErrors.push(`DLT: Network error`);
    console.error('[Fast2SMS] DLT route error:', error);
  }

  // ── Method 3: Quick SMS Route (~₹5/SMS - EXPENSIVE, last resort only!) ──
  try {
    const quickBody = new URLSearchParams({
      route: 'q',
      message: otpMessage,
      language: 'english',
      numbers: mobile10,
      flash: '0',
    });

    console.log('[Fast2SMS] Method 3: Quick SMS to:', mobile10, '(~₹5/SMS - EXPENSIVE!)');

    const response = await fetch('https://www.fast2sms.com/dev/bulkV2', {
      method: 'POST',
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: quickBody.toString(),
    });

    const data = await response.json();
    console.log('[Fast2SMS] Quick route full response:', JSON.stringify(data));

    if (data.return === true) {
      console.log('[Fast2SMS] ✅ Quick route SUCCESS (~₹5/SMS - consider setting up OTP route to save money)');
      return {
        success: true,
        message: 'OTP sent via Fast2SMS Quick route (~₹5/SMS)',
        provider: 'fast2sms',
        requestId: data.request_id,
        method: 'quick-route',
        apiResponse: data,
      };
    }

    routeErrors.push(`Quick: "${data.message}" (code:${data.status_code})`);
    console.warn('[Fast2SMS] Quick route FAILED:', data.message, 'code:', data.status_code);
  } catch (error) {
    routeErrors.push(`Quick: Network error`);
    console.error('[Fast2SMS] Quick route error:', error);
  }

  return {
    success: false,
    message: `Fast2SMS failed: [${routeErrors.join(' | ')}]`,
    provider: 'fast2sms',
    method: 'all-failed',
  };
}

// ─── MSG91 Provider ─────────────────────────────────────────────

async function sendViaMSG91(
  phone: string,
  otp: string,
  config: OTPProviderConfig
): Promise<OTPResult> {
  const authKey = config.msg91AuthKey!;
  const mobile10 = sanitizePhone(phone);
  const mobileWithCC = '91' + mobile10;
  const message = `Your Kabaddi Pro verification code is ${otp}. Do not share with anyone. Valid for 5 minutes.`;

  // ── Method 1: Direct SMS API (transactional) ──────────────
  try {
    const smsBody = {
      sender: 'MSG91',
      route: '4',
      country: '91',
      sms: [{ message, to: [mobile10] }],
    };

    console.log('[MSG91] Method 1: Direct SMS to:', mobile10);

    const smsResponse = await fetch('https://api.msg91.com/api/v2/sendsms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'authkey': authKey },
      body: JSON.stringify(smsBody),
    });

    const smsData = await smsResponse.json();
    console.log('[MSG91] Direct SMS full response:', JSON.stringify(smsData));

    if (smsResponse.ok && smsData.type !== 'error') {
      return {
        success: true,
        message: 'OTP sent via MSG91 Direct SMS',
        provider: 'msg91',
        requestId: smsData.message,
        method: 'direct-sms',
        apiResponse: smsData,
      };
    }
    console.warn('[MSG91] Direct SMS failed:', smsData.message || smsData.type);
  } catch (error) {
    console.error('[MSG91] Direct SMS error:', error);
  }

  // ── Method 2: OTP API ──────────────────────────────────────
  try {
    console.log('[MSG91] Method 2: OTP API to:', mobileWithCC);

    const otpResponse = await fetch('https://control.msg91.com/api/v5/otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'authkey': authKey },
      body: JSON.stringify({ 
        mobile: mobileWithCC, 
        otp,
        otp_length: '6',
        otp_expiry: '5',
      }),
    });

    const otpData = await otpResponse.json();
    console.log('[MSG91] OTP API full response:', JSON.stringify(otpData));

    if (otpData.type === 'success') {
      return {
        success: true,
        message: 'OTP sent via MSG91 OTP API',
        provider: 'msg91',
        requestId: otpData.request_id,
        method: 'otp-api',
        apiResponse: otpData,
      };
    }
  } catch (error) {
    console.error('[MSG91] OTP API error:', error);
  }

  // ── Method 3: Flow API (if template available) ─────────────
  if (config.msg91TemplateId) {
    try {
      console.log('[MSG91] Method 3: Flow API with template:', config.msg91TemplateId);

      const flowBody = {
        template_id: config.msg91TemplateId,
        recipients: [{ mobiles: mobileWithCC, var: otp }],
      };

      const flowResponse = await fetch('https://control.msg91.com/api/v5/flow/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'authkey': authKey },
        body: JSON.stringify(flowBody),
      });

      const flowData = await flowResponse.json();
      console.log('[MSG91] Flow API full response:', JSON.stringify(flowData));

      if (flowResponse.ok) {
        return {
          success: true,
          message: 'OTP sent via MSG91 Flow API',
          provider: 'msg91',
          method: 'flow-api',
          apiResponse: flowData,
        };
      }
    } catch (error) {
      console.error('[MSG91] Flow API error:', error);
    }
  }

  return {
    success: false,
    message: 'MSG91: All methods failed. Check SMS credits (not wallet balance) and DLT registration.',
    provider: 'msg91',
    method: 'all-failed',
  };
}

// ─── Twilio Provider ────────────────────────────────────────────

async function sendViaTwilio(
  phone: string,
  otp: string,
  config: OTPProviderConfig
): Promise<OTPResult> {
  const accountSid = config.twilioAccountSid!;
  const authToken = config.twilioAuthToken!;
  const fullPhone = phone.startsWith('+') ? phone : '+91' + sanitizePhone(phone);

  if (config.twilioVerifyServiceSid) {
    try {
      const response = await fetch(
        `https://verify.twilio.com/v2/Services/${config.twilioVerifyServiceSid}/Verifications`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
          },
          body: new URLSearchParams({ To: fullPhone, Channel: 'sms' }),
        }
      );
      const data = await response.json();
      if (!response.ok) {
        return { success: false, message: data.message || 'Failed via Twilio Verify', provider: 'twilio', method: 'verify' };
      }
      return { success: true, message: 'OTP sent via Twilio Verify', provider: 'twilio', requestId: data.sid, method: 'verify' };
    } catch {
      // Fall through to direct SMS
    }
  }

  if (!config.twilioPhoneNumber) {
    return { success: false, message: 'TWILIO_PHONE_NUMBER required for direct SMS', provider: 'twilio', method: 'direct-sms' };
  }

  try {
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
        },
        body: new URLSearchParams({
          To: fullPhone,
          From: config.twilioPhoneNumber,
          Body: `Your Kabaddi Pro verification code is ${otp}. Do not share. Valid for 5 minutes.`,
        }),
      }
    );
    const data = await response.json();
    if (!response.ok) {
      return { success: false, message: data.message || 'Failed via Twilio SMS', provider: 'twilio', method: 'direct-sms' };
    }
    return { success: true, message: 'OTP sent via Twilio SMS', provider: 'twilio', requestId: data.sid, method: 'direct-sms' };
  } catch {
    return { success: false, message: 'Twilio unavailable', provider: 'twilio', method: 'direct-sms' };
  }
}

// ─── MSG91 Balance Check ────────────────────────────────────────

async function checkMSG91Balance(authKey: string): Promise<{ balance: number | null; raw: Record<string, unknown> }> {
  try {
    const response = await fetch('https://api.msg91.com/api/balance.php?authkey=' + authKey + '&type=1', {
      method: 'GET',
      headers: { 'authkey': authKey },
    });
    const text = await response.text();
    const balance = parseFloat(text);
    return { balance: isNaN(balance) ? null : balance, raw: { response: text } };
  } catch {
    return { balance: null, raw: { error: 'Failed to check balance' } };
  }
}

// ─── Fast2SMS Balance Check ─────────────────────────────────────

async function checkFast2SMSBalance(apiKey: string): Promise<{ wallet: number | null; raw: Record<string, unknown> }> {
  try {
    const response = await fetch('https://www.fast2sms.com/dev/wallet-balance', {
      method: 'GET',
      headers: { 'Authorization': apiKey },
    });
    const data = await response.json();
    return { wallet: data.wallet ?? null, raw: data };
  } catch {
    return { wallet: null, raw: { error: 'Failed to check Fast2SMS balance' } };
  }
}

// ─── Smart Send: Auto-Fallback Across Providers ─────────────────

export async function sendOTP(phone: string, otp: string): Promise<OTPResult> {
  const config = getConfig();
  const providers = getAvailableProviders(config);
  const attempts: OTPAttempt[] = [];

  if (providers.length === 0) {
    console.error('[OTP] NO providers configured!');
    return {
      success: false,
      message: 'No OTP provider configured. Please add FAST2SMS_API_KEY or MSG91_AUTH_KEY.',
      provider: 'none',
      attempts,
    };
  }

  console.log(`[OTP] Available providers: ${providers.join(' → ')}`);

  for (const provider of providers) {
    console.log(`[OTP] Trying: ${provider}...`);
    
    let result: OTPResult;
    switch (provider) {
      case 'fast2sms': result = await sendViaFast2SMS(phone, otp, config); break;
      case 'msg91': result = await sendViaMSG91(phone, otp, config); break;
      case 'twilio': result = await sendViaTwilio(phone, otp, config); break;
      default: result = { success: false, message: `Unknown: ${provider}`, provider };
    }

    attempts.push({
      provider,
      method: result.method || 'unknown',
      success: result.success,
      message: result.message,
      apiResponse: result.apiResponse,
    });

    if (result.success) {
      console.log(`[OTP] ✅ Success: ${provider} (${result.method})`);
      result.attempts = attempts;
      return result;
    }

    console.warn(`[OTP] ❌ ${provider} failed: ${result.message}`);
  }

  return {
    success: false,
    message: `All providers failed: ${attempts.map(a => `${a.provider}: ${a.message}`).join(' || ')}`,
    provider: 'all-failed',
    attempts,
  };
}

// ─── Verify OTP ─────────────────────────────────────────────────

export async function verifyOTPProvider(
  phone: string,
  otp: string,
  providerUsed?: string
): Promise<{ valid: boolean; message: string } | null> {
  // Only use MSG91 server-side verification if the OTP was actually sent via MSG91
  // When OTP is sent via Fast2SMS or Twilio, MSG91 has no record and will return "invalid"
  const config = getConfig();
  if (config.msg91AuthKey && providerUsed === 'msg91') {
    const mobileWithCC = '91' + sanitizePhone(phone);
    try {
      const response = await fetch(
        `https://control.msg91.com/api/v5/otp/verify?mobile=${encodeURIComponent(mobileWithCC)}&otp=${otp}`,
        { method: 'GET', headers: { 'authkey': config.msg91AuthKey } }
      );
      const data = await response.json();
      if (data.type === 'success' || data.message?.toLowerCase().includes('verified')) {
        return { valid: true, message: 'OTP verified' };
      }
      return { valid: false, message: data.message || 'Invalid OTP' };
    } catch {
      return null;
    }
  }
  // For all other providers (Fast2SMS, Twilio), use local verification
  return null;
}

// ─── Public Helpers ─────────────────────────────────────────────

export function isDemoMode(): boolean { return false; }
export function isConfigured(): boolean { return getAvailableProviders(getConfig()).length > 0; }

export function getProviderName(): string {
  const config = getConfig();
  const providers = getAvailableProviders(config);
  if (providers.length === 0) return 'Not Configured';
  if (config.preferredProvider === 'auto') return providers.join(' → ') + ' (auto)';
  return providers[0].toUpperCase();
}

export async function getDiagnosticInfo() {
  const config = getConfig();
  const providers = getAvailableProviders(config);
  
  let msg91Balance: { balance: number | null; raw: Record<string, unknown> } | null = null;
  if (config.msg91AuthKey) {
    msg91Balance = await checkMSG91Balance(config.msg91AuthKey);
  }

  let fast2smsBalance: { wallet: number | null; raw: Record<string, unknown> } | null = null;
  if (config.fast2smsApiKey) {
    fast2smsBalance = await checkFast2SMSBalance(config.fast2smsApiKey);
  }

  return {
    preferredProvider: config.preferredProvider,
    availableProviders: providers,
    hasFast2smsKey: !!config.fast2smsApiKey,
    fast2smsWallet: fast2smsBalance?.wallet,
    hasMsg91AuthKey: !!config.msg91AuthKey,
    msg91Balance: msg91Balance?.balance,
    hasMsg91TemplateId: !!config.msg91TemplateId,
    hasTwilioCreds: !!(config.twilioAccountSid && config.twilioAuthToken),
    isConfigured: providers.length > 0,
    recommendation: providers.length === 0
      ? '⚠️ NO providers configured! Add FAST2SMS_API_KEY or MSG91_AUTH_KEY.'
      : providers.includes('fast2sms')
        ? '✅ Fast2SMS available - best for India (no DLT needed)'
        : '⚠️ Only MSG91 available. Add FAST2SMS_API_KEY for reliable delivery.',
  };
}
