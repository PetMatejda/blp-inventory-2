/**
 * webAuthnService.js
 *
 * WebAuthn (FIDO2) biometric authentication service for BLP Inventory.
 *
 * Flow:
 *   1. REGISTER: After successful Firebase login, user can register a biometric
 *      credential tied to their Firebase userId. The credentialId is stored locally.
 *   2. AUTHENTICATE: On app open, if a credential is found, prompt the user for
 *      biometrics. On success, retrieve the stored user object and sign them in.
 *
 * Security model:
 *   - Biometric challenge/response is handled entirely by the OS/browser.
 *   - Private key never leaves the device (TPM / Secure Enclave).
 *   - We store credentialId + serialized Firebase user in localStorage.
 *   - This is the same security level as native apps that re-use stored tokens after biometric verification.
 */

const STORAGE_KEY = 'blp_webauthn_credential';
const USER_STORAGE_KEY = 'blp_auth_user_v2';

// RP (Relying Party) — must match your domain
const RP_ID = window.location.hostname; // e.g. "blp-inventory-2.vercel.app"
const RP_NAME = 'BLP Inventory';

/**
 * Checks if WebAuthn is supported and available on this device.
 * Returns { supported: bool, platformAuth: bool }
 */
export const checkWebAuthnSupport = async () => {
  if (!window.PublicKeyCredential) {
    return { supported: false, platformAuth: false };
  }
  try {
    const platformAvailable = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    return { supported: true, platformAuth: platformAvailable };
  } catch {
    return { supported: true, platformAuth: false };
  }
};

/**
 * Checks if a biometric credential is already registered for this device.
 */
export const hasRegisteredCredential = () => {
  return !!localStorage.getItem(STORAGE_KEY);
};

/**
 * Registers a new biometric credential for the current user.
 * Must be called after a successful Firebase login.
 *
 * @param {object} user — the Firebase user object (from context)
 * @returns {{ success: boolean, error?: string }}
 */
export const registerBiometric = async (user) => {
  try {
    const { supported, platformAuth } = await checkWebAuthnSupport();
    if (!supported || !platformAuth) {
      return { success: false, error: 'Biometrie není na tomto zařízení podporována.' };
    }

    // Create a random challenge (in production this should come from a server)
    const challenge = crypto.getRandomValues(new Uint8Array(32));

    // User ID must be a BufferSource — encode the Firebase uid
    const userId = new TextEncoder().encode(user.id);

    const publicKeyOptions = {
      challenge,
      rp: { id: RP_ID, name: RP_NAME },
      user: {
        id: userId,
        name: user.email || user.name,
        displayName: user.name,
      },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },   // ES256 (ECDSA with SHA-256)
        { type: 'public-key', alg: -257 },  // RS256 (RSA with SHA-256)
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform', // Only device-native (fingerprint, Face ID)
        userVerification: 'required',         // Require biometric
        requireResidentKey: false,
      },
      timeout: 60000,
      attestation: 'none', // We don't need attestation for this use case
    };

    const credential = await navigator.credentials.create({ publicKey: publicKeyOptions });
    if (!credential) return { success: false, error: 'Registrace biometrie selhala.' };

    // Store the credentialId (raw id as base64) and userId
    const credentialData = {
      credentialId: btoa(String.fromCharCode(...new Uint8Array(credential.rawId))),
      userId: user.id,
      userName: user.name,
      registeredAt: new Date().toISOString(),
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(credentialData));
    return { success: true };
  } catch (err) {
    console.error('[WebAuthn] Registration error:', err);
    if (err.name === 'NotAllowedError') {
      return { success: false, error: 'Registrace biometrie zrušena uživatelem.' };
    }
    if (err.name === 'InvalidStateError') {
      return { success: false, error: 'Biometrie je již na tomto zařízení registrovaná.' };
    }
    return { success: false, error: err.message || 'Neznámá chyba při registraci biometrie.' };
  }
};

/**
 * Authenticates user using the registered biometric credential.
 * On success, retrieves the stored Firebase user from localStorage.
 *
 * @returns {{ success: boolean, user?: object, error?: string }}
 */
export const authenticateWithBiometric = async () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return { success: false, error: 'Žádná biometrie není registrována.' };
    }

    const { credentialId } = JSON.parse(stored);

    // Convert base64 credentialId back to ArrayBuffer
    const credentialIdBytes = Uint8Array.from(atob(credentialId), c => c.charCodeAt(0));

    // Random challenge for this authentication attempt
    const challenge = crypto.getRandomValues(new Uint8Array(32));

    const publicKeyOptions = {
      challenge,
      rpId: RP_ID,
      allowCredentials: [
        {
          type: 'public-key',
          id: credentialIdBytes,
          transports: ['internal'], // Only device-internal (platform) authenticators
        },
      ],
      userVerification: 'required',
      timeout: 60000,
    };

    const assertion = await navigator.credentials.get({ publicKey: publicKeyOptions });
    if (!assertion) return { success: false, error: 'Biometrická autentizace selhala.' };

    // On successful assertion, retrieve the cached Firebase user
    const cachedUser = localStorage.getItem(USER_STORAGE_KEY);
    if (!cachedUser) {
      return { success: false, error: 'Relace vypršela. Přihlaste se znovu e-mailem nebo Google.' };
    }

    const user = JSON.parse(cachedUser);
    return { success: true, user };
  } catch (err) {
    console.error('[WebAuthn] Authentication error:', err);
    if (err.name === 'NotAllowedError') {
      return { success: false, error: 'Biometrická autentizace zrušena nebo zamítnuta.' };
    }
    return { success: false, error: err.message || 'Neznámá chyba při biometrické autentizaci.' };
  }
};

/**
 * Removes the stored biometric credential (for re-registration or logout).
 */
export const removeBiometricCredential = () => {
  localStorage.removeItem(STORAGE_KEY);
};
