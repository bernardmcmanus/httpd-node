module.exports = (function() {


	function RequestPath( relative , httpRoot ) {
		
		var that = this;

		that.original = relative;
		that.relative = relative;
		that.httpRoot = httpRoot;
		
		Object.defineProperty( that , 'absolute' , {
			get: function() {
				return that.httpRoot + that.relative;
			}
		});
	}


	RequestPath.prototype = {

		modify: function( relative ) {
			this.relative = relative;
		},
		
		append: function( extra ) {
			this.relative += extra;
		}
	};


	return RequestPath;


}());



















