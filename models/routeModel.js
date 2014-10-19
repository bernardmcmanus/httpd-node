module.exports = (function() {


    var mime = require( 'mime' );
    
    
    function RouteModel( reqPath , data ) {
        
        var that = this;
        var statusCode = data.code;
        var headers = data.headers || {};
        var body = data.body || '';

        switch (statusCode) {

            case 200:
                headers['Content-Type'] = mime.lookup( reqPath.absolute );
            break;

            case 302:
                body = '302 Found\n';
                headers['Location'] = reqPath.full;
                headers['Content-Type'] = 'text/plain';
            break;

            case 404:
                body = '404 Not Found\n';
                headers['Content-Type'] = 'text/plain';
            break;

            case 500:
                body = '500 Internal Server Error\n';
                headers['Content-Type'] = 'text/plain';
            break;
        }

        that.statusCode = statusCode;
        that.headers = headers;
        that.body = body;
    }


    return RouteModel;

    
}());



















