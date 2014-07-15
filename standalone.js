(function() {

	var httpd = require( './index.js' );

	httpd.Environ( 'dirname' , __dirname );

	var server = new httpd({
		port: 8889
	});

	server.start();

	server.use(function( request , response , data ) {
		console.log(data);
	});

	console.log(server);

}());



















