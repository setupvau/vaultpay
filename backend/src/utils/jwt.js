// src/utils/jwt.js
const jwt = require('jsonwebtoken');

const generateAccessToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
  });
};

const generateRefreshToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  });
};

const generateAdminToken = (payload) => {
  return jwt.sign(payload, process.env.ADMIN_JWT_SECRET, {
    expiresIn: '4h',  // Admins must re-login more often
  });
};

const verifyAccessToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET);
};

const verifyRefreshToken = (token) => {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
};

const verifyAdminToken = (token) => {
  return jwt.verify(token, process.env.ADMIN_JWT_SECRET);
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  generateAdminToken,
  verifyAccessToken,
  verifyRefreshToken,
  verifyAdminToken,
};
