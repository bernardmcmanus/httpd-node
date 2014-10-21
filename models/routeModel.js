module.exports = (function() {
    
    
    function RouteModel( statusCode , data ) {

        data = data || {};
        
        var that = this;
        var headers = data.headers || {};
        var body = data.body || '';

        switch (statusCode) {

            case 302:
                body = body || '302 Found\n';
                headers['Content-Type'] = headers['Content-Type'] || 'text/plain';
            break;

            case 404:
                body = body || '404 Not Found\n';
                headers['Content-Type'] = headers['Content-Type'] || 'text/plain';
            break;

            case 500:
                body = body || '500 Internal Server Error\n';
                headers['Content-Type'] = headers['Content-Type'] || 'text/plain';
            break;
        }

        that.statusCode = statusCode;
        that.headers = headers;
        that.body = body;
    }


    return RouteModel;

    
}());



















