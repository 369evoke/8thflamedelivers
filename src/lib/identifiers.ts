import { randomBytes, randomInt } from "crypto";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I

/** Luhn mod-10 check digit over digits. */
export function luhnCheckDigit(digits: string): number {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 0) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return (10 - (sum % 10)) % 10;
}

/** Tracking numbers: "8F" + 11 random digits + Luhn check digit, e.g. 8F482019573611. */
export function generateTrackingNumber(): string {
  let body = "";
  for (let i = 0; i < 11; i++) body += randomInt(0, 10).toString();
  return `8F${body}${luhnCheckDigit(body)}`;
}

export function isValidTrackingNumber(v: string): boolean {
  const m = /^8F(\d{11})(\d)$/.exec(v.trim().toUpperCase());
  return !!m && luhnCheckDigit(m[1]) === Number(m[2]);
}

export function normalizeTracking(v: string) {
  return v.replace(/\s+/g, "").toUpperCase();
}

function code(len: number) {
  let s = "";
  for (let i = 0; i < len; i++) s += ALPHABET[randomInt(0, ALPHABET.length)];
  return s;
}

export const generateShipmentReference = () => `EFD-${new Date().getFullYear()}-${code(6)}`;
export const generateTicketNumber = () => `SUP-${code(7)}`;
export const generateReceiptNumber = () => `RCT-${code(8)}`;
export const generateInvoiceNumber = () => `INV-${new Date().getFullYear()}-${code(6)}`;
export const generateAccessToken = () => randomBytes(24).toString("base64url");
