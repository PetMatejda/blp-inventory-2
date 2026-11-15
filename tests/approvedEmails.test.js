// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { APPROVED_EMAILS, isApprovedEmail } from '../api/_lib/approvedEmails.js';

describe('approved e-mails', () => {
  it('server list matches firestore.rules', () => {
    const rules = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
    const block = rules.slice(rules.indexOf('function isApprovedUser'));
    const list = block.slice(block.indexOf('['), block.indexOf(']') + 1);
    const fromRules = [...list.matchAll(/'([^']+)'/g)].map((m) => m[1].toLowerCase()).sort();
    expect([...APPROVED_EMAILS].sort()).toEqual(fromRules);
  });

  it('checks e-mails case-insensitively', () => {
    expect(isApprovedEmail('PetMatejda@Gmail.com')).toBe(true);
    expect(isApprovedEmail('someone@else.cz')).toBe(false);
    expect(isApprovedEmail('')).toBe(false);
  });
});
