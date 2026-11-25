const express = require('express');
const passport = require('passport');
const router = express.Router();
const { login, getMe, googleCallback } = require('../controllers/authController');
const { auth } = require('../middleware/auth');

router.post('/login', login);
router.get('/me', auth, getMe);

router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/google/callback', passport.authenticate('google', { failureRedirect: '/login' }), googleCallback);

module.exports = router;
