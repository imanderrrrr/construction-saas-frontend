// BuildTrack — paymentMethodLabel: preset methods are stored language-independently
// ('Bank transfer', …) but the payment-history tables were rendering them raw, so a
// payment made by picking "Transferencia bancaria" showed back as "Bank transfer".
// These tests lock the display mapping.

import { describe, it, expect, vi } from 'vitest';
import type { TFunction } from 'i18next';

import { paymentMethodLabel, PAYMENT_METHOD_PRESETS } from './PayableCommon';

// Stub of i18next's t(key, fallback): returns the Spanish label for the known
// finance keys, otherwise the provided fallback — exactly how a real lookup of a
// present/absent key behaves.
const ES: Record<string, string> = {
  'finance:paymentMethod.bankTransfer': 'Transferencia bancaria',
  'finance:paymentMethod.check': 'Cheque',
  'finance:paymentMethod.cash': 'Efectivo',
  'finance:paymentMethod.wireTransfer': 'Transferencia',
  'finance:paymentMethod.creditCard': 'Tarjeta de crédito',
};
const t = ((key: string, fallback?: string) => ES[key] ?? fallback ?? key) as unknown as TFunction;

describe('paymentMethodLabel', () => {
  it('localizes every stored preset to the current language', () => {
    expect(paymentMethodLabel('Bank transfer', t)).toBe('Transferencia bancaria');
    expect(paymentMethodLabel('Credit card', t)).toBe('Tarjeta de crédito');
    expect(paymentMethodLabel('Cash', t)).toBe('Efectivo');
  });

  it('every preset has a translation mapping (no preset falls through to English)', () => {
    for (const preset of PAYMENT_METHOD_PRESETS) {
      // A mapped preset never returns its raw English value.
      expect(paymentMethodLabel(preset, t)).not.toBe(preset);
    }
  });

  it('returns a typed-in "Other" method verbatim', () => {
    expect(paymentMethodLabel('Cheque 0091', t)).toBe('Cheque 0091');
    expect(paymentMethodLabel('PayPal', t)).toBe('PayPal');
  });

  it('degrades an unmapped preset to its stored value rather than a blank cell', () => {
    // If a preset ever lacks a key, the fallback is the stored string, not ''.
    const tNoKeys = ((_key: string, fallback?: string) => fallback ?? '') as unknown as TFunction;
    expect(paymentMethodLabel('Bank transfer', tNoKeys)).toBe('Bank transfer');
  });
});
