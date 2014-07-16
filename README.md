node-httpd
==========

A super simple HTTPD server for node.js

Installation
-----

	npm install node-httpd

Usage
-----

### Standalone

    npm start

### Module

    var httpd = require( 'node-httpd' );

    var server = new httpd();

	server.start();

	server.use(function( request , response , data ) {
		// do stuff here
	});