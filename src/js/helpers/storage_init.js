var storage_module = null;
var local_storage = require('./local_storage'),
	session_storage = require('./session_storage'),
	cookies       = require('./cookies');

module.exports = {
	validateType: function( storage_type ) {
		// Default to valid_values[0] if storage_type is not in valid_values
		var valid_values = ['cookies', 'singleCookie', 'localStorage', 'sessionStorage'];
		return valid_values.indexOf( storage_type ) > -1 ? storage_type : valid_values[0];
	},
	set: function( storage_type ) {
		storage_type = this.validateType( storage_type );
		switch ( storage_type ) {
			case 'singleCookie':
				storage_module = cookies;
				break;
			case 'localStorage':
				storage_module = local_storage;
				break;
			case 'sessionStorage':
				storage_module = session_storage;
				break;
			case 'cookies':
			default:
				storage_module = cookies;
		}
	},
	get: function() {
		return storage_module;
	}
};
