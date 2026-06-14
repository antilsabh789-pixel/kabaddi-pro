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
 * MSG91 Delivery Note:
 * - KYC must be completed on MSG91 for SMS delivery in India (TRAI regulation)
 * - Without KYC, API returns success but SMS is NOT delivered by carriers
 * - Complete KYC at: https://control.msg91.com → Profile → KYC
 */

// ─── Types ──────────────────────────────────────────────────────
export interface OTPResult {
  success: boolean;
  message: string;
  /** Provider that was used */
  provider: string;
  /** Request ID from the provider (for tracking) */
  requestId?: string;
  /** Full API response for debugging */
  apiResponse?: Record<string, unknown>;
  /** Method used to send */
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

/**
 * Validate that the selected provider has all required credentials
 * Returns an error message if misconfigured, null if OK
 */
function validateConfig(config: OTPProviderConfig): string | null {
  if (config.provider === 'msg91') {
    if (!config.msg91AuthKey) return 'MSG91_AUTH_KEY is required when OTP_PROVIDER=msg91';
    // Template ID is optional - we can use MSG91's built-in OTP service without it
  }
  if (config.provider === 'twilio') {
    if (!config.twilioAccountSid) return 'TWILIO_ACCOUNT_SID is required when OTP_PROVIDER=twilio';
    if (!config.twilioAuthToken) return 'TWILIO_AUTH_TOKEN is required when OTP_PROVIDER=twilio';
  }
  return null;
}

// ─── MSG91 Provider ─────────────────────────────────────────────
// MSG91 is India's most popular SMS/OTP provider
// Docs: https://docs.msg91.com
//
// Delivery methods (tried in order):
// 1. MSG91 SMS Flow API (with template) - best for custom DLT templates
// 2. MSG91 OTP API (built-in service) - uses MSG91's own DLT sender
//
// IMPORTANT: KYC must be completed on MSG91 for delivery!

/**
 * Sanitize phone number for MSG91 API
 * MSG91 expects format: 91XXXXXXXXXX (no + sign, with country code)
 */
function sanitizePhoneForMSG91(phone: string): string {
  // Remove all spaces, dashes, parentheses
  let cleaned = phone.replace(/[\s\-()]/g, '');
  // Remove leading + if present
  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  }
  // If number starts with 0 (local format like 09876543210), replace with 91
  if (cleaned.startsWith('0') && cleaned.length === 11) {
    cleaned = '91' + cleaned.substring(1);
  }
  // If number is 10 digits only (no country code), prepend 91
  if (cleaned.length === 10 && /^\d{10}$/.test(cleaned)) {
    cleaned = '91' + cleaned;
  }
  // Validate final format: should be 12 digits starting with 91
  if (!/^91\d{10}$/.test(cleaned)) {
    console.warn('[MSG91] Unexpected phone format after sanitization:', cleaned, '(original:', phone, ')');
  }
  return cleaned;
}

/**
 * Method 1: Send OTP via MSG91 SMS Flow API
 * This uses a DLT-approved template and is more reliable for delivery
 * Requires MSG91_TEMPLATE_ID to be set
 */
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
      recipients: [
        {
          mobiles: sanitizedPhone,
          OTP: otp,
        },
      ],
    };

    console.log('[MSG91 Flow] Sending OTP via Flow API to:', sanitizedPhone, 'template:', templateId);

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
        message: data.message || data.msg || 'Failed to send OTP via MSG91 Flow',
        provider: 'msg91',
        method: 'flow',
        apiResponse: data,
      };
    }

    console.log('[MSG91 Flow] OTP sent successfully');
    return {
      success: true,
      message: 'OTP sent successfully via MSG91 Flow',
      provider: 'msg91',
      requestId: data.message,
      method: 'flow',
      apiResponse: data,
    };
  } catch (error) {
    console.error('[MSG91 Flow] Network error:', error);
    return {
      success: false,
      message: 'MSG91 Flow service unavailable',
      provider: 'msg91',
      method: 'flow',
    };
  }
}

/**
 * Method 2: Send OTP via MSG91 OTP API (built-in service)
 * This uses MSG91's own DLT-registered sender and template
 * Works without template_id - MSG91 handles everything
 */
async function sendViaMSG91OTP(
  phone: string,
  otp: string,
  config: OTPProviderConfig
): Promise<OTPResult> {
  const authKey = config.msg91AuthKey!;
  const sanitizedPhone = sanitizePhoneForMSG91(phone);

  try {
    // Build the request body - only mobile and otp for built-in service
    const requestBody: Record<string, string> = {
      mobile: sanitizedPhone,
      otp: otp,
    };

    // Add template_id ONLY if provided
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

    console.log('[MSG91 OTP] OTP sent successfully, request_id:', data.request_id);
    return {
      success: true,
      message: 'OTP sent successfully via MSG91',
      provider: 'msg91',
      requestId: data.request_id,
      method: 'otp-api',
      apiResponse: data,
    };
  } catch (error) {
    console.error('[MSG91 OTP] Network error:', error);
    return {
      success: false,
      message: 'MSG91 service unavailable. Please try again.',
      provider: 'msg91',
      method: 'otp-api',
    };
  }
}

/**
 * MSG91 Combined Send: 
 * - With template: Try Flow API first, then OTP API
 * - Without template: Use OTP API only (built-in service, guaranteed delivery)
 */
async function sendViaMSG91(
  phone: string,
  otp: string,
  config: OTPProviderConfig
): Promise<OTPResult> {
  // If template ID is available AND valid, try Flow API first
  if (config.msg91TemplateId) {
    console.log('[MSG91] Template available, trying Flow API first...');
    const flowResult = await sendViaMSG91Flow(phone, otp, config);
    if (flowResult.success) return flowResult;
    
    // Flow failed, try OTP API with template
    console.log('[MSG91] Flow API failed, trying OTP API with template...');
    return sendViaMSG91OTP(phone, otp, config);
  }
  
  // NO template = use MSG91's built-in OTP service (best delivery rate)
  // This uses MSG91's own DLT-registered sender - no custom template needed
  console.log('[MSG91] No template - using built-in OTP service (guaranteed delivery)');
  return sendViaMSG91OTP(phone, otp, config);
}

/**
 * Verify OTP using MSG91 Verify API
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
      {
        method: 'GET',
        headers: {
          'authkey': authKey,
        },
      }
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
// Twilio Verify is the recommended way for OTP via Twilio
// Docs: https://www.twilio.com/docs/verify

async function sendViaTwilio(
  phone: string,
  otp: string,
  config: OTPProviderConfig
): Promise<OTPResult> {
  const accountSid = config.twilioAccountSid!;
  const authToken = config.twilioAuthToken!;

  // If Twilio Verify Service SID is configured, use Verify API (recommended)
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
          body: new URLSearchParams({
            To: phone,
            Channel: 'sms',
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        console.error('[Twilio Verify] Send failed:', data);
        return {
          success: false,
          message: data.message || 'Failed to send OTP via Twilio',
          provider: 'twilio',
        };
      }

      return {
        success: true,
        message: 'OTP sent successfully via Twilio Verify',
        provider: 'twilio',
        requestId: data.sid,
      };
    } catch (error) {
      console.error('[Twilio Verify] Network error:', error);
      return {
        success: false,
        message: 'Twilio service unavailable. Please try again.',
        provider: 'twilio',
      };
    }
  }

  // Fallback: Direct SMS via Twilio
  try {
    const fromNumber = config.twilioPhoneNumber;
    if (!fromNumber) {
      return {
        success: false,
        message: 'TWILIO_PHONE_NUMBER is required for direct SMS',
        provider: 'twilio',
      };
    }

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
          From: fromNumber,
          Body: `Your Kabaddi Pro verification code is ${otp}. Do not share this with anyone. Valid for 5 minutes.`,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error('[Twilio SMS] Send failed:', data);
      return {
        success: false,
        message: data.message || 'Failed to send SMS via Twilio',
        provider: 'twilio',
      };
    }

    return {
      success: true,
      message: 'OTP sent successfully via Twilio SMS',
      provider: 'twilio',
      requestId: data.sid,
    };
  } catch (error) {
    console.error('[Twilio SMS] Network error:', error);
    return {
      success: false,
      message: 'Twilio service unavailable. Please try again.',
      provider: 'twilio',
    };
  }
}

/**
 * Verify OTP using Twilio Verify API
 */
async function verifyViaTwilio(
  phone: string,
  otp: string,
  config: OTPProviderConfig
): Promise<{ valid: boolean; message: string }> {
  const accountSid = config.twilioAccountSid!;
  const authToken = config.twilioAuthToken!;

  if (!config.twilioVerifyServiceSid) {
    return { valid: false, message: 'Local verification required' };
  }

  try {
    const response = await fetch(
      `https://verify.twilio.com/v2/Services/${config.twilioVerifyServiceSid}/VerificationCheck`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
        },
        body: new URLSearchParams({
          To: phone,
          Code: otp,
        }),
      }
    );

    const data = await response.json();

    if (data.status === 'approved') {
      return { valid: true, message: 'OTP verified successfully' };
    }

    return { valid: false, message: 'Invalid OTP' };
  } catch (error) {
    console.error('[Twilio Verify] Verify error:', error);
    return { valid: false, message: 'Verification service unavailable' };
  }
}

// ─── Public API ─────────────────────────────────────────────────

/**
 * Send an OTP to the given phone number via real SMS provider.
 * NO DEMO MODE - will fail if credentials are misconfigured.
 */
export async function sendOTP(phone: string, otp: string): Promise<OTPResult> {
  const config = getConfig();

  // Validate configuration - fail hard instead of falling back to demo
  const validationError = validateConfig(config);
  if (validationError) {
    console.error(`[OTP] Configuration error: ${validationError}`);
    return {
      success: false,
      message: `OTP service is not configured: ${validationError}. Please contact support.`,
      provider: config.provider,
    };
  }

  switch (config.provider) {
    case 'msg91':
      return sendViaMSG91(phone, otp, config);
    case 'twilio':
      return sendViaTwilio(phone, otp, config);
    default:
      return {
        success: false,
        message: `Unknown OTP provider: ${config.provider}`,
        provider: config.provider,
      };
  }
}

/**
 * Verify an OTP using the provider's verification API
 * Returns null if provider doesn't support server-side verification
 * (in which case, local verification should be used)
 */
export async function verifyOTPProvider(
  phone: string,
  otp: string
): Promise<{ valid: boolean; message: string } | null> {
  const config = getConfig();
  const validationError = validateConfig(config);
  if (validationError) return null;

  switch (config.provider) {
    case 'msg91':
      return verifyViaMSG91(phone, otp, config);
    case 'twilio':
      if (config.twilioVerifyServiceSid) {
        return verifyViaTwilio(phone, otp, config);
      }
      return null;
    default:
      return null;
  }
}

/**
 * Check if OTP is properly configured (always returns false for demo mode now)
 * This is kept for API compatibility but always returns false
 */
export function isDemoMode(): boolean {
  // Never demo mode anymore - real SMS only
  return false;
}

/**
 * Check if OTP provider is properly configured
 */
export function isConfigured(): boolean {
  const config = getConfig();
  return validateConfig(config) === null;
}

/**
 * Get the current provider name for display
 */
export function getProviderName(): string {
  const config = getConfig();
  if (validateConfig(config)) return 'Not Configured';
  return config.provider.toUpperCase();
}

/**
 * Get diagnostic info about OTP provider configuration
 */
export function getDiagnosticInfo() {
  const config = getConfig();
  return {
    provider: config.provider,
    hasAuthKey: !!config.msg91AuthKey,
    hasTemplateId: !!config.msg91TemplateId,
    templateId: config.msg91TemplateId || '(none - using built-in)',
    authKeyPrefix: config.msg91AuthKey ? config.msg91AuthKey.substring(0, 6) + '...' : '(missing)',
    isConfigured: validateConfig(config) === null,
    validationError: validateConfig(config),
    note: 'MSG91 requires: (1) KYC completed, (2) Valid template or built-in OTP service, (3) Wallet balance for delivery',
  };
}
