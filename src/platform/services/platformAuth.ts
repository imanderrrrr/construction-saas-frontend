import { platformApi } from '../lib/platformApi';
import type { PlatformLoginResponse } from '../types';

export async function login(email: string, password: string): Promise<PlatformLoginResponse> {
  return platformApi<PlatformLoginResponse>('/platform/auth/login', {
    method: 'POST',
    body: { email, password },
    skipAuth: true,
  });
}

export async function enrollMfa(challengeToken: string, code: string): Promise<PlatformLoginResponse> {
  return platformApi<PlatformLoginResponse>('/platform/auth/mfa-enroll', {
    method: 'POST',
    body: { challengeToken, code },
    skipAuth: true,
  });
}

export async function verifyMfa(challengeToken: string, code: string): Promise<PlatformLoginResponse> {
  return platformApi<PlatformLoginResponse>('/platform/auth/mfa-verify', {
    method: 'POST',
    body: { challengeToken, code },
    skipAuth: true,
  });
}
