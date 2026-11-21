var test = require('node:test');
var assert = require('node:assert/strict');

var invoice = require('../lib/invoice');
var pricing = require('../lib/pricing');
var reports = require('../lib/reports');

function orderFromCheckout(items, coupon) {
  var totals = pricing.computeTotals(items, coupon);
  return {
    id: 41,
    date: '2026-11-21',
    customer: 'In-memory customer',
    items: items,
    coupon: coupon,
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    total: totals.total
  };
}

test('invoice uses the billed HSN GST slab when a line has no gstRate', function () {
  var order = orderFromCheckout([
    { id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 100, qty: 1 }
  ], '');

  var figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual(
    { tax: order.tax, total: order.total },
    { tax: 5, total: 105 }
  );
  assert.deepEqual(
    { tax: figures.tax, cgst: figures.cgst, sgst: figures.sgst, total: figures.total },
    { tax: 5, cgst: 2.5, sgst: 2.5, total: 105 }
  );
  assert.equal(figures.rows[0].gstPercent, 5);
});

test('invoice applies a percent coupon to taxable totals before GST', function () {
  var order = orderFromCheckout([
    { id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 1000, qty: 1 },
    { id: 2, name: 'Ghee', sku: 'GHEE-1', hsn: '0405', price: 500, qty: 1 }
  ], 'WELCOME');

  var figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual(
    { discount: order.discount, tax: order.tax, total: order.total },
    { discount: 75, tax: 104.5, total: 1529.5 }
  );
  assert.deepEqual(
    { discount: figures.discount, tax: figures.tax, cgst: figures.cgst, sgst: figures.sgst, total: figures.total },
    { discount: 75, tax: 104.5, cgst: 52.25, sgst: 52.25, total: 1529.5 }
  );
});

test('GST reconciliation reports the invoice and billed order as matched', function () {
  var order = orderFromCheckout([
    { id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 100, qty: 1 }
  ], '');

  var reconciliation = reports.getGstReconciliation({ orders: [order] });

  assert.deepEqual(reconciliation, {
    totalChecked: 1,
    mismatchCount: 0,
    totalDelta: 0,
    rows: [{
      orderId: 41,
      date: '2026-11-21',
      customer: 'In-memory customer',
      coupon: '',
      ledgerSubtotal: 100,
      ledgerDiscount: 0,
      ledgerTax: 5,
      ledgerTotal: 105,
      invoiceDiscount: 0,
      invoiceTax: 5,
      invoiceTotal: 105,
      delta: 0,
      matched: true
    }]
  });
});
