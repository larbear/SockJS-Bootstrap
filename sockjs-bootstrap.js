// Set this to the username you would like the server to run under
var username = "bootstrap";

// Set to true if you are going to use SSL and you have an SSL certificate
// If you use this, make sure you set the proper file names for your
// certificate files. Look for ssl.key and ssl.crt in this file.
var useSSL = true;

var
	fs = require( "fs" ),
	http = require( "http" ),
	https = require( "https" );


var
	express = require( "express" ),
	sockjs = require( "sockjs" ),
	Log = require( "log" ),
	moment = require( "moment" ),
	tinycolor = require( "tinycolor" ),
	commander = require( "commander" );

var 
	i = j = k = 0,
	startTime = Date.now();


//
// Main web server. Sockets are tied to this and one can
// also create express routers on this.
//
var web = express();



//
// Socket servers, one per port
//
var servers = [];


//
// Client list. Information about each client.
//
var clients = {};



//
// Socket list. This is the actual SockJS socket object
//
var sockets = {};



//
// Set up logging right away so we can log anything.
//
log = new Log( "info", fs.createWriteStream( "sockjs.log" ) );


//
// Set up the command line options.
//
commander 
	.version( "0.0.1" )
	.option( "-p, --ports [ports]", "Comma separated list of ports for server to listen on", "80" );

if ( useSSL ) { 
	commander.option( "-s, --secure [ports]", "Comma separated list of secure ports to listen on", "443" );
}

commander.parse( process.argv );



/***************************************************************************
   ____                             ____       _
  / ___|  ___ _ ____   _____ _ __  / ___|  ___| |_ _   _ _ __
  \___ \ / _ \ '__\ \ / / _ \ '__| \___ \ / _ \ __| | | | '_ \
   ___) |  __/ |   \ V /  __/ |     ___) |  __/ |_| |_| | |_) |
  |____/ \___|_|    \_/ \___|_|    |____/ \___|\__|\__,_| .__/
                                                        |_|
 ***************************************************************************/
(function() {
	var
		i = 0,
		server,           // http or https server
		socket_server,    // sock.js server
		ports, secure,
		sockjs_opts, ssl_opts;

	ports = commander.ports.split( "," );
	
	sockjs_opts = {
		sockjs_url : "http://cdn.sockjs.org/sockjs-0.3.min.js"
	};

			

	// Create non SSL servers
	for ( i = 0; i < ports.length; i += 1 ) {
		console.log( ( "Server binding to port " + ports[ i ] ).green );

		if ( process.getuid() !== 0 && ports[ i ] < 1024 ) {
			console.log( ( "Must run server as root for ports below 1024." ).red );
			process.exit( 1 );
		}

		server = http.createServer( web );
		server.listen( ports[ i ] );
		socket_server = sockjs.createServer( sockjs_opts );
		socket_server.installHandlers( server, { prefix : "/sockjs" } );
		servers.push( socket_server );
	}
		
	// Create SSL servers
	if ( useSSL ) {
		ssl_opts = {
			key : fs.readFileSync( "ssl.key" ),
			cert : fs.readFileSync( "ssl.crt" )
		};
		secure = commander.secure.split( "," );

		for ( i = 0; i < secure.length; i += 1 ) {
			console.log( ( "SSL Server binding to port " + secure[ i ] ).green );

			if ( process.getuid() !== 0 && secure[ i ] < 1024 ) {
				console.log( ( "Must run server as root for ports below 1024." ).red );
				process.exit( 1 );
			}

			server = https.createServer( ssl_opts, web );
			server.listen( secure[ i ] );
			socket_server = sockjs.createServer( sockjs_opts );
			socket_server.installHandlers( server, { prefix : "/sockjs" } );
			servers.push( socket_server );
		}
	}
		
})();


// Remove root priveleges after ports have been setup.
if ( process.getuid() === 0 ) {
	process.setuid( username );
}



/***************************************************************************
   ____             _
  |  _ \ ___  _   _| |_ ___ _ __ ___
  | |_) / _ \| | | | __/ _ \ '__/ __|
  |  _ < (_) | |_| | ||  __/ |  \__ \
  |_| \_\___/ \__,_|\__\___|_|  |___/

 ***************************************************************************/

web.get( "/", function( req, res ) {
	res.send( "SockJS Bootstrap" );
});



/***************************************************************************
   ____             _        _     _____                 _
  / ___|  ___   ___| | _____| |_  | ____|_   _____ _ __ | |_ ___
  \___ \ / _ \ / __| |/ / _ \ __| |  _| \ \ / / _ \ '_ \| __/ __|
   ___) | (_) | (__|   <  __/ |_  | |___ \ V /  __/ | | | |_\__ \
  |____/ \___/ \___|_|\_\___|\__| |_____| \_/ \___|_| |_|\__|___/

 ***************************************************************************/

var bindSocket = function( server ) {
	server.on( "connection", function( socket ) {
		if ( ! socket ) return;

		sockets[ socket.id ] = socket;
		clients[ socket.id ] = {
			id : socket.id,
			connected : moment().format( "MMMM Do YYYY, h:mm:ss a" ),
			activity : Date.now()
		};


		socket.on( "data", function( data ) {

			// Update activity indicator, indicating socket is still active
			if ( clients.hasOwnProperty( socket.id ) ) {
				clients[ socket.id ].activty = Date.now();
				clients[ socket.id ].lastActive = moment().format( "MMMM Do YYYY, h:mm:ss a" );
			}
		} );


		socket.on( "close", function() {

			// Free's memory!
			socket.removeAllListeners();
			
			if ( cients.hasOwnProperty( this.id ) ) {
				delete clients[ this.id ];
			}

			if ( sockets.hasOwnProperty( this.id ) ) {
				delete sockets[ this.id ];
			}
		} );
	} );
}

for ( i = 0; i < servers.length; i++ ) {
	bindSocket( servers[ i ] );
}

//
// This is the sad part. We don't know why it's needed, but if
// it's not here, connections will get stuck for a very long
// time, maybe forever.
//
// Cleans unused SockJS connections. 
//
setInterval(function() {
	var 
		id,
		expires = Date.now() - 900000;

	for ( id in sockets ) {
		if ( clients[ id ].activity < expires ) {
			sockets[ id ].close();
		}
	}
}, 90432);
