import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';

// 1. VERCEL ATTACK CHALLENGE MODE
// Enable this in Vercel Dashboard > Security > Attack Challenge Mode
// This automatically challenges suspicious traffic with CAPTCHAs

// 2. CLOUDFLARE TURNSTILE (Free, privacy-friendly CAPTCHA alternative)
export async function verifyTurnstile(token: string): Promise<boolean> {
    if (!process.env.TURNSTILE_SECRET_KEY) return true; // Skip if not configured
    
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            secret: process.env.TURNSTILE_SECRET_KEY,
            response: token,
        }),
    });
    
    const data = await response.json();
    return data.success;
}

// 3. FINGERPRINTING with FingerprintJS (more advanced than basic IP)
export interface Fingerprint {
    visitorId: string;
    confidence: number;
    botProbability?: number;
}

export async function verifyFingerprint(fingerprint: Fingerprint): Promise<boolean> {
    if (!process.env.FINGERPRINTJS_API_KEY) return true;
    
    // High bot probability
    if (fingerprint.botProbability && fingerprint.botProbability > 0.8) {
        return false;
    }
    
    // Low confidence in fingerprint
    if (fingerprint.confidence < 0.5) {
        return false;
    }
    
    // Check if this fingerprint has been seen too many times
    const key = `fingerprint:${fingerprint.visitorId}`;
    const count = await kv.incr(key);
    await kv.expire(key, 3600); // 1 hour
    
    if (count > 10) { // More than 10 requests per hour from same fingerprint
        return false;
    }
    
    return true;
}

// 4. PROOF OF WORK - Client must solve a puzzle
export function generateChallenge(): { challenge: string; difficulty: number } {
    const challenge = Math.random().toString(36).substring(2);
    const difficulty = 4; // Require 4 leading zeros in hash
    return { challenge, difficulty };
}

export function verifyProofOfWork(
    challenge: string,
    nonce: string,
    difficulty: number
): boolean {
    const crypto = require('crypto');
    const hash = crypto
        .createHash('sha256')
        .update(challenge + nonce)
        .digest('hex');
    
    const leadingZeros = hash.match(/^0*/)?.[0].length || 0;
    return leadingZeros >= difficulty;
}

// 5. BEHAVIORAL ANALYSIS - Track mouse movements, typing patterns
export interface BehaviorData {
    mouseMovements: number;
    keystrokes: number;
    timeOnPage: number;
    scrollEvents: number;
}

export function analyzeBehavior(data: BehaviorData): boolean {
    // Bot-like behavior patterns
    if (data.mouseMovements === 0) return false; // No mouse movement
    if (data.timeOnPage < 2000) return false; // Less than 2 seconds on page
    if (data.keystrokes > 0 && data.timeOnPage / data.keystrokes < 50) return false; // Typing too fast
    
    return true;
}

// 6. DEVICE ATTESTATION - For mobile apps
export async function verifyDeviceAttestation(
    attestation: string,
    platform: 'ios' | 'android'
): Promise<boolean> {
    if (platform === 'ios') {
        // Verify with Apple DeviceCheck
        // https://developer.apple.com/documentation/devicecheck
        return verifyAppleDeviceCheck(attestation);
    } else {
        // Verify with Google Play Integrity
        // https://developer.android.com/google/play/integrity
        return verifyGooglePlayIntegrity(attestation);
    }
}

async function verifyAppleDeviceCheck(token: string): Promise<boolean> {
    if (!process.env.APPLE_DEVICE_CHECK_KEY) return true;
    
    // Implementation for Apple DeviceCheck
    // This requires setting up Apple Developer account
    return true;
}

async function verifyGooglePlayIntegrity(token: string): Promise<boolean> {
    if (!process.env.GOOGLE_PLAY_INTEGRITY_KEY) return true;
    
    // Implementation for Google Play Integrity
    return true;
}

// 7. COMPREHENSIVE ANTI-BOT MIDDLEWARE
export async function antiBotMiddleware(
    req: VercelRequest,
    res: VercelResponse,
    next: () => Promise<any>
) {
    try {
        // Check various anti-bot measures
        const checks = {
            // User-Agent check
            hasUserAgent: !!req.headers['user-agent'],
            notKnownBot: !/bot|crawler|spider|scraper|python|curl|wget|postman/i.test(
                req.headers['user-agent'] || ''
            ),
            
            // Headers check
            hasAcceptLanguage: !!req.headers['accept-language'],
            hasAcceptEncoding: !!req.headers['accept-encoding'],
            
            // Turnstile CAPTCHA (if provided)
            captcha: req.body?.captchaToken 
                ? await verifyTurnstile(req.body.captchaToken)
                : true,
            
            // Fingerprint (if provided)
            fingerprint: req.body?.fingerprint
                ? await verifyFingerprint(req.body.fingerprint)
                : true,
            
            // Proof of Work (if provided)
            proofOfWork: req.body?.proofOfWork && req.body?.challenge
                ? verifyProofOfWork(
                    req.body.challenge,
                    req.body.proofOfWork,
                    4
                  )
                : true,
            
            // Behavior analysis (if provided)
            behavior: req.body?.behavior
                ? analyzeBehavior(req.body.behavior)
                : true,
        };
        
        // Calculate bot score
        const score = Object.values(checks).filter(Boolean).length;
        const maxScore = Object.keys(checks).length;
        const botProbability = 1 - (score / maxScore);
        
        // Add to response headers for debugging
        res.setHeader('X-Bot-Score', score.toString());
        res.setHeader('X-Bot-Probability', botProbability.toFixed(2));
        
        // Block if high bot probability
        if (botProbability > 0.7) {
            // Log for analysis
            console.log('Bot detected:', {
                ip: req.headers['x-forwarded-for'],
                userAgent: req.headers['user-agent'],
                checks,
                botProbability
            });
            
            return res.status(403).json({
                error: 'Access denied',
                reason: 'Suspicious activity detected',
                // In production, don't reveal details
                ...(process.env.NODE_ENV === 'development' && { checks, botProbability })
            });
        }
        
        // Soft throttle for medium probability
        if (botProbability > 0.4) {
            await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
        }
        
        return next();
    } catch (error) {
        console.error('Anti-bot middleware error:', error);
        // Don't block on errors
        return next();
    }
}

// 8. VERCEL EDGE CONFIG for dynamic rate limits
export async function getDynamicRateLimit(endpoint: string) {
    try {
        const { get } = require('@vercel/edge-config');
        const config = await get('rateLimits');
        return config?.[endpoint] || null;
    } catch {
        return null;
    }
}

// 9. IP REPUTATION CHECK using IPQualityScore or similar
export async function checkIPReputation(ip: string): Promise<number> {
    if (!process.env.IPQS_API_KEY) return 0;
    
    try {
        const response = await fetch(
            `https://ipqualityscore.com/api/json/ip/${process.env.IPQS_API_KEY}/${ip}`
        );
        const data = await response.json();
        
        // Returns fraud score 0-100 (higher = more suspicious)
        return data.fraud_score || 0;
    } catch {
        return 0;
    }
}

// 10. HONEYPOT FIELDS - Invisible fields that only bots fill
export function checkHoneypot(req: VercelRequest): boolean {
    // Check if honeypot fields are filled (they shouldn't be)
    const honeypotFields = ['email_confirm', 'phone_number', 'website'];
    
    for (const field of honeypotFields) {
        if (req.body?.[field]) {
            console.log('Honeypot triggered:', field);
            return false; // Bot detected
        }
    }
    
    return true;
}