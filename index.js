module.exports = (function() {


	var util = require( 'util' );
	var http = require( 'http' );
	var https = require( 'https' );
	var Url = require( 'url' );
	var fs = require( 'fs' );
	var mime = require( 'mime' );
	var Codes = require( './lib/codes' );
	var RequestPath = require( './lib/requestPath' );


	var Environ = {
		root: __dirname
	};


	function Config() {
		return {
			protocol: 'http',
			port: 8888,
			index: 'index.html',
			verbose: true,
			ssl: null
		};
	}


	function HTTPD() {

		var that = this;
		var options = (typeof arguments[0] === 'object' ? pop( arguments ) : {});
		//var callback = (typeof arguments[0] === 'function' ? pop( arguments ) : function() {});

		that._environ = Object.create( Environ );

		var config = new Config();
		var keys = Object.keys( config );

		keys.forEach(function( key ) {
			that[key] = (options[key] !== undefined ? options[key] : config[key]);
		});

		Codes.forEach(function( handler , code ) {
			that[code] = handler;
		});

		if (that.ssl) {
			that.protocol = 'https';
			that.port = (that.port === 80 && !options.port ? 443 : that.port);
			that.ssl = that._getSSLCerts( that.ssl.key , that.ssl.cert );
		}

		var httpRoot = options.httpRoot ? Object.create( options.httpRoot ) : {};

		Object.defineProperty( that , 'httpRoot' , {
			get: function() {
				return httpRoot;
			}
		});

		var toUse = [];

		Object.defineProperty( that , 'toUse' , {
			get: function() {
				return toUse;
			}
		});

		var validIndexes = {};

		Object.defineProperty( that , 'validIndexes' , {
			get: function() {
				return validIndexes;
			}
		});

		// add the default httpRoot
		that.setHttpDir( 'default' , '/www' );
	}


	HTTPD.Environ = function( key , value ) {
		Environ[key] = value;
	};


	HTTPD.prototype = {

		environ: function( key , value ) {
			this._environ[key] = value;
			return this;
		},

		setHttpDir: function( domain , value ) {
			this.httpRoot[domain] = value;
			return this;
		},

		_getSSLCerts: function( key , cert ) {
			return {
				key: fs.readFileSync( key ),
				cert: fs.readFileSync( cert )
			};
		},

		start: function() {
			
			var that = this;

			if (that.ssl) {
				https.createServer( that.ssl , function() {
					that._handle.apply( that , arguments );
				}).listen( that.port );
			}
			else {
				http.createServer(function() {
					that._handle.apply( that , arguments );
				}).listen( that.port );
			}

			util.puts( 'server running at ' + that.protocol + '://localhost:' + ( that.port ) + '/' );

			return that;
		},

		use: function( handler ) {
			this.toUse.push( handler );
			return this;
		},

		getHttpRoot: function( subdomain ) {

			var that = this;
			var root = that._environ.root;

			if (typeof that.httpRoot === 'string') {
				return root + that.httpRoot;
			}

			var httpRoot = (that.httpRoot[subdomain] || that.httpRoot.default);

			if (typeof httpRoot === 'function') {
				return httpRoot( root );
			}
			else {
				return root + httpRoot;
			}			
		},

		_handle: function( request , response ) {

			var that = this;
			var subdomain = that._getSubdomain( request );
			var httpRoot = that.getHttpRoot( subdomain );
			var path = that._getPath( request.url , httpRoot );

			var data = {
				subdomain: subdomain,
				httpRoot: httpRoot,
				path: path.relative
			};

			that.toUse.forEach(function( handler ) {
				handler( request , response , data );
			});

			that._serve( path , function( code , args ) {

				if (that.verbose) {
					util.puts( code + ' -> ' + path.original );
				}

				args = ([ response ]).concat( args || [] );

				try {
					that[ code ].apply( null , args );
				}
				catch (err) {
					util.puts( err );
					that[ 500 ]( response );
				}
			});
		},

		_serve: function( path , callback ) {

			var that = this;

			if (pointsToDirectory( path.relative )) {
				path.append( '/' );
				return callback( 302 , [ path.relative ]);
			}

			if (pointsToIndex( path.relative )) {
				path.modify(
					that._getIndex( path )
				);
			}

			if (!fs.existsSync( path.absolute )) {
				return callback( 404 );
			}

			var stats = fs.statSync( path.absolute );

			if (stats.isDirectory()) {
				return callback( 401 );
			}

			fs.readFile( path.absolute , function ( err , content ) {

				if (err) {
					callback( 500 );
				}
				else {

					var data = {
						size: stats.size,
						mime: mime.lookup( path.absolute ),
						modified: new Date( stats.mtime ).toUTCString()
					};

					callback( 200 , [ content , data ]);
				}
			});
		},

		_getPath: function( url , httpRoot ) {
			var relative = Url.parse( url ).pathname;
			return new RequestPath( relative , httpRoot );
		},

		_getSubdomain: function( request ) {
			var arr = request.headers.host.split( '.' );
			return (arr.length < 2 ? '' : arr[0]);
		},

		_getIndex: function( path ) {

			var that = this;
			var relative = path.relative;
			var absolute = path.absolute;

			if (that.validIndexes[absolute]) {
				return relative + that.index;
			}
			
			if (that.index && fs.existsSync( absolute + that.index )) {
				that.validIndexes[absolute] = that.index;
				return relative + that.index;
			}

			return relative;
		}
	};


	function pop( subject ) {
		return Array.prototype.pop.call( subject );
	}


	function pointsToDirectory( path ) {
		return (/(\/$)|(\.[0-9a-z]+$)/i).test( path ) === false;
	}


	function pointsToIndex( path ) {
		return (/\/$/).test( path );
	}


	return HTTPD;


}());



















