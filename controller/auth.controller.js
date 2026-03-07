const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../config/db');
const { sendOTPEmail } = require('../services/email.service');
const { logActivity } = require('./activity.controller');

const OTP_EXPIRY_MINUTES = 10;
const SALT_ROUNDS = 12;

// ── helpers ──────────────────────────────────────────────────
function maskEmail(email) {
  if (!email) return null;
  const [local, domain] = email.split('@');
  return `${local.slice(0, 2)}${'*'.repeat(Math.max(local.length - 2, 3))}@${domain}`;
}

function generateOTP() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function signToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  });
}

function signRefreshToken(payload) {
  return jwt.sign(
    payload,
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET + '_refresh',
    {
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    },
  );
}

function safeUser(user) {
  const { password, otp, otp_expires_at, ...safe } = user;
  return safe;
}

exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password)
      return res
        .status(400)
        .json({ error: 'Username/email and password are required' });

    // Find user by username OR email
    const [rows] = await pool.execute(
      `SELECT u.*, m.display_name AS merchant_name
       FROM users u
       LEFT JOIN merchant m ON u.merchant_id = m.id
       WHERE (u.username = ? OR u.email = ?)
       LIMIT 1`,
      [username, username],
    );

    const user = rows[0];

    // Generic error — don't reveal whether user exists
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    if (!user.is_active)
      return res
        .status(403)
        .json({ error: 'Account is deactivated. Contact administrator.' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    // Generate OTP
    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    await pool.execute(
      `UPDATE users SET otp = ?, otp_expires_at = ? WHERE id = ?`,
      [otp, otpExpiry, user.id],
    );

    // Dev mode — print OTP to console
    if (process.env.NODE_ENV !== 'production') {
      console.log(`🔑 [DEV] OTP for ${user.username}: ${otp}`);
    }
    // send email.
    let emailSent = false;
    if (user.email) {
      try {
        await sendOTPEmail({
          to: user.email,
          username: user.username,
          otp,
        });
        emailSent = true;
        console.log(`[AUTH] OTP sent to ${user.email}`);
      } catch (emailErr) {
        return res.status(400).json({ message: emailErr });
        console.error(`[AUTH] Email failed: ${emailErr.message}`);
        if (process.env.NODE_ENV !== 'production') {
          console.log(`🔑 [DEV] OTP for ${user.username}: ${otp}`);
        }
      }
    } else {
      console.warn(`⚠️ [AUTH] No email for user ${user.username}`);
      if (process.env.NODE_ENV !== 'production') {
        console.log(`🔑 [DEV] OTP for ${user.username}: ${otp}`);
      }
    }
    // send email.
    // TODO (production): send OTP via email / SMS using your mail service

    return res.json({
      emailSent,
      otp_required: true,
      email_hint: maskEmail(user.email),
      username: user.username,
      expires_in: `${OTP_EXPIRY_MINUTES} minutes`,
    });
  } catch (err) {
    console.error('[AUTH] login error:', err);
    return res.status(500).json({ error: err });
  }
};

exports.verifyOtp = async (req, res) => {
  try {
    const { username, otp } = req.body;

    if (!username || !otp)
      return res.status(400).json({ error: 'Username and OTP are required' });

    const [rows] = await pool.execute(
      `SELECT u.*, m.display_name AS merchant_name,
              (u.otp_expires_at IS NOT NULL AND u.otp_expires_at < NOW()) AS is_expired
       FROM users u
       LEFT JOIN merchant m ON u.merchant_id = m.id
       WHERE (u.username = ? OR u.email = ?) AND u.is_active = 1 AND u.otp = ?
       LIMIT 1`,
      [username, username, otp],
    );

    const user = rows[0];

    if (!user) return res.status(401).json({ error: 'Invalid OTP' });

    if (user.is_expired) {
      // Clear expired OTP
      await pool.execute(
        `UPDATE users SET otp = NULL, otp_expires_at = NULL WHERE id = ?`,
        [user.id],
      );
      return res
        .status(401)
        .json({ error: 'OTP has expired. Please login again.' });
    }

    // Clear OTP + update last_login
    await pool.execute(
      `UPDATE users SET otp = NULL, otp_expires_at = NULL, last_login = NOW() WHERE id = ?`,
      [user.id],
    );

    const tokenPayload = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      merchant_id: user.merchant_id,
    };

    const token = signToken(tokenPayload);
    const refreshToken = signRefreshToken({ id: user.id });
    try {
      await logActivity(req, {
        user_id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        merchant_id: user.merchant_id || null,
        merchant_name: user.display_name || null,
        action: 'LOGIN',
        status: 'SUCCESS',
      });
    } catch (error) {
      null;
    }
    return res.json({
      token,
      refresh_token: refreshToken,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        full_name: user.full_name,
        phone: user.phone,
        role: user.role,
        merchant_id: user.merchant_id,
        merchant_name: user.merchant_name,
        last_login: user.last_login,
      },
    });
  } catch (err) {
    console.error('[AUTH] verifyOtp error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

exports.refresh = async (req, res) => {
  try {
    const { refresh_token } = req.body;
    if (!refresh_token)
      return res.status(400).json({ error: 'Refresh token required' });

    let decoded;
    try {
      decoded = jwt.verify(
        refresh_token,
        process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET + '_refresh',
      );
    } catch {
      return res
        .status(401)
        .json({ error: 'Invalid or expired refresh token' });
    }

    // Re-fetch user to ensure still active
    const [rows] = await pool.execute(
      `SELECT id, username, email, role, merchant_id, is_active FROM users WHERE id = ? LIMIT 1`,
      [decoded.id],
    );

    const user = rows[0];
    if (!user || !user.is_active)
      return res.status(401).json({ error: 'User not found or deactivated' });

    const token = signToken({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      merchant_id: user.merchant_id,
    });

    return res.json({ token });
  } catch (err) {
    console.error('[AUTH] refresh error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

exports.logout = async (req, res) => {
  // Optional: log the logout event to activity_logs
  try {
    if (req.user?.id) {
      await pool
        .execute(`UPDATE users SET updated_at = NOW() WHERE id = ?`, [
          req.user.id,
        ])
        .catch(() => {}); // non-fatal
    }
  } catch {}
  return res.json({ message: 'Logged out successfully' });
};

exports.getMe = async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT u.id, u.username, u.email, u.full_name, u.phone,
              u.role, u.is_active, u.merchant_id, u.last_login,
              u.created_at,
              m.display_name AS merchant_name,
              m.id_type, m.id_value, m.status AS merchant_status
       FROM users u
       LEFT JOIN merchant m ON u.merchant_id = m.id
       WHERE u.id = ?
       LIMIT 1`,
      [req.user.id],
    );

    if (!rows[0]) return res.status(404).json({ error: 'User not found' });

    return res.json({ data: rows[0] });
  } catch (err) {
    console.error('[AUTH] getMe error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};


exports.updateMe = async (req, res) => {
  try {
    const { full_name, phone } = req.body;

    await pool.execute(
      `UPDATE users SET full_name = ?, phone = ?, updated_at = NOW() WHERE id = ?`,
      [full_name || null, phone || null, req.user.id],
    );

    return res.json({ message: 'Profile updated successfully' });
  } catch (err) {
    console.error('[AUTH] updateMe error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};


exports.changePassword = async (req, res) => {
  try {
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password)
      return res
        .status(400)
        .json({ error: 'Current password and new password are required' });

    // Fetch current hash
    const [rows] = await pool.execute(
      `SELECT id, password FROM users WHERE id = ? LIMIT 1`,
      [req.user.id],
    );
    const user = rows[0];
    if (!user) return res.status(404).json({ error: 'User not found' });

    const valid = await bcrypt.compare(current_password, user.password);
    if (!valid)
      return res.status(401).json({ error: 'Current password is incorrect' });

    const hashed = await bcrypt.hash(new_password, SALT_ROUNDS);

    await pool.execute(
      `UPDATE users SET password = ?, updated_at = NOW() WHERE id = ?`,
      [hashed, user.id],
    );

    return res.json({ message: 'Password changed successfully' });
  } catch (err) {
    console.error('[AUTH] changePassword error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

exports.getUsers = async (req, res) => {
  try {
    // ADMIN only
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Access denied. ADMIN only.' });
    }

    // Query params
    const { search, role, is_active, page = 1, per_page = 20 } = req.query;

    // Sanitize pagination
    const parsedPerPage = parseInt(per_page, 10);
    const parsedPage = parseInt(page, 10);

    const limit = Math.min(
      Math.max(isNaN(parsedPerPage) ? 20 : parsedPerPage, 1),
      100,
    );
    const currentPage = Math.max(isNaN(parsedPage) ? 1 : parsedPage, 1);
    const offset = (currentPage - 1) * limit;

    // Dynamic filters
    const conditions = [];
    const params = [];

    if (search) {
      conditions.push(
        `(u.username LIKE ? OR u.email LIKE ? OR u.full_name LIKE ?)`,
      );
      const like = `%${search}%`;
      params.push(like, like, like);
    }

    if (role) {
      conditions.push(`u.role = ?`);
      params.push(role.toUpperCase());
    }

    if (is_active !== undefined && is_active !== '') {
      const activeValue = parseInt(is_active, 10);
      if (!isNaN(activeValue)) {
        conditions.push(`u.is_active = ?`);
        params.push(activeValue);
      }
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    // -----------------------
    // COUNT QUERY
    // -----------------------
    const [countRows] = await pool.execute(
      `SELECT COUNT(*) AS total
       FROM users u
       ${where}`,
      params,
    );

    const total = countRows[0]?.total || 0;

    // -----------------------
    // DATA QUERY
    // IMPORTANT FIX:
    // LIMIT/OFFSET inlined
    // -----------------------
    const [rows] = await pool.execute(
      `SELECT u.id,
              u.username,
              u.email,
              u.full_name,
              u.phone,
              u.role,
              u.is_active,
              u.merchant_id,
              u.last_login,
              u.created_at,
              m.display_name AS merchant_name
       FROM users u
       LEFT JOIN merchant m ON u.merchant_id = m.id
       ${where}
       ORDER BY u.created_at DESC
       LIMIT ${limit} OFFSET ${offset}`,
      params,
    );

    return res.json({
      data: rows,
      pagination: {
        total,
        total_pages: Math.ceil(total / limit),
        current_page: currentPage,
        per_page: limit,
      },
    });
  } catch (err) {
    console.error('[AUTH] getUsers error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

exports.createUser = async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN')
      return res.status(403).json({ error: 'Access denied. ADMIN only.' });

    const { username, email, password, full_name, phone, merchant_id, role } =
      req.body;

    if (!username || !email || !password || !merchant_id)
      return res
        .status(400)
        .json({ error: 'username, email, password, merchant_id are required' });

    if (password.length < 8)
      return res
        .status(400)
        .json({ error: 'Password must be at least 8 characters' });

    // Validate role
    const validRoles = ['ADMIN', 'MERCHANT'];
    const userRole = (role || 'MERCHANT').toUpperCase();
    if (!validRoles.includes(userRole))
      return res
        .status(400)
        .json({ error: `Role must be one of: ${validRoles.join(', ')}` });

    // Validate merchant exists
    const [merchantRows] = await pool.execute(
      `SELECT id FROM merchant WHERE id = ? LIMIT 1`,
      [merchant_id],
    );
    if (!merchantRows[0])
      return res.status(400).json({ error: 'Merchant not found' });

    const hashed = await bcrypt.hash(password, SALT_ROUNDS);
    const id = uuidv4();

    await pool.execute(
      `INSERT INTO users (id, username, email, password, full_name, phone, merchant_id, role)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        username,
        email,
        hashed,
        full_name || null,
        phone || null,
        merchant_id,
        userRole,
      ],
    );

    return res.status(201).json({
      message: 'User created successfully',
      data: {
        id,
        username,
        email,
        full_name,
        phone,
        merchant_id,
        role: userRole,
      },
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY')
      return res
        .status(409)
        .json({ error: 'Username or email already exists' });
    console.error('[AUTH] createUser error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

exports.updateUser = async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN')
      return res.status(403).json({ error: 'Access denied. ADMIN only.' });

    const { id } = req.params;
    const { full_name, phone, role, is_active, merchant_id } = req.body;

    // Cannot deactivate yourself
    if (id === req.user.id && is_active === 0)
      return res
        .status(400)
        .json({ error: 'Cannot deactivate your own account' });

    const fields = [];
    const values = [];

    if (full_name !== undefined) {
      fields.push('full_name = ?');
      values.push(full_name);
    }
    if (phone !== undefined) {
      fields.push('phone = ?');
      values.push(phone);
    }
    if (role !== undefined) {
      fields.push('role = ?');
      values.push(role.toUpperCase());
    }
    if (is_active !== undefined) {
      fields.push('is_active = ?');
      values.push(parseInt(is_active));
    }
    if (merchant_id !== undefined) {
      fields.push('merchant_id = ?');
      values.push(merchant_id);
    }

    if (fields.length === 0)
      return res.status(400).json({ error: 'No fields to update' });

    fields.push('updated_at = NOW()');
    values.push(id);

    await pool.execute(
      `UPDATE users SET ${fields.join(', ')} WHERE id = ?`,
      values,
    );

    return res.json({ message: 'User updated successfully' });
  } catch (err) {
    console.error('[AUTH] updateUser error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN')
      return res.status(403).json({ error: 'Access denied. ADMIN only.' });

    const { id } = req.params;

    if (id === req.user.id)
      return res.status(400).json({ error: 'Cannot delete your own account' });

    await pool.execute(
      `UPDATE users SET is_active = 0, updated_at = NOW() WHERE id = ?`,
      [id],
    );

    return res.json({ message: 'User deactivated successfully' });
  } catch (err) {
    console.error('[AUTH] deleteUser error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN')
      return res.status(403).json({ error: 'Access denied. ADMIN only.' });

    const { id } = req.params;
    const { new_password } = req.body;

    if (!new_password || new_password.length < 8)
      return res
        .status(400)
        .json({ error: 'Password must be at least 8 characters' });

    const hashed = await bcrypt.hash(new_password, SALT_ROUNDS);
    await pool.execute(
      `UPDATE users SET password = ?, updated_at = NOW() WHERE id = ?`,
      [hashed, id],
    );

    return res.json({ message: 'Password reset successfully' });
  } catch (err) {
    console.error('[AUTH] resetPassword error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const { role, merchant_id, id } = req.user;

    if (role === 'ADMIN') {
      const [[sum]] = await pool.execute(
        `SELECT COALESCE(SUM(balance), 0) AS total_balance,
                COUNT(*) AS total_merchants
         FROM merchant_wallet`
      );

      const [[user]] = await pool.execute(
        `SELECT username, email, full_name FROM users WHERE id = ?`,
        [id]
      );

      return res.json({
        role:             'ADMIN',
        username:         user?.username,
        full_name:        user?.full_name,
        email:            user?.email,
        total_balance:    parseFloat(sum.total_balance   || 0),
        total_merchants:  parseInt(sum.total_merchants   || 0),
        currency:         'BDT',
      });
    }

    if (!merchant_id)
      return res.status(400).json({ error: 'No merchant linked to this account' });

    const [[row]] = await pool.execute(
      `SELECT w.balance, w.currency,
              m.display_name, m.id_type, m.id_value, m.status
       FROM merchant_wallet w
       JOIN merchant m ON m.id = w.merchant_id
       WHERE w.merchant_id = ?`,
      [merchant_id]
    );

    return res.json({
      role:         'MERCHANT',
      merchant_id,
      display_name: row?.display_name,
      id_type:      row?.id_type,
      id_value:     row?.id_value,
      status:       row?.status,
      balance:      parseFloat(row?.balance  || 0),
      currency:     row?.currency || 'BDT',
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};