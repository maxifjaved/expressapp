'use strict';

const express = require('express'),
	router = express.Router(),
	Joi = require('joi'),
	User = require('../user/usermodel').User,
	jwt = require('jsonwebtoken'),
	config = require('../../config/config'),
	ensureAuth = require('../middleware/authmiddleware').ensureAuth,
	logger = require('../../utils/logger');

const secret = config.SECRET;

var createToken = function (user) {
	let payload = {
		sub: user._id,
		iat: Math.floor(Date.now() / 1000) - 30,
		exp: Math.floor(Date.now() / 1000) + 86400000
	};
	return jwt.sign(payload, secret);
}

var invalidateToken = function (user) {
	let payload = {
		sub: user._id,
		iat: Math.floor(Date.now() / 1000) - 30,
		exp: Math.floor(Date.now() / 1000) - 30
	};
	return jwt.sign(payload, secret);
}

router.post('/auth/signup', validateRequestForSignup, function (req, res) {
	let newuser = new User(req.body);
	newuser.save(function (err) {
		if (err) {
			logger.error(err.stack);
			if (err.code === 11000) {
        let field = err.message.match(/dup key: { : "(.+)" }/)[1];
				return res.status(500).send({ message: `An account with email '${field}' already exists.` });
			}
			return res.status(500).send({ message: 'Internal Server Error' })
		}
		return res.status(200).send({ message: 'Signup successfully' })
	});
});

router.post('/auth/login', validateRequestForLogin, function (req, res) {
	User.findOne({ email: req.body.email.toLowerCase() }, '+password', function (err, foundUser) {
		if (err) {
			logger.error(err.stack);
			return res.status(500).send({ message: 'Internal Server Error' })
		}
		else {
			if (foundUser) {
				foundUser.comparePassword(req.body.password, function (err, isMatch) {
					if (!isMatch) {
						return res.status(200).send({ message: 'Wrong email and password' })
					}
					else {
						let sendData = {};
						sendData.userId = foundUser._id;
						sendData.fistname = foundUser.fistname;
						sendData.lastname = foundUser.lastname;
						sendData.email = foundUser.email;
						return res.status(200).send(
							{
								message: 'Login successfull',
								token: createToken(foundUser),
								data: sendData
							});
					}
				})
			}
			else {
				return res.status(200).send({ message: 'Wrong email and password' })
			}
		}
	})
})

router.post('/auth/logout', function (req, res) {
	ensureAuth(req, res, function (payload) {
		User.findById(payload.sub, function (err, existingUser) {
			if (err) {
				logger.error(err.stack);
				return res.status(500).send({ message: 'Internal Server Error' })
			}
			else {
				if (existingUser) {
					return res.status(200).send({ message: 'logged Out', token: invalidateToken(existingUser) });
				}
				return res.status(200).send({ message: 'Not a user' });
			}
		})
	})
});

module.exports = router;

function validateRequestForSignup(req, res, next) {
	let signupSchema = Joi.object().keys({
		firstname: Joi.string().min(3).max(30),
		lastname: Joi.string().min(3).max(30),
		email: Joi.string().email().required(),
		password: Joi.string().regex(/^[a-zA-Z0-9]{3,30}$/)
	});

	Joi.validate(req.body, signupSchema, function (err, value) {
		if (err) {
			logger.error(err.stack);
			return res.status(400).send({ message: 'Bad Request', error: err })
		}
		next();
	});
}

function validateRequestForLogin(req, res, next) {
	let loginSchema = Joi.object().keys({
		email: Joi.string().email().required(),
		password: Joi.string().regex(/^[a-zA-Z0-9]{3,30}$/)
	});

	Joi.validate(req.body, loginSchema, function (err, value) {
		if (err) {
			logger.error(err.stack);
			return res.status(400).send({ message: 'Bad Request', error: err })
		}
		next();
	});
}