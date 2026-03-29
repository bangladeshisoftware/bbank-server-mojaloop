require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const crypto = require('crypto');
const http = require('http');
const { Server } = require('socket.io');
const db = require('./utils/db');
const axios = require('axios');
const base64url = require('base64url');
const transferRoute = require('./route/transactions.route.js');
const authRoute = require('./route/auth.routes.js');
const dashboardRoute = require('./route/dashboard.route.js');
const activityRoute = require('./route/activity.route.js');
const balanceRoute = require('./route/balance.route.js');
const { sendEmail } = require('./services/email.service');
const { v4: uuidv4 } = require('uuid');
const auth = require('./middleware/auth.middleware.js');
const { updateBalance } = require('./controller/balance.controller.js');

delete axios.defaults.headers.common['Accept'];

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  },
});

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

app.use(
  express.json({
    type: [
      'application/json',
      'application/*+json',
      'application/vnd.interoperability.parties+json;version=2.0',
      'application/vnd.interoperability.transfers+json;version=2.0',
      'application/vnd.interoperability.quotes+json;version=2.0',
    ],
  }),
);

app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    credentials: true,
  }),
);
// route
app.use('/api', transferRoute);
app.use('/api', authRoute);
app.use('/api', dashboardRoute);
app.use('/api', activityRoute);
app.use('/api', balanceRoute);

function queryDB(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, results) => {
      if (err) reject(err);
      else resolve(results);
    });
  });
}

async function sendCallbackToHub(callbackPath, responseBody, originalHeaders) {
  try {
    const hubCallbackUrl = callbackPath;

    // Extract path to detect service type
    const path = hubCallbackUrl.toLowerCase();

    // Dynamic values from received callback headers
    const fspiopSource = originalHeaders['fspiop-source'] || 'switch';
    const fspiopDestination =
      originalHeaders['fspiop-destination'] || process.env.fspId;

    // Generate dynamic date & trace ID
    const dynamicDate = new Date().toUTCString();
    const traceId = crypto.randomUUID();

    // Detect service type (ALS / Quotes / Transfers)
    let headers = {};

    if (path.includes('/parties')) {
      // ðŸ”¹ ALS Headers
      headers = {
        'Content-Type':
          'application/vnd.interoperability.parties+json;version=2.0',
        Accept: 'application/vnd.interoperability.parties+json;version=2.0',
        'FSPIOP-Source': process.env.fspId, // fspiopSource
        'FSPIOP-Destination': originalHeaders['fspiop-source'],
        Date: dynamicDate,
        'FSPIOP-HTTP-Method': 'PUT',
        'FSPIOP-URI': `/parties/${originalHeaders.partyIdType || 'unknown'}/${originalHeaders.partyIdentifier || 'unknown'}`,
        traceparent: traceId,
      };
    } else if (path.includes('/quotes')) {
      // ðŸ”¹ Quotes Headers
      const quoteId = originalHeaders.quoteId || randomUUID(); // dynamic quote id fallback
      headers = {
        'Content-Type':
          'application/vnd.interoperability.quotes+json;version=1.1',
        'FSPIOP-Source': originalHeaders?.payeefsp,
        'FSPIOP-Destination': originalHeaders?.payerfsp,
        Date: dynamicDate,
        'FSPIOP-HTTP-Method': 'PUT',
        'FSPIOP-URI': `/quotes/${quoteId}`,
      };
    } else if (path.includes('/transfers')) {
      // ðŸ”¹ Transfers Headers
      headers = {
        'Content-Type':
          'application/vnd.interoperability.transfers+json;version=1.0',
        Accept: 'application/vnd.interoperability.transfers+json;version=1.0', // ADD THIS!
        'FSPIOP-Source': process.env.fspId, // FIX: YOU are the source
        'FSPIOP-Destination': originalHeaders['fspiop-source'], // FIX: Original sender is destination
        'FSPIOP-HTTP-Method': 'PUT', // ADD: Required!
        'FSPIOP-URI': `/transfers/${transferId}`, // ADD: Required!
        Date: dynamicDate,
        traceparent: traceId,
      };
    } else {
      // ðŸ”¹ Default Fallback Headers
      headers = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'FSPIOP-Source': fspiopSource,
        'FSPIOP-Destination': fspiopDestination,
        Date: dynamicDate,
      };
    }

    const options = {
      method: 'PUT',
      headers,
      body: JSON.stringify(responseBody),
    };

    console.log(`Sending callback to: ${hubCallbackUrl}`);
    console.log('Headers:', headers);

    const response = await fetch(hubCallbackUrl, options);

    if (response.status >= 200 && response.status < 300) {
      console.log('âœ… Callback sent successfully to hub');
    } else {
      console.error(
        'Failed to send callback to hub:',
        response.status,
        await response.text(),
      );
    }
  } catch (error) {
    console.error('Error sending callback to hub:', error);
  }
}

async function forwardRequest(url, options) {
  try {
    const response = await fetch(url, options);
    const text = await response.text();
    const data = text ? JSON.parse(text) : {};
    return { status: response.status, data };
  } catch (error) {
    console.error('forwardRequest error:', error);
    throw new Error(error.message || 'Network Error');
  }
}

async function forwardRequestCore(res, url, options) {
  try {
    const response = await fetch(url, options);
    const text = await response.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch (parseError) {
      data = text;
    }
    res.status(response.status).json(data);
  } catch (error) {
    console.error('forwardRequest error:', error);
    res.status(500).json({
      message: error?.message || 'Network Error!',
    });
  }
}

app.get('/api/parties', auth, async (req, res) => {
  try {
    const {
      search,
      status,
      id_type,
      date_from,
      date_to,
      page = 1,
      per_page = 10,
    } = req.query;

    // ── Pagination ────────────────────────────────────────────
    const limit = Math.min(Math.max(parseInt(per_page) || 10, 1), 100);
    const offset = (Math.max(parseInt(page) || 1, 1) - 1) * limit;

    // ── Build WHERE ───────────────────────────────────────────
    const conditions = [];
    const params = [];

    if (search && search.trim()) {
      const like = `%${search.trim()}%`;
      conditions.push(`(
        display_name LIKE ? OR
        id_value     LIKE ? OR
        nid          LIKE ? OR
        acc_no       LIKE ? OR
        first_name   LIKE ? OR
        last_name    LIKE ?
      )`);
      params.push(like, like, like, like, like, like);
    }

    if (status !== undefined && status !== '') {
      conditions.push(`status = ?`);
      params.push(status);
    }

    if (id_type) {
      conditions.push(`id_type = ?`);
      params.push(id_type);
    }

    if (date_from) {
      conditions.push(`DATE(created_at) >= ?`);
      params.push(date_from);
    }

    if (date_to) {
      conditions.push(`DATE(created_at) <= ?`);
      params.push(date_to);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    // ── Count ─────────────────────────────────────────────────
    const countResult = await queryDB(
      `SELECT COUNT(*) AS total FROM merchant ${where}`,
      params,
    );
    const total = countResult[0]?.total || 0;
    const total_pages = Math.ceil(total / limit);

    // ── Data ──────────────────────────────────────────────────
    const data = await queryDB(
      `SELECT
         id, display_name, first_name, middle_name, last_name,
         dob, fsp_id, id_type, id_value,
         nid, acc_no,
         daily_limit, single_transaction_limit,
         status, created_at
       FROM merchant
       ${where}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );

    return res.status(200).json({
      message: 'Success',
      data,
      pagination: {
        total,
        total_pages,
        current_page: parseInt(page) || 1,
        per_page: limit,
        has_next: (parseInt(page) || 1) < total_pages,
        has_prev: (parseInt(page) || 1) > 1,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/parties/:id', auth, async (req, res) => {
  try {
    const result = await queryDB(
      `SELECT m.*,
              u.id AS user_id, u.username, u.email,
              u.is_active AS user_active, u.last_login
       FROM merchant m
       LEFT JOIN users u ON u.merchant_id = m.id
       WHERE m.id = ?
       LIMIT 1`,
      [req.params.id],
    );

    if (!result.length) {
      return res.status(404).json({ message: 'Merchant not found' });
    }

    res.status(200).json({ message: 'Success', data: result[0] });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.put('/api/parties/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const allowed = [
      'display_name',
      'first_name',
      'middle_name',
      'last_name',
      'dob',
      'nid',
      'acc_no',
      'daily_limit',
      'single_transaction_limit',
      'status',
    ];

    const fields = [];
    const values = [];

    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        fields.push(`${key} = ?`);
        values.push(req.body[key]);
      }
    }

    if (fields.length === 0) {
      return res.status(400).json({ message: 'No fields to update' });
    }

    values.push(id);
    await queryDB(
      `UPDATE merchant SET ${fields.join(', ')} WHERE id = ?`,
      values,
    );

    res.status(200).json({ message: 'Merchant updated successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/parties/active/merchant', auth, async (req, res) => {
  try {
    const user = req.user;

    let sql = `
      SELECT m.id, m.display_name, m.daily_limit, m.single_transaction_limit,
             COALESCE(w.balance, 0) AS balance, COALESCE(w.currency, 'BDT') AS currency
      FROM merchant m
      LEFT JOIN merchant_wallet w ON w.merchant_id = m.id
      WHERE m.status = ?
        AND COALESCE(w.balance, 0) > 50
    `;

    let params = ['1'];

    if (user?.role === 'MERCHANT') {
      sql += ' AND m.id = ?';
      params.push(user.merchant_id);
    }

    const results = await queryDB(sql, params);

    if (!results.length) {
      return res.status(404).json({ message: 'No merchants found' });
    }

    res.status(200).json({
      message: 'Success',
      data: results,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/settings', auth, async (req, res) => {
  try {
    const sql = 'SELECT * FROM settings WHERE id = ?';
    const results = await queryDB(sql, [1]);
    if (!results.length) {
      return res.status(404).json({ message: 'No settings found' });
    }
    res.status(200).json({ message: 'Success', data: results[0] });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/settings', auth, async (req, res) => {
  try {
    const { quote_fee } = req.body;
    const sql = 'UPDATE settings SET quote_fee = ? WHERE id = ?';
    await queryDB(sql, [quote_fee, 1]);
    res.status(200).json({ message: 'Success' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/parties/add', auth, async (req, res) => {
  try {
    const {
      display_name,
      first_name,
      middle_name,
      last_name,
      dob,
      id_type,
      id_value,
      email,
      password,
      nid,
      acc_no,
      daily_limit,
      single_transaction_limit,
      open_account,
    } = req.body;

    if (
      !display_name ||
      !first_name ||
      !id_type ||
      !id_value ||
      !email ||
      !password
    ) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Check if merchant exists
    const checkSql =
      'SELECT * FROM merchant WHERE id_type = ? AND id_value = ?';
    const checkSql2 = 'SELECT * FROM users WHERE email = ?';
    const existing = await queryDB(checkSql, [id_type, id_value]);
    const existing2 = await queryDB(checkSql2, [email]);

    if (existing.length > 0 || existing2.length > 0) {
      return res
        .status(400)
        .json({ message: 'Merchant or user already exists' });
    }

    // Register with ALS
    const url = `${process.env.ALS_SERVICE}/participants/${id_type}/${id_value}`;
    const now = new Date().toUTCString();

    const options = {
      method: 'POST',
      headers: {
        'FSPIOP-Source': process.env.fspId,
        Authorization: 'Bearer abcdefghjklmnopqrstuvwxyz1234567890',
        Accept:
          'application/vnd.interoperability.participants+json;version=1.1',
        'Content-Type':
          'application/vnd.interoperability.participants+json;version=1.1',
        Date: now,
      },
      body: JSON.stringify({
        fspId: process.env.fspId,
        currency: process.env.currency,
      }),
    };

    const { status } = await forwardRequest(url, options);

    if (status >= 200 && status < 300) {
      // Insert merchant
      const insertMerchantSql = `
        INSERT INTO merchant 
        (display_name, first_name, middle_name, last_name, dob, id_type, id_value, nid, acc_no, daily_limit, single_transaction_limit, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const merchantResult = await queryDB(insertMerchantSql, [
        display_name,
        first_name,
        middle_name || null,
        last_name || null,
        dob || null,
        id_type,
        id_value,
        nid,
        acc_no,
        daily_limit,
        single_transaction_limit,
        '1',
      ]);

      const merchant_id = merchantResult.insertId;

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Extract username from email
      const username = email.split('@')[0];
      const userId = uuidv4();

      // Insert user
      const userSql = `
        INSERT INTO users 
        (id, username, email, password, full_name, phone, merchant_id, role, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      await queryDB(userSql, [
        userId,
        username,
        email,
        hashedPassword,
        display_name,
        id_value, // phone
        merchant_id,
        'MERCHANT',
        1,
      ]);
      await updateBalance({
        merchant_id,
        type: 'CREDIT',
        amount: open_account || 0,
        note: 'Opening Account Deposit.',
      });
      // send email
      let emailSent = false;
      try {
        await sendEmail({
          to: email,
          subject: `B Bank Portal Access by — ${username}`,
          html: `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Portal Access Created</title>
<style>
  body {
    margin:0;
    padding:0;
    background:#0b0f14;
    font-family: Arial, Helvetica, sans-serif;
  }
  .container {
    max-width:520px;
    margin:40px auto;
    padding:0 16px;
  }
  .card {
    background:#121821;
    border-radius:14px;
    border:1px solid #1c2430;
    overflow:hidden;
  }
  .header {
    padding:24px 28px;
    border-bottom:2px solid #00e676;
    background:#0f141b;
  }
  .header h1 {
    margin:0;
    font-size:16px;
    color:#ffffff;
    letter-spacing:.5px;
  }
  .content {
    padding:28px;
  }
  .intro {
    color:#9aa4af;
    font-size:13px;
    line-height:1.6;
    margin-bottom:22px;
  }
  .intro strong {
    color:#ffffff;
  }
  .info-row {
    display:flex;
    justify-content:space-between;
    padding:10px 0;
    border-bottom:1px solid #1c2430;
  }
  .info-row:last-child {
    border-bottom:none;
  }
  .label {
    font-size:12px;
    color:#6b7785;
  }
  .value {
    font-size:12px;
    color:#e6edf3;
    font-family: "Courier New", monospace;
    font-weight:600;
  }
  .alert {
    margin-top:20px;
    padding:14px 16px;
    background:#1a1f12;
    border:1px solid #2c3a1b;
    border-radius:8px;
    font-size:11px;
    color:#9fb38f;
    line-height:1.6;
  }
  .footer {
    text-align:center;
    padding:16px;
    font-size:10px;
    color:#3c4652;
    border-top:1px solid #1c2430;
  }
  @media(max-width:480px){
    .info-row { flex-direction:column; gap:4px; }
  }
</style>
</head>
<body>
  <div class="container">
    <div class="card">

      <div class="header">
        <h1>Financial Portal Access Created</h1>
      </div>

      <div class="content">
        <div class="intro">
          Dear <strong>${display_name || 'Merchant'}</strong>,<br><br>
          Your Financial Portal account has been successfully created by B Bank.
        </div>

        <div class="info-row">
          <span class="label">Username</span>
          <span class="value">${username}</span>
        </div>

        <div class="info-row">
          <span class="label">Temporary Password</span>
          <span class="value">${password}</span>
        </div>

        <div class="alert">
          Please log in and change your password immediately.<br>
          You may create additional users (Operator, Viewer) from within the portal.<br>
          Keep your credentials confidential and do not share them.
        </div>
      </div>

      <div class="footer">
        Presented by Bangladeshi Software LTD.<br>
        Automated system email · Please do not reply
      </div>

    </div>
  </div>
</body>
</html>`,
        });
        emailSent = 'sent';
      } catch (emailErr) {
        emailSent = 'failed';
        console.error(`[DFSP] Welcome email failed: ${emailErr.message}`);
      }
      // send email.
      return res
        .status(201)
        .json({ emailSent, message: 'Merchant added successfully' });
    } else {
      return res
        .status(502)
        .json({ message: 'Failed to register with ALS Admin Service' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.put('/api/parties/add', auth, async (req, res) => {
  try {
    const {
      id,
      display_name,
      first_name,
      middle_name,
      last_name,
      dob,
      id_type,
      id_value,
      nid,
      acc_no,
      daily_limit,
      single_transaction_limit,
    } = req.body;

    // Basic validation
    if (!id) {
      return res.status(400).json({ message: 'Missing merchant ID' });
    }

    if (!display_name || !first_name || !id_type || !id_value) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const checkSql = `SELECT id_value FROM merchant WHERE id = ?`;
    const [existing] = await queryDB(checkSql, [id]);

    if (!existing) {
      return res.status(404).json({ message: 'Merchant not found' });
    }

    if (existing.id_value !== id_value) {
      return res
        .status(403)
        .json({ message: 'ID value change not permitted.' });
    }

    const updateSql = `
      UPDATE merchant
      SET display_name = ?,
          first_name = ?,
          middle_name = ?,
          last_name = ?,
          dob = ?,
          id_type = ?,
          nid = ?,
          acc_no = ?,
          daily_limit = ?,
          single_transaction_limit = ?
      WHERE id = ?;
    `;

    const result = await queryDB(updateSql, [
      display_name,
      first_name,
      middle_name,
      last_name,
      dob,
      id_type,
      nid,
      acc_no,
      daily_limit,
      single_transaction_limit,
      id,
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Merchant not found' });
    }

    return res.status(200).json({ message: 'Merchant successfully updated.' });
  } catch (error) {
    console.error('Error updating merchant:', error);
    res
      .status(500)
      .json({ message: 'Internal server error', error: error.message });
  }
});

app.delete('/api/parties/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;

    // ── 1. Find merchant ──────────────────────────────────────
    const merchant = await queryDB('SELECT * FROM merchant WHERE id = ?', [id]);

    if (merchant.length === 0) {
      return res.status(404).json({ message: 'Merchant not found' });
    }

    const { id_type, id_value, display_name } = merchant[0];

    // ── 2. De-register from ALS ───────────────────────────────
    let alsStatus = 'skipped';
    try {
      const alsUrl = `${process.env.ALS_SERVICE}/participants/${id_type}/${id_value}`;
      const { status } = await forwardRequest(alsUrl, {
        method: 'DELETE',
        headers: {
          'FSPIOP-Source': process.env.fspId,
          Authorization: 'Bearer abcdefghjklmnopqrstuvwxyz1234567890',
          Accept:
            'application/vnd.interoperability.participants+json;version=1.1',
          'Content-Type':
            'application/vnd.interoperability.participants+json;version=1.1',
          Date: new Date().toUTCString(),
        },
      });

      alsStatus =
        status >= 200 && status < 300 ? 'success' : `failed (HTTP ${status})`;

      if (status >= 200 && status < 300) {
        console.log(`[ALS] De-registered ${id_type}/${id_value}`);
      } else {
        // Non-fatal — log and continue with DB cleanup
        console.warn(
          `[ALS] De-registration returned ${status} for ${id_type}/${id_value} — continuing with DB delete`,
        );
      }
    } catch (alsErr) {
      // Network error hitting ALS — still clean up DB
      alsStatus = `error: ${alsErr.message}`;
      console.warn(
        `[ALS] De-registration failed for ${id_type}/${id_value}: ${alsErr.message} — continuing with DB delete`,
      );
    }

    // ── 3. Delete linked users ────────────────────────────────
    const users = await queryDB('SELECT id FROM users WHERE merchant_id = ?', [
      id,
    ]);

    if (users.length > 0) {
      await queryDB('DELETE FROM users WHERE merchant_id = ?', [id]);
      console.log(`[DB] Deleted ${users.length} user(s) for merchant ${id}`);
    }

    // ── 4. Delete merchant ────────────────────────────────────
    await queryDB('DELETE FROM merchant WHERE id = ?', [id]);
    console.log(`[DB] Deleted merchant ${id} (${display_name})`);

    // ── 5. Response ───────────────────────────────────────────
    return res.status(200).json({
      message: `Merchant "${display_name}" deleted successfully${users.length > 0 ? ` along with ${users.length} associated user(s)` : ''}`,
      als_status: alsStatus,
      users_deleted: users.length,
    });
  } catch (error) {
    console.error('[DELETE /api/parties/:id]', error.message);
    res.status(500).json({ message: error.message });
  }
});

app.put('/api/merchant/update/status/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const updatesql = 'UPDATE merchant SET status = ? WHERE id = ?';
    const result = await queryDB(updatesql, [status, id]);

    res.status(200).json({ message: 'Merchant deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

async function send_S1_createQuote({
  quote_id,
  transaction_id,
  payer_fsp,
  payee_fsp,
  payer_id_type,
  payer_id_value,
  payer_name,
  payee_id_type,
  payee_id_value,
  merchant_id,
  amount,
  currency,
  type = 'P2P',
}) {
  await queryDB(
    `INSERT INTO transactions (
       id, quote_id, transaction_id,
       type, direction,
       payer_fsp, payee_fsp,
       payer_id_type, payer_id_value, payer_name,
       payee_id_type, payee_id_value,
       merchant_id,
       amount, currency,
       status, quote_at
     ) VALUES (
       UUID(), ?, ?,
       ?, 'OUTGOING',
       ?, ?,
       ?, ?, ?,
       ?, ?,
       ?,
       ?, ?,
       'QUOTE_REQUESTED', NOW()
     )`,
    [
      quote_id,
      transaction_id,
      type,
      payer_fsp || null,
      payee_fsp || null,
      payer_id_type || null,
      payer_id_value || null,
      payer_name || null,
      payee_id_type || null,
      payee_id_value || null,
      merchant_id || null,
      amount,
      currency || process.env.currency || 'BDT',
    ],
  );
  console.log(
    `[SEND S1] OUTGOING created  quote_id=${quote_id}  status=QUOTE_REQUESTED`,
  );
}

async function send_S2_quoteReceived({
  quote_id,
  receive_amount,
  fee,
  ilp_packet,
  condition_hash,
  expiration,
}) {
  await queryDB(
    `UPDATE transactions SET
       status         = 'QUOTE_RECEIVED',
       receive_amount = ?,
       fee            = ?,
       ilp_packet     = ?,
       condition_hash = ?,
       expiration     = ?,
       updated_at     = NOW()
     WHERE quote_id = ? AND direction = 'OUTGOING'`,
    [
      receive_amount || null,
      fee || 0,
      ilp_packet || null,
      condition_hash || null,
      expiration ? new Date(expiration) : null,
      quote_id,
    ],
  );
  console.log(
    `[SEND S2] ILP stored  quote_id=${quote_id}  status=QUOTE_RECEIVED`,
  );
}

async function send_S3_transferSent({ quote_id, transfer_id }) {
  await queryDB(
    `UPDATE transactions SET
       transfer_id = ?,
       status      = 'TRANSFER_SENT',
       transfer_at = NOW(),
       updated_at  = NOW()
     WHERE quote_id = ? AND direction = 'OUTGOING'`,
    [transfer_id, quote_id],
  );
  console.log(
    `[SEND S3] transfer linked  quote_id=${quote_id}  transfer_id=${transfer_id}  status=TRANSFER_SENT`,
  );
}

async function send_S4_finalStatus(transfer_id, newStatus, extra = {}) {
  const TERMINAL = ['COMMITTED', 'FAILED', 'ABORTED', 'EXPIRED'];
  try {
    const rows = await queryDB(
      `SELECT id, status FROM transactions
       WHERE transfer_id = ? AND direction = 'OUTGOING' LIMIT 1`,
      [transfer_id],
    );

    if (!rows || rows.length === 0) {
      console.warn(
        `[SEND S4] no OUTGOING row found for transfer_id=${transfer_id}`,
      );
      return;
    }

    const row = rows[0];

    if (row.status === newStatus) {
      console.log(`[SEND S4] already ${newStatus} — skip`);
      return;
    }
    if (TERMINAL.includes(row.status)) {
      console.log(`[SEND S4] already terminal (${row.status}) — skip`);
      return;
    }

    // Build dynamic SET fields
    const fields = ['status = ?', 'updated_at = NOW()'];
    const values = [newStatus];

    if (newStatus === 'COMMITTED') {
      fields.push('completed_at = NOW()');
      if (extra.fulfilment) {
        fields.push('fulfilment = ?');
        values.push(extra.fulfilment);
      }
    }
    if (['FAILED', 'ABORTED', 'EXPIRED'].includes(newStatus)) {
      if (extra.error_code) {
        fields.push('error_code = ?');
        values.push(extra.error_code);
      }
      if (extra.error_description) {
        fields.push('error_description = ?');
        values.push(extra.error_description);
      }
    }

    values.push(row.id); // WHERE id = ?
    await queryDB(
      `UPDATE transactions SET ${fields.join(', ')} WHERE id = ?`,
      values,
    );
    //console.log(`[SEND S4] ${transfer_id}  ${row.status} -> ${newStatus}`);

    //Balance Debit
    if (newStatus === 'COMMITTED') {
      const txnRows = await queryDB(
        `SELECT merchant_id, amount, fee, currency, transaction_id, type, payee_id_value
         FROM transactions WHERE id = ? LIMIT 1`,
        [row.id],
      );
      const txn = txnRows?.[0];
      if (txn?.merchant_id) {
        await updateBalance({
          merchant_id: txn.merchant_id,
          transaction_id: txn.transaction_id,
          transfer_id,
          type: 'DEBIT',
          amount: parseFloat(txn.amount || 0),
          fee: parseFloat(txn.fee || 0),
          currency: txn.currency || 'BDT',
          note: `${txn.type || 'P2P'} sent to ${txn.payee_id_value}`,
        }).catch((e) => console.error('[BALANCE DEBIT]', e.message));
      }
    }
  } catch (err) {
    console.error('[SEND S4] error:', err.message);
  }
}
/*
async function recv_R1_createQuote(body, reqHeaders) {
  // Duplicate guard
  const exists = await queryDB(
    `SELECT id FROM transactions
     WHERE quote_id = ? AND direction = 'INCOMING' LIMIT 1`,
    [body?.quoteId],
  );
  if (exists && exists.length > 0) {
    console.log(`[RECV R1] duplicate — skip  quote_id=${body?.quoteId}`);
    return;
  }

  const payerName =
    [
      body?.payer?.personalInfo?.complexName?.firstName,
      body?.payer?.personalInfo?.complexName?.lastName,
    ]
      .filter(Boolean)
      .join(' ') || null;

  await queryDB(
    `INSERT INTO transactions (
       id, quote_id, transaction_id,
       type, direction,
       payer_fsp, payee_fsp,
       payer_id_type, payer_id_value, payer_name,
       payee_id_type, payee_id_value,
       amount, currency,
       status, quote_at
     ) VALUES (
       UUID(), ?, ?,
       'P2P', 'INCOMING',
       ?, ?,
       ?, ?, ?,
       ?, ?,
       ?, ?,
       'QUOTE_REQUESTED', NOW()
     )`,
    [
      body?.quoteId || null,
      body?.transactionId || null,
      // payer FSP = FSPIOP-Source (whoever sent the quote)
      body?.payer?.partyIdInfo?.fspId || reqHeaders['fspiop-source'] || null,
      // payee FSP = us
      body?.payee?.partyIdInfo?.fspId ||
        reqHeaders['fspiop-destination'] ||
        process.env.fspId ||
        null,
      body?.payer?.partyIdInfo?.partyIdType || null,
      body?.payer?.partyIdInfo?.partyIdentifier || null,
      payerName,
      body?.payee?.partyIdInfo?.partyIdType || null,
      body?.payee?.partyIdInfo?.partyIdentifier || null,
      body?.amount?.amount || 0,
      body?.amount?.currency || process.env.currency || 'BDT',
    ],
  );
  console.log(
    `[RECV R1] INCOMING created  quote_id=${body?.quoteId}  status=QUOTE_REQUESTED`,
  );
}
*/
async function recv_R1_createQuote(body, reqHeaders) {
  const exists = await queryDB(
    `SELECT id FROM transactions
     WHERE quote_id = ? AND direction = 'INCOMING' LIMIT 1`,
    [body?.quoteId],
  );
  if (exists && exists.length > 0) {
    console.log(`[RECV R1] duplicate — skip  quote_id=${body?.quoteId}`);
    return;
  }

  // ── Derive type from Hub's transactionType ────────────────
  const SCENARIO_MAP = {
    TRANSFER:   'P2P',
    PAYMENT:    'INSTANT',
    DEPOSIT:    'INSTANT',
    WITHDRAWAL: 'P2P',
    REFUND:     'P2P',
  };
  const scenario = body?.transactionType?.scenario || 'TRANSFER';
  const txnType  = SCENARIO_MAP[scenario] || 'P2P';  // ← dynamic
  // ──────────────────────────────────────────────────────────

  const payerName = [
    body?.payer?.personalInfo?.complexName?.firstName,
    body?.payer?.personalInfo?.complexName?.lastName,
  ].filter(Boolean).join(' ') || null;

  await queryDB(
    `INSERT INTO transactions (
       id, quote_id, transaction_id,
       type, direction,
       payer_fsp, payee_fsp,
       payer_id_type, payer_id_value, payer_name,
       payee_id_type, payee_id_value,
       amount, currency,
       status, quote_at
     ) VALUES (
       UUID(), ?, ?,
       ?, 'INCOMING',
       ?, ?,
       ?, ?, ?,
       ?, ?,
       ?, ?,
       'QUOTE_REQUESTED', NOW()
     )`,
    [
      body?.quoteId       || null,
      body?.transactionId || null,
      txnType,                                                    // ← was hardcoded 'P2P'
      body?.payer?.partyIdInfo?.fspId || reqHeaders['fspiop-source']      || null,
      body?.payee?.partyIdInfo?.fspId || reqHeaders['fspiop-destination'] || process.env.fspId || null,
      body?.payer?.partyIdInfo?.partyIdType    || null,
      body?.payer?.partyIdInfo?.partyIdentifier|| null,
      payerName,
      body?.payee?.partyIdInfo?.partyIdType    || null,
      body?.payee?.partyIdInfo?.partyIdentifier|| null,
      body?.amount?.amount   || 0,
      body?.amount?.currency || process.env.currency || 'BDT',
    ],
  );

  console.log(
    `[RECV R1] INCOMING created  quote_id=${body?.quoteId}  type=${txnType}  status=QUOTE_REQUESTED`,
  );
}

async function recv_R2_ilpSentToHub({
  quote_id,
  ilp_packet,
  condition_hash,
  expiration,
  receive_amount,
  fee,
}) {
  await queryDB(
    `UPDATE transactions SET
       status         = 'QUOTE_RECEIVED',
       receive_amount = ?,
       fee            = ?,
       ilp_packet     = ?,
       condition_hash = ?,
       expiration     = ?,
       updated_at     = NOW()
     WHERE quote_id = ? AND direction = 'INCOMING'`,
    [
      receive_amount || null,
      fee || 0,
      ilp_packet || null,
      condition_hash || null,
      expiration ? new Date(expiration) : null,
      quote_id,
    ],
  );
  console.log(
    `[RECV R2] ILP sent to Hub  quote_id=${quote_id}  status=QUOTE_RECEIVED`,
  );
}

async function recv_R3_transferReceived(body, reqHeaders) {
  const transferId = body?.transferId;
  if (!transferId) return;

  // Try to find the row created in R1 (POST /quotes)
  const byQuote = body?.quoteId
    ? await queryDB(
        `SELECT id FROM transactions
         WHERE quote_id = ? AND direction = 'INCOMING' LIMIT 1`,
        [body.quoteId],
      )
    : [];

  if (byQuote && byQuote.length > 0) {
    // ── Normal path: R1 row exists, link transferId ──────────
    await queryDB(
      `UPDATE transactions SET
         transfer_id = ?,
         status      = 'TRANSFER_SENT',
         transfer_at = NOW(),
         updated_at  = NOW()
       WHERE quote_id = ? AND direction = 'INCOMING'`,
      [transferId, body.quoteId],
    );
    console.log(
      `[RECV R3] transfer linked  quote_id=${body.quoteId}  transfer_id=${transferId}  status=TRANSFER_SENT`,
    );
  } else {
    // ── Edge case: Hub sends transfer without prior POST /quotes ──
    const already = await queryDB(
      `SELECT id FROM transactions
       WHERE transfer_id = ? AND direction = 'INCOMING' LIMIT 1`,
      [transferId],
    );
    if (already && already.length > 0) return; // already tracked

    await queryDB(
      `INSERT INTO transactions (
         id, transfer_id, quote_id, transaction_id,
         type, direction,
         payer_fsp, payee_fsp,
         amount, currency,
         ilp_packet, condition_hash, expiration,
         status, transfer_at
       ) VALUES (
         UUID(), ?, ?, ?,
         'P2P', 'INCOMING',
         ?, ?,
         ?, ?,
         ?, ?, ?,
         'TRANSFER_SENT', NOW()
       )`,
      [
        transferId,
        body?.quoteId || null,
        body?.transactionId || null,
        body?.payerFsp || reqHeaders['fspiop-source'] || null,
        body?.payeeFsp || reqHeaders['fspiop-destination'] || null,
        body?.amount?.amount || 0,
        body?.amount?.currency || process.env.currency || 'BDT',
        body?.ilpPacket || null,
        body?.condition || null,
        body?.expiration ? new Date(body.expiration) : null,
      ],
    );
    console.log(
      `[RECV R3] INCOMING created from transfer (no prior quote)  transfer_id=${transferId}`,
    );
  }
}

async function recv_R4_finalStatus(transfer_id, newStatus, extra = {}) {
  const TERMINAL = ['COMMITTED', 'FAILED', 'ABORTED', 'EXPIRED'];
  try {
    const rows = await queryDB(
      `SELECT id, status FROM transactions
       WHERE transfer_id = ? AND direction = 'INCOMING' LIMIT 1`,
      [transfer_id],
    );

    if (!rows || rows.length === 0) {
      console.warn(
        `[RECV R4] no INCOMING row found for transfer_id=${transfer_id}`,
      );
      return;
    }

    const row = rows[0];

    if (row.status === newStatus) {
      console.log(`[RECV R4] already ${newStatus} — skip`);
      return;
    }
    if (TERMINAL.includes(row.status)) {
      console.log(`[RECV R4] already terminal (${row.status}) — skip`);
      return;
    }

    const fields = ['status = ?', 'updated_at = NOW()'];
    const values = [newStatus];

    if (newStatus === 'COMMITTED') {
      fields.push('completed_at = NOW()');
      if (extra.fulfilment) {
        fields.push('fulfilment = ?');
        values.push(extra.fulfilment);
      }
    }
    if (['FAILED', 'ABORTED', 'EXPIRED'].includes(newStatus)) {
      if (extra.error_code) {
        fields.push('error_code = ?');
        values.push(extra.error_code);
      }
      if (extra.error_description) {
        fields.push('error_description = ?');
        values.push(extra.error_description);
      }
    }

    values.push(row.id);
    await queryDB(
      `UPDATE transactions SET ${fields.join(', ')} WHERE id = ?`,
      values,
    );
    // console.log(`[RECV R4] ${transfer_id}  ${row.status} -> ${newStatus}`);
    // Balance credit.
    if (newStatus === 'COMMITTED') {
      const txnRows = await queryDB(
        `SELECT merchant_id, amount, fee, currency, transaction_id, type, payer_id_value
         FROM transactions WHERE id = ? LIMIT 1`,
        [row.id],
      );
      const txn = txnRows?.[0];
      if (txn?.merchant_id) {
        await updateBalance({
          merchant_id: txn.merchant_id,
          transaction_id: txn.transaction_id,
          transfer_id,
          type: 'CREDIT',
          amount: parseFloat(txn.amount || 0),
          fee: 0,
          currency: txn.currency || 'BDT',
          note: `${txn.type || 'P2P'} received from ${txn.payer_id_value}`,
        }).catch((e) => console.error('[BALANCE CREDIT]', e.message));
      }
    }
  } catch (err) {
    console.error('[RECV R4] error:', err.message);
  }
}
// init process
app.get('/api/verify-parties/:id/:number', async (req, res) => {
  const id = req.params?.id;
  const number = req.params?.number;
  const url = `${process.env.ALS_SERVICE}/parties/${id}/${number}`;
  const options = {
    method: 'GET',
    headers: {
      'Content-Type':
        'application/vnd.interoperability.parties+json;version=2.0',
      Accept: 'application/vnd.interoperability.parties+json;version=2.0',
      'FSPIOP-Source': process.env.fspId,
      'FSPIOP-Destination': process.env.fspDes,
      Authorization: 'Bearer asdfjkl;2e43Asdasa3a34ioaporigniginergk',
      Date: new Date().toUTCString(),
    },
  };
  await forwardRequestCore(res, url, options);
});

app.post('/api/init-quotes', async (req, res) => {
  try {
    const { payer_id, payee, amount, type = 'P2P' } = req.body;
    const quoteId = crypto.randomUUID();
    const transactionId = crypto.randomUUID();

    // get the payerfsp merchant data.
    const sql = `SELECT * FROM merchant WHERE id = ?`;
    const merchant = await queryDB(sql, [payer_id]);
    if (merchant?.length > 0) {
      // new
      const TRANSACTION_TYPE_MAP = {
        P2P: {
          scenario: 'TRANSFER',
          initiator: 'PAYER',
          initiatorType: 'CONSUMER',
        },
        INSTANT: {
          scenario: 'PAYMENT',
          initiator: 'PAYER',
          initiatorType: 'BUSINESS',
        },
        BULK: {
          scenario: 'TRANSFER',
          initiator: 'PAYER',
          initiatorType: 'CONSUMER',
        },
        NPSB: {
          scenario: 'PAYMENT',
          initiator: 'PAYER',
          initiatorType: 'CONSUMER',
        },
        RTGS: {
          scenario: 'TRANSFER',
          initiator: 'PAYER',
          initiatorType: 'CONSUMER',
        },
        BEFTN: {
          scenario: 'TRANSFER',
          initiator: 'PAYER',
          initiatorType: 'CONSUMER',
        },
      };

      const VALID_TYPES = Object.keys(TRANSACTION_TYPE_MAP);
      const txnType = VALID_TYPES.includes(type) ? type : 'P2P';
      const txnTypeObj = TRANSACTION_TYPE_MAP[txnType];
      // new
      // exits.
      const payer = merchant[0];
      // ðŸ”¹ Construct body in the given format
      const requestBody = {
        quoteId: quoteId,
        transactionId: transactionId,
        payer: {
          partyIdInfo: {
            partyIdType: payer?.id_type, // this credential get from the database.
            partyIdentifier: payer?.id_value, // this credential get from the database.
            fspId: process.env.fspId,
          },
          personalInfo: {
            complexName: {
              firstName: payer?.first_name,
              lastName: payer?.last_name,
            },
            dateOfBirth: payer?.dob,
          },
        },
        payee: {
          partyIdInfo: {
            partyIdType: payee?.party?.partyIdInfo?.partyIdType,
            partyIdentifier: payee?.party?.partyIdInfo?.partyIdentifier,
            fspId: payee?.party?.partyIdInfo?.fspId,
          },
        },
        amountType: 'SEND',
        amount: {
          amount: amount,
          currency: process.env.currency,
        },
        transactionType: txnTypeObj,
        note: `${txnType} payment initialization.`,
      };
      //  NEW >>  [SEND S1] — insert OUTGOING row

      await send_S1_createQuote({
        quote_id: quoteId,
        transaction_id: transactionId,
        payer_fsp: process.env.fspId,
        payee_fsp: payee?.party?.partyIdInfo?.fspId,
        payer_id_type: payer?.id_type,
        payer_id_value: payer?.id_value,
        payer_name:
          `${payer?.first_name || ''} ${payer?.last_name || ''}`.trim(),
        payee_id_type: payee?.party?.partyIdInfo?.partyIdType,
        payee_id_value: payee?.party?.partyIdInfo?.partyIdentifier,
        merchant_id: payer_id,
        amount,
        currency: process.env.currency,
        type: txnType,
      }).catch((e) => console.error('[SEND S1]', e.message));
      // << END >>
      // Prepare Endpoint
      const url = `${process.env.QUOTE_SERVICE}/quotes`;

      // Headers as per FSPIOP spec
      const options = {
        method: 'POST',
        headers: {
          'Content-Type':
            'application/vnd.interoperability.quotes+json;version=1.0',
          Accept: 'application/vnd.interoperability.quotes+json;version=1.0',
          'FSPIOP-Source': process.env.fspId,
          'FSPIOP-Destination': requestBody.payee.partyIdInfo.fspId,
          Authorization: 'Bearer asdfjkl;2e43Asdasa3a34ioaporigniginergk',
          Date: new Date().toUTCString(),
        },
        body: JSON.stringify(requestBody),
      };

      await forwardRequestCore(res, url, options);
    } else {
      // return error message to dfsp portal.
      res
        .status(400)
        .json({ message: 'Invalid selected merchant ID!', payer_id });
    }
  } catch (error) {
    console.error('error initiating quote:', error);
    res.status(500).json({
      message: 'Internal server error',
      error: error.message,
    });
  }
});

app.post('/api/init-transfer', async (req, res) => {
  try {
    const {
      currency,
      amount,
      expiration,
      ilpPacket,
      condition,
      payer_fsp,
      payee_fsp,
      quoteId,
    } = req.body;

    // Validate required fields
    if (
      !currency ||
      !amount ||
      !ilpPacket ||
      !condition ||
      !payer_fsp ||
      !payee_fsp ||
      !quoteId
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Missing required fields: currency, amount, ilpPacket, condition, payer_fsp, payee_fsp, quoteId',
      });
    }

    // Generate IDs
    const transferId = crypto.randomUUID();
    const transactionId = crypto.randomUUID();

    // Construct request body
    const requestBody = {
      transferId,
      quoteId,
      transactionId,
      payerFsp: payer_fsp,
      payeeFsp: payee_fsp,
      amount: {
        amount: amount.toString(),
        currency,
      },
      expiration:
        expiration || new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      ilpPacket,
      condition,
    };

    // Prepare headers
    const headersPayer = {
      'Content-Type':
        'application/vnd.interoperability.transfers+json;version=1.0',
      Accept: 'application/vnd.interoperability.transfers+json;version=1.0',
      'FSPIOP-Source': payer_fsp,
      'FSPIOP-HTTP-Method': 'POST',
      'FSPIOP-Destination': payee_fsp,
      'FSPIOP-URI': '/transfers',
      Date: new Date().toUTCString(),
      Connection: 'keep-alive',
      'Accept-Encoding': 'gzip, deflate, br',
      'User-Agent': 'PostmanRuntime/7.39.0',
    };

    const headersPayee = {
      ...headersPayer,
      'FSPIOP-Source': payee_fsp,
      'FSPIOP-Destination': payer_fsp,
    };

    // Send transfer request using axios
    const url = `${process.env.ML_API_ADAPTER}/transfers`;
    const response = await axios.post(url, requestBody, {
      headers: headersPayer,
    });

    // Prepare DFSP callback data
    const dfspData = {
      transfer_id: transferId,
      fulfill: transactionId,
      complete_timespan: new Date().toUTCString(),
    };

    const callbackDataPayer = {
      params: {},
      headers: headersPayer,
      body: dfspData,
    };
    const callbackDataPayee = {
      params: { id: transferId },
      headers: headersPayee,
      body: dfspData,
    };

    // << NEW >>  [SEND S3] — link transfer_id, mark TRANSFER_SENT
    await send_S3_transferSent({
      quote_id: quoteId,
      transfer_id: transferId,
    }).catch((e) => console.error('[SEND S3]', e.message));
    // << END >>

    // Send response once
    res.status(200).json({
      success: true,
      message: 'Transfer initiated successfully',
      transferId,
      transactionId,
      mlApiResponse: response.data,
    });
  } catch (error) {
    console.error('Error initiating transfer:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
});
// ============================================================
// CALLBACK HANDLERS (Parties, Quotes, Transfers)
// ============================================================

// Parties Phase

// # single registration callback PUT method.
app.put('/participants/:partyIdType/:partyIdentifier', async (req, res) => {
  const { partyIdType, partyIdentifier } = req.params;
  const { fspId, currency } = req.body;

  try {
    const callbackData = {
      params: req.params,
      query: req.query,
      headers: req.headers,
      body: req.body,
    };
    // Save to your database
    // ✅ Just return HTTP 200 - no JSON!
    io.emit('alsRegisterOneCallback', callbackData);
    res.status(200).send();
  } catch (error) {
    // Even on error, return 200 - but log the error
    res.status(200).send(); // Still 200!
  }
});
// For FSPIOP_CALLBACK_URL_PARTICIPANT_PUT_ERROR
app.put(
  '/participants/:partyIdType/:partyIdentifier/error',
  async (req, res) => {
    try {
      const callbackData = {
        params: req.params,
        query: req.query,
        headers: req.headers,
        body: req.body,
      };
      // Save to your database
      // ✅ Just return HTTP 200 - no JSON!
      io.emit('alsRegisterOneErrorCallback', callbackData);
      // Notify internal systems about failure

      // ✅ Return 200 OK for error callback acknowledgment
      res.status(200).send();
    } catch (error) {
      console.error('Error processing error callback:', error);
      res.status(200).send();
    }
  },
);
// # multiple registration callback PUT method.

app.put('/participants/:requestId', async (req, res) => {
  try {
    const callbackData = {
      params: req.params,
      query: req.query,
      headers: req.headers,
      body: req.body,
    };
    // Process all participants
    io.emit('alsRegisterManyCallback', callbackData);
    // ✅ Just return HTTP 200 - no JSON!
    res.status(200).send();
  } catch (error) {
    // Even if some fail, return 200
    res.status(200).send(); // Still 200!
  }
});
// For FSPIOP_CALLBACK_URL_PARTICIPANT_BATCH_PUT_ERROR
app.put('/participants/:requestId/error', async (req, res) => {
  try {
    const callbackData = {
      params: req.params,
      query: req.query,
      headers: req.headers,
      body: req.body,
    };
    // Process all participants
    io.emit('alsRegisterManyErrorCallback', callbackData);
    // Handle batch registration failure

    // Notify administrators

    res.status(200).send();
  } catch (error) {
    console.error('Error processing batch error callback:', error);
    res.status(200).send();
  }
});

// helper function

// init request

// ALS
app.put('/participants/:party_id/:party_identifire', async (req, res) => {});

app.get('/parties/:partyIdType/:partyIdentifier', async (req, res) => {
  try {
    const { partyIdType, partyIdentifier } = req.params;

    const callbackData = {
      params: req.params,
      query: req.query,
      headers: req.headers,
      body: req.body,
    };

    io.emit('alsverifyCallback', callbackData);

    res.status(202).send();

    await processPartyLookup(partyIdType, partyIdentifier, req.headers);
  } catch (error) {
    console.error('Error in /parties route:', error);
    res.status(202).send();
  }
});

async function processPartyLookup(partyIdType, partyIdentifier, headers) {
  try {
    const sql = `SELECT * FROM merchant WHERE id_type = ? AND id_value = ? AND status = ?`;
    const merchant = await queryDB(sql, [partyIdType, partyIdentifier, '1']);

    let responseBody;
    let callbackUrl;

    if (merchant?.length > 0) {
      if (merchant[0]?.status === '1') {
        // active merchant found
        responseBody = {
          party: {
            partyIdInfo: {
              partyIdType,
              partyIdentifier,
              fspId: process.env.fspId,
            },
            name: merchant[0].display_name || 'Unknown Merchant',
            personalInfo: {
              complexName: {
                firstName: merchant[0].first_name || 'N/A',
                lastName: merchant[0].last_name || 'N/A',
              },
              dateOfBirth: merchant[0].dob || null,
            },
          },
        };

        callbackUrl = `${process.env.ALS_SERVICE}/parties/${partyIdType}/${partyIdentifier}`;
      } else {
        // merchant inactive
        responseBody = {
          errorInformation: {
            errorCode: '3200',
            errorDescription: 'Merchant is inactive',
          },
        };

        callbackUrl = `${process.env.ALS_SERVICE}/parties/${partyIdType}/${partyIdentifier}/error`;
      }
    } else {
      // Merchant not found
      responseBody = {
        errorInformation: {
          errorCode: '3300',
          errorDescription: 'Merchant not found',
        },
      };

      callbackUrl = `${process.env.ALS_SERVICE}/parties/${partyIdType}/${partyIdentifier}/error`;
    }

    await sendCallbackToHub(callbackUrl, responseBody, headers);
  } catch (error) {
    console.error('Error processing party lookup:', error);
    const errorResponse = {
      errorInformation: {
        errorCode: '5000',
        errorDescription: 'Internal server error processing party lookup',
      },
    };
    await sendCallbackToHub(
      `${process.env.ALS_SERVICE}/parties/${partyIdType}/${partyIdentifier}/error`,
      errorResponse,
      headers,
    );
  }
}

app.put('/parties/:partyIdType/:partyIdentifier', (req, res) => {
  const callbackData = {
    params: req.params,
    query: req.query,
    headers: req.headers,
    body: req.body,
  };
  io.emit('alsputCallback', callbackData);
  res.status(200).send();
});

app.put('/parties/:partyIdType/:partyIdentifier/error', (req, res) => {
  const callbackData = {
    params: req.params,
    query: req.query,
    headers: req.headers,
    body: req.body,
  };
  io.emit('alsputErrorCallback', callbackData);
  res.status(200).send();
});

// Quotes Phase

async function generateDynamicILPData(ilpData) {
  // Create a dynamic expiration time (1 hour later)
  const expirationTime = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  // Generate a random ILP packet (base64 encoded JSON)
  const ilpPacket = Buffer.from(JSON.stringify(ilpData)).toString('base64');

  // Generate random condition (32-byte random hash in base64url)
  const condition = crypto.randomBytes(32).toString('base64url');

  // Return dynamic object
  return {
    ilpPacket,
    condition,
    expiration: expirationTime,
  };
}

app.post('/quotes', async (req, res) => {
  try {
    const sql = 'SELECT * FROM settings WHERE id = ?';
    const results = await queryDB(sql, [1]);
    const body = req.body;
    const callbackData = {
      params: req.params,
      query: req.query,
      headers: req.headers,
      body: req.body,
    };
    io.emit('postQuoteCallback', callbackData);
    res.status(202).send();
    //  NEW >>  [RECEIVE R1] — insert INCOMING row
    await recv_R1_createQuote(body, req.headers).catch((e) =>
      console.error('[RECV R1]', e.message),
    );
    // << END >>

    // after that send response to Hub.
    try {
      let fee = results[0]?.quote_fee;
      const expirationTime = new Date(
        Date.now() + 60 * 60 * 1000,
      ).toISOString();
      const ilpData = {
        amount: body?.amount?.amount,
        currency: body?.amount?.currency,
        payee: { id: body?.payee?.partyIdInfo?.partyIdentifier },
        payer: { id: body?.payer?.partyIdInfo?.partyIdentifier },
        expiration: expirationTime,
      };
      const dynamicILPData = await generateDynamicILPData(ilpData);
      const fee_value = (Number(body?.amount?.amount) / 100) * fee;
      const receive_amount = Number(body?.amount?.amount) - fee_value;
      const url = `https://quoting.mojaloop.xyz/quotes/${body?.quoteId}`;
      const headers = {
        'Content-Type':
          'application/vnd.interoperability.quotes+json;version=1.1',
        Date: new Date().toUTCString(),
        'FSPIOP-Source': body?.payee?.partyIdInfo?.fspId,
        'FSPIOP-Destination': body?.payer?.partyIdInfo?.fspId,
        'FSPIOP-HTTP-Method': 'PUT',
        'FSPIOP-URI': `/quotes/${body?.quoteId}`,
        Connection: 'keep-alive',
        'Accept-Encoding': 'gzip, deflate, br',
        'User-Agent': 'PostmanRuntime/7.39.0',
      };

      const payload = {
        transferAmount: {
          currency: body?.amount?.currency,
          amount: body?.amount?.amount,
        },
        payeeReceiveAmount: {
          currency: body?.amount?.currency,
          amount: receive_amount,
        },
        ...dynamicILPData,
        extensionList: {
          extension: [{ key: 'fees', value: fee_value }],
        },
      };

      const response = await axios.put(url, payload, { headers });
      // << NEW >>  [RECEIVE R2] — ILP accepted and sent to Hub
      await recv_R2_ilpSentToHub({
        quote_id: body?.quoteId,
        ilp_packet: dynamicILPData.ilpPacket || null,
        condition_hash: dynamicILPData.condition || null,
        expiration: dynamicILPData.expiration,
        receive_amount,
        fee: fee_value,
      }).catch((e) => console.error('[RECV R2]', e.message));
      // << END >>
      res.json({
        success: true,
        message: 'Mojaloop quote PUT successful!',
        data: response.data,
      });
    } catch (err) {
      console.log('e');
    }
  } catch (error) {
    console.error('💥 Error:', error);
    res.status(202).send();
  }
});

app.put('/quotes/:id', async (req, res) => {
  const body = req.body;
  const quoteId = req.params.id;
  io.emit('putQuoteCallback', {
    params: req.params,
    query: req.query,
    headers: req.headers,
    body: req.body,
  });
  res.status(200).json({ message: 'Callback received' });
  // NEW >>  [SEND S2] — store ILP, advance to QUOTE_RECEIVED
  const fee =
    body?.payeeFspFee?.amount ??
    body?.extensionList?.extension?.find((e) => e.key === 'fees')?.value ??
    0;
  await send_S2_quoteReceived({
    quote_id: quoteId,
    receive_amount: body?.payeeReceiveAmount?.amount ?? null,
    fee,
    ilp_packet: body?.ilpPacket ?? null,
    condition_hash: body?.condition ?? null,
    expiration: body?.expiration ?? null,
  }).catch((e) => console.error('[SEND S2]', e.message));
  // << END >>
});

app.put('/quotes/:id/error', async (req, res) => {
  io.emit('putQuoteCallbackError', {
    params: req.params,
    query: req.query,
    headers: req.headers,
    body: req.body,
  });
  res.status(200).json({ message: 'Callback received' });
  // NEW [SEND] — mark OUTGOING row FAILED
  const errInfo = req.body?.errorInformation || {};
  await queryDB(
    `UPDATE transactions SET
       status            = 'FAILED',
       error_code        = ?,
       error_description = ?,
       updated_at        = NOW()
     WHERE quote_id = ? AND direction = 'OUTGOING'`,
    [
      errInfo.errorCode || null,
      errInfo.errorDescription || null,
      req.params.id,
    ],
  ).catch((e) => console.error('[SEND quote/error]', e.message));
  // << END >>
});

// Transfers Phase
app.post('/transfers', async (req, res) => {
  try {
    const callbackData = {
      params: req.params,
      query: req.query,
      headers: req.headers,
      body: req.body,
    };

    // Socket emit
    io.emit('postTransferCallback', callbackData);

    //*** HERE ***//
    const incomingBody = req.body;
    const transferId =
      incomingBody?.transferId || '4a4d99d4-0e07-437f-986a-a443d214449a';
    const completedTimestamp = new Date().toISOString();
    // << NEW >>  [RECEIVE R3] — link transfer_id to INCOMING row
    await recv_R3_transferReceived(incomingBody, req.headers).catch((e) =>
      console.error('[RECV R3]', e.message),
    );
    // << END >>
    const url = `https://api.mojaloop.xyz/transfers/${transferId}`;
    const headers = {
      'Content-Type':
        'application/vnd.interoperability.transfers+json;version=1.0',
      Accept: 'application/vnd.interoperability.transfers+json;version=1.0',
      'FSPIOP-Source': 'BBank',
      'FSPIOP-Destination': 'ABank',
      'FSPIOP-HTTP-Method': 'PUT',
      'FSPIOP-URI': `/transfers/${transferId}`,
      Date: new Date().toUTCString(),
    };
    const body = {
      completedTimestamp: completedTimestamp,
      transferState: 'COMMITTED',
    };
    await axios.put(url, body, { headers });

    //***  HERE  ***//

    // NEW  [RECEIVE R4] — Hub accepted our COMMITTED, close INCOMING row
    await recv_R4_finalStatus(transferId, 'COMMITTED').catch((e) =>
      console.error('[RECV R4]', e.message),
    );
    // << END >>
    // Send response ONCE
    res.status(202).json({
      message: 'Callback received successfully',
    });
  } catch (error) {
    console.error('Error in /transfers route:', error);
    // Still send 202 even on error (Mojaloop requirement)
    // << NEW >>  [RECEIVE R4] — our PUT to Hub failed, mark INCOMING FAILED
    const tid = req.body?.transferId;
    if (tid) {
      await recv_R4_finalStatus(tid, 'FAILED', {
        error_code: '5000',
        error_description: error.message,
      }).catch(() => {});
    }
    // << END >>
    res.status(202).json({
      message: 'Callback received with errors',
      error: error.message,
    });
  }
});
app.post('/transfers/:id', async (req, res) => {
  try {
    const callbackData = {
      params: req.params,
      query: req.query,
      headers: req.headers,
      body: req.body,
    };
    io.emit('postTransferCallback', callbackData);
    res.status(202).send();
    await processTransferRequest(req.body, req.headers);
  } catch (error) {
    console.error('Error in /transfers route:', error);
    res.status(202).send();
  }
});

async function processTransferRequest(transferData, headers) {
  try {
    const responseBody = {
      completedTimestamp: new Date().toISOString(),
      transferState: 'COMMITTED',
    };
    await sendCallbackToHub(
      `${process.env.ML_API_ADAPTER}/transfers/${transferData.transferId}`,
      responseBody,
      headers,
    );
  } catch (error) {
    console.error('Error processing transfer:', error);
    const errorResponse = {
      errorInformation: {
        errorCode: '5000',
        errorDescription: 'Internal server error processing transfer',
      },
    };
    await sendCallbackToHub(
      `${process.env.ML_API_ADAPTER}/transfers/${transferData.transferId}/error`,
      errorResponse,
      headers,
    );
  }
}

app.put('/transfers/:id', async (req, res) => {
  const body = req.body;
  const transferId = req.params.id;

  io.emit('putTransferCallback', {
    params: req.params,
    query: req.query,
    headers: req.headers,
    body: req.body,
  });
  res.status(200).json({ message: 'Callback received' });
  // << NEW >>  [SEND S4] — close OUTGOING row, unique tracker skips if terminal
  const newStatus =
    body?.transferState === 'COMMITTED'
      ? 'COMMITTED'
      : body?.transferState === 'ABORTED'
        ? 'ABORTED'
        : body?.transferState === 'EXPIRED'
          ? 'EXPIRED'
          : 'TRANSFER_SENT';

  await send_S4_finalStatus(transferId, newStatus, {
    fulfilment: body?.fulfilment ?? null,
  }).catch((e) => console.error('[SEND S4]', e.message));
  // << END >>
});

app.put('/transfers/:id/error', (req, res) => {
  const body = req.body;
  const transferId = req.params.id;
  io.emit('putTransferCallbackError', {
    params: req.params,
    query: req.query,
    headers: req.headers,
    body: req.body,
  });
  res.status(200).json({ message: 'Callback received' });
  // << NEW >>  [SEND S4] — close OUTGOING row as FAILED
  const errInfo = body?.errorInformation || {};
  send_S4_finalStatus(transferId, 'FAILED', {
    error_code: errInfo.errorCode ?? null,
    error_description: errInfo.errorDescription ?? null,
  }).catch((e) => console.error('[SEND S4 error]', e.message));
  // << END >>
});
// ALL Bulk

// ==========================================
// ALS CALLBACK HANDLERS (REQUIRED!)
// ==========================================

app.post('/api/verify-bulk-parties', async (req, res) => {
  try {
    const parties = req.body; // Array of {idType, identifier}

    if (!parties) return res.status(401).json({ message: 'asdf' });

    if (!parties || !Array.isArray(parties)) {
      return res.status(400).json({
        success: false,
        message: 'parties must be an array',
        data: parties || 'N/A',
      });
    }

    const results = await Promise.allSettled(
      parties.map(async (party) => {
        const url = `${process.env.ALS_SERVICE}/parties/${party.idType}/${party.identifier}`;

        const response = await axios.get(url, {
          headers: {
            'Content-Type':
              'application/vnd.interoperability.parties+json;version=2.0',
            Accept: 'application/vnd.interoperability.parties+json;version=2.0',
            'FSPIOP-Source': process.env.fspId,
            Date: new Date().toUTCString(),
          },
        });

        return {
          party,
          found: true,
          details: response.data,
        };
      }),
    );

    const verified = results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          party: parties[index],
          found: false,
          error: result.reason.message,
        };
      }
    });

    res.status(200).json({
      success: true,
      total: parties.length,
      found: verified.filter((v) => v.found).length,
      not_found: verified.filter((v) => !v.found).length,
      results: verified,
    });
  } catch (error) {
    console.error('error verifying bulk parties:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// ==========================================
// BULK QUOTES CALLBACK HANDLERS (REQUIRED!)
// ==========================================

// 1. Bulk Quote Success Callback
app.put('/bulkQuotes/:bulkQuoteId', async (req, res) => {
  try {
    const { bulkQuoteId } = req.params;
    const bulkQuoteResponse = req.body;

    console.log(`📥 Bulk quote callback received: ${bulkQuoteId}`);

    // Extract individual quote responses
    const individualQuoteResults =
      bulkQuoteResponse.individualQuoteResults || [];

    console.log(`✅ Received ${individualQuoteResults.length} quote results`);

    // Emit to frontend via Socket.io
    const callbackData = {
      params: req.params,
      headers: req.headers,
      body: req.body,
    };

    io.emit('putBulkQuoteCallback', callbackData);

    // Save to database for tracking
    /*  for (const quoteResult of individualQuoteResults) {
      try {
        // Update recipient status
        const updateSql = `
          UPDATE g2p_recipients 
          SET 
            status = 'QUOTED',
            ilp_packet = ?,
            condition = ?,
            quoted_at = NOW()
          WHERE quote_id = ?
        `;

        await queryDB(updateSql, [
          quoteResult.ilpPacket,
          quoteResult.condition,
          quoteResult.quoteId
        ]);

      } catch (err) {
        console.error(`Failed to update quote ${quoteResult.quoteId}:`, err);
      }
    }

    // Update bulk disbursement status
    const updateBulkSql = `
      UPDATE g2p_disbursements 
      SET status = 'QUOTED', quoted_at = NOW()
      WHERE bulk_quote_id = ?
    `;
    await queryDB(updateBulkSql, [bulkQuoteId]);
    */
    // Send 200 OK to Hub
    res.status(200).json({
      message: 'Bulk quote callback received',
      bulkQuoteId,
    });
  } catch (error) {
    console.error('❌ Error handling bulk quote callback:', error);
    res.status(200).json({ message: 'Callback received with error' });
  }
});

// 2. Bulk Quote Error Callback
app.put('/bulkQuotes/:bulkQuoteId/error', async (req, res) => {
  try {
    const { bulkQuoteId } = req.params;
    const errorInfo = req.body.errorInformation;

    console.log(`❌ Bulk quote error: ${bulkQuoteId}`, errorInfo);

    // Emit to frontend
    io.emit('putBulkQuoteCallbackError', {
      params: req.params,
      headers: req.headers,
      body: req.body,
    });

    // Update database
    /* const updateSql = `
      UPDATE g2p_disbursements 
      SET 
        status = 'FAILED',
        error_message = ?
      WHERE bulk_quote_id = ?
    `;

    await queryDB(updateSql, [
      errorInfo.errorDescription,
      bulkQuoteId
    ]);
    */
    res.status(200).json({ message: 'Error callback received' });
  } catch (error) {
    console.error('Error handling bulk quote error:', error);
    res.status(200).json({ message: 'Error callback received' });
  }
});

// ==========================================
// BULK TRANSFER CALLBACK HANDLERS
// ==========================================

// 3. Bulk Transfer Success Callback
app.put('/bulkTransfers/:bulkTransferId', async (req, res) => {
  try {
    const { bulkTransferId } = req.params;
    const bulkTransferResponse = req.body;

    console.log(`📥 Bulk transfer callback: ${bulkTransferId}`);

    const individualTransferResults =
      bulkTransferResponse.individualTransferResults || [];

    console.log(`✅ ${individualTransferResults.length} transfers completed`);

    // Emit to frontend
    io.emit('putBulkTransferCallback', {
      params: req.params,
      headers: req.headers,
      body: req.body,
    });

    // Update each transfer status
    /*  for (const transferResult of individualTransferResults) {
      try {
        const updateSql = `
          UPDATE g2p_recipients 
          SET 
            status = ?,
            fulfilment = ?,
            completed_at = NOW(),
            error_code = ?,
            error_description = ?
          WHERE transfer_id = ?
        `;

        const status = transferResult.transferState === 'COMMITTED' ? 'COMPLETED' : 'FAILED';

        await queryDB(updateSql, [
          status,
          transferResult.fulfilment || null,
          transferResult.errorInformation?.errorCode || null,
          transferResult.errorInformation?.errorDescription || null,
          transferResult.transferId
        ]);
        
      } catch (err) {
        console.error(`Failed to update transfer ${transferResult.transferId}:`, err);
      }
    }
*/
    // Update bulk disbursement
    const completedCount = individualTransferResults.filter(
      (r) => r.transferState === 'COMMITTED',
    ).length;

    const allCompleted = completedCount === individualTransferResults.length;

    /* const updateBulkSql = `
      UPDATE g2p_disbursements 
      SET 
        status = ?,
        completed_at = NOW()
      WHERE bulk_transfer_id = ?
    `;

    await queryDB(updateBulkSql, [
      allCompleted ? 'COMPLETED' : 'FAILED',
      bulkTransferId
    ]);
    */
    res.status(200).json({
      message: 'Bulk transfer callback received',
      bulkTransferId,
      completed: completedCount,
      total: individualTransferResults.length,
    });
  } catch (error) {
    console.error('❌ Error handling bulk transfer callback:', error);
    res.status(200).json({ message: 'Callback received with error' });
  }
});

// 4. Bulk Transfer Error Callback
app.put('/bulkTransfers/:bulkTransferId/error', async (req, res) => {
  try {
    const { bulkTransferId } = req.params;
    const errorInfo = req.body.errorInformation;

    console.log(`❌ Bulk transfer error: ${bulkTransferId}`, errorInfo);

    // Emit to frontend
    io.emit('putBulkTransferCallbackError', {
      params: req.params,
      headers: req.headers,
      body: req.body,
    });

    // Update database
    /* const updateSql = `
      UPDATE g2p_disbursements 
      SET 
        status = 'FAILED',
        error_message = ?
      WHERE bulk_transfer_id = ?
    `;

    await queryDB(updateSql, [
      errorInfo.errorDescription,
      bulkTransferId
    ]);
    */
    res.status(200).json({ message: 'Error callback received' });
  } catch (error) {
    console.error('Error handling bulk transfer error:', error);
    res.status(200).json({ message: 'Error callback received' });
  }
});

// ==========================================
// UPDATED: Bulk Quote Initialization (with callback saving)
// ==========================================

// Real function.

app.post('/api/init-bulk-quotes', async (req, res) => {
  try {
    const { payer_id, recipients, amount_per_recipient, disbursement_type } =
      req.body;

    if (!payer_id || !recipients || !Array.isArray(recipients)) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: payer_id, recipients',
      });
    }

    const bulkQuoteId = crypto.randomUUID();

    // Get payer data
    const sql = `SELECT * FROM merchant WHERE id = ?`;
    const merchant = await queryDB(sql, [payer_id]);

    if (!merchant || merchant.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payer ID',
      });
    }

    const payer = merchant[0];

    // Build individual quotes
    const individualQuotes = recipients.map((recipient) => {
      const quoteId = crypto.randomUUID();
      const transactionId = crypto.randomUUID();

      return {
        quoteId,
        transactionId,
        payee: {
          partyIdInfo: {
            partyIdType: recipient.partyIdType || 'MSISDN',
            partyIdentifier: recipient.partyIdentifier,
            fspId: recipient.fspId,
          },
        },
        amountType: 'SEND',
        amount: {
          amount: (recipient?.amount || amount_per_recipient).toString(),
          currency: process.env.currency || 'BDT',
        },
        transactionType: {
          scenario: 'TRANSFER',
          initiator: 'PAYER',
          initiatorType: 'CONSUMER',
        },
        note: recipient.note || 'Bulk payment',
      };
    });

    // Save to database BEFORE sending request
    const totalAmount = individualQuotes.reduce(
      (sum, q) => sum + parseFloat(q.amount.amount),
      0,
    );
    // Construct bulk quote request
    const requestBody = {
      bulkQuoteId,
      payer: {
        partyIdInfo: {
          partyIdType: payer.id_type,
          partyIdentifier: payer.id_value,
          fspId: process.env.fspId,
        },
        personalInfo: {
          complexName: {
            firstName: payer.first_name,
            lastName: payer.last_name,
          },
          dateOfBirth: payer.dob,
        },
      },
      expiration: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      individualQuotes,
    };

    // Send to Mojaloop Bulk API
    const url = `${'https://quoting.mojaloop.xyz'}/bulkQuotes`;

    const options = {
      method: 'POST',
      headers: {
        'Content-Type':
          'application/vnd.interoperability.bulkQuotes+json;version=1.0',
        Accept: 'application/vnd.interoperability.bulkQuotes+json;version=1.0',
        'FSPIOP-Source': process.env.fspId || 'BBank',
        'FSPIOP-Destination': process.env.fspDes || 'ABank',
        'FSPIOP-HTTP-Method': 'POST',
        'FSPIOP-URI': '/bulkQuotes',
        Date: new Date().toUTCString(),
      },
      body: JSON.stringify(requestBody),
    };

    // Forward request
    await forwardRequestCore(res, url, options);

    // Note: Response will come via PUT /bulkQuotes/:bulkQuoteId callback!
  } catch (error) {
    console.error('initiating bulk quotes:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
});

app.post('/bulkQuotes', async (req, res) => {
  try {
    const bulkQuoteRequest = req.body;
    const { bulkQuoteId, payer, individualQuotes, expiration } =
      bulkQuoteRequest;

    // Emit to frontend
    io.emit('postBulkQuoteCallback', {
      params: req.params,
      headers: req.headers,
      body: req.body,
    });

    // Send 202 Accepted immediately
    res.status(202).send();

    // ✅ Process EACH individual quote (UNCOMMENTED)
    const individualQuoteResults = [];
    const exp = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    for (const quote of individualQuotes) {
      try {
        // Get fee settings
        const sql = 'SELECT * FROM settings WHERE id = ?';
        const settings = await queryDB(sql, [1]);
        const fee = settings[0]?.quote_fee || 1;

        // Calculate amounts
        const amount = parseFloat(quote.amount.amount);
        const fee_value = (amount / 100) * fee;
        const receive_amount = amount - fee_value;

        // Generate ILP data
        const ilpData = {
          amount: quote.amount.amount,
          currency: quote.amount.currency,
          payee: { id: quote.payee.partyIdInfo.partyIdentifier },
          payer: { id: payer.partyIdInfo.partyIdentifier },
          expiration: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        };

        const dynamicILPData = await generateDynamicILPData(ilpData);

        // ✅ Build individual quote result
        individualQuoteResults.push({
          quoteId: quote.quoteId,
          transferAmount: {
            currency: quote.amount.currency,
            amount: quote.amount.amount,
          },
          payeeReceiveAmount: {
            currency: quote.amount.currency,
            amount: receive_amount.toString(),
          },
          payeeFspFee: {
            currency: quote.amount.currency,
            amount: fee_value.toString(),
          },
          ilpPacket: dynamicILPData.ilpPacket,
          condition: dynamicILPData.condition,
          expiration: dynamicILPData.expiration,
        });

        console.log(
          `✅ Processed quote ${quote.quoteId}: receive ${receive_amount}, fee ${fee_value}`,
        );
      } catch (error) {
        console.error(`❌ Error processing quote ${quote.quoteId}:`, error);

        // Add error response for this quote
        individualQuoteResults.push({
          quoteId: quote.quoteId,
          errorInformation: {
            errorCode: '5000',
            errorDescription: error.message,
          },
        });
      }
    }

    // Send bulk quote response back to Hub
    const url = `https://quoting.mojaloop.xyz/bulkQuotes/${bulkQuoteId}`;

    const headers = {
      'Content-Type':
        'application/vnd.interoperability.bulkQuotes+json;version=1.0',
      Date: new Date().toUTCString(),
      'FSPIOP-Source': process.env.fspId, // Payee FSP (BracBankDFSP)
      'FSPIOP-Destination': payer.partyIdInfo.fspId, // Payer FSP
      'FSPIOP-HTTP-Method': 'PUT',
      'FSPIOP-URI': `/bulkQuotes/${bulkQuoteId}`,
    };

    const payload = {
      individualQuoteResults: individualQuoteResults,
      expiration: expiration,
    };

    console.log(`🚀 PAYEE: Sending bulk quote response to Hub`);
    console.log(`   URL: ${url}`);
    console.log(`   Results: ${individualQuoteResults.length}`);
    console.log(`   Payload:`, JSON.stringify(payload, null, 2));

    const response = await axios.put(url, payload, { headers });

    console.log(`✅ PAYEE: Bulk quote response sent successfully`);
    console.log(`   Status: ${response.status}`);
  } catch (error) {
    console.error('💥 PAYEE: Error handling bulk quote:', error);
    console.error('   Error details:', error.response?.data || error.message);
    res.status(202).send();
  }
});

// Transfers phase
// ==========================================
// PAYER SIDE: Initialize Bulk Transfer
// ==========================================

app.post('/api/init-bulk-transfer', async (req, res) => {
  try {
    const {
      bulkQuoteId,
      payerFsp,
      payeeFsp,
      individualTransfers, // Array from quote response
    } = req.body;

    // Validate
    if (
      !bulkQuoteId ||
      !payerFsp ||
      !payeeFsp ||
      !individualTransfers ||
      !Array.isArray(individualTransfers)
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Missing required fields: bulkQuoteId, payerFsp, payeeFsp, individualTransfers',
      });
    }

    // Generate Bulk Transfer ID
    const bulkTransferId = crypto.randomUUID();

    console.log(`   Bulk Transfer ID: ${bulkTransferId}`);

    // Build request body with REQUIRED extensionList
    const requestBody = {
      bulkTransferId: bulkTransferId,
      bulkQuoteId: bulkQuoteId,
      payerFsp: payerFsp,
      payeeFsp: payeeFsp,
      individualTransfers: individualTransfers.map((transfer, index) => {
        // Build base transfer
        const baseTransfer = {
          transferId: transfer.transferId || crypto.randomUUID(),
          transferAmount: {
            currency:
              transfer.currency || transfer.transferAmount?.currency || 'BDT',
            amount: (
              transfer.amount || transfer.transferAmount?.amount
            ).toString(),
          },
          ilpPacket: transfer.ilpPacket,
          condition: transfer.condition,
        };

        // ✅ Add extensionList (REQUIRED by Mojaloop)
        if (transfer.extensionList) {
          // User provided extension list
          baseTransfer.extensionList = transfer.extensionList;
        } else {
          // ✅ Create default extension list
          baseTransfer.extensionList = {
            extension: [
              {
                key: 'transferIndex',
                value: index.toString(),
              },
            ],
          };
        }

        return baseTransfer;
      }),
      expiration: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    };

    // Headers
    /*
    const headers = {
      "Accept": "application/vnd.interoperability.bulkTransfers+json;version=1.0",
      "Content-Type": "application/vnd.interoperability.bulkTransfers+json;version=1.0",
      "Date": new Date().toUTCString(),
      "FSPIOP-Source": payerFsp,
      "FSPIOP-Destination": payeeFsp
    }; */
    const headers = {
      Accept: 'application/vnd.interoperability.bulkTransfers+json;version=1.0',
      'Content-Type':
        'application/vnd.interoperability.bulkTransfers+json;version=1.0',
      'FSPIOP-Source': payerFsp,
      'FSPIOP-Destination': payeeFsp,
      Date: new Date().toUTCString(),
    };

    const url = `${'https://bulk-api.mojaloop.xyz'}/bulkTransfers`;

    // Send to Hub
    const response = await axios.post(url, requestBody, { headers });

    // Response
    res.status(200).json({
      success: true,
      message: 'Bulk transfer initiated',
      bulkTransferId: bulkTransferId,
      bulkQuoteId: bulkQuoteId,
      payeeFsp: payeeFsp,
      transferCount: individualTransfers.length,
      hubResponse: response.data,
    });
  } catch (error) {
    console.error('❌ Error initiating bulk transfer:', error);

    if (error.response) {
      console.error('   Response status:', error.response.status);
      console.error('   Response data:', error.response.data);
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.response?.data || error.message,
    });
  }
});

app.post('/bulkTransfers', async (req, res) => {
  try {
    res.status(202).send();

    const { bulkTransferId, payerFsp, payeeFsp, individualTransfers } =
      req.body;

    const completedTimestamp = new Date().toISOString();

    // ✅ fulfilment uncommented!
    const individualTransferResults = individualTransfers.map((t) => ({
      transferId: t.transferId,
      transferState: 'COMMITTED',
      completedTimestamp: completedTimestamp,
      fulfilment: crypto.randomBytes(32).toString('base64url'), // ✅ UNCOMMENT!
    }));

    const hubUrl = `https://bulk-api.mojaloop.xyz/bulkTransfers/${bulkTransferId}`;

    const headers = {
      'Content-Type':
        'application/vnd.interoperability.bulkTransfers+json;version=1.0',
      Accept: 'application/vnd.interoperability.bulkTransfers+json;version=1.0',
      'FSPIOP-Source': payeeFsp,
      'FSPIOP-Destination': payerFsp,
      Date: new Date().toUTCString(),
    };

    await axios.put(
      hubUrl,
      {
        bulkTransferState: 'COMPLETED',
        individualTransferResults,
      },
      { headers },
    );

    console.log(`✅ Bulk transfer sent: ${bulkTransferId}`);
  } catch (err) {
    console.error('❌ Error:', err.message);
    if (err.response) {
      console.error('   Hub error:', err.response.data);
    }
  }
});
// Helper functions
function validateILPPacket(ilpPacket, condition) {
  try {
    if (!ilpPacket || !condition) return false;

    const decoded = Buffer.from(ilpPacket, 'base64').toString();
    const packet = JSON.parse(decoded);

    return packet && packet.amount;
  } catch (error) {
    return false;
  }
}

function generateFulfilment(condition) {
  return crypto.randomBytes(32).toString('base64url');
}

// All Bulk
// ===========================================================
const PORT = process.env.PORT || 5002;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
