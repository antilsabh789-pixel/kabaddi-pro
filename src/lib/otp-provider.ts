/**
 * OTP Provider Abstraction Layer
 * 
 * Supports:
 * - Fast2SMS (recommended for India - NO DLT required!) - https://fast2sms.com
 * - MSG91 (requires DLT registration) - https://msg91.com
 * - Twilio (global fallback) - https://twilio.com
 * 
 * NO DEMO MODE - Always uses real SMS providers.
 * 
 * IMPORTANT for India:
 * - MSG91 requires DLT registration (Entity ID + Sender ID + Template + PE-TM Chain)
 *   Without DLT, MSG91 API returns "success" but SMS is NEVER delivered
 * - Fast2SMS works WITHOUT DLT registration using Quick SMS route
 * - Fast2SMS gives ₹50 free credits on signup
 */

// ─── Types ──────────────────────────────────────────────────────
export interface OTPResult {
  success: boolean;
  message: string;
  provider: string;
  requestId?: string;
  apiResponse?: Record<string, unknown>;
  method?: string;
}

export interface OTPProviderConfig {
  provider: 'fast2sms' | 'msg91' | 'twilio';
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

// ─── Provider Implementation ────────────────────────────────────

function getConfig(): OTPProviderConfig {
  const provider = (process.env.OTP_PROVIDER || 'fast2sms').toLowerCase() as OTPProviderConfig['provider'];
  return {
    provider,
    fast2smsApiKey: process.env.FAST2SMS_API_KEY,
    msg91AuthKey: process.env.MSG91_AUTH_KEY,
    msg91TemplateId: process.env.MSG91_TEMPLATE_ID,
    twilioAccountSid: process.env.TWILIO_ACCOUNT_SID,
    twilioAuthToken: process.env.TWILIO_AUTH_TOKEN,
    twilioPhoneNumber: process.env.TWILIO_PHONE_NUMBER,
    twilioVerifyServiceSid: process.env.TWILIO_VERIFY_SERVICE_SID,
  };
}

function validateConfig(config: OTPProviderConfig): string | null {
  if (config.provider === 'fast2sms') {
    if (!config.fast2smsApiKey) return 'FAST2SMS_API_KEY is required when OTP_PROVIDER=fast2sms';
  }
  if (config.provider === 'msg91') {
    if (!config.msg91AuthKey) return 'MSG91_AUTH_KEY is required when OTP_PROVIDER=msg91';
  }
  if (config.provider === 'twilio') {
    if (!config.twilioAccountSid) return 'TWILIO_ACCOUNT_SID is required when OTP_PROVIDER=twilio';
    if (!config.twilioAuthToken) return 'TWILIO_AUTH_TOKEN is required when OTP_PROVIDER=twilio';
  }
  return null;
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
// Fast2SMS is the BEST option for India:
// - NO DLT registration required
// - Quick SMS route delivers instantly
// - ₹50 free credits on signup
// - API: https://www.fast2sms.com/dev/api

async function sendViaFast2SMS(
  phone: string,
  otp: string,
  config: OTPProviderConfig
): Promise<OTPResult> {
  const apiKey = config.fast2smsApiKey!;
  const mobile10 = sanitizePhone(phone);

  try {
    const requestBody = new URLSearchParams({
      route: 'otp',              // Fast2SMS OTP route (no DLT needed)
      variables_values: otp,      // The OTP value
      numbers: mobile10,          // 10-digit mobile number
      flash: '0',                 // Non-flash SMS
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
    console.log('[Fast2SMS] Full API response:', JSON.stringify(data), 'HTTP status:', response.status);

    if (data.return === false) {
      console.error('[Fast2SMS] Send failed:', data);
      return {
        success: false,
        message: data.message || 'Failed to send OTP via Fast2SMS',
        provider: 'fast2sms',
        method: 'otp-route',
        apiResponse: data,
      };
    }

    console.log('[Fast2SMS] ✅ OTP sent successfully, request_id:', data.request_id);
    return {
      success: true,
      message: 'OTP sent successfully via Fast2SMS',
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

// ─── MSG91 Provider (DLT required - fallback only) ──────────────

async function sendViaMSG91(
  phone: string,
  otp: string,
  config: OTPProviderConfig
): Promise<OTPResult> {
  const authKey = config.msg91AuthKey!;
  const mobile10 = sanitizePhone(phone);
  const mobileWithCC = '91' + mobile10;

  // Try Direct SMS API first
  try {
    const requestBody = {
      sender: 'MSG91',
      route: '4',
      country: '91',
      sms: [{
        message: `Your Kabaddi Pro verification code is ${otp}. Do not share. Valid 5 min.`,
        to: [mobile10],
      }],
    };

    console.log('[MSG91] Sending SMS to:', mobile10, 'route: transactional');

    const response = await fetch('https://api.msg91.com/api/v2/sendsms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'authkey': authKey,
      },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();
    console.log('[MSG91] API response:', JSON.stringify(data));

    if (!response.ok || data.type === 'error') {
      console.error('[MSG91] Direct SMS failed, trying OTP API...');
      
      // Fallback to OTP API
      const otpResponse = await fetch('https://control.msg91.com/api/v5/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'authkey': authKey },
        body: JSON.stringify({ mobile: mobileWithCC, otp: otp }),
      });
      const otpData = await otpResponse.json();
      console.log('[MSG91] OTP API response:', JSON.stringify(otpData));

      if (otpData.type === 'success') {
        return {
          success: true,
          message: 'OTP sent via MSG91 OTP API (may not deliver without DLT)',
          provider: 'msg91',
          requestId: otpData.request_id,
          method: 'otp-api',
        };
      }

      return {
        success: false,
        message: 'All MSG91 methods failed. DLT registration required for delivery.',
        provider: 'msg91',
        method: 'all-failed',
      };
    }

    return {
      success: true,
      message: 'OTP sent via MSG91 Direct SMS',
      provider: 'msg91',
      requestId: data.message,
      method: 'direct-sms',
    };
  } catch (error) {
    console.error('[MSG91] Network error:', error);
    return {
      success: false,
      message: 'MSG91 service unavailable',
      provider: 'msg91',
    };
  }
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
        return { success: false, message: data.message || 'Failed via Twilio', provider: 'twilio' };
      }
      return { success: true, message: 'OTP sent via Twilio Verify', provider: 'twilio', requestId: data.sid };
    } catch {
      return { success: false, message: 'Twilio unavailable', provider: 'twilio' };
    }
  }

  if (!config.twilioPhoneNumber) {
    return { success: false, message: 'TWILIO_PHONE_NUMBER required', provider: 'twilio' };
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
      return { success: false, message: data.message || 'Failed via Twilio SMS', provider: 'twilio' };
    }
    return { success: true, message: 'OTP sent via Twilio SMS', provider: 'twilio', requestId: data.sid };
  } catch {
    return { success: false, message: 'Twilio unavailable', provider: 'twilio' };
  }
}

// ─── Public API ─────────────────────────────────────────────────

export async function sendOTP(phone: string, otp: string): Promise<OTPResult> {
  const config = getConfig();
  const validationError = validateConfig(config);
  if (validationError) {
    console.error(`[OTP] Configuration error: ${validationError}`);
    return {
      success: false,
      message: `OTP service not configured: ${validationError}`,
      provider: config.provider,
    };
  }

  switch (config.provider) {
    case 'fast2sms': return sendViaFast2SMS(phone, otp, config);
    case 'msg91': return sendViaMSG91(phone, otp, config);
    case 'twilio': return sendViaTwilio(phone, otp, config);
    default: return { success: false, message: `Unknown provider: ${config.provider}`, provider: config.provider };
  }
}

export async function verifyOTPProvider(
  phone: string,
  otp: string
): Promise<{ valid: boolean; message: string } | null> {
  // MSG91 verify only works with OTP API, Fast2SMS doesn't have server-side verify
  // We use local verification instead for all providers
  const config = getConfig();
  if (config.provider === 'msg91' && config.msg91AuthKey) {
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
  return null; // Use local verification for Fast2SMS and Twilio
}

export function isDemoMode(): boolean { return false; }
export function isConfigured(): boolean { return validateConfig(getConfig()) === null; }
export function getProviderName(): string {
  const config = getConfig();
  return validateConfig(config) ? 'Not Configured' : config.provider.toUpperCase();
}

export function getDiagnosticInfo() {
  const config = getConfig();
  return {
    provider: config.provider,
    hasFast2smsKey: !!config.fast2smsApiKey,
    hasMsg91AuthKey: !!config.msg91AuthKey,
    hasMsg91TemplateId: !!config.msg91TemplateId,
    isConfigured: validateConfig(config) === null,
    validationError: validateConfig(config),
    note: config.provider === 'fast2sms'
      ? 'Fast2SMS: No DLT required, instant delivery. Get API key from https://fast2sms.com → Dev API'
      : 'MSG91: DLT registration REQUIRED for SMS delivery in India. Without DLT, API returns success but SMS never delivers.',
  };
}
