/**************************************************************************
 * Copyright © 2026 Bangladeshi Software Ltd. All rights reserved.
 * Distributed under the license terms specified in this repository.
 *
 * ORIGINAL AUTHOR: Muhammad Nasim (Developer)
 **************************************************************************/

const jwt = require('jsonwebtoken');

// Core token verifier
function verifyToken(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer '))
    return res
      .status(401)
      .json({ error: 'Authorization header missing or malformed' });

  const token = header.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError')
      return res
        .status(401)
        .json({ error: 'Token expired. Please login again.' });
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// Role guard factory
function requireRoles(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    if (!roles.includes(req.user.role))
      return res.status(403).json({
        error: `Access denied. Required role: ${roles.join(' or ')}`,
      });

    next();
  };
}

// Attach named guards as properties
verifyToken.admin = requireRoles('ADMIN');
verifyToken.merchant = requireRoles('MERCHANT');
verifyToken.roles = requireRoles;

module.exports = verifyToken;
