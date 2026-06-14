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
 * - Fast2SMS works WITHOUT DLT registration. ₹50 free credits on signup.
 * - Recommended: Sign up at https://fast2sms.com and add FAST2SMS_API_KEY
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

/**
 * Get the list of available providers with credentials, in priority order.
 * The preferred provider goes first, then others by reliability.
 */
function getAvailableProviders(config: OTPProviderConfig): Array<'fast2sms' | 'msg91' | 'twilio'> {
  const available: Array<'fast2sms' | 'msg91' | 'twilio'> = [];
  
  // If a specific provider is preferred, try it first
  if (config.preferredProvider !== 'auto') {
    const pref = config.preferredProvider;
    if (hasCredentials(config, pref)) {
      available.push(pref);
    } else {
      console.warn(`[OTP] Preferred provider "${pref}" has no credentials, skipping to auto-order`);
    }
  }

  // Add remaining providers in optimal order for India:
  // Fast2SMS first (no DLT, instant), then MSG91, then Twilio
  const order: Array<'fast2sms' | 'msg91' | 'twilio'> = ['fast2sms', 'msg91', 'twilio'];
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

/**
 * Sanitize phone number: ensure 10-digit Indian format
 */
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
// Best for India: No DLT required, instant delivery, ₹50 free credits

async function sendViaFast2SMS(
  phone: string,
  otp: string,
  config: OTPProviderConfig
): Promise<OTPResult> {
  const apiKey = config.fast2smsApiKey!;
  const mobile10 = sanitizePhone(phone);

  try {
    // Method 1: OTP route (recommended - no DLT needed)
    const requestBody = new URLSearchParams({
      route: 'otp',
      variables_values: otp,
      numbers: mobile10,
      flash: '0',
    });

    console.log('[Fast2SMS] Sending OTP to:', mobile10, 'route: otp');

    const response = await fetch('https://www.fast2sms.com/dev/bulkV2', {
      method: 'POST',
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: requestBody.toString(),
    });

    const data = await response.json();
    console.log('[Fast2SMS] API response:', JSON.stringify(data), 'HTTP:', response.status);

    if (data.return === false) {
      // OTP route failed, try Quick SMS route as fallback
      console.warn('[Fast2SMS] OTP route failed, trying Quick route...');
      
      const quickBody = new URLSearchParams({
        route: 'q',              // Quick route
        message: `Your Kabaddi Pro verification code is ${otp}. Do not share with anyone.`,
        language: 'english',
        numbers: mobile10,
        flash: '0',
      });

      const quickResponse = await fetch('https://www.fast2sms.com/dev/bulkV2', {
        method: 'POST',
        headers: {
          'Authorization': apiKey,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
        },
        body: quickBody.toString(),
      });

      const quickData = await quickResponse.json();
      console.log('[Fast2SMS] Quick route response:', JSON.stringify(quickData));

      if (quickData.return === false) {
        return {
          success: false,
          message: quickData.message || 'Fast2SMS Quick route also failed',
          provider: 'fast2sms',
          method: 'quick-route',
          apiResponse: quickData,
        };
      }

      return {
        success: true,
        message: 'OTP sent via Fast2SMS Quick route',
        provider: 'fast2sms',
        requestId: quickData.request_id,
        method: 'quick-route',
        apiResponse: quickData,
      };
    }

    return {
      success: true,
      message: 'OTP sent via Fast2SMS OTP route',
      provider: 'fast2sms',
      requestId: data.request_id,
      method: 'otp-route',
      apiResponse: data,
    };
  } catch (error) {
    console.error('[Fast2SMS] Network error:', error);
    return {
      success: false,
      message: 'Fast2SMS service unavailable',
      provider: 'fast2sms',
      method: 'otp-route',
    };
  }
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
    console.log('[MSG91] Direct SMS response:', JSON.stringify(smsData), 'HTTP:', smsResponse.status);

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
    console.log('[MSG91] OTP API response:', JSON.stringify(otpData));

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
      console.log('[MSG91] Flow API response:', JSON.stringify(flowData));

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
    message: 'All MSG91 methods failed. Check: 1) SMS credits (not wallet balance), 2) DLT registration, 3) Sender ID approval',
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

  // Try Twilio Verify first (better for OTP)
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

  // Direct SMS via Twilio
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

async function checkMSG91Balance(authKey: string): Promise<{ balance: number | null; route: string; raw: Record<string, unknown> }> {
  try {
    const response = await fetch('https://api.msg91.com/api/balance.php?authkey=' + authKey + '&type=1', {
      method: 'GET',
      headers: { 'authkey': authKey },
    });
    const text = await response.text();
    const balance = parseFloat(text);
    return { balance: isNaN(balance) ? null : balance, route: 'transactional', raw: { response: text } };
  } catch {
    return { balance: null, route: 'transactional', raw: { error: 'Failed to check balance' } };
  }
}

// ─── Smart Send: Auto-Fallback Across Providers ─────────────────

export async function sendOTP(phone: string, otp: string): Promise<OTPResult> {
  const config = getConfig();
  const providers = getAvailableProviders(config);
  const attempts: OTPAttempt[] = [];

  if (providers.length === 0) {
    console.error('[OTP] NO providers configured! Add at least one: FAST2SMS_API_KEY, MSG91_AUTH_KEY, or Twilio credentials');
    return {
      success: false,
      message: 'No OTP provider configured. Please add FAST2SMS_API_KEY or MSG91_AUTH_KEY to your environment variables.',
      provider: 'none',
      attempts,
    };
  }

  console.log(`[OTP] Available providers (in order): ${providers.join(' → ')}`);

  // Try each provider in order until one succeeds
  for (const provider of providers) {
    console.log(`[OTP] Trying provider: ${provider}...`);
    
    let result: OTPResult;
    switch (provider) {
      case 'fast2sms':
        result = await sendViaFast2SMS(phone, otp, config);
        break;
      case 'msg91':
        result = await sendViaMSG91(phone, otp, config);
        break;
      case 'twilio':
        result = await sendViaTwilio(phone, otp, config);
        break;
      default:
        result = { success: false, message: `Unknown provider: ${provider}`, provider };
    }

    attempts.push({
      provider,
      method: result.method || 'unknown',
      success: result.success,
      message: result.message,
      apiResponse: result.apiResponse,
    });

    if (result.success) {
      console.log(`[OTP] ✅ Success with ${provider} (${result.method})`);
      result.attempts = attempts;
      return result;
    }

    console.warn(`[OTP] ❌ ${provider} failed: ${result.message}`);
    // Continue to next provider
  }

  // All providers failed
  console.error('[OTP] All providers failed!');
  return {
    success: false,
    message: `All ${providers.length} OTP provider(s) failed. Attempts: ${attempts.map(a => `${a.provider}(${a.method}): ${a.message}`).join('; ')}`,
    provider: 'all-failed',
    attempts,
  };
}

// ─── Verify OTP ─────────────────────────────────────────────────

export async function verifyOTPProvider(
  phone: string,
  otp: string
): Promise<{ valid: boolean; message: string } | null> {
  const config = getConfig();
  // Only MSG91 has server-side OTP verification
  if (config.msg91AuthKey) {
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
  return null; // Use local verification for other providers
}

// ─── Public Helpers ─────────────────────────────────────────────

export function isDemoMode(): boolean { return false; }

export function isConfigured(): boolean { 
  const config = getConfig();
  return getAvailableProviders(config).length > 0;
}

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
  
  // Check MSG91 balance if key exists
  let msg91Balance: { balance: number | null; route: string; raw: Record<string, unknown> } | null = null;
  if (config.msg91AuthKey) {
    msg91Balance = await checkMSG91Balance(config.msg91AuthKey);
  }

  return {
    preferredProvider: config.preferredProvider,
    availableProviders: providers,
    hasFast2smsKey: !!config.fast2smsApiKey,
    hasMsg91AuthKey: !!config.msg91AuthKey,
    hasMsg91TemplateId: !!config.msg91TemplateId,
    hasTwilioCreds: !!(config.twilioAccountSid && config.twilioAuthToken),
    isConfigured: providers.length > 0,
    msg91Balance: msg91Balance?.balance,
    msg91BalanceRaw: msg91Balance?.raw,
    recommendation: providers.length === 0
      ? '⚠️ NO providers configured! Add FAST2SMS_API_KEY (recommended) or MSG91_AUTH_KEY to your environment variables.'
      : providers.includes('fast2sms')
        ? '✅ Fast2SMS available - best for India (no DLT, instant delivery)'
        : '⚠️ Only MSG91 available. MSG91 requires: 1) SMS credits (not just wallet), 2) DLT registration, 3) Approved sender ID. Consider adding FAST2SMS_API_KEY as backup.',
  };
}
