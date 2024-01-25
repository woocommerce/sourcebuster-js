"use strict";

var default_cookies = require('./cookies');

module.exports = Object.assign({}, default_cookies, {

  set: function(name, value, minutes, domain, excl_subdomains) {
    // Don't break the build
    excl_subdomains = minutes + domain + excl_subdomains;
    sessionStorage.setItem(this.encodeData(name), value);
  },

  get: function(name) {
    return sessionStorage.getItem(this.encodeData(name));
  },

  destroy: function(name, domain, excl_subdomains) {
    // Don't break the build
    domain = '';
    excl_subdomains = false;

    localStorage.removeItem(name);
  },

});
