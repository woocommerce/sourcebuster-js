"use strict";

var terms = require('./terms'),
    uri   = require('./helpers/uri'),
    utils = require('./helpers/utils');

// Escape every pipe before cookie-budget parsing. A trailing "|" or "||" would
// otherwise merge with the "|||" delimiter and break the next field.
function packValue(value) {
  return String(value || '').replace(/\|/g, '%7C');
}

function landingPath() {
  return document.location.pathname || uri.parse(document.location.href).path || '/';
}

function refererPath() {
  var parsed;

  if (!document.referrer) {
    return terms.none;
  }

  parsed = uri.parse(document.referrer);
  return (
    (parsed.protocol ? parsed.protocol + '://' : '') +
    parsed.host +
    (parsed.port ? ':' + parsed.port : '') +
    (parsed.path || '/')
  );
}

var data = {

  containers: {
    current:          'sbjs_current',
    current_extra:    'sbjs_current_add',
    first:            'sbjs_first',
    first_extra:      'sbjs_first_add',
    session:          'sbjs_session',
    udata:            'sbjs_udata',
    promocode:        'sbjs_promo'
  },

  service: {
    migrations:       'sbjs_migrations'
  },

  delimiter:          '|||',

  aliases: {

    main: {
      type:           'typ',
      source:         'src',
      medium:         'mdm',
      campaign:       'cmp',
      content:        'cnt',
      term:           'trm',
      id:             'id',
      platform:       'plt',
      format:         'fmt',
      tactic:         'tct'
    },

    extra: {
      fire_date:      'fd',
      entrance_point: 'ep',
      referer:        'rf'
    },

    session: {
      pages_seen:     'pgs',
      current_page:   'cpg'
    },

    udata: {
      visits:         'vst',
      ip:             'uip',
      agent:          'uag'
    },

    promo:            'code'

  },

  pack: {

    main: function(sbjs) {
      return (
        data.aliases.main.type      + '=' + packValue(sbjs.type)     + data.delimiter +
        data.aliases.main.source    + '=' + packValue(sbjs.source)   + data.delimiter +
        data.aliases.main.medium    + '=' + packValue(sbjs.medium)   + data.delimiter +
        data.aliases.main.campaign  + '=' + packValue(sbjs.campaign) + data.delimiter +
        data.aliases.main.content   + '=' + packValue(sbjs.content)  + data.delimiter +
        data.aliases.main.term      + '=' + packValue(sbjs.term)     + data.delimiter +
        data.aliases.main.id        + '=' + packValue(sbjs.id)       + data.delimiter +
        data.aliases.main.platform  + '=' + packValue(sbjs.platform) + data.delimiter +
        data.aliases.main.format    + '=' + packValue(sbjs.format)   + data.delimiter +
        data.aliases.main.tactic    + '=' + packValue(sbjs.tactic)
      );
    },

    extra: function(timezone_offset) {
      return (
        data.aliases.extra.fire_date      + '=' + utils.setDate(new Date, timezone_offset) + data.delimiter +
        data.aliases.extra.entrance_point + '=' + packValue(landingPath())                  + data.delimiter +
        data.aliases.extra.referer        + '=' + packValue(refererPath())
      );
    },

    user: function(visits, user_ip) {
      return (
        data.aliases.udata.visits + '=' + visits  + data.delimiter +
        data.aliases.udata.ip     + '=' + packValue(user_ip) + data.delimiter +
        data.aliases.udata.agent  + '=' + packValue(navigator.userAgent)
      );
    },

    session: function(pages) {
      return (
      data.aliases.session.pages_seen   + '=' + pages + data.delimiter +
      data.aliases.session.current_page + '=' + packValue(landingPath())
      );
    },

    promo: function(promo) {
      return (
        data.aliases.promo + '=' + utils.setLeadingZeroToInt(utils.randomInt(promo.min, promo.max), promo.max.toString().length)
      );
    }

  }
};

module.exports = data;
