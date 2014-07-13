(function() {


	var util = require( 'util' );
	var http = require( 'http' );
	var url = require( 'url' );
	var fs = require( 'fs' );
	var mime = require( 'mime' );


	var Config = {
		protocol: 'http',
		port: 8888,
		httpRoot: {
			default: __dirname + '/public/www',
			www: __dirname + '/public/www'
		},
		index: 'index.html'
	};


	function handleRequest( request , response ) {

		var httpRoot = getHttpRoot( request );
		var pathname = url.parse( request.url ).pathname;

		serve( httpRoot , pathname , function( code , args ) {

			args = ([ response ]).concat( args || [] );

			try {
				handleCode[ code ].apply( null , args );
			}
			catch (err) {
				util.puts( err );
				handleCode[ 500 ]( response );
			}
		});
	}


	function getHttpRoot( request ) {
		var subdomain = request.headers.host.split( '.' );
		return Config.httpRoot[subdomain[0]] || Config.httpRoot.default;
	}


	function serve( httpRoot , path , callback ) {

		util.puts( path );

		if (!(/(\/$)|(\.[0-9a-z]+$)/i).test( path )) {
			path += '/';
			return callback( 302 , [ path ] );
		}

		path = httpRoot + path;

		if ((/\/$/).test( path )) {
			path = getIndex( path );
		}

		if (!fs.existsSync( path )) {
			return callback( 404 );
		}

		var stats = fs.statSync( path );

		if (stats.isDirectory()) {
			return callback( 401 );
		}

		fs.readFile(( path ) , function ( err , content ) {
			if (err) {
				callback( 500 );
			}
			else {

				var data = {
					size: stats.size,
					mime: mime.lookup( path ),
					modified: new Date( stats.mtime ).toUTCString()
				};

				callback( 200 , [ content , data ] );
			}
		});
	}


	function getIndex( path ) {
		if (Config.index && fs.existsSync( path + Config.index )) {
			return path + Config.index;
		}
		return path;
	}


	var handleCode = {

		200: function( response , content , data ) {
			response.writeHead( 200 , {
				'Content-Type': data.mime,
				'Content-Length': data.size,
				'Last-Modified': data.modified
			});
			response.end( content );
		},

		302: function( response , location ) {
			response.writeHead( 302 , {
				'Location': location
			});
			response.end();
		},

		401: function( response ) {
			response.writeHead( 401 , {
				'Content-Type': 'text/plain'
			});
			response.end( '401 Unauthorized\n' );
		},

		404: function( response ) {
			response.writeHead( 404 , {
				'Content-Type': 'text/plain'
			});
			response.end( '404 Not Found\n' );
		},

		500: function( response ) {
			response.writeHead( 500 , {
				'Content-Type': 'text/plain'
			});
			response.end( '500 Internal Server Error\n' );
		}
	};


	http.createServer( handleRequest ).listen( Config.port );
	util.puts( 'server running at ' + Config.protocol + '://localhost:' + ( Config.port ) + '/' );


}());



















