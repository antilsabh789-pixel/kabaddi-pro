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

  // Priority order by RELIABILITY for India:
  // Fast2SMS Quick (no DLT, works now) → Twilio (best when upgraded) → MSG91 (needs DLT + credits)
  // Note: Twilio trial accounts can't send to unverified numbers (error 21608)
  const order: Array<'fast2sms' | 'msg91' | 'twilio'> = ['fast2sms', 'twilio', 'msg91'];
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
// Fast2SMS routes (ORDERED BY RELIABILITY - most likely to work first):
// - Quick route (q): Most reliable, NO verification needed, ~₹5/SMS
// - OTP route: ~₹0.30/SMS but needs website verification in Fast2SMS dashboard
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

  // ── Method 1: Quick SMS Route (MOST RELIABLE - no verification needed!) ──
  try {
    const quickBody = new URLSearchParams({
      route: 'q',
      message: otpMessage,
      language: 'english',
      numbers: mobile10,
      flash: '0',
    });

    console.log('[Fast2SMS] Method 1: Quick SMS to:', mobile10, '(most reliable)');

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
      console.log('[Fast2SMS] ✅ Quick route SUCCESS');
      return {
        success: true,
        message: 'OTP sent via Fast2SMS Quick route',
        provider: 'fast2sms',
        requestId: data.request_id,
        method: 'quick-route',
        apiResponse: data,
      };
    }

    // DND number check - if number is on DND, other routes won't help either
    if (data.status_code === 427) {
      console.warn('[Fast2SMS] Number is on DND list - other routes will also fail');
      return {
        success: false,
        message: `Fast2SMS: This phone number is on the DND (Do Not Disturb) list. Please use a different number or deactivate DND by sending "START" to 1909.`,
        provider: 'fast2sms',
        method: 'quick-route',
      };
    }

    routeErrors.push(`Quick: "${data.message}" (code:${data.status_code})`);
    console.warn('[Fast2SMS] Quick route FAILED:', data.message, 'code:', data.status_code);
  } catch (error) {
    routeErrors.push(`Quick: Network error`);
    console.error('[Fast2SMS] Quick route error:', error);
  }

  // ── Method 2: OTP Route (~₹0.30/SMS - cheaper but needs website verification) ──
  try {
    const otpBody = new URLSearchParams({
      route: 'otp',
      variables_values: otp,
      numbers: mobile10,
      flash: '0',
    });

    console.log('[Fast2SMS] Method 2: OTP route to:', mobile10, '(~₹0.30/SMS)');

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

  // ── Method 3: DLT Route (needs DLT registration) ──
  try {
    const dltBody = new URLSearchParams({
      route: 'dlt',
      message: otpMessage,
      language: 'english',
      numbers: mobile10,
      flash: '0',
      sender_id: 'FSTSMS',
    });

    console.log('[Fast2SMS] Method 3: DLT route to:', mobile10);

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
// Twilio is the GOLD STANDARD for OTP delivery:
// - Twilio Verify: Purpose-built for OTP, handles sending + verification server-side
//   - No need for TWILIO_PHONE_NUMBER
//   - Built-in rate limiting, fraud guard, and expiry
//   - Supports SMS, WhatsApp, Voice, and Email channels
//   - Works reliably in India with ALL carriers (no DLT needed!)
// - Direct SMS: Fallback if Verify Service SID not configured
//
// IMPORTANT: Twilio TRIAL accounts can only send to VERIFIED numbers!
// Error 21608 = "The phone number is unverified. Trial accounts cannot send messages
// to unverified numbers; verify it at twilio.com/user/account/phone-numbers/verified"
// FIX: Upgrade your Twilio account by adding a payment method.
//
// Setup: https://www.twilio.com/en-us/verify
// 1. Sign up at twilio.com (free trial available)
// 2. Get Account SID + Auth Token from Dashboard
// 3. Create a Verify Service: https://www.twilio.com/console/verify/services
// 4. Set TWILIO_VERIFY_SERVICE_SID env var
// 5. UPGRADE your account by adding billing info at twilio.com/user/account/billing

async function sendViaTwilio(
  phone: string,
  otp: string,
  config: OTPProviderConfig
): Promise<OTPResult> {
  const accountSid = config.twilioAccountSid!;
  const authToken = config.twilioAuthToken!;
  const mobile10 = sanitizePhone(phone);
  const fullPhone = phone.startsWith('+') ? phone : '+91' + mobile10;
  const authHeader = 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64');

  // ── Method 1: Twilio Verify (BEST - purpose-built for OTP) ──
  if (config.twilioVerifyServiceSid) {
    try {
      console.log('[Twilio] Method 1: Verify Service to:', fullPhone);

      const response = await fetch(
        `https://verify.twilio.com/v2/Services/${config.twilioVerifyServiceSid}/Verifications`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': authHeader,
          },
          body: new URLSearchParams({
            To: fullPhone,
            Channel: 'sms',
            CustomCode: otp,  // Use our own OTP for local verification compatibility
          }),
        }
      );
      const data = await response.json();
      console.log('[Twilio] Verify response:', JSON.stringify(data));

      if (response.ok && data.status === 'pending') {
        console.log('[Twilio] ✅ Verify OTP sent successfully');
        return {
          success: true,
          message: 'OTP sent via Twilio Verify (most reliable)',
          provider: 'twilio',
          requestId: data.sid,
          method: 'verify',
          apiResponse: { status: data.status, sid: data.sid, to: data.to, valid: data.valid },
        };
      }

      // Trial account error (21608) - skip immediately, don't waste time
      if (data.code === 21608) {
        console.warn('[Twilio] ❌ TRIAL ACCOUNT - can only send to verified numbers. Upgrade at twilio.com/user/account/billing');
        return {
          success: false,
          message: 'Twilio trial account: Cannot send to unverified numbers. Please upgrade your Twilio account at twilio.com/user/account/billing or verify the phone number at twilio.com/user/account/phone-numbers/verified',
          provider: 'twilio',
          method: 'verify',
          apiResponse: { code: data.code, message: data.message, isTrialError: true },
        };
      }

      // If CustomCode not supported (older Twilio), retry without it
      if (data.code === 51007 || (data.message && data.message.includes('CustomCode'))) {
        console.log('[Twilio] CustomCode not supported, retrying without it...');
        const retryResponse = await fetch(
          `https://verify.twilio.com/v2/Services/${config.twilioVerifyServiceSid}/Verifications`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'Authorization': authHeader,
            },
            body: new URLSearchParams({ To: fullPhone, Channel: 'sms' }),
          }
        );
        const retryData = await retryResponse.json();
        console.log('[Twilio] Verify retry response:', JSON.stringify(retryData));

        if (retryResponse.ok && retryData.status === 'pending') {
          console.log('[Twilio] ✅ Verify OTP sent (without CustomCode)');
          return {
            success: true,
            message: 'OTP sent via Twilio Verify',
            provider: 'twilio',
            requestId: retryData.sid,
            method: 'verify-auto',  // 'auto' = Twilio generates the OTP
            apiResponse: { status: retryData.status, sid: retryData.sid, to: retryData.to },
          };
        }

        // Check trial error on retry too
        if (retryData.code === 21608) {
          return {
            success: false,
            message: 'Twilio trial account: Cannot send to unverified numbers. Please upgrade at twilio.com/user/account/billing',
            provider: 'twilio',
            method: 'verify-auto',
            apiResponse: { code: retryData.code, message: retryData.message, isTrialError: true },
          };
        }

        return {
          success: false,
          message: `Twilio Verify failed: ${retryData.message || 'Unknown error'}`,
          provider: 'twilio',
          method: 'verify-auto',
          apiResponse: retryData,
        };
      }

      console.warn('[Twilio] Verify failed:', data.message || data.status);
      return {
        success: false,
        message: `Twilio Verify failed: ${data.message || 'Unknown error'} (code: ${data.code || 'N/A'})`,
        provider: 'twilio',
        method: 'verify',
        apiResponse: data,
      };
    } catch (error) {
      console.error('[Twilio] Verify error:', error);
      // Fall through to direct SMS only on network error
    }
  }

  // ── Method 2: Direct SMS via Twilio (fallback if Verify not configured) ──
  if (!config.twilioPhoneNumber) {
    return {
      success: false,
      message: 'Twilio requires either TWILIO_VERIFY_SERVICE_SID (recommended) or TWILIO_PHONE_NUMBER for direct SMS',
      provider: 'twilio',
      method: 'direct-sms',
    };
  }

  try {
    console.log('[Twilio] Method 2: Direct SMS to:', fullPhone, 'from:', config.twilioPhoneNumber);

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': authHeader,
        },
        body: new URLSearchParams({
          To: fullPhone,
          From: config.twilioPhoneNumber,
          Body: `${otp} is your Kabaddi Pro verification code. Do not share with anyone.`,
        }),
      }
    );
    const data = await response.json();
    console.log('[Twilio] Direct SMS response:', JSON.stringify(data));

    if (response.ok && data.status) {
      console.log('[Twilio] ✅ Direct SMS sent, status:', data.status);
      return {
        success: true,
        message: 'OTP sent via Twilio SMS',
        provider: 'twilio',
        requestId: data.sid,
        method: 'direct-sms',
        apiResponse: { status: data.status, sid: data.sid, to: data.to },
      };
    }

    // Trial account error for direct SMS too
    if (data.code === 21608) {
      return {
        success: false,
        message: 'Twilio trial account: Cannot send to unverified numbers. Upgrade at twilio.com/user/account/billing',
        provider: 'twilio',
        method: 'direct-sms',
        apiResponse: { code: data.code, message: data.message, isTrialError: true },
      };
    }

    return {
      success: false,
      message: `Twilio SMS failed: ${data.message || 'Unknown error'} (code: ${data.code || 'N/A'})`,
      provider: 'twilio',
      method: 'direct-sms',
      apiResponse: data,
    };
  } catch (error) {
    console.error('[Twilio] Direct SMS error:', error);
    return {
      success: false,
      message: 'Twilio unavailable (network error)',
      provider: 'twilio',
      method: 'direct-sms',
    };
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
  providerUsed?: string,
  providerMethod?: string
): Promise<{ valid: boolean; message: string } | null> {
  const config = getConfig();
  const fullPhone = phone.startsWith('+') ? phone : '+91' + sanitizePhone(phone);

  // ── Twilio Verify: Server-side verification (MOST RELIABLE) ──
  if (config.twilioAccountSid && config.twilioAuthToken && config.twilioVerifyServiceSid && providerUsed === 'twilio') {
    const authHeader = 'Basic ' + Buffer.from(`${config.twilioAccountSid}:${config.twilioAuthToken}`).toString('base64');
    try {
      console.log('[Twilio Verify] Checking OTP for:', fullPhone);
      const response = await fetch(
        `https://verify.twilio.com/v2/Services/${config.twilioVerifyServiceSid}/VerificationCheck`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': authHeader,
          },
          body: new URLSearchParams({ To: fullPhone, Code: otp }),
        }
      );
      const data = await response.json();
      console.log('[Twilio Verify] Check response:', JSON.stringify(data));

      if (data.status === 'approved') {
        return { valid: true, message: 'OTP verified via Twilio Verify' };
      }
      if (data.status === 'pending') {
        return { valid: false, message: 'Invalid OTP. Please try again.' };
      }
      return { valid: false, message: data.message || 'OTP verification failed' };
    } catch (error) {
      console.error('[Twilio Verify] Check error:', error);
      // Fall through to local verification
    }
  }

  // ── MSG91: Server-side verification (only if OTP was sent via MSG91) ──
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

  // For Fast2SMS, Twilio direct SMS, and others: use local verification
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
    hasTwilioVerifyService: !!config.twilioVerifyServiceSid,
    hasTwilioPhoneNumber: !!config.twilioPhoneNumber,
    isConfigured: providers.length > 0,
    recommendation: providers.length === 0
      ? '⚠️ NO providers configured! Add TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN + TWILIO_VERIFY_SERVICE_SID (recommended) or FAST2SMS_API_KEY.'
      : providers.includes('twilio') && config.twilioVerifyServiceSid
        ? '✅ Twilio Verify available - GOLD STANDARD for OTP (no DLT, works with ALL Indian carriers)'
        : providers.includes('twilio')
          ? '✅ Twilio available - add TWILIO_VERIFY_SERVICE_SID for best experience'
          : providers.includes('fast2sms')
            ? '✅ Fast2SMS available - good for India (no DLT needed)'
            : '⚠️ Only MSG91 available. Add TWILIO or FAST2SMS_API_KEY for reliable delivery.',
  };
}
