"use strict";

var data    = require('./data'),
    storage_init = require('./helpers/storage_init');

module.exports = {

  go: function(lifetime, domain, isolate) {

    var web_storage = storage_init.get();
    var migrate = this.migrations,
        _with   = { l: lifetime, d: domain, i: isolate };

    var i;

    if (!web_storage.get(data.containers.first) && !web_storage.get(data.service.migrations)) {

      var mids = [];
      for (i = 0; i < migrate.length; i++) { mids.push(migrate[i].id); }

      var advance = '';
      for (i = 0; i < mids.length; i++) {
        advance += mids[i] + '=1';
        if (i < mids.length - 1) { advance += data.delimiter; }
      }
      web_storage.set(data.service.migrations, advance, _with.l, _with.d, _with.i);

    } else if (!web_storage.get(data.service.migrations)) {

      // We have only one migration for now, so just
      for (i = 0; i < migrate.length; i++) {
        migrate[i].go(migrate[i].id, _with);
      }

    }

  },

  migrations: [

    {
      id: '1418474375998',
      version: '1.0.0-beta',
      go: function(mid, _with) {

        var web_storage = storage_init.get();

        var success = mid + '=1',
            fail    = mid + '=0';

        var safeReplace = function($0, $1, $2) {
          return ($1 || $2 ? $0 : data.delimiter);
        };

        try {

          // Switch delimiter and renew cookies
          var _in = [];
          for (var prop in data.containers) {
            if (data.containers.hasOwnProperty(prop)) {
              _in.push(data.containers[prop]);
            }
          }

          for (var i = 0; i < _in.length; i++) {
            if (web_storage.get(_in[i])) {
              var buffer = web_storage.get(_in[i]).replace(/(\|)?\|(\|)?/g, safeReplace);
              web_storage.destroy(_in[i], _with.d, _with.i);
              web_storage.destroy(_in[i], _with.d, !_with.i);
              web_storage.set(_in[i], buffer, _with.l, _with.d, _with.i);
            }
          }

          // Update `session`
          if (web_storage.get(data.containers.session)) {
            web_storage.set(data.containers.session, data.pack.session(0), _with.l, _with.d, _with.i);
          }

          // Yay!
          web_storage.set(data.service.migrations, success, _with.l, _with.d, _with.i);

        } catch (err) {
          // Oops
          web_storage.set(data.service.migrations, fail, _with.l, _with.d, _with.i);
        }
      }
    }

  ]

};
