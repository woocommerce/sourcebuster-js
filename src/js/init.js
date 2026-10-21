"use strict";

var data        = require('./data'),
    terms       = require('./terms'),
    cookies     = require('./helpers/cookies'),
    uri         = require('./helpers/uri'),
    utils       = require('./helpers/utils'),
    params      = require('./params'),
    migrations  = require('./migrations');

module.exports = function(prefs) {

  var p         = params.fetch(prefs);
  var get_param = uri.getParam();
  var domain    = p.domain.host,
      isolate   = p.domain.isolate,
      lifetime  = p.lifetime,
      fields    = p.fields,
      new_attribution = false;

  cookies.setBase64Flag( p.base64 );

  migrations.go(lifetime, domain, isolate);

  if (fields) {
    addRequiredFields();
  }

  var __sbjs_type,
      __sbjs_source,
      __sbjs_medium,
      __sbjs_campaign,
      __sbjs_content,
      __sbjs_term,
      __sbjs_id,
      __sbjs_platform,
      __sbjs_format,
      __sbjs_tactic;

  function mainData() {
    var sbjs_data;
    if (
        typeof get_param.utm_source           !== 'undefined' ||
        typeof get_param.utm_medium           !== 'undefined' ||
        typeof get_param.utm_campaign         !== 'undefined' ||
        typeof get_param.utm_content          !== 'undefined' ||
        typeof get_param.utm_term             !== 'undefined' ||
        typeof get_param.utm_id               !== 'undefined' ||
        typeof get_param.utm_source_platform  !== 'undefined' ||
        typeof get_param.utm_creative_format  !== 'undefined' ||
        typeof get_param.utm_marketing_tactic !== 'undefined' ||
        typeof get_param.gclid                !== 'undefined' ||
        typeof get_param.yclid                !== 'undefined' ||
        typeof get_param[p.campaign_param]    !== 'undefined' ||
        typeof get_param[p.term_param]        !== 'undefined' ||
        typeof get_param[p.content_param]     !== 'undefined'
    ) {
      setFirstAndCurrentExtraData();
      sbjs_data = getData(terms.traffic.utm);
    } else if (checkReferer(terms.traffic.organic)) {
      setFirstAndCurrentExtraData();
      sbjs_data = getData(terms.traffic.organic);
    } else if (!cookies.get(data.containers.session) && checkReferer(terms.traffic.referral)) {
      setFirstAndCurrentExtraData();
      sbjs_data = getData(terms.traffic.referral);
    } else if (!cookies.get(data.containers.first) && !cookies.get(data.containers.current)) {
      setFirstAndCurrentExtraData();
      sbjs_data = getData(terms.traffic.typein);
    } else {
      return cookies.get(data.containers.current);
    }

    return sbjs_data;
  }

  function getData(type) {

    switch (type) {

      case terms.traffic.utm:

        __sbjs_type = terms.traffic.utm;

        if (typeof get_param.utm_source !== 'undefined') {
          __sbjs_source = get_param.utm_source;
        } else if (typeof get_param.gclid !== 'undefined') {
          __sbjs_source = 'google';
        } else if (typeof get_param.yclid !== 'undefined') {
          __sbjs_source = 'yandex';
        } else {
          __sbjs_source = terms.none;
        }

        if (typeof get_param.utm_medium !== 'undefined') {
          __sbjs_medium = get_param.utm_medium;
        } else if (typeof get_param.gclid !== 'undefined') {
          __sbjs_medium = 'cpc';
        } else if (typeof get_param.yclid !== 'undefined') {
          __sbjs_medium = 'cpc';
        } else {
          __sbjs_medium = terms.none;
        }

        if (typeof get_param.utm_campaign !== 'undefined') {
          __sbjs_campaign = get_param.utm_campaign;
        } else if (typeof get_param[p.campaign_param] !== 'undefined') {
          __sbjs_campaign = get_param[p.campaign_param];
        } else if (typeof get_param.gclid !== 'undefined') {
          __sbjs_campaign = 'google_cpc';
        } else if (typeof get_param.yclid !== 'undefined') {
          __sbjs_campaign = 'yandex_cpc';
        } else {
          __sbjs_campaign = terms.none;
        }

        if (typeof get_param.utm_content !== 'undefined') {
          __sbjs_content = get_param.utm_content;
        } else if (typeof get_param[p.content_param] !== 'undefined') {
          __sbjs_content = get_param[p.content_param];
        } else {
          __sbjs_content = terms.none;
        }

        __sbjs_id       = get_param.utm_id || terms.none;
        __sbjs_platform = get_param.utm_source_platform || terms.none;
        __sbjs_format   = get_param.utm_creative_format || terms.none;
        __sbjs_tactic   = get_param.utm_marketing_tactic || terms.none;

        if (typeof get_param.utm_term !== 'undefined') {
          __sbjs_term = get_param.utm_term;
        } else if (typeof get_param[p.term_param] !== 'undefined') {
          __sbjs_term = get_param[p.term_param];
        } else {
          __sbjs_term = getUtmTerm() || terms.none;
        }

        break;

      case terms.traffic.organic:
        __sbjs_type     = terms.traffic.organic;
        __sbjs_source   = __sbjs_source || uri.getHost(document.referrer);
        __sbjs_medium   = terms.referer.organic;
        __sbjs_campaign = terms.none;
        __sbjs_content  = terms.none;
        __sbjs_term     = terms.none;
        __sbjs_id       = terms.none;
        __sbjs_platform = terms.none;
        __sbjs_format   = terms.none;
        __sbjs_tactic   = terms.none;
        break;

      case terms.traffic.referral:
        __sbjs_type     = terms.traffic.referral;
        __sbjs_source   = __sbjs_source || uri.getHost(document.referrer);
        __sbjs_medium   = __sbjs_medium || terms.referer.referral;
        __sbjs_campaign = terms.none;
        __sbjs_content  = uri.parse(document.referrer).path;
        __sbjs_term     = terms.none;
        __sbjs_id       = terms.none;
        __sbjs_platform = terms.none;
        __sbjs_format   = terms.none;
        __sbjs_tactic   = terms.none;
        break;

      case terms.traffic.typein:
        __sbjs_type     = terms.traffic.typein;
        __sbjs_source   = p.typein_attributes.source;
        __sbjs_medium   = p.typein_attributes.medium;
        __sbjs_campaign = terms.none;
        __sbjs_content  = terms.none;
        __sbjs_term     = terms.none;
        __sbjs_id       = terms.none;
        __sbjs_platform = terms.none;
        __sbjs_format   = terms.none;
        __sbjs_tactic   = terms.none;
        break;

      default:
        __sbjs_type     = terms.oops;
        __sbjs_source   = terms.oops;
        __sbjs_medium   = terms.oops;
        __sbjs_campaign = terms.oops;
        __sbjs_content  = terms.oops;
        __sbjs_term     = terms.oops;
        __sbjs_id       = terms.oops;
        __sbjs_platform = terms.oops;
        __sbjs_format   = terms.oops;
        __sbjs_tactic   = terms.oops;
    }
    var sbjs_data = {
      type:             __sbjs_type,
      source:           __sbjs_source,
      medium:           __sbjs_medium,
      campaign:         __sbjs_campaign,
      content:          __sbjs_content,
      term:             __sbjs_term,
      id:               __sbjs_id,
      platform:         __sbjs_platform,
      format:           __sbjs_format,
      tactic:           __sbjs_tactic
    };

    return data.pack.main(sbjs_data);

  }

  function getUtmTerm() {
    var referer = document.referrer;
    if (get_param.utm_term) {
      return get_param.utm_term;
    } else if (referer && uri.parse(referer).host && uri.parse(referer).host.match(/^(?:.*\.)?yandex\..{2,9}$/i)) {
      try {
        return uri.getParam(uri.parse(document.referrer).query).text;
      } catch (err) {
        return false;
      }
    } else {
      return false;
    }
  }

  function checkReferer(type) {
    var referer = document.referrer;
    switch(type) {
      case terms.traffic.organic:
        return (!!referer && checkRefererHost(referer) && isOrganic(referer));
      case terms.traffic.referral:
        return (!!referer && checkRefererHost(referer) && isReferral(referer));
      default:
        return false;
    }
  }

  function checkRefererHost(referer) {
    if (p.domain) {
      if (!isolate) {
        var host_regex = new RegExp('^(?:.*\\.)?' + utils.escapeRegexp(domain) + '$', 'i');
        return !(uri.getHost(referer).match(host_regex));
      } else {
        return (uri.getHost(referer) !== uri.getHost(domain));
      }
    } else {
      return (uri.getHost(referer) !== uri.getHost(document.location.href));
    }
  }

  function isOrganic(referer) {

    var y_host  = 'yandex',
        y_param = 'text',
        g_host  = 'google';

    var y_host_regex  = new RegExp('^(?:.*\\.)?'  + utils.escapeRegexp(y_host)  + '\\..{2,9}$'),
        y_param_regex = new RegExp('.*'           + utils.escapeRegexp(y_param) + '=.*'),
        g_host_regex  = new RegExp('^(?:www\\.)?' + utils.escapeRegexp(g_host)  + '\\..{2,9}$');

    if (
        !!uri.parse(referer).query &&
        !!uri.parse(referer).host.match(y_host_regex) &&
        !!uri.parse(referer).query.match(y_param_regex)
      ) {
      __sbjs_source = y_host;
      return true;
    } else if (!!uri.parse(referer).host.match(g_host_regex)) {
      __sbjs_source = g_host;
      return true;
    } else if (!!uri.parse(referer).query) {
      for (var i = 0; i < p.organics.length; i++) {
        if (
            uri.parse(referer).host.match(new RegExp('^(?:.*\\.)?' + utils.escapeRegexp(p.organics[i].host)  + '$', 'i')) &&
            uri.parse(referer).query.match(new RegExp('.*'         + utils.escapeRegexp(p.organics[i].param) + '=.*', 'i'))
          ) {
          __sbjs_source = p.organics[i].display || p.organics[i].host;
          return true;
        }
        if (i + 1 === p.organics.length) {
          return false;
        }
      }
    } else {
      return false;
    }
  }

  function isReferral(referer) {
    if (p.referrals.length > 0) {
      for (var i = 0; i < p.referrals.length; i++) {
        if (uri.parse(referer).host.match(new RegExp('^(?:.*\\.)?' + utils.escapeRegexp(p.referrals[i].host) + '$', 'i'))) {
          __sbjs_source = p.referrals[i].display  || p.referrals[i].host;
          __sbjs_medium = p.referrals[i].medium   || terms.referer.referral;
          return true;
        }
        if (i + 1 === p.referrals.length) {
          __sbjs_source = uri.getHost(referer);
          return true;
        }
      }
    } else {
      __sbjs_source = uri.getHost(referer);
      return true;
    }
  }

  function setFirstAndCurrentExtraData() {
    new_attribution = true;
    setCookie(data.containers.current_extra, data.pack.extra(p.timezone_offset), lifetime);
    if (!cookies.get(data.containers.first_extra)) {
      if (fields && !fields[data.containers.first_extra] && (fields[data.containers.current] || fields[data.containers.session])) {
        // Written in full even when not listed: another script that runs `sbjs.init` after this one
        // sees `current` or `session`, so it no longer records this visit in `first_add` itself
        cookies.set(data.containers.first_extra, data.pack.extra(p.timezone_offset), lifetime, domain, isolate);
      } else {
        setCookie(data.containers.first_extra, data.pack.extra(p.timezone_offset), lifetime);
      }
    }
  }

  // Some containers decide how others are written, so keep them whenever those are written:
  // `current` is copied into `first`, and whether it exists decides `typein` attribution,
  // `session` existing decides `referral` attribution and the visit count in `udata`.
  function addRequiredFields() {
    var c = data.containers;

    if (fields[c.first]) {
      addFields(c.current, fields[c.first]);
    }
    if (!fields[c.current] && (fields[c.current_extra] || fields[c.first_extra])) {
      addFields(c.current, [data.aliases.main.type]);
    }
    if (
        !fields[c.session] &&
        (fields[c.current] || (fields[c.udata] && utils.hasKey(fields[c.udata], data.aliases.udata.visits)))
    ) {
      addFields(c.session, [data.aliases.session.pages_seen]);
    }
  }

  function addFields(name, keys) {
    fields[name] = fields[name] || [];
    for (var i = 0; i < keys.length; i++) {
      if (!utils.hasKey(fields[name], keys[i])) {
        fields[name].push(keys[i]);
      }
    }
  }

  // Writes the container, with only the listed fields when `fields` is set
  function setCookie(name, value, minutes) {
    if (fields) {
      if (!fields[name]) {
        return;
      }
      value = mergeFields(name, value);
    }
    cookies.set(name, value, minutes, domain, isolate);
  }

  // Takes the listed fields from `value`, and keeps the unlisted fields of the existing cookie,
  // which another script that runs `sbjs.init` without `fields` may have written
  function mergeFields(name, value) {
    if (typeof value !== 'string') {
      return value;
    }
    var keys     = fields[name],
        written  = splitFields(value),
        existing = splitFields(cookies.get(name)),
        merged   = [],
        i,
        key;

    // `session` and `udata` are rewritten on every page view. The other containers belong to an
    // attribution, so their unlisted fields are dropped when this page view starts a new one.
    var keep = name === data.containers.session || name === data.containers.udata || !new_attribution;

    for (i = 0; i < written.keys.length; i++) {
      key = written.keys[i];
      if (utils.hasKey(keys, key)) {
        merged.push(key + '=' + written.values[key]);
      }
    }
    for (i = 0; keep && i < existing.keys.length; i++) {
      key = existing.keys[i];
      if (!utils.hasKey(keys, key)) {
        merged.push(key + '=' + existing.values[key]);
      }
    }
    return merged.join(data.delimiter);
  }

  function splitFields(value) {
    var parts  = value ? value.split(data.delimiter) : [],
        result = { keys: [], values: {} },
        separator,
        key;
    for (var i = 0; i < parts.length; i++) {
      separator = parts[i].indexOf('=');
      key = parts[i].substring(0, separator);
      if (separator > 0 && !result.values.hasOwnProperty(key)) {
        result.keys.push(key);
        result.values[key] = parts[i].substring(separator + 1);
      }
    }
    return result;
  }

  (function setData() {

    // Main data
    setCookie(data.containers.current, mainData(), lifetime);
    if (!cookies.get(data.containers.first)) {
      setCookie(data.containers.first, cookies.get(data.containers.current), lifetime);
    }

    // User data
    var visits, udata;
    if (!cookies.get(data.containers.udata)) {
      visits  = 1;
      udata   = data.pack.user(visits, p.user_ip);
    } else {
      visits  = parseInt(cookies.parse(data.containers.udata)[cookies.unsbjs(data.containers.udata)][data.aliases.udata.visits]) || 1;
      visits  = cookies.get(data.containers.session) ? visits : visits + 1;
      udata   = data.pack.user(visits, p.user_ip);
    }
    setCookie(data.containers.udata, udata, lifetime);

    // Session
    var pages_count;
    if (!cookies.get(data.containers.session)) {
      pages_count = 1;
    } else {
      pages_count = parseInt(cookies.parse(data.containers.session)[cookies.unsbjs(data.containers.session)][data.aliases.session.pages_seen]) || 1;
      pages_count += 1;
    }
    setCookie(data.containers.session, data.pack.session(pages_count), p.session_length);

    // Promocode
    if (p.promocode && !cookies.get(data.containers.promocode)) {
      setCookie(data.containers.promocode, data.pack.promo(p.promocode), lifetime);
    }

  })();

  return cookies.parse(data.containers);

};
