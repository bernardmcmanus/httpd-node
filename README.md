httpd-node
==========

A super simple HTTPD server for node.js

Installation
-----

	npm install httpd-node

Usage
-----

### Standalone

    npm start

### Module

    var httpd = require( 'httpd-node' );

    var server = new httpd();

	server.start();

	server.use(function( request , response , data ) {
		// do stuff here
	});