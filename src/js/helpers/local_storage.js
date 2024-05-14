"use strict";

var default_cookies = require('./cookies');
var local_storage_session_length = 0;

module.exports = Object.assign({}, default_cookies, {

  set: function(name, value, minutes, domain, excl_subdomains) {
    // Don't break the build
    domain = '';
    excl_subdomains = false;

    // `item` is an object which contains the original value
    // as well as the time when it's supposed to expire
    var item = {
      value: this.encodeData( value ),
      expiry: (new Date()).getTime() + ( Math.max( minutes, local_storage_session_length ) * 60 * 1000 ),
    };
    localStorage.setItem(name, JSON.stringify(item));
  },

  get: function(name) {
    var item_raw = localStorage.getItem(name);
    // if the item doesn't exist, return null
    if (!item_raw) {
      return null;
    }

    var item_str = JSON.parse(item_raw);
    // compare the expiry time of the item with the current time
    if ((new Date()).getTime() > item_str.expiry) {
      // If the item is expired, delete the item from storage
      // and return null
      localStorage.removeItem(name);
      return null;
    }

    return this.decodeData( item_str.value );
  },

  destroy: function(name, domain, excl_subdomains) {
    // Don't break the build
    domain = '';
    excl_subdomains = false;

    localStorage.removeItem(name);
  },

  setSessionLength: function( session_length ) {
    local_storage_session_length = session_length;
  },
});
