import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  displayBarcode,
  expandUpcE,
  gtinCheckDigit,
  isProductBarcodeType,
  isValidGtin,
  maskBarcode,
  normalizeBarcode,
  scannerType,
} from './barcode.ts';

/**
 * Run with `npm test`.
 *
 * ## Why these are worth a test
 *
 * Every function here decides whether a scan is looked up at all, and the key it
 * is looked up by. A wrong check digit rejects a real box silently; a wrong
 * normalisation stores the same box under two keys and makes "this barcode
 * already exists" impossible to detect. The database checks the digit too
 * (`public.gtin_is_valid`, 0024) — these tests pin the client to the same answer.
 *
 * The fixtures are real, published codes: 036000291452 is the canonical UPC-A
 * worked example, 4006381333931 a real EAN-13, 4902370548495 a Japanese (JAN) box.
 */

describe('check digits', () => {
  it('agrees with published codes at every length', () => {
    assert.equal(gtinCheckDigit('03600029145'), 2); // UPC-A
    assert.equal(gtinCheckDigit('400638133393'), 1); // EAN-13
    assert.equal(gtinCheckDigit('9638507'), 4); // EAN-8 96385074
  });

  it('accepts valid codes and rejects a single wrong digit', () => {
    assert.equal(isValidGtin('036000291452'), true);
    assert.equal(isValidGtin('036000291453'), false);
    assert.equal(isValidGtin('4006381333931'), true);
    assert.equal(isValidGtin('96385074'), true);
    assert.equal(isValidGtin('12345'), false);
  });
});

describe('normalisation to GTIN-14', () => {
  it('pads every length to the same key', () => {
    assert.equal(normalizeBarcode('036000291452'), '00036000291452');
    assert.equal(normalizeBarcode('4006381333931'), '04006381333931');
    assert.equal(normalizeBarcode('96385074', 'ean8'), '00000096385074');
  });

  it('makes iOS’s EAN-13 reading of a UPC-A the same key as Android’s UPC-A', () => {
    assert.equal(
      normalizeBarcode('0036000291452', 'ean13'),
      normalizeBarcode('036000291452', 'upc_a')
    );
  });

  it('reads a JAN like any EAN-13', () => {
    assert.equal(normalizeBarcode('4902370548495', 'ean13'), '04902370548495');
  });

  it('ignores separators a person types', () => {
    assert.equal(normalizeBarcode('0 36000 29145 2'), '00036000291452');
    assert.equal(normalizeBarcode('036-000-291-452'), '00036000291452');
  });

  it('refuses what is not a valid product barcode', () => {
    assert.equal(normalizeBarcode('036000291453'), null);
    assert.equal(normalizeBarcode('hello'), null);
    assert.equal(normalizeBarcode(''), null);
  });
});

describe('UPC-E', () => {
  it('expands each of the four patterns', () => {
    // Each case checked against the UPC specification's expansion table.
    assert.equal(expandUpcE('01234505'), '012000003455'); // d6 = 0..2
    assert.equal(expandUpcE('01234531'), '012300000451'); // d6 = 3
    assert.equal(expandUpcE('01234543'), '012340000053'); // d6 = 4
    assert.equal(expandUpcE('01234565'), '012345000065'); // d6 = 5..9
  });

  it('computes the check digit when it is missing, and rejects a wrong one', () => {
    assert.equal(expandUpcE('123456'), '012345000065');
    assert.equal(expandUpcE('01234566'), null);
  });

  it('is expanded only when the scanner says UPC-E — the same 8 digits as EAN-8 mean something else', () => {
    assert.equal(normalizeBarcode('01234565', 'upc_e'), '00012345000065');
    assert.equal(normalizeBarcode('01234565', 'ean8'), '00000001234565');
  });
});

describe('what a person sees', () => {
  it('prints the digits on the box, never the padding', () => {
    assert.equal(displayBarcode('00036000291452'), '036000291452');
    assert.equal(displayBarcode('04006381333931'), '4006381333931');
    assert.equal(displayBarcode('00000096385074'), '96385074');
  });

  it('masks all but the last four', () => {
    assert.equal(maskBarcode('00036000291452'), '••••••••1452');
  });

  it('knows which symbologies are product barcodes', () => {
    assert.equal(isProductBarcodeType('ean13'), true);
    assert.equal(isProductBarcodeType('UPC_E'), true);
    assert.equal(isProductBarcodeType('qr'), false);
    assert.equal(isProductBarcodeType('code128'), false);
  });
});

describe('scanner type names', () => {
  it('reads every spelling platforms have used', () => {
    assert.equal(scannerType('ean13'), 'ean13');
    assert.equal(scannerType('EAN_13'), 'ean13');
    assert.equal(scannerType('org.gs1.EAN-13'), 'ean13');
    assert.equal(scannerType('upc_e'), 'upc_e');
    assert.equal(scannerType('org.gs1.UPC-E'), 'upc_e');
    assert.equal(scannerType('UPC_A'), 'upc_a');
    assert.equal(scannerType('ean8'), 'ean8');
  });

  it('returns null for what is not on a game box', () => {
    assert.equal(scannerType('qr'), null);
    assert.equal(scannerType('code128'), null);
    assert.equal(scannerType(undefined), null);
  });
});
