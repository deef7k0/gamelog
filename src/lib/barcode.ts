/**
 * Game-box barcodes: reading what a scanner reports, and turning it into the one
 * key the release database is indexed by.
 *
 * ## One numbering system, four lengths
 *
 * UPC-A (12 digits, North American boxes), EAN-13 (13, European), JAN (EAN-13
 * with a 45 or 49 prefix, Japanese) and EAN-8 are all GTINs — the same scheme at
 * different lengths — and left-padded with zeros to 14 digits they become one
 * comparable string. That is what `release_barcodes` stores (migration 0024), so
 * a UPC-A scan of an American box finds a release someone entered as its EAN-13,
 * and iOS — which reports every UPC-A as an EAN-13 with a leading zero — lands on
 * the same key as Android, which does not.
 *
 * UPC-E is the exception: an 8-digit *compressed* UPC-A that looks exactly like an
 * EAN-8 but means something else. Only the scanner knows which it read, so the
 * caller passes the type and UPC-E is expanded here before padding. The database
 * could not do it; by the time a code reaches it the type is gone.
 *
 * Pure functions, no React Native — `barcode.test.ts` runs them under `npm test`.
 */

/** GS1 check digit for the digits *before* the check digit, at any length. */
export function gtinCheckDigit(body: string): number {
  let total = 0;
  // Weights alternate 3,1,3,1… counting leftwards from the digit nearest the
  // check digit, which is what makes one rule serve every GTIN length.
  for (let index = 0; index < body.length; index++) {
    const fromRight = body.length - index;
    total += Number(body[index]) * (fromRight % 2 === 1 ? 3 : 1);
  }
  return (10 - (total % 10)) % 10;
}

/** Whether a string of 8, 12, 13 or 14 digits carries a correct check digit. */
export function isValidGtin(code: string): boolean {
  if (!/^\d{8}$|^\d{12,14}$/.test(code)) return false;
  return gtinCheckDigit(code.slice(0, -1)) === Number(code[code.length - 1]);
}

/**
 * UPC-E → UPC-A.
 *
 * Accepts the 8-digit form (number system + six digits + check), the 7-digit
 * form without the check digit, or the bare six. The expansion depends on the
 * last of the six, per the UPC specification; the check digit is shared by both
 * forms, so it is recomputed rather than trusted when it is missing.
 */
export function expandUpcE(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  let system = '0';
  let six: string;

  if (digits.length === 6) six = digits;
  else if (digits.length === 7 || digits.length === 8) {
    system = digits[0];
    six = digits.slice(1, 7);
  } else return null;

  // Only number systems 0 and 1 exist for UPC-E.
  if (system !== '0' && system !== '1') return null;

  const [d1, d2, d3, d4, d5, d6] = six;
  let body: string;
  switch (d6) {
    case '0':
    case '1':
    case '2':
      body = `${d1}${d2}${d6}0000${d3}${d4}${d5}`;
      break;
    case '3':
      body = `${d1}${d2}${d3}00000${d4}${d5}`;
      break;
    case '4':
      body = `${d1}${d2}${d3}${d4}00000${d5}`;
      break;
    default:
      body = `${d1}${d2}${d3}${d4}${d5}0000${d6}`;
  }

  const upcA = `${system}${body}`;
  const check = gtinCheckDigit(upcA);
  if (digits.length === 8 && Number(digits[7]) !== check) return null;
  return `${upcA}${check}`;
}

/**
 * The symbologies a game box can carry, by the names `expo-camera` reports.
 * Anything else — a QR code on a manual, a Code 128 on a shipping label — is
 * not a product barcode and is ignored rather than looked up.
 */
export const PRODUCT_BARCODE_TYPES = ['ean13', 'ean8', 'upc_a', 'upc_e'] as const;
export type ProductBarcodeType = (typeof PRODUCT_BARCODE_TYPES)[number];

export function isProductBarcodeType(type: string): type is ProductBarcodeType {
  return (PRODUCT_BARCODE_TYPES as readonly string[]).includes(type.toLowerCase());
}

/**
 * A scanner's symbology name → one of ours, or null for anything that is not a
 * product barcode.
 *
 * `expo-camera` reports `ean13`, `upc_e` and so on today, but platform scanners
 * have spelt these every way over the years — `EAN_13`, `UPC-E`, iOS's
 * `org.gs1.EAN-13` — and the difference is not cosmetic: reading a UPC-E as
 * EAN-8 looks the 8 digits up as a different product entirely. So the name is
 * compared with its punctuation stripped, and UPC-E is recognised before
 * anything that could swallow it.
 */
export function scannerType(raw: string | null | undefined): ProductBarcodeType | null {
  const name = (raw ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (name.endsWith('upce')) return 'upc_e';
  if (name.endsWith('upca')) return 'upc_a';
  if (name.endsWith('ean13')) return 'ean13';
  if (name.endsWith('ean8')) return 'ean8';
  return null;
}

/**
 * Whatever was scanned or typed → the 14-digit key, or null if it is not a valid
 * product barcode. `type` is the scanner's symbology when there is one; typed
 * input has none and is read by length.
 */
export function normalizeBarcode(raw: string, type?: string | null): string | null {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return null;

  let gtin = digits;
  if (type?.toLowerCase() === 'upc_e') {
    const expanded = expandUpcE(digits);
    if (!expanded) return null;
    gtin = expanded;
  }

  if (!isValidGtin(gtin)) return null;
  return gtin.padStart(14, '0');
}

/**
 * The 14-digit key → the digits printed on the box.
 *
 * A UPC-A is shown as its 12 digits, an EAN-13 as its 13 and an EAN-8 as its 8 —
 * the form a player can find under the bars and compare. The padding is a
 * storage detail and never appears on screen.
 */
export function displayBarcode(gtin14: string): string {
  if (!/^\d{14}$/.test(gtin14)) return gtin14;
  if (gtin14.startsWith('000000')) return gtin14.slice(6);
  if (gtin14.startsWith('00')) return gtin14.slice(2);
  if (gtin14.startsWith('0')) return gtin14.slice(1);
  return gtin14;
}

/**
 * The same number, masked for a detail view: "•••••••1452".
 *
 * The collection's detail screen shows that a copy has a barcode and which one
 * without printing a string nobody reads in full; the last four are what anyone
 * comparing it against a box actually checks.
 */
export function maskBarcode(gtin14: string): string {
  const shown = displayBarcode(gtin14);
  return `${'•'.repeat(Math.max(0, shown.length - 4))}${shown.slice(-4)}`;
}
