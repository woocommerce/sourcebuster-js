var storageModule = null;

module.exports = {
	validateType: function( storage_type ) {
		// Default to valid_values[0] if storage_type is not in valid_values
		var valid_values = ['cookies', 'singleCookie', 'localStorage', 'sessionStorage'];
		return valid_values.indexOf( storage_type ) > -1 ? storage_type : valid_values[0];
	},
	set: function(module) {
		storageModule = this.validateType( module );
	},
	get: function() {
		return storageModule;
	}
};
