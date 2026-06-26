/**************************************************************************
 * Copyright © 2026 Bangladeshi Software Ltd. All rights reserved.
 * Distributed under the license terms specified in this repository.
 *
 * ORIGINAL AUTHOR: Muhammad Nasim (Developer)
 **************************************************************************/

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
      'application/vnd.interoperability.transfers+json;version=1.0',
      'application/vnd.interoperability.quotes+json;version=2.0',
      'application/vnd.interoperability.quotes+json;version=1.1',
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

/////////////// UTILS FUNCTION ////////////////

async function generateDynamicILPData(ilpData) {
  const expirationTime = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const ilpPacket = Buffer.from(JSON.stringify(ilpData)).toString('base64');

  // fulfilment = random preimage
  const fulfilment = crypto.randomBytes(32).toString('base64url');

  // condition = SHA256(fulfilment) — Mojaloop validates this!
  const condition = crypto
    .createHash('sha256')
    .update(Buffer.from(fulfilment, 'base64url'))
    .digest('base64url');

  return { ilpPacket, condition, fulfilment, expiration: expirationTime };
}

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

    let headers = {};

    if (path.includes('/parties')) {
      headers = {
        'Content-Type':
          'application/vnd.interoperability.parties+json;version=2.0',
        Accept: 'application/vnd.interoperability.parties+json;version=2.0',
        'FSPIOP-Source': process.env.fspId,
        'FSPIOP-Destination': originalHeaders['fspiop-source'],
        Date: dynamicDate,
        'FSPIOP-HTTP-Method': 'PUT',
        'FSPIOP-URI': `/parties/${originalHeaders.partyIdType || 'unknown'}/${originalHeaders.partyIdentifier || 'unknown'}`,
        traceparent: traceId,
      };
    } else if (path.includes('/quotes')) {
      const quoteId = originalHeaders.quoteId || randomUUID();
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
      headers = {
        'Content-Type':
          'application/vnd.interoperability.transfers+json;version=1.0',
        Accept: 'application/vnd.interoperability.transfers+json;version=1.0',
        'FSPIOP-Source': process.env.fspId,
        'FSPIOP-Destination': originalHeaders['fspiop-source'],
        'FSPIOP-HTTP-Method': 'PUT',
        'FSPIOP-URI': `/transfers/${transferId}`,
        Date: dynamicDate,
        traceparent: traceId,
      };
    } else {
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

    const response = await fetch(hubCallbackUrl, options);

    if (response.status >= 200 && response.status < 300) {
      console.log('Callback sent successfully to hub');
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
      return;
    }

    const row = rows[0];

    if (row.status === newStatus) {
      return;
    }
    if (TERMINAL.includes(row.status)) {
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

    // Balance Debit
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

  const SCENARIO_MAP = {
    TRANSFER: 'P2P',
    PAYMENT: 'INSTANT',
    DEPOSIT: 'INSTANT',
    WITHDRAWAL: 'P2P',
    REFUND: 'P2P',
  };
  const scenario = body?.transactionType?.scenario || 'TRANSFER';
  const txnType = SCENARIO_MAP[scenario] || 'P2P';

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
       ?, 'INCOMING',
       ?, ?,
       ?, ?, ?,
       ?, ?,
       ?, ?,
       'QUOTE_REQUESTED', NOW()
     )`,
    [
      body?.quoteId || null,
      body?.transactionId || null,
      txnType,
      body?.payer?.partyIdInfo?.fspId || reqHeaders['fspiop-source'] || null,
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
}

async function recv_R3_transferReceived(body, reqHeaders) {
  const transferId = body?.transferId;
  if (!transferId) return;

  const byQuote = body?.quoteId
    ? await queryDB(
        `SELECT id FROM transactions
         WHERE quote_id = ? AND direction = 'INCOMING' LIMIT 1`,
        [body.quoteId],
      )
    : [];

  if (byQuote && byQuote.length > 0) {
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
    const already = await queryDB(
      `SELECT id FROM transactions
       WHERE transfer_id = ? AND direction = 'INCOMING' LIMIT 1`,
      [transferId],
    );
    if (already && already.length > 0) return;

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

//////////////////// CORE API //////////////////////

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

    const limit = Math.min(Math.max(parseInt(per_page) || 10, 1), 100);
    const offset = (Math.max(parseInt(page) || 1, 1) - 1) * limit;

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

    const countResult = await queryDB(
      `SELECT COUNT(*) AS total FROM merchant ${where}`,
      params,
    );
    const total = countResult[0]?.total || 0;
    const total_pages = Math.ceil(total / limit);

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
        id_value,
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
          subject: `A Bank Portal Access by — ${username}`,
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
          Your Financial Portal account has been successfully created by A Bank.
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
    res
      .status(500)
      .json({ message: 'Internal server error', error: error.message });
  }
});

app.delete('/api/parties/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;

    const merchant = await queryDB('SELECT * FROM merchant WHERE id = ?', [id]);

    if (merchant.length === 0) {
      return res.status(404).json({ message: 'Merchant not found' });
    }

    const { id_type, id_value, display_name } = merchant[0];

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
        // console.log(`[ALS] De-registered ${id_type}/${id_value}`);
      } else {
        // Non-fatal — log and continue with DB cleanup
      }
    } catch (alsErr) {
      alsStatus = `error: ${alsErr.message}`;
    }

    const users = await queryDB('SELECT id FROM users WHERE merchant_id = ?', [
      id,
    ]);

    if (users.length > 0) {
      await queryDB('DELETE FROM users WHERE merchant_id = ?', [id]);
      console.log(`[DB] Deleted ${users.length} user(s) for merchant ${id}`);
    }

    await queryDB('DELETE FROM merchant WHERE id = ?', [id]);
    console.log(`[DB] Deleted merchant ${id} (${display_name})`);

    return res.status(200).json({
      message: `Merchant "${display_name}" deleted successfully${users.length > 0 ? ` along with ${users.length} associated user(s)` : ''}`,
      als_status: alsStatus,
      users_deleted: users.length,
    });
  } catch (error) {
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

//////////////////////// INIT PROCESS ///////////////////////////

// Oracle party id verify to get FSP ID
app.get('/api/oracle-verify/:id_type/:id_value', async (req, res) => {
  const { id_type, id_value } = req.params;
  const url = `${process.env.ALS_SERVICE}/participants/${id_type}/${id_value}`;
  const options = {
    method: 'GET',
    headers: {
      'Content-Type':
        'application/vnd.interoperability.participants+json;version=1.1',
      Accept: 'application/vnd.interoperability.participants+json;version=1.1',
      'FSPIOP-Source': process.env.fspId,
      'FSPIOP-Destination': 'account-lookup-service',
      Authorization: 'Bearer asdfjkl;2e43Asdasa3a34ioaporigniginergk',
      Date: new Date().toUTCString(),
    },
  };
  await forwardRequestCore(res, url, options);
});

// Verity parties from payee side.
app.get('/api/verify-parties/:receiver_dfsp/:id/:number', async (req, res) => {
  const id = req.params?.id;
  const number = req.params?.number;
  const receiver_dfsp = req.params?.receiver_dfsp;
  const url = `${process.env.ALS_SERVICE}/parties/${id}/${number}`;
  const options = {
    method: 'GET',
    headers: {
      'Content-Type':
        'application/vnd.interoperability.parties+json;version=2.0',
      Accept: 'application/vnd.interoperability.parties+json;version=2.0',
      'FSPIOP-Source': process.env.fspId,
      'FSPIOP-Destination': receiver_dfsp || process.env.fspDes,
      Authorization: 'Bearer asdfjkl;2e43Asdasa3a34ioaporigniginergk',
      Date: new Date().toUTCString(),
    },
  };
  await forwardRequestCore(res, url, options);
});

// Init quote from payer side.
app.post('/api/init-quotes', async (req, res) => {
  try {
    const { payer_id, payee, amount, type = 'P2P' } = req.body;
    const quoteId = crypto.randomUUID();
    const transactionId = crypto.randomUUID();

    // get the payerfsp merchant data.

    const sql = `SELECT * FROM merchant WHERE id = ?`;
    const merchant = await queryDB(sql, [payer_id]);
    if (merchant?.length > 0) {
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

      const payer = merchant[0];
      const requestBody = {
        quoteId: quoteId,
        transactionId: transactionId,
        payer: {
          partyIdInfo: {
            partyIdType: payer?.id_type,
            partyIdentifier: payer?.id_value,
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

// Init transfer from payer side.
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
        'application/vnd.interoperability.transfers+json;version=2.0',
      Accept: 'application/vnd.interoperability.transfers+json;version=2.0',
      'FSPIOP-Source': payer_fsp,
      'FSPIOP-Destination': payee_fsp,
      'FSPIOP-HTTP-Method': 'POST',
      'FSPIOP-URI': '/transfers',
      Date: new Date().toUTCString(),
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

    await send_S3_transferSent({
      quote_id: quoteId,
      transfer_id: transferId,
    }).catch((e) => console.error('[SEND S3]', e.message));

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

///////////////// CALLBACK HANDLERS (Parties, Quotes, Transfers) //////////////////

// Parties Phase Callback

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

    // check response type
    if (Array.isArray(req?.body?.partyList)) {
      io.emit('alsRegisterOneCallback', callbackData);
    } else {
      io.emit('alsOracleVerifyCallback', callbackData);
    }
    res.status(200).send();
  } catch (error) {
    res.status(200).send();
  }
});

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
      if (req?.body?.errorInformation?.errorDescription == 'Party not found') {
        io.emit('alsOracleVerifyErrorCallback', callbackData);
      } else {
        io.emit('alsRegisterOneErrorCallback', callbackData);
      }
      res.status(200).send();
    } catch (error) {
      res.status(200).send();
    }
  },
);
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
    res.status(200).send();
  } catch (error) {
    res.status(200).send();
  }
});

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
    res.status(200).send();
  } catch (error) {
    console.error('Error processing batch error callback:', error);
    res.status(200).send();
  }
});

// Account Lookup Service Callback

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

// Quotes Phase Callback

app.post('/quotes', async (req, res) => {
  try {
    const sql = 'SELECT * FROM settings WHERE id = ?';
    const results = await queryDB(sql, [1]);
    const body = req.body;

    io.emit('postQuoteCallback', {
      params: req.params,
      query: req.query,
      headers: req.headers,
      body: req.body,
    });

    res.status(202).send();

    await recv_R1_createQuote(body, req.headers).catch((e) =>
      console.error('RECV R1', e.message),
    );

    try {
      const fee = results[0]?.quote_fee || 0;
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

      // save fulfilment in database
      await queryDB(
        `UPDATE transactions SET fulfilment = ? WHERE quote_id = ? AND direction = 'INCOMING'`,
        [dynamicILPData.fulfilment, body?.quoteId],
      ).catch((e) => console.error('[SAVE FULFILMENT]', e.message));

      const url = `${process.env.QUOTE_SERVICE}/quotes/${body?.quoteId}`;
      const headers = {
        'Content-Type':
          'application/vnd.interoperability.quotes+json;version=1.1',
        Date: new Date().toUTCString(),
        'FSPIOP-Source': body?.payee?.partyIdInfo?.fspId,
        'FSPIOP-Destination': body?.payer?.partyIdInfo?.fspId,
        'FSPIOP-HTTP-Method': 'PUT',
        'FSPIOP-URI': `/quotes/${body?.quoteId}`,
      };

      const payload = {
        transferAmount: {
          currency: body?.amount?.currency,
          amount: body?.amount?.amount,
        },
        payeeReceiveAmount: {
          currency: body?.amount?.currency,
          amount: receive_amount.toString(),
        },
        ilpPacket: dynamicILPData.ilpPacket,
        condition: dynamicILPData.condition,
        expiration: dynamicILPData.expiration,
        extensionList: {
          extension: [{ key: 'fees', value: fee_value.toString() }],
        },
      };

      const response = await axios.put(url, payload, { headers });

      await recv_R2_ilpSentToHub({
        quote_id: body?.quoteId,
        ilp_packet: dynamicILPData.ilpPacket || null,
        condition_hash: dynamicILPData.condition || null,
        expiration: dynamicILPData.expiration,
        receive_amount,
        fee: fee_value,
      }).catch((e) => console.error('[RECV R2]', e.message));
    } catch (err) {
      console.error('[QUOTE PUT ERROR]', err.response?.data || err.message);
    }
  } catch (error) {
    console.error('[POST /quotes ERROR]', error);
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
});

app.put('/quotes/:id/error', async (req, res) => {
  io.emit('putQuoteCallbackError', {
    params: req.params,
    query: req.query,
    headers: req.headers,
    body: req.body,
  });
  res.status(200).json({ message: 'Callback received' });
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
});

// Transfers Phase Callback

app.post('/transfers', async (req, res) => {
  try {
    const incomingBody = req.body;
    const transferId = incomingBody?.transferId;
    const completedTimestamp = new Date().toISOString();

    io.emit('postTransferCallback', {
      params: req.params,
      query: req.query,
      headers: req.headers,
      body: req.body,
    });

    await recv_R3_transferReceived(incomingBody, req.headers).catch((e) =>
      console.error('RECV R3', e.message),
    );

    // get correct fulfilment from db
    const txnRows = await queryDB(
      `SELECT fulfilment FROM transactions WHERE quote_id = ? AND direction = 'INCOMING' LIMIT 1`,
      [incomingBody?.quoteId],
    );
    const fulfilment =
      txnRows?.[0]?.fulfilment || crypto.randomBytes(32).toString('base64url');

    const url = `${process.env.ML_API_ADAPTER}/transfers/${transferId}`;
    const headers = {
      'Content-Type':
        'application/vnd.interoperability.transfers+json;version=2.0',
      Accept: 'application/vnd.interoperability.transfers+json;version=2.0',
      'FSPIOP-Source':
        incomingBody?.payeeFsp ||
        req.headers['fspiop-destination'] ||
        process.env.fspId,
      'FSPIOP-Destination':
        incomingBody?.payerFsp || req.headers['fspiop-source'],
      'FSPIOP-HTTP-Method': 'PUT',
      'FSPIOP-URI': `/transfers/${transferId}`,
      Date: new Date().toUTCString(),
    };

    const body = {
      completedTimestamp,
      transferState: 'COMMITTED',
      fulfilment,
    };

    console.log('[POST /transfers] PUT body:', JSON.stringify(body));
    await axios.put(url, body, { headers });

    await recv_R4_finalStatus(transferId, 'COMMITTED', { fulfilment }).catch(
      (e) => console.error('RECV R4', e.message),
    );

    res.status(202).json({ message: 'Callback received successfully' });
  } catch (error) {
    console.error(
      '[POST /transfers ERROR]',
      error.response?.data || error.message,
    );
    const tid = req.body?.transferId;
    if (tid) {
      await recv_R4_finalStatus(tid, 'FAILED', {
        error_code: '5000',
        error_description: error.message,
      }).catch(() => {});
    }
    res
      .status(202)
      .json({ message: 'Callback received with errors', error: error.message });
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
  const errInfo = body?.errorInformation || {};
  send_S4_finalStatus(transferId, 'FAILED', {
    error_code: errInfo.errorCode ?? null,
    error_description: errInfo.errorDescription ?? null,
  }).catch((e) => console.error('[SEND S4 error]', e.message));
});

const PORT = process.env.PORT || 5002;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
