httpd-node
==========

#### A super simple HTTPD server for node.js

Overview
-----

__httpd-node__ is a simple HTTPD that includes support for ssl and multiple subdomains.

Installation
-----

	npm install httpd-node

Usage
-----

### Standalone

    npm start
    
The standalone config can be found in [standalone.js](standalone.js).

### Requiring

```javascript
var httpd = require( 'httpd-node' );
```

### Setting Up the Environment

```javascript
httpd.environ( 'root' , '/path/to/your/public/directory' );
```

### Creating an Instance

An options object can be passed to the httpd constructor:

```javascript
var server = new httpd( options );
```

| Parameter | Type | Default | Description |
| --------- | ---- | ------- | ----------- |
| `port` | `Integer` | `8888` | The port for this instance. |
| `index` | `String` | `'index.html'` | The name of the file that should be served when a directory is requested. |
| `verbose` | `Boolean` | `true` | When verbose is true, the http response code and request path will be logged to the console. |
| `ssl` | `Object` | `null` | An object containing paths to ssl .key and .cert files |

Examples
-----

First, require httpd and setup your environment:

```javascript
var httpd = require( 'httpd-node' );
httpd.environ( 'root' , '/path/to/your/public/directory' );
```

### Basic

Assuming your public directory contains a www directory, all you need to get started is:

```javascript    
var server = new httpd();
server.start();
```

### Subdomains

Point yourdomain.com and rad.yourdomain.com to different directories:

```javascript
var server = new httpd();

server.setHttpDir( 'default' , '/cool' );
server.setHttpDir( 'rad' , '/rad' );

server.start();
```

### SSL

HTTPS on port 8080:

```javascript
var server = new httpd({
    port: 8080,
    ssl: {
        key: '/absolute/path/to/ssl/key.key',
        cert: '/absolute/path/to/ssl/cert.crt'
    }
});

server.start();
```

Methods
-----

### server.setHttpDir
- Adds a new http directory and subdomain. The default directory is `/www`.

```javascript
server.setHttpDir( 'www' , '/www' );
server.setHttpDir( 'cdn' , '/cdn' );

// to override the default
server.setHttpDir( 'default' , '/some_other_path' );
```

### server.use
- Adds a callback that will be executed before the response is sent.
- `data` is an object containing subdomain, httpRoot, and request path.

```javascript
server.use(function( request , response , data ) {
    // do stuff here
});
```

### server.environ
- Same as [httpd.environ](#setting-up-the-environment), but sets the environment for the server instance rather than the default httpd environment.

```javascript
server.environ( 'root' , '/path/to/your/public/directory' );
```

### server.start
- Starts the httpd instance.

```javascript
server.start();
```
