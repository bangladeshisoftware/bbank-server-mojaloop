const db = require('../utils/db');
const { pool } = require('../config/db');

function queryDB(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, results) => {
      if (err) reject(err);
      else resolve(results);
    });
  });
}

const getTransactions = async (req, res) => {
  try {
    const {
      direction,
      search,
      type,
      status,
      merchant_id,
      date_from,
      date_to,
      page = 1,
      per_page = 20,
    } = req.query;
    const user = req.user;
    // if user.role=='MERCHANT', then query user.merchant_id

    // ── Pagination ────────────────────────────────────────────
    const limit = Math.min(Math.max(parseInt(per_page) || 20, 1), 100);
    const offset = (Math.max(parseInt(page) || 1, 1) - 1) * limit;

    // ── Build WHERE clauses dynamically ──────────────────────
    const conditions = [];
    const params = [];

    // direction filter
    if (direction) {
      const dir = direction.toLowerCase() === 'send' ? 'OUTGOING' : 'INCOMING';
      conditions.push(`t.direction = ?`);
      params.push(dir);
    }

    // type filter
    if (type) {
      conditions.push(`t.type = ?`);
      params.push(type.toUpperCase());
    }

    // status filter
    if (status) {
      conditions.push(`t.status = ?`);
      params.push(status.toUpperCase());
    }

    // merchant_id filter
    if (user?.role == 'MERCHANT' && user?.merchant_id) {
      conditions.push(`t.merchant_id = ?`);
      params.push(user?.merchant_id);
    } else if (merchant_id) {
      conditions.push(`t.merchant_id = ?`);
      params.push(merchant_id);
    }

    // date range filter
    if (date_from) {
      conditions.push(`DATE(t.created_at) >= ?`);
      params.push(date_from);
    }
    if (date_to) {
      conditions.push(`DATE(t.created_at) <= ?`);
      params.push(date_to);
    }

    // free text search: transfer_id | transaction_id | quote_id | amount
    if (search && search.trim()) {
      const like = `%${search.trim()}%`;
      conditions.push(`(
        t.transfer_id    LIKE ? OR
        t.transaction_id LIKE ? OR
        t.quote_id       LIKE ? OR
        CAST(t.amount AS CHAR) LIKE ?
      )`);
      params.push(like, like, like, like);
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // ── Count total matching rows ─────────────────────────────
    const countSQL = `
      SELECT COUNT(*) AS total
      FROM transactions t
      ${whereClause}
    `;
    const countResult = await queryDB(countSQL, params);
    const total = countResult[0]?.total || 0;
    const total_pages = Math.ceil(total / limit);

    // ── Fetch paginated rows ──────────────────────────────────
    const dataSQL = `
      SELECT
        t.id,
        t.transfer_id,
        t.quote_id,
        t.transaction_id,
        t.type,
        t.direction,
        t.status,

        t.payer_fsp,
        t.payee_fsp,
        t.payer_id_type,
        t.payer_id_value,
        t.payer_name,
        t.payee_id_type,
        t.payee_id_value,
        t.payee_name,

        t.merchant_id,
        t.amount,
        t.currency,
        t.fee,
        t.receive_amount,

        t.condition_hash,
        t.fulfilment,
        t.expiration,

        t.error_code,
        t.error_description,

        t.quote_at,
        t.transfer_at,
        t.completed_at,
        t.created_at,
        t.updated_at

      FROM transactions t
      ${whereClause}
      ORDER BY t.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const dataParams = [...params, limit, offset];
    const rows = await queryDB(dataSQL, dataParams);

    // ── Response ──────────────────────────────────────────────
    return res.status(200).json({
      success: true,
      data: rows,
      pagination: {
        total,
        total_pages,
        current_page: parseInt(page) || 1,
        per_page: limit,
        has_next: (parseInt(page) || 1) < total_pages,
        has_prev: (parseInt(page) || 1) > 1,
      },
      filters: {
        direction: direction || null,
        search: search || null,
        type: type || null,
        status: status || null,
        merchant_id: merchant_id || null,
        date_from: date_from || null,
        date_to: date_to || null,
      },
    });
  } catch (error) {
    console.error('[TXN] getTransactions error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};

const getTransactionSummary = async (req, res) => {
  try {
    const user = req.user;

    const { date_from, date_to, direction } = req.query;

    const conditions = [];
    const params = [];

    if (direction) {
      const dir = direction.toLowerCase() === 'send' ? 'OUTGOING' : 'INCOMING';
      conditions.push(`direction = ?`);
      params.push(dir);
    }
    if (user?.role == 'MERCHANT' && user?.merchant_id) {
      conditions.push(`merchant_id = ?`);
      params.push(user?.merchant_id);
    }
    if (date_from) {
      conditions.push(`DATE(created_at) >= ?`);
      params.push(date_from);
    }
    if (date_to) {
      conditions.push(`DATE(created_at) <= ?`);
      params.push(date_to);
    }

    const whereBase =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // ── Per-type aggregation in a single query ────────────────
    const summarySQL = `
      SELECT
        type,
        direction,

        COUNT(*)                                                           AS total_count,
        COALESCE(SUM(amount), 0)                                           AS total_amount,
        COALESCE(SUM(receive_amount), 0)                                   AS total_receive_amount,
        COALESCE(SUM(fee), 0)                                              AS total_fee,

        SUM(CASE WHEN status = 'COMMITTED'    THEN 1 ELSE 0 END)          AS committed_count,
        COALESCE(SUM(CASE WHEN status = 'COMMITTED'
                     THEN amount ELSE 0 END), 0)                           AS committed_amount,

        SUM(CASE WHEN status = 'FAILED'       THEN 1 ELSE 0 END)          AS failed_count,
        SUM(CASE WHEN status = 'ABORTED'      THEN 1 ELSE 0 END)          AS aborted_count,
        SUM(CASE WHEN status = 'EXPIRED'      THEN 1 ELSE 0 END)          AS expired_count,

        SUM(CASE WHEN status IN (
              'PENDING','QUOTE_REQUESTED','QUOTE_RECEIVED','TRANSFER_SENT'
            ) THEN 1 ELSE 0 END)                                           AS pending_count

      FROM transactions
      ${whereBase}
      GROUP BY type, direction
      ORDER BY type, direction
    `;

    const rows = await queryDB(summarySQL, params);

    // ── Structure: one card per type ─────────────────────────
    const TYPES = ['P2P', 'INSTANT', 'BULK', 'NBPS', 'RTGS', 'BEFTN'];

    const cards = {};

    for (const txType of TYPES) {
      const outRow = rows.find(
        (r) => r.type === txType && r.direction === 'OUTGOING',
      );
      const inRow = rows.find(
        (r) => r.type === txType && r.direction === 'INCOMING',
      );

      const merge = (row) =>
        row
          ? {
              total_count: Number(row.total_count),
              total_amount: Number(row.total_amount),
              receive_amount: Number(row.total_receive_amount),
              total_fee: Number(row.total_fee),
              committed_count: Number(row.committed_count),
              committed_amount: Number(row.committed_amount),
              failed_count: Number(row.failed_count),
              aborted_count: Number(row.aborted_count),
              expired_count: Number(row.expired_count),
              pending_count: Number(row.pending_count),
            }
          : {
              total_count: 0,
              total_amount: 0,
              receive_amount: 0,
              total_fee: 0,
              committed_count: 0,
              committed_amount: 0,
              failed_count: 0,
              aborted_count: 0,
              expired_count: 0,
              pending_count: 0,
            };

      const out = merge(outRow);
      const inc = merge(inRow);

      cards[txType] = {
        type: txType,
        // combined totals
        total_count: out.total_count + inc.total_count,
        total_amount: out.total_amount + inc.total_amount,
        committed_count: out.committed_count + inc.committed_count,
        committed_amount: out.committed_amount + inc.committed_amount,
        failed_count: out.failed_count + inc.failed_count,
        pending_count: out.pending_count + inc.pending_count,
        // split by direction
        send: out,
        receive: inc,
      };
    }

    // ── Grand total across all types ─────────────────────────
    const allRows = rows;
    const grand = {
      total_count: allRows.reduce((s, r) => s + Number(r.total_count), 0),
      total_amount: allRows.reduce((s, r) => s + Number(r.total_amount), 0),
      committed_count: allRows.reduce(
        (s, r) => s + Number(r.committed_count),
        0,
      ),
      committed_amount: allRows.reduce(
        (s, r) => s + Number(r.committed_amount),
        0,
      ),
      failed_count: allRows.reduce((s, r) => s + Number(r.failed_count), 0),
      pending_count: allRows.reduce((s, r) => s + Number(r.pending_count), 0),
    };

    return res.status(200).json({
      success: true,
      summary: {
        grand_total: grand,
        cards, // keyed by type: cards.P2P, cards.RTGS, etc.
        cards_array: Object.values(cards), // array version for easy frontend loop
      },
      filters: {
        date_from: date_from || null,
        date_to: date_to || null,
        direction: direction || null,
      },
    });
  } catch (error) {
    console.error('[TXN] getTransactionSummary error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};

const getTransactionById = async (req, res) => {
  try {
    const { id } = req.params;

    const sql = `
      SELECT
        t.*
      FROM transactions t
      WHERE
        t.id             = ? OR
        t.transfer_id    = ? OR
        t.quote_id       = ? OR
        t.transaction_id = ?
      LIMIT 1
    `;

    const rows = await queryDB(sql, [id, id, id, id]);

    if (!rows || rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: 'Transaction not found' });
    }

    return res.status(200).json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('[TXN] getTransactionById error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
};

const getMerchantDashboard = async (req, res) => {
  try {
    const { role, merchant_id: tokenMerchantId } = req.user;

    let merchantId;
    if (role === 'MERCHANT') {
      merchantId = tokenMerchantId;
      if (!merchantId) {
        return res.status(400).json({
          error: 'Merchant ID not found in token. Contact administrator.',
        });
      }
    } else {
      // ADMIN can pass ?merchant_id= to inspect any merchant
      merchantId = req.query.merchant_id || null;
      if (!merchantId) {
        return res
          .status(400)
          .json({ error: 'merchant_id query param required for ADMIN role.' });
      }
    }

    const [merchantRows] = await pool.execute(
      `SELECT id, display_name, first_name, last_name,
              id_type, id_value, acc_no, status,
              daily_limit, single_transaction_limit
       FROM merchant
       WHERE id = ?
       LIMIT 1`,
      [merchantId],
    );

    if (!merchantRows.length) {
      return res.status(404).json({ error: 'Merchant not found' });
    }

    const merchant = merchantRows[0];
    const dailyLimit = parseFloat(merchant.daily_limit || 0);
    const singleLimit = parseFloat(merchant.single_transaction_limit || 0);

    const [[usageRow]] = await pool.execute(
      `SELECT COALESCE(SUM(
         CASE WHEN status = 'COMMITTED' AND direction = 'OUTGOING'
              THEN amount ELSE 0 END
       ), 0) AS used_today
       FROM transactions
       WHERE merchant_id = ?
         AND DATE(created_at) = CURDATE()`,
      [merchantId],
    );

    const usedToday = parseFloat(usageRow.used_today || 0);
    const remaining =
      dailyLimit > 0 ? Math.max(dailyLimit - usedToday, 0) : null;
    const usagePct =
      dailyLimit > 0
        ? parseFloat(Math.min((usedToday / dailyLimit) * 100, 100).toFixed(1))
        : 0;

    const [[todayStats]] = await pool.execute(
      `SELECT
         COUNT(*)                                                                AS total,
         COALESCE(SUM(status = 'COMMITTED'), 0)                                 AS committed,
         COALESCE(SUM(status = 'FAILED'), 0)                                    AS failed,
         COALESCE(SUM(status = 'ABORTED'), 0)                                   AS aborted,
         COALESCE(SUM(status = 'EXPIRED'), 0)                                   AS expired,
         COALESCE(SUM(status IN (
           'PENDING','QUOTE_REQUESTED','QUOTE_RECEIVED','TRANSFER_SENT'
         )), 0)                                                                  AS pending,
         COALESCE(SUM(CASE WHEN status='COMMITTED' THEN fee  ELSE 0 END), 0)    AS total_fee,

         -- SEND (OUTGOING)
         COALESCE(SUM(CASE WHEN direction='OUTGOING' THEN 1  ELSE 0 END), 0)    AS send_count,
         COALESCE(SUM(CASE WHEN direction='OUTGOING' AND status='COMMITTED'
                      THEN 1 ELSE 0 END), 0)                                    AS send_committed_count,
         COALESCE(SUM(CASE WHEN direction='OUTGOING' AND status='COMMITTED'
                      THEN amount ELSE 0 END), 0)                               AS send_committed_amount,

         -- RECEIVE (INCOMING)
         COALESCE(SUM(CASE WHEN direction='INCOMING' THEN 1  ELSE 0 END), 0)    AS receive_count,
         COALESCE(SUM(CASE WHEN direction='INCOMING' AND status='COMMITTED'
                      THEN 1 ELSE 0 END), 0)                                    AS receive_committed_count,
         COALESCE(SUM(CASE WHEN direction='INCOMING' AND status='COMMITTED'
                      THEN amount ELSE 0 END), 0)                               AS receive_committed_amount

       FROM transactions
       WHERE merchant_id = ?
         AND DATE(created_at) = CURDATE()`,
      [merchantId],
    );

    const [typeRows] = await pool.execute(
      `SELECT
         type,
         direction,
         COUNT(*)                                                                AS total,
         COALESCE(SUM(status = 'COMMITTED'), 0)                                 AS committed,
         COALESCE(SUM(status = 'FAILED'), 0)                                    AS failed,
         COALESCE(SUM(CASE WHEN status='COMMITTED' THEN amount ELSE 0 END), 0)  AS committed_amount,
         COALESCE(SUM(CASE WHEN status='COMMITTED' THEN fee    ELSE 0 END), 0)  AS total_fee
       FROM transactions
       WHERE merchant_id = ?
         AND DATE(created_at) = CURDATE()
       GROUP BY type, direction
       ORDER BY type, direction`,
      [merchantId],
    );

    // Normalize into { P2P: { send:{}, receive:{} }, ... }
    const TYPE_LIST = ['P2P', 'INSTANT', 'BULK', 'NBPS', 'RTGS', 'BEFTN'];
    const empty = () => ({
      total: 0,
      committed: 0,
      failed: 0,
      committed_amount: 0,
      total_fee: 0,
    });

    const type_breakdown = {};
    for (const t of TYPE_LIST) {
      const outRow = typeRows.find(
        (r) => r.type === t && r.direction === 'OUTGOING',
      );
      const inRow = typeRows.find(
        (r) => r.type === t && r.direction === 'INCOMING',
      );

      const shape = (row) =>
        row
          ? {
              total: parseInt(row.total || 0),
              committed: parseInt(row.committed || 0),
              failed: parseInt(row.failed || 0),
              committed_amount: parseFloat(row.committed_amount || 0),
              total_fee: parseFloat(row.total_fee || 0),
            }
          : empty();

      type_breakdown[t] = { send: shape(outRow), receive: shape(inRow) };
    }

    const [recent] = await pool.execute(
      `SELECT id, transfer_id, quote_id,
              type, direction, status,
              payer_fsp, payee_fsp,
              payer_name, payee_name,
              payer_id_value, payee_id_value,
              amount, currency, fee, receive_amount,
              error_code, error_description,
              created_at, completed_at
       FROM transactions
       WHERE merchant_id = ?
       ORDER BY created_at DESC
       LIMIT 5`,
      [merchantId],
    );

    return res.json({
      merchant: {
        id: merchant.id,
        display_name: merchant.display_name,
        full_name:
          `${merchant.first_name || ''} ${merchant.last_name || ''}`.trim(),
        id_type: merchant.id_type,
        id_value: merchant.id_value,
        acc_no: merchant.acc_no,
        status: merchant.status,
      },

      limits: {
        daily_limit: dailyLimit,
        single_transaction_limit: singleLimit,
        used_today: usedToday,
        remaining_today: remaining,
        usage_pct: usagePct,
        daily_limit_set: dailyLimit > 0,
        single_limit_set: singleLimit > 0,
      },

      today: {
        total: parseInt(todayStats.total || 0),
        committed: parseInt(todayStats.committed || 0),
        failed: parseInt(todayStats.failed || 0),
        aborted: parseInt(todayStats.aborted || 0),
        expired: parseInt(todayStats.expired || 0),
        pending: parseInt(todayStats.pending || 0),
        total_fee: parseFloat(todayStats.total_fee || 0),

        send: {
          count: parseInt(todayStats.send_count || 0),
          committed_count: parseInt(todayStats.send_committed_count || 0),
          committed_amount: parseFloat(todayStats.send_committed_amount || 0),
        },
        receive: {
          count: parseInt(todayStats.receive_count || 0),
          committed_count: parseInt(todayStats.receive_committed_count || 0),
          committed_amount: parseFloat(
            todayStats.receive_committed_amount || 0,
          ),
        },
      },

      type_breakdown,
      recent,
    });
  } catch (err) {
    console.error('[TXN] getMerchantDashboard:', err);
    return res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getTransactions,
  getTransactionSummary,
  getTransactionById,
  getMerchantDashboard,
};
