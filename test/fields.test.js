"use strict";

var assert = require('assert'),
    sbjs   = require('../src/js/sourcebuster');

var RealDate = Date,
    HOST     = 'shop.example.com',
    UA       = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';

global.btoa = global.btoa || function(value) {
  return Buffer.from(value, 'binary').toString('base64');
};
global.atob = global.atob || function(value) {
  return Buffer.from(value, 'base64').toString('binary');
};
global.navigator = { userAgent: UA };

// The fields WooCommerce reads, without `udata.uag`
var WC_FIELDS = [
  'current.typ', 'current.src', 'current.mdm', 'current.cmp', 'current.cnt', 'current.trm',
  'current.id', 'current.plt', 'current.fmt', 'current.tct',
  'current_add.fd', 'current_add.ep', 'current_add.rf', 'session.pgs', 'udata.vst'
];

var CONTAINERS = ['current', 'current_add', 'first', 'first_add', 'session', 'udata', 'promo'];

// A cookie jar with host-only and domain cookies, and a clock that tests can move forward
function Browser() {
  this.jar = {};
  this.now = RealDate.UTC(2026, 9, 20, 10, 0, 0);
}

Browser.prototype.alive = function() {
  var self = this;
  return Object.keys(this.jar).filter(function(k) {
    return self.jar[k].expires === null || self.jar[k].expires > self.now;
  }).map(function(k) { return self.jar[k]; });
};

Browser.prototype.header = function() {
  return this.alive().map(function(c) { return c.name + '=' + c.value; }).join('; ');
};

Browser.prototype.cookies = function() {
  var out = {};
  this.alive().forEach(function(c) { out[c.name + (c.domain ? '@.' + c.domain : '')] = c.value; });
  return out;
};

Browser.prototype.write = function(str) {
  var parts   = str.split(';'),
      pair    = parts.shift(),
      eq      = pair.indexOf('='),
      cookie  = { name: pair.slice(0, eq).trim(), value: pair.slice(eq + 1), expires: null, domain: '' };
  parts.forEach(function(part) {
    part = part.trim();
    if (/^expires=/i.test(part)) { cookie.expires = new RealDate(part.slice(8)).getTime(); }
    if (/^domain=/i.test(part)) { cookie.domain = part.slice(7).replace(/^\./, ''); }
  });
  var key = cookie.name + '|' + cookie.domain;
  if (cookie.expires !== null && cookie.expires <= this.now) {
    delete this.jar[key];
  } else {
    this.jar[key] = cookie;
  }
};

// Loads a page and runs `sbjs.init`, returns `sbjs.get`
Browser.prototype.visit = function(href, referrer, prefs) {
  var self = this,
      url  = new URL(href);

  function FakeDate(v) {
    return arguments.length ? new RealDate(v) : new RealDate(self.now);
  }
  FakeDate.prototype = RealDate.prototype;
  FakeDate.now = function() { return self.now; };
  FakeDate.UTC = RealDate.UTC;

  global.document = {
    location: { href: href, hostname: url.hostname, pathname: url.pathname, search: url.search, protocol: url.protocol },
    referrer: referrer || ''
  };
  Object.defineProperty(global.document, 'cookie', {
    configurable: true,
    get: function() { return self.header(); },
    set: function(v) { self.write(v); }
  });
  global.window = { location: global.document.location };
  global.Date = FakeDate;
  try {
    sbjs.init(prefs);
  } finally {
    global.Date = RealDate;
  }
  return JSON.parse(JSON.stringify(sbjs.get));
};

Browser.prototype.wait = function(minutes) {
  this.now += minutes * 60 * 1000;
};

var page     = 'https://' + HOST,
    internal = page + '/shop/?orderby=price',
    longUtm  = page + '/product/long-sleeve-tee/?utm_source=newsletter&utm_medium=email' +
      '&utm_campaign=' + new Array(60).join('extra-long-campaign-') +
      '&utm_content=' + encodeURIComponent('日本語キャンペーン' + new Array(30).join('variant-b-')) +
      '&utm_term=shirts&utm_id=abc123&fbclid=' + new Array(200).join('x');

// Each step is [ url, referrer, minutes to wait first ]
var scenarios = {
  'long UTM link': [
    [longUtm, 'https://mail.example.org/inbox'],
    [internal, longUtm],
    [page + '/checkout/', internal]
  ],
  'search referral': [
    [page + '/product/hoodie/', 'https://www.google.com/search?q=hoodie'],
    [internal, page + '/product/hoodie/']
  ],
  'returning visit': [
    [page + '/', ''],
    // A referral inside the session doesn't override the source
    [page + '/blog/', 'https://friend.example.net/post', 5],
    // After the session it does, and counts a new visit
    [page + '/product/hoodie/', 'https://friend.example.net/post', 45],
    // A direct visit never overrides, but counts a visit
    [page + '/', '', 60 * 24],
    [internal, page + '/', 1],
    // Organic always overrides
    [page + '/product/cap/', 'https://www.bing.com/search?q=cap', 2],
    // After `first` expires it is copied from `current` again
    [page + '/', '', 60 * 24 * 200]
  ]
};

function prefsFor(base64, fields) {
  var prefs = { lifetime: 6, session_length: 30, base64: base64, timezone_offset: '0' };
  if (fields) { prefs.fields = fields; }
  return prefs;
}

function run(steps, prefs) {
  var b = new Browser();
  return steps.map(function(s) {
    if (s[2]) { b.wait(s[2]); }
    return { get: b.visit(s[0], s[1], prefs), cookies: b.cookies(), header: b.header() };
  });
}

// Two scripts that run `sbjs.init` on every page, `a` before `b`
function runBoth(steps, a, b) {
  var browser = new Browser();
  return steps.map(function(s) {
    if (s[2]) { browser.wait(s[2]); }
    var r = {};
    r[a.key] = browser.visit(s[0], s[1], a.prefs);
    r[b.key] = browser.visit(s[0], s[1], b.prefs);
    r.cookies = browser.cookies();
    return r;
  });
}

function byContainer(fields) {
  var map = {};
  fields.forEach(function(f) {
    var path = f.split('.');
    (map[path[0]] = map[path[0]] || []).push(path[1]);
  });
  return map;
}

var configs = [
  { fields: WC_FIELDS, extra: { first_add: ['fd', 'ep', 'rf'] } },
  { fields: ['first.src', 'first.typ'], extra: { current: ['src', 'typ'], session: ['pgs'], first_add: ['fd', 'ep', 'rf'] } },
  { fields: ['current_add.ep'], extra: { current: ['typ'], session: ['pgs'], first_add: ['fd', 'ep', 'rf'] } },
  { fields: ['current.typ', 'current.src'], extra: { session: ['pgs'], first_add: ['fd', 'ep', 'rf'] } },
  { fields: ['udata.vst'], extra: { session: ['pgs'], first_add: ['fd', 'ep', 'rf'] } },
  { fields: ['udata.uag'] }
];

[false, true].forEach(function(base64) {
  var mode = ' (base64=' + base64 + ')';

  Object.keys(scenarios).forEach(function(name) {
    var steps = scenarios[name],
        plain = run(steps, prefsFor(base64));

    // Invalid values are ignored
    [[], 'current.typ', ['nope.typ', 'current.zzz', 'current', 42], { current: ['typ'] }].forEach(function(v) {
      assert.deepStrictEqual(run(steps, prefsFor(base64, v)), plain, name + ': invalid fields ' + JSON.stringify(v) + mode);
    });

    configs.forEach(function(config) {
      var res     = run(steps, prefsFor(base64, config.fields)),
          listed  = byContainer(config.fields),
          allowed = byContainer(config.fields),
          label   = name + ', ' + config.fields.join(' ') + mode;
      Object.keys(config.extra || {}).forEach(function(c) {
        allowed[c] = (allowed[c] || []).concat(config.extra[c]);
      });

      res.forEach(function(r, i) {
        // Listed fields keep the same values as without the option
        Object.keys(listed).forEach(function(c) {
          listed[c].forEach(function(f) {
            assert.strictEqual(r.get[c][f], plain[i].get[c][f], label + ', step ' + i + ': ' + c + '.' + f);
          });
        });
        // Only listed and required fields are stored, unlisted fields are not stored as empty values
        CONTAINERS.forEach(function(c) {
          var want = (allowed[c] || []).filter(function(f) { return typeof plain[i].get[c][f] !== 'undefined'; });
          assert.deepStrictEqual(Object.keys(r.get[c]).sort(), want.sort(), label + ', step ' + i + ': ' + c);
        });
        assert(r.cookies['sbjs_migrations@.' + HOST], label + ', step ' + i + ': sbjs_migrations missing');
      });
    });
  });

  // Another script runs `sbjs.init` without `fields` on the same pages: the cookies end up
  // the same as when both run without `fields`, in either order
  ['long UTM link', 'returning visit', 'search referral'].forEach(function(name) {
    var steps  = scenarios[name],
        other  = { key: 'other', prefs: prefsFor(base64) },
        plain  = { key: 'wc', prefs: prefsFor(base64) },
        listed = { key: 'wc', prefs: prefsFor(base64, WC_FIELDS) };

    [[listed, other, plain, other], [other, listed, other, plain]].forEach(function(order) {
      var label = name + ', ' + (order[0].key === 'wc' ? 'WooCommerce first' : 'other script first') + mode,
          ref   = runBoth(steps, order[2], order[3]),
          res   = runBoth(steps, order[0], order[1]);
      res.forEach(function(r, i) {
        assert.deepStrictEqual(r.cookies, ref[i].cookies, label + ', step ' + i + ': cookies');
        assert.deepStrictEqual(r.other, ref[i].other, label + ', step ' + i + ': other sbjs.get');
        WC_FIELDS.forEach(function(f) {
          var path = f.split('.');
          assert.strictEqual(r.wc[path[0]][path[1]], ref[i].wc[path[0]][path[1]], label + ', step ' + i + ': ' + f);
        });
      });
    });
  });

  // A visitor with cookies from before keeps them, the listed fields are updated as usual
  var before = new Browser(),
      ref    = new Browser();
  [before, ref].forEach(function(b) {
    b.visit(longUtm, '', prefsFor(base64));
    b.visit(internal, longUtm, prefsFor(base64));
    b.wait(3);
  });
  var old      = before.cookies(),
      upgraded = before.visit(page + '/checkout/', internal, prefsFor(base64, WC_FIELDS)),
      expected = ref.visit(page + '/checkout/', internal, prefsFor(base64)),
      after    = before.cookies();
  ['sbjs_first@.' + HOST, 'sbjs_first_add@.' + HOST].forEach(function(k) {
    assert.strictEqual(after[k], old[k], 'existing ' + k + ' changed' + mode);
  });
  WC_FIELDS.forEach(function(f) {
    var path = f.split('.');
    assert.strictEqual(upgraded[path[0]][path[1]], expected[path[0]][path[1]], 'existing visitor: ' + f + mode);
  });

  // Unlisted fields from an earlier attribution are not mixed into a new one
  var mixed = new Browser();
  mixed.visit(page + '/?utm_source=first&utm_content=hero', '', prefsFor(base64));
  mixed.wait(1);
  var second = mixed.visit(page + '/?utm_source=second', '', prefsFor(base64, ['current.typ', 'current.src', 'session.pgs']));
  assert.strictEqual(second.current.src, 'second', 'new attribution' + mode);
  assert.strictEqual(second.current.cnt, undefined, 'unlisted field kept from an earlier attribution' + mode);
  mixed.wait(1);
  var third = mixed.visit(internal, page + '/', prefsFor(base64, ['current.typ', 'current.src', 'session.pgs']));
  assert.deepStrictEqual(third.current, second.current, 'current changed on a page view' + mode);
});

var full   = run(scenarios['long UTM link'], prefsFor(false)),
    listed = run(scenarios['long UTM link'], prefsFor(false, WC_FIELDS));
console.log('fields tests passed (long UTM link sbjs_* cookies: ' + full[0].header.length + ' -> ' + listed[0].header.length + ' bytes)');
