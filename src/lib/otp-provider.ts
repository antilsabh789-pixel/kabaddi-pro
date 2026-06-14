/**
 * OTP Provider Abstraction Layer
 * 
 * Supports:
 * - MSG91 (recommended for India) - https://msg91.com
 * - Twilio (global fallback) - https://twilio.com
 * 
 * NO DEMO MODE - Always uses real SMS providers.
 * If credentials are missing, the OTP send will FAIL (not fall back to demo).
 * 
 * MSG91 Delivery Methods (tried in order):
 * 1. Direct SMS API (/api/v2/sendsms) - most reliable, bypasses OTP app
 * 2. Flow API (/api/v5/flow/) - for DLT templates
 * 3. OTP API (/api/v5/otp) - MSG91 built-in OTP service (requires OTP app setup)
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
  provider: 'msg91' | 'twilio';
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
  const provider = (process.env.OTP_PROVIDER || 'msg91').toLowerCase() as OTPProviderConfig['provider'];
  return {
    provider,
    msg91AuthKey: process.env.MSG91_AUTH_KEY,
    msg91TemplateId: process.env.MSG91_TEMPLATE_ID,
    twilioAccountSid: process.env.TWILIO_ACCOUNT_SID,
    twilioAuthToken: process.env.TWILIO_AUTH_TOKEN,
    twilioPhoneNumber: process.env.TWILIO_PHONE_NUMBER,
    twilioVerifyServiceSid: process.env.TWILIO_VERIFY_SERVICE_SID,
  };
}

function validateConfig(config: OTPProviderConfig): string | null {
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
 * Sanitize phone number for MSG91 API
 * MSG91 expects: 91XXXXXXXXXX (no +, with country code)
 * For SMS API: XXXXXXXXXX (10 digits without country code)
 */
function sanitizePhoneForMSG91(phone: string): string {
  let cleaned = phone.replace(/[\s\-()]/g, '');
  if (cleaned.startsWith('+')) cleaned = cleaned.substring(1);
  if (cleaned.startsWith('0') && cleaned.length === 11) cleaned = '91' + cleaned.substring(1);
  if (cleaned.length === 10 && /^\d{10}$/.test(cleaned)) cleaned = '91' + cleaned;
  if (!/^91\d{10}$/.test(cleaned)) {
    console.warn('[MSG91] Unexpected phone format:', cleaned, '(original:', phone, ')');
  }
  return cleaned;
}

/**
 * Extract 10-digit number from sanitized phone (91XXXXXXXXXX → XXXXXXXXXX)
 */
function get10DigitPhone(phone: string): string {
  const sanitized = sanitizePhoneForMSG91(phone);
  if (sanitized.startsWith('91') && sanitized.length === 12) {
    return sanitized.substring(2);
  }
  return sanitized;
}

// ─── MSG91 Method 1: Direct SMS API ─────────────────────────────
// This is the MOST RELIABLE method - sends a regular transactional SMS
// Bypasses the OTP app entirely, works with just KYC + wallet balance
// Uses MSG91's own approved sender ID

async function sendViaMSG91DirectSMS(
  phone: string,
  otp: string,
  config: OTPProviderConfig
): Promise<OTPResult> {
  const authKey = config.msg91AuthKey!;
  const mobile10 = get10DigitPhone(phone);

  try {
    const requestBody = {
      sender: 'MSG91',  // MSG91's own DLT-approved sender
      route: '4',       // Route 4 = Transactional
      country: '91',
      sms: [
        {
          message: `Your Kabaddi Pro verification code is ${otp}. Do not share with anyone. Valid for 5 minutes.`,
          to: [mobile10],
        },
      ],
    };

    console.log('[MSG91 SMS] Sending direct SMS to:', mobile10, '(route: transactional)');

    const response = await fetch('https://api.msg91.com/api/v2/sendsms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'authkey': authKey,
      },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();
    console.log('[MSG91 SMS] Full API response:', JSON.stringify(data), 'HTTP status:', response.status);

    if (!response.ok || data.type === 'error') {
      console.error('[MSG91 SMS] Send failed:', data);
      return {
        success: false,
        message: data.message || data.msg || 'Failed to send SMS via MSG91',
        provider: 'msg91',
        method: 'direct-sms',
        apiResponse: data,
      };
    }

    console.log('[MSG91 SMS] SMS sent successfully, message_id:', data.message);
    return {
      success: true,
      message: 'OTP sent successfully via MSG91 SMS',
      provider: 'msg91',
      requestId: data.message,
      method: 'direct-sms',
      apiResponse: data,
    };
  } catch (error) {
    console.error('[MSG91 SMS] Network error:', error);
    return {
      success: false,
      message: 'MSG91 SMS service unavailable',
      provider: 'msg91',
      method: 'direct-sms',
    };
  }
}

// ─── MSG91 Method 2: Flow API ───────────────────────────────────
// Uses DLT-approved template (requires MSG91_TEMPLATE_ID)

async function sendViaMSG91Flow(
  phone: string,
  otp: string,
  config: OTPProviderConfig
): Promise<OTPResult> {
  const authKey = config.msg91AuthKey!;
  const sanitizedPhone = sanitizePhoneForMSG91(phone);
  const templateId = config.msg91TemplateId;

  if (!templateId) {
    return {
      success: false,
      message: 'MSG91_TEMPLATE_ID required for Flow API',
      provider: 'msg91',
      method: 'flow',
    };
  }

  try {
    const requestBody = {
      template_id: templateId,
      short_url: 0,
      recipients: [{ mobiles: sanitizedPhone, OTP: otp }],
    };

    console.log('[MSG91 Flow] Sending OTP via Flow to:', sanitizedPhone, 'template:', templateId);

    const response = await fetch('https://control.msg91.com/api/v5/flow/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'authkey': authKey,
      },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();
    console.log('[MSG91 Flow] Full API response:', JSON.stringify(data), 'HTTP status:', response.status);

    if (!response.ok || data.type === 'error') {
      console.error('[MSG91 Flow] Send failed:', data);
      return {
        success: false,
        message: data.message || data.msg || 'Failed to send via MSG91 Flow',
        provider: 'msg91',
        method: 'flow',
        apiResponse: data,
      };
    }

    return {
      success: true,
      message: 'OTP sent via MSG91 Flow',
      provider: 'msg91',
      requestId: data.message,
      method: 'flow',
      apiResponse: data,
    };
  } catch (error) {
    console.error('[MSG91 Flow] Network error:', error);
    return {
      success: false,
      message: 'MSG91 Flow unavailable',
      provider: 'msg91',
      method: 'flow',
    };
  }
}

// ─── MSG91 Method 3: OTP API ────────────────────────────────────
// Uses MSG91's built-in OTP service (requires OTP app to be configured in dashboard)
// This is the LEAST reliable method - often returns "success" but doesn't deliver

async function sendViaMSG91OTP(
  phone: string,
  otp: string,
  config: OTPProviderConfig
): Promise<OTPResult> {
  const authKey = config.msg91AuthKey!;
  const sanitizedPhone = sanitizePhoneForMSG91(phone);

  try {
    const requestBody: Record<string, string> = {
      mobile: sanitizedPhone,
      otp: otp,
    };

    if (config.msg91TemplateId) {
      requestBody.template_id = config.msg91TemplateId;
      requestBody.OTP = otp;
    }

    console.log('[MSG91 OTP] Sending OTP to:', sanitizedPhone, 'template:', config.msg91TemplateId || 'built-in');

    const response = await fetch('https://control.msg91.com/api/v5/otp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'authkey': authKey,
      },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();
    console.log('[MSG91 OTP] Full API response:', JSON.stringify(data), 'HTTP status:', response.status);

    if (!response.ok || data.type === 'error') {
      console.error('[MSG91 OTP] Send failed:', data);
      return {
        success: false,
        message: data.message || 'Failed to send OTP via MSG91',
        provider: 'msg91',
        method: 'otp-api',
        apiResponse: data,
      };
    }

    return {
      success: true,
      message: 'OTP sent via MSG91 OTP API',
      provider: 'msg91',
      requestId: data.request_id,
      method: 'otp-api',
      apiResponse: data,
    };
  } catch (error) {
    console.error('[MSG91 OTP] Network error:', error);
    return {
      success: false,
      message: 'MSG91 OTP service unavailable',
      provider: 'msg91',
      method: 'otp-api',
    };
  }
}

// ─── MSG91 Combined Send ────────────────────────────────────────
// Try methods in order of reliability:
// 1. Direct SMS (most reliable, bypasses OTP app)
// 2. Flow API (if template available)
// 3. OTP API (least reliable, often silently fails)

async function sendViaMSG91(
  phone: string,
  otp: string,
  config: OTPProviderConfig
): Promise<OTPResult> {
  // Method 1: Direct SMS - always try this first
  console.log('[MSG91] === Trying Method 1: Direct SMS API ===');
  const smsResult = await sendViaMSG91DirectSMS(phone, otp, config);
  if (smsResult.success) {
    console.log('[MSG91] ✅ Direct SMS succeeded');
    return smsResult;
  }
  console.log('[MSG91] ❌ Direct SMS failed:', smsResult.message);

  // Method 2: Flow API (if template available)
  if (config.msg91TemplateId) {
    console.log('[MSG91] === Trying Method 2: Flow API ===');
    const flowResult = await sendViaMSG91Flow(phone, otp, config);
    if (flowResult.success) {
      console.log('[MSG91] ✅ Flow API succeeded');
      return flowResult;
    }
    console.log('[MSG91] ❌ Flow API failed:', flowResult.message);
  }

  // Method 3: OTP API (last resort)
  console.log('[MSG91] === Trying Method 3: OTP API ===');
  const otpResult = await sendViaMSG91OTP(phone, otp, config);
  if (otpResult.success) {
    console.log('[MSG91] ✅ OTP API succeeded (but may not deliver - check MSG91 dashboard)');
    return otpResult;
  }

  console.log('[MSG91] ❌ ALL METHODS FAILED');
  return {
    success: false,
    message: 'All MSG91 delivery methods failed. Please check MSG91 dashboard for errors.',
    provider: 'msg91',
    method: 'all-failed',
  };
}

/**
 * Verify OTP using MSG91 Verify API
 * Note: Only works with OTP API method. For Direct SMS, we use local verification.
 */
async function verifyViaMSG91(
  phone: string,
  otp: string,
  config: OTPProviderConfig
): Promise<{ valid: boolean; message: string }> {
  const authKey = config.msg91AuthKey!;
  const sanitizedPhone = sanitizePhoneForMSG91(phone);

  try {
    const response = await fetch(
      `https://control.msg91.com/api/v5/otp/verify?mobile=${encodeURIComponent(sanitizedPhone)}&otp=${otp}`,
      { method: 'GET', headers: { 'authkey': authKey } }
    );

    const data = await response.json();
    console.log('[MSG91 Verify] Response:', JSON.stringify(data));

    if (data.type === 'success' || data.message?.toLowerCase().includes('verified')) {
      return { valid: true, message: 'OTP verified successfully' };
    }

    return { valid: false, message: data.message || 'Invalid OTP' };
  } catch (error) {
    console.error('[MSG91 Verify] Error:', error);
    return { valid: false, message: 'Verification service unavailable' };
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
          body: new URLSearchParams({ To: phone, Channel: 'sms' }),
        }
      );

      const data = await response.json();
      if (!response.ok) {
        return { success: false, message: data.message || 'Failed via Twilio', provider: 'twilio' };
      }
      return { success: true, message: 'OTP sent via Twilio Verify', provider: 'twilio', requestId: data.sid };
    } catch (error) {
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
          To: phone,
          From: config.twilioPhoneNumber,
          Body: `Your Kabaddi Pro verification code is ${otp}. Do not share with anyone. Valid for 5 minutes.`,
        }),
      }
    );
    const data = await response.json();
    if (!response.ok) {
      return { success: false, message: data.message || 'Failed via Twilio SMS', provider: 'twilio' };
    }
    return { success: true, message: 'OTP sent via Twilio SMS', provider: 'twilio', requestId: data.sid };
  } catch (error) {
    return { success: false, message: 'Twilio unavailable', provider: 'twilio' };
  }
}

async function verifyViaTwilio(
  phone: string,
  otp: string,
  config: OTPProviderConfig
): Promise<{ valid: boolean; message: string }> {
  if (!config.twilioVerifyServiceSid) return { valid: false, message: 'Local verification required' };
  
  try {
    const response = await fetch(
      `https://verify.twilio.com/v2/Services/${config.twilioVerifyServiceSid}/VerificationCheck`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': 'Basic ' + Buffer.from(`${config.twilioAccountSid!}:${config.twilioAuthToken!}`).toString('base64'),
        },
        body: new URLSearchParams({ To: phone, Code: otp }),
      }
    );
    const data = await response.json();
    return data.status === 'approved' ? { valid: true, message: 'OTP verified' } : { valid: false, message: 'Invalid OTP' };
  } catch {
    return { valid: false, message: 'Verification unavailable' };
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
    case 'msg91': return sendViaMSG91(phone, otp, config);
    case 'twilio': return sendViaTwilio(phone, otp, config);
    default: return { success: false, message: `Unknown provider: ${config.provider}`, provider: config.provider };
  }
}

export async function verifyOTPProvider(
  phone: string,
  otp: string
): Promise<{ valid: boolean; message: string } | null> {
  const config = getConfig();
  if (validateConfig(config)) return null;

  switch (config.provider) {
    case 'msg91': return verifyViaMSG91(phone, otp, config);
    case 'twilio': return config.twilioVerifyServiceSid ? verifyViaTwilio(phone, otp, config) : null;
    default: return null;
  }
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
    hasAuthKey: !!config.msg91AuthKey,
    hasTemplateId: !!config.msg91TemplateId,
    templateId: config.msg91TemplateId || '(none)',
    authKeyPrefix: config.msg91AuthKey ? config.msg91AuthKey.substring(0, 6) + '...' : '(missing)',
    isConfigured: validateConfig(config) === null,
    validationError: validateConfig(config),
    primaryMethod: 'direct-sms (most reliable)',
    note: 'MSG91 requires: (1) KYC completed, (2) Wallet balance. Direct SMS bypasses OTP app.',
  };
}
