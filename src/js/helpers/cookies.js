"use strict";

var data              = require('../data'),
    delimiter         = data.delimiter,
    requestBudget     = 2304,
    containerBudgets  = {},
    allowedFields     = {},
    fieldBudgets      = {
      typ: 32,
      src: 96,
      mdm: 96,
      cmp: 256,
      cnt: 256,
      trm: 256,
      id: 256,
      plt: 96,
      fmt: 96,
      tct: 96,
      fd: 32,
      ep: 512,
      rf: 512,
      pgs: 32,
      cpg: 512,
      vst: 32,
      uip: 64,
      uag: 512,
      code: 64
    },
    // When a cookie is still over budget after the field caps, fields are emptied
    // in this order until the rest fits. The field that makes it fit is then
    // trimmed to the largest size that fits instead of being emptied.
    // Fields at the end of the list are kept the longest.
    reductionOrder = [
      'uag', 'rf', 'cnt', 'trm', 'plt', 'fmt', 'tct', 'ep', 'cpg',
      'id', 'cmp', 'uip', 'src', 'mdm', 'typ', 'fd', 'pgs', 'vst', 'code'
    ];

// Each container budget includes its encoded name, "=", and encoded value.
// All eight budgets plus seven "; " separators stay below requestBudget.
containerBudgets[data.containers.current]       = 520;
containerBudgets[data.containers.first]         = 520;
containerBudgets[data.containers.current_extra] = 266;
containerBudgets[data.containers.first_extra]   = 266;
containerBudgets[data.containers.session]       = 144;
// Keeps common desktop and mobile user agents complete, also in Base64 mode.
// Very long in-app browser user agents can still be trimmed.
containerBudgets[data.containers.udata]         = 470;
containerBudgets[data.containers.promocode]     = 40;
containerBudgets[data.service.migrations]       = 40;

allowedFields[data.containers.current] = allowedFields[data.containers.first] =
  ['typ', 'src', 'mdm', 'cmp', 'cnt', 'trm', 'id', 'plt', 'fmt', 'tct'];
allowedFields[data.containers.current_extra] = allowedFields[data.containers.first_extra] =
  ['fd', 'ep', 'rf'];
allowedFields[data.containers.session] = ['pgs', 'cpg'];
allowedFields[data.containers.udata] = ['vst', 'uip', 'uag'];
allowedFields[data.containers.promocode] = ['code'];

function encodeData(s) {
  return encodeURIComponent(s).replace(/\!/g, '%21')
                              .replace(/\~/g, '%7E')
                              .replace(/\*/g, '%2A')
                              .replace(/\'/g, '%27')
                              .replace(/\(/g, '%28')
                              .replace(/\)/g, '%29');
}

function encodeCookieValue(value, useBase64) {
  var encoded = encodeData(value);
  return useBase64 ? btoa(encoded).replace(/=+$/, '') : encoded;
}

// Values from the URL are still percent encoded. Trim on whole units only:
// a complete %XX UTF-8 character, a surrogate pair, or a single character.
// Cutting inside an escape makes decodeURIComponent fail on the whole field.
var trimUnits = new RegExp(
  '%[0-7][0-9A-F]' +
  '|%[CD][0-9A-F]%[89AB][0-9A-F]' +
  '|%E[0-9A-F](?:%[89AB][0-9A-F]){2}' +
  '|%F[0-7](?:%[89AB][0-9A-F]){3}' +
  '|[\\uD800-\\uDBFF][\\uDC00-\\uDFFF]' +
  '|[\\s\\S]',
  'gi'
);

function trimToEncodedBytes(value, maxBytes) {
  var units = String(value || '').replace(/[\u0000-\u001f\u007f]/g, '').match(trimUnits) || [],
      out = '',
      used = 0,
      i,
      encoded;

  for (i = 0; i < units.length; i++) {
    try {
      encoded = encodeData(units[i]);
    } catch (error) {
      // Skip lone surrogates, which encodeURIComponent rejects.
      continue;
    }
    if (used + encoded.length > maxBytes) {
      break;
    }
    out += units[i];
    used += encoded.length;
  }
  return out;
}

function removeLastCodePoint(value) {
  var end = value.length - 1;
  if (end > 0 && /[\uDC00-\uDFFF]/.test(value.charAt(end))) {
    end -= 1;
  }
  return value.substring(0, end);
}

function hasKey(keys, key) {
  var i;
  for (i = 0; i < keys.length; i++) {
    if (keys[i] === key) {
      return true;
    }
  }
  return false;
}

function parseFields(value, keys) {
  var parts = String(value || '').split(delimiter),
      parsed = {},
      i,
      separator,
      key;

  for (i = 0; i < parts.length; i++) {
    separator = parts[i].indexOf('=');
    if (separator < 1) {
      continue;
    }
    key = parts[i].substring(0, separator);
    if (hasKey(keys, key) && typeof parsed[key] === 'undefined') {
      parsed[key] = parts[i].substring(separator + 1);
    }
  }
  return parsed;
}

function serializeFields(keys, values) {
  var packed = [],
      i;
  for (i = 0; i < keys.length; i++) {
    packed.push(keys[i] + '=' + (values[keys[i]] || ''));
  }
  return packed.join(delimiter);
}

function fitPackedValue(name, value, maxBytes, useBase64) {
  var keys = allowedFields[name],
      values = parseFields(value, keys),
      packed,
      i,
      key,
      original,
      candidate,
      best,
      low,
      high,
      middle;

  for (i = 0; i < keys.length; i++) {
    key = keys[i];
    values[key] = trimToEncodedBytes(values[key], fieldBudgets[key]);
  }

  packed = serializeFields(keys, values);
  if (encodeCookieValue(packed, useBase64).length <= maxBytes) {
    return packed;
  }

  for (i = 0; i < reductionOrder.length; i++) {
    key = reductionOrder[i];
    if (typeof values[key] === 'undefined' || values[key].length === 0) {
      continue;
    }
    original = values[key];
    values[key] = '';
    packed = serializeFields(keys, values);
    if (encodeCookieValue(packed, useBase64).length > maxBytes) {
      continue;
    }

    best = '';
    low = 0;
    high = encodeData(original).length;
    while (low <= high) {
      middle = Math.floor((low + high) / 2);
      candidate = trimToEncodedBytes(original, middle);
      values[key] = candidate;
      packed = serializeFields(keys, values);
      if (encodeCookieValue(packed, useBase64).length <= maxBytes) {
        best = candidate;
        low = middle + 1;
      } else {
        high = middle - 1;
      }
    }
    values[key] = best;
    return serializeFields(keys, values);
  }
  return serializeFields(keys, values);
}

function fitScalarValue(value, maxBytes, useBase64) {
  var fitted = trimToEncodedBytes(value, maxBytes);
  while (encodeCookieValue(fitted, useBase64).length > maxBytes && fitted.length > 0) {
    fitted = removeLastCodePoint(fitted);
  }
  return fitted;
}

module.exports = {

  useBase64: false, // Base64 flag set to false by default
  requestBudget: requestBudget,
  containerBudgets: containerBudgets,
  fieldBudgets: fieldBudgets,

  setBase64Flag: function(value) {
    this.useBase64 = value;
  },

  encodeData: encodeData,

  prepareValue: function(name, value) {
    var budget = containerBudgets[name],
        contentBudget;

    if (!budget) {
      return encodeCookieValue(String(value || ''), this.useBase64);
    }
    contentBudget = budget - encodeData(name).length - 1;
    if (allowedFields[name]) {
      value = fitPackedValue(name, value, contentBudget, this.useBase64);
    } else {
      value = fitScalarValue(value, contentBudget, this.useBase64);
    }
    return encodeCookieValue(value, this.useBase64);
  },

  decodeData: function(s) {
    try {
      return decodeURIComponent(s).replace(/\%21/g, '!')
                                  .replace(/\%7E/g, '~')
                                  .replace(/\%2A/g, '*')
                                  .replace(/\%27/g, "'")
                                  .replace(/\%28/g, '(')
                                  .replace(/\%29/g, ')');
    } catch(err1) {
      // try unescape for backward compatibility
      try { return unescape(s); } catch(err2) { return ''; }
    }
  },

  set: function(name, value, minutes, domain, excl_subdomains) {
    var expires, basehost;

    if (minutes) {
      var date = new Date();
      date.setTime(date.getTime() + (minutes * 60 * 1000));
      expires = '; expires=' + date.toGMTString();
    } else {
      expires = '';
    }
    if (domain && !excl_subdomains) {
      basehost = ';domain=.' + domain;
    } else {
      basehost = '';
    }
    var cookie_content = this.prepareValue(name, value);
    document.cookie = this.encodeData(name) + '=' + cookie_content + expires + basehost + '; path=/';
  },

  get: function(name) {
    var nameEQ = this.encodeData(name) + '=',
        ca = document.cookie.split(';');

    for (var i = 0; i < ca.length; i++) {
      var c = ca[i];
      while (c.charAt(0) === ' ') { c = c.substring(1, c.length); }
      if (c.indexOf(nameEQ) === 0) {
        var cookie_content = c.substring(nameEQ.length, c.length);
        // Decode the content if it only contains Base64-valid characters
        // Non-alphanumeric characters indicate that the cookie data is not encoded
        if (/^[A-Za-z0-9+/]+$/.test(cookie_content)) {
          try {
            // Attempt to decode the Base64 string (after padding with = to make it a multiple of 4)
            cookie_content = atob( cookie_content + new Array((4 - cookie_content.length % 4) % 4 + 1).join('=') );
          } catch (error) {
            // If the Base64 string is invalid, just keep the cookie content as is
          }
        }
        return this.decodeData(cookie_content);
      }
    }
    return null;
  },

  destroy: function(name, domain, excl_subdomains) {
    this.set(name, '', -1, domain, excl_subdomains);
  },

  parse: function(yummy) {

    var cookies = [],
        data    = {};

    if (typeof yummy === 'string') {
      cookies.push(yummy);
    } else {
      for (var prop in yummy) {
        if (yummy.hasOwnProperty(prop)) {
          cookies.push(yummy[prop]);
        }
      }
    }

    for (var i1 = 0; i1 < cookies.length; i1++) {
      var cookie_array;
      data[this.unsbjs(cookies[i1])] = {};
      if (this.get(cookies[i1])) {
        cookie_array = this.get(cookies[i1]).split(delimiter);
      } else {
        cookie_array = [];
      }
      for (var i2 = 0; i2 < cookie_array.length; i2++) {
        var tmp_array = cookie_array[i2].split('='),
            result_array = tmp_array.splice(0, 1);
        result_array.push(tmp_array.join('='));
        data[this.unsbjs(cookies[i1])][result_array[0]] = this.decodeData(result_array[1]);
      }
    }

    return data;

  },

  unsbjs: function (string) {
    return string.replace('sbjs_', '');
  }

};
