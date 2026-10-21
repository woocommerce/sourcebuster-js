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

// Run sbjs.init against real percent-encoded URLs, so field budgets cut raw escape sequences.
var sbjs = require('../src/js/sourcebuster');

function setBrowser(search, pathname) {
  var jar = {};
  global.window = { location: { search: search } };
  global.document = {
    location: { href: 'https://shop.example' + pathname + search, hostname: 'shop.example', pathname: pathname },
    referrer: ''
  };
  Object.defineProperty(global.document, 'cookie', {
    get: function() {
      return Object.keys(jar).map(function(name) { return name + '=' + jar[name]; }).join('; ');
    },
    set: function(value) {
      var pair = value.split(';')[0],
          separator = pair.indexOf('='),
          expires = /expires=([^;]+)/.exec(value);
      if (expires && new Date(expires[1]) < new Date()) {
        delete jar[pair.substring(0, separator)];
      } else {
        jar[pair.substring(0, separator)] = pair.substring(separator + 1);
      }
    }
  });
}

function assertDecodedPrefix(actual, expected, label) {
  assert(actual.length > 0, label + ' was emptied');
  assert.strictEqual(expected.indexOf(actual), 0, label + ' is not a clean prefix: ' + actual);
}

Object.defineProperty(global, 'navigator', { value: { userAgent: 'Mozilla/5.0' }, configurable: true });

// Mix 2-byte, 3-byte and 4-byte UTF-8 characters.
var wide = new Array(9).join('\u00e9\u65e5\u672c\u8a9e\ud83d\ude00\u30ad\u30e3\u30f3\u30da'),
    shift,
    padding,
    content,
    path;

[false, true].forEach(function(useBase64) {
  for (shift = 0; shift < 9; shift++) {
    padding = new Array(shift + 1).join('x');
    content = padding + wide;
    path = '/' + padding + wide;
    setBrowser(
      '?utm_source=google&utm_content=' + encodeURIComponent(content),
      '/' + padding + encodeURIComponent(wide)
    );
    sbjs.init({ base64: useBase64 });
    assertDecodedPrefix(sbjs.get.current.cnt, content, 'cnt base64=' + useBase64 + ' shift=' + shift);
    assertDecodedPrefix(sbjs.get.current_add.ep, path, 'ep base64=' + useBase64 + ' shift=' + shift);
    assertDecodedPrefix(sbjs.get.session.cpg, path, 'cpg base64=' + useBase64 + ' shift=' + shift);

    // A delimiter, raw or browser-encoded, is stored as %7C%7C%7C. The cut must not leave a partial escape.
    content = new Array(shift + 245).join('a') + '|||' + 'b';
    ['|||', '%7C%7C%7C'].forEach(function(delimiter) {
      setBrowser('?utm_source=google&utm_content=' + content.replace('|||', delimiter), '/');
      sbjs.init({ base64: useBase64 });
      assertDecodedPrefix(sbjs.get.current.cnt, content, 'delimiter base64=' + useBase64 + ' shift=' + shift);
      assert.strictEqual(sbjs.get.current.trm, '(none)', 'delimiter cut broke the next field');
    });
  }
});

['foo|', 'foo||', 'a|b'].forEach(function(content) {
  var packed = data.pack.main({
        type: 'utm', source: 'google', medium: 'cpc', campaign: 'spring',
        content: content, term: 'x', id: '(none)', platform: '(none)',
        format: '(none)', tactic: '(none)'
      }),
      parsed;
  cookies.setBase64Flag(false);
  setBrowser('', '/');
  parsed = parsedPrepared(data.containers.current, packed);
  assert.strictEqual(parsed.cnt, content, 'pipe changed the content value');
  assert.strictEqual(parsed.trm, 'x', 'trailing pipe broke the next field');
});

var desktopAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
[false, true].forEach(function(useBase64) {
  cookies.setBase64Flag(useBase64);
  setBrowser('', '/');
  assert.strictEqual(
    parsedPrepared(data.containers.udata, 'vst=1|||uip=(none)|||uag=' + desktopAgent).uag,
    desktopAgent,
    'desktop user agent was truncated with base64=' + useBase64
  );
});

console.log('cookie budget tests passed');
