"use strict";

var single_cookie = null;
var data = require('../data'),
    default_cookies = require('./cookies');

module.exports = Object.assign({}, default_cookies, {

  set: function(name, value, minutes, domain, excl_subdomains) {
    if( ! single_cookie ) {
      this.load();
    }
    // Don't break the build
    domain = '';
    excl_subdomains = false;

    // Set an expiration for the values
    if( name === data.containers.session ) {
      value += data.delimiter + data.aliases.single_expire + '=' + (Math.floor(Date.now() / 1000) + minutes * 60);
    }
    single_cookie[default_cookies.unsbjs(name)] = value;
  },

  get: function(name) {
    if( ! single_cookie ) {
      this.load();
    }

    // Simulate checking session expiration
    if( name === data.containers.session ) {
      var session = single_cookie[default_cookies.unsbjs(name)];
      if( session ) {
        var sts = session.match(/sts=(\d+)/);
        if( sts && Math.floor(Date.now() / 1000) > parseInt(sts[1]) ) {
          delete single_cookie[default_cookies.unsbjs(name)];
          return null;
        }
      }
    }
    return single_cookie[default_cookies.unsbjs(name)] || default_cookies.get(name);
  },

  load: function() {
    var retrieved_cookie = default_cookies.get(data.containers.single);
    if( ! retrieved_cookie ) {
      single_cookie = {};
      return;
    }
    try {
      single_cookie = JSON.parse(retrieved_cookie);
    } catch (error) {
      single_cookie = {};
    }
  },

  save: function( lifetime, domain, isolate ) {
    default_cookies.set(data.containers.single, JSON.stringify(single_cookie), lifetime, domain, isolate);
  },

  deleteOld: function( domain, isolate ) {
    var deleted_old = single_cookie['do'] !== undefined;
    single_cookie['do'] = 1;

    if( ! deleted_old ) {
      var old_cookies = Object.keys(data.containers).map(function (key) {
        return data.containers[key];
      });
      for (var prop in data.service) {
        if (data.service.hasOwnProperty(prop)) {
          old_cookies.push(data.service[prop]);
        }
      }

      // Delete all instances of data.containers.single in old_cookies
      var val_remove = data.containers.single;
      var index = old_cookies.indexOf(val_remove);
      while (index !== -1) {
        old_cookies.splice(index, 1);
        index = old_cookies.indexOf(val_remove);
      }
      for (var i = 0; i < old_cookies.length; i++) {
        default_cookies.set(old_cookies[i], '', -1, domain, isolate);
      }
    }

  }
});
