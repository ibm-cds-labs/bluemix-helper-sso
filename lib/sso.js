//-------------------------------------------------------------------------------
// Copyright IBM Corp. 2015
//
// Licensed under the Apache License, Version 2.0 (the 'License');
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an 'AS IS' BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//-------------------------------------------------------------------------------

'use strict';

/**
 * CDS sso module
 * 
 * @author David Taieb
 */

var express = require('express');
var passport = require('passport');
var session = require('express-session');
var openIDConnectStrategy = require('./idaas/strategy');
var global = require('bluemix-helper-config").global;
var _ = require('lodash');

/**
 * Configure the app to add security based on the ssoService
 */
module.exports = function( app, ssoService ){
	app.use(session({ secret: 'keyboard cat' }));
	app.use(passport.initialize());
	app.use(passport.session()); 
	
	passport.serializeUser(function(user, done) {
		done(null, user);
	}); 

	passport.deserializeUser(function(obj, done) {
		done(null, obj);
	});

	var strategy = new openIDConnectStrategy({
		authorizationURL : ssoService.credentials.authorizationEndpointUrl,
		tokenURL : ssoService.credentials.tokenEndpointUrl,
		clientID : ssoService.credentials.clientId,
		scope: 'openid',
		response_type: 'code',
		clientSecret : ssoService.credentials.secret,
		callbackURL : global.getHostUrl() + "/auth/sso/callback",
		skipUserProfile: true,
		issuer: ssoService.credentials.issuerIdentifier
		}, function(accessToken, refreshToken, profile, done) {
			process.nextTick(function() {
				profile.accessToken = accessToken;
				profile.refreshToken = refreshToken;
				done(null, profile);
			})
		}
	);

	passport.use(strategy); 
	app.get('/login', passport.authenticate('openidconnect', {})); 
	
	app.get('/logout', function( req, res, next ){
		req.session.destroy(function (err) {
			//Clear the cookies too
			_.forEach( req.cookies, function( value, key ){
				console.log("cookie name :" + key + " Cookie value: " + value); 
				res.clearCookie( key );
			});
			res.redirect('https://idaas.ng.bluemix.net/idaas/protected/logout.jsp');
		});
	});
	
	app.get("/userid", function( req, res,next){
		res.send( (req.user && req.user.id) || "");
	});
	
	app.get('/auth/sso/callback',function(req,res,next) {
		passport.authenticate('openidconnect',{
			successRedirect: '/',                            
			failureRedirect: '/loginfailure',                        
		})(req,res,next);
	});

	function ensureAuthenticated(req, res, next) {
		if ( req.url.indexOf("/auth") == 0 || req.url.indexOf("/login") == 0 ){
			//auth and login should always go through
			return next();
		}
		if(!req.isAuthenticated()) {
			req.session.originalUrl = req.originalUrl;
			res.redirect('/login');
		} else {
			return next();
		}
	}
	
	//Authenticate all requests
	app.use(ensureAuthenticated);
	
}