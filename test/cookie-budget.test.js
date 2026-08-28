"use strict";

var assert  = require('assert'),
    data    = require('../src/js/data'),
    cookies = require('../src/js/helpers/cookies');

global.btoa = global.btoa || function(value) {
  return Buffer.from(value, 'binary').toString('base64');
};
global.atob = global.atob || function(value) {
  return Buffer.from(value, 'base64').toString('binary');
};

function setPage(href, pathname, referer) {
  global.document = {
    cookie: '',
    location: { href: href, pathname: pathname },
    referrer: referer
  };
}

function decodedPrepared(name, value) {
  var prepared = cookies.prepareValue(name, value),
      encoded = prepared;
  if (cookies.useBase64) {
    encoded = atob(prepared + new Array((4 - prepared.length % 4) % 4 + 1).join('='));
  }
  return cookies.decodeData(encoded);
}

function parsedPrepared(name, value) {
  document.cookie = cookies.encodeData(name) + '=' + cookies.prepareValue(name, value);
  return cookies.parse(name)[cookies.unsbjs(name)];
}

function managedHeader(values) {
  var pairs = [],
      name,
      pair;
  for (name in values) {
    if (values.hasOwnProperty(name)) {
      pair = cookies.encodeData(name) + '=' + cookies.prepareValue(name, values[name]);
      assert(pair.length <= cookies.containerBudgets[name], name + ' exceeded its budget');
      pairs.push(pair);
    }
  }
  return pairs.join('; ');
}

setPage(
  'https://shop.example/product?utm_source=google&utm_campaign=spring#details',
  '/product',
  'https://ref.example/search?q=private#result'
);

var extra = data.pack.extra(0),
    session = data.pack.session(1);
assert(extra.indexOf('ep=/product') !== -1, 'landing query leaked into extra cookie');
assert(extra.indexOf('rf=https://ref.example/search') !== -1, 'referrer origin/path missing');
assert(extra.indexOf('q=private') === -1, 'referrer query leaked into extra cookie');
assert.strictEqual(session, 'pgs=1|||cpg=/product');

var normalMain = data.pack.main({
      type: 'utm', source: 'google', medium: 'cpc', campaign: 'spring',
      content: 'hero', term: 'shoes', id: '(none)', platform: '(none)',
      format: '(none)', tactic: '(none)'
    }),
    long = new Array(2001).join('x'),
    injected = long + '|||evil=' + long,
    hostileMain = data.pack.main({
      type: injected, source: injected, medium: injected, campaign: injected,
      content: injected, term: injected, id: injected, platform: injected,
      format: injected, tactic: injected
    }),
    hostileExtra = 'fd=' + long + '|||ep=/' + long + '|||rf=https://ref.example/' + long,
    hostileSession = 'pgs=' + long + '|||cpg=/' + long,
    hostileUser = 'vst=' + long + '|||uip=' + long + '|||uag=' + long,
    values = {};

values[data.containers.current] = hostileMain;
values[data.containers.first] = hostileMain;
values[data.containers.current_extra] = hostileExtra;
values[data.containers.first_extra] = hostileExtra;
values[data.containers.session] = hostileSession;
values[data.containers.udata] = hostileUser;
values[data.containers.promocode] = 'code=' + long;
values[data.service.migrations] = long;

[false, true].forEach(function(useBase64) {
  var header,
      hostileParsed;
  cookies.setBase64Flag(useBase64);
  assert.strictEqual(decodedPrepared(data.containers.current, normalMain), normalMain);
  hostileParsed = parsedPrepared(data.containers.current, hostileMain);
  assert.strictEqual(hostileParsed.evil, undefined);
  assert(hostileParsed.src.length > 0 && hostileParsed.mdm.length > 0 && hostileParsed.cmp.length > 0);
  assert(cookies.encodeData(hostileParsed.cmp).length <= cookies.fieldBudgets.cmp);
  header = managedHeader(values);
  assert(
    header.length <= cookies.requestBudget,
    'managed Cookie header exceeded aggregate budget with base64=' + useBase64
  );
  assert(header.length > 1900, 'adversarial fixture did not exercise the aggregate ceiling');
});

cookies.setBase64Flag(false);
var unicodeMain = data.pack.main({
  type: 'utm', source: 'google', medium: 'cpc', campaign: new Array(301).join('😀'),
  content: '(none)', term: '(none)', id: '(none)', platform: '(none)',
  format: '(none)', tactic: '(none)'
});
assert(decodedPrepared(data.containers.current, unicodeMain).indexOf('\uFFFD') === -1);

var legacy = 'fd=2026-08-27 10:00:00|||ep=https://shop.example/product?utm_campaign=legacy' +
  '|||rf=https://ref.example/search?q=legacy';
document.cookie = cookies.encodeData(data.containers.current_extra) + '=' + cookies.encodeData(legacy);
assert.strictEqual(
  cookies.parse(data.containers.current_extra).current_add.ep,
  'https://shop.example/product?utm_campaign=legacy'
);

console.log('cookie budget tests passed');
