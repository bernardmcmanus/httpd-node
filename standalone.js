(function() {

	var httpd = require( './index.js' );

	var server = new httpd();

	server.use(function( request , response , data ) {
		console.log(data);
	});

	server.start();

}());



















