// ================================================================
//  DASHBOARD CONTROLLER
//  File : src/controllers/dashboard.controller.js
//
//  GET /api/dashboard/summary
//
//  Uses: transactions table (direction: OUTGOING|INCOMING)
//        merchants table
//        users table
// ================================================================

const { pool } = require('../config/db');

exports.getSummary = async (req, res) => {
  try {

    // ── 1. TODAY ─────────────────────────────────────────────
    const [[today]] = await pool.execute(`
      SELECT
        COUNT(*)                                                        AS total,
        COALESCE(SUM(status = 'COMMITTED'), 0)                         AS committed,
        COALESCE(SUM(status = 'FAILED'), 0)                            AS failed,
        COALESCE(SUM(status = 'ABORTED'), 0)                           AS aborted,
        COALESCE(SUM(status = 'EXPIRED'), 0)                           AS expired,
        COALESCE(SUM(status IN (
          'PENDING','QUOTE_REQUESTED','QUOTE_RECEIVED','TRANSFER_SENT'
        )), 0)                                                          AS pending,

        -- SEND (OUTGOING committed)
        COALESCE(SUM(CASE WHEN direction='OUTGOING' AND status='COMMITTED'
                     THEN amount ELSE 0 END), 0)                       AS sent_amount,
        COALESCE(SUM(CASE WHEN direction='OUTGOING' AND status='COMMITTED'
                     THEN 1 ELSE 0 END), 0)                            AS sent_count,

        -- RECEIVE (INCOMING committed)
        COALESCE(SUM(CASE WHEN direction='INCOMING' AND status='COMMITTED'
                     THEN amount ELSE 0 END), 0)                       AS received_amount,
        COALESCE(SUM(CASE WHEN direction='INCOMING' AND status='COMMITTED'
                     THEN 1 ELSE 0 END), 0)                            AS received_count,

        -- Fee collected
        COALESCE(SUM(CASE WHEN status='COMMITTED' THEN fee ELSE 0 END), 0) AS total_fee,

        -- Total committed volume (both directions)
        COALESCE(SUM(CASE WHEN status='COMMITTED' THEN amount ELSE 0 END), 0) AS committed_volume

      FROM transactions
      WHERE DATE(created_at) = CURDATE()
    `);

    // ── 2. YESTERDAY ─────────────────────────────────────────
    const [[yesterday]] = await pool.execute(`
      SELECT
        COUNT(*)                                                        AS total,
        COALESCE(SUM(status = 'COMMITTED'), 0)                         AS committed,
        COALESCE(SUM(status = 'FAILED'), 0)                            AS failed,
        COALESCE(SUM(CASE WHEN direction='OUTGOING' AND status='COMMITTED'
                     THEN amount ELSE 0 END), 0)                       AS sent_amount,
        COALESCE(SUM(CASE WHEN direction='INCOMING' AND status='COMMITTED'
                     THEN amount ELSE 0 END), 0)                       AS received_amount,
        COALESCE(SUM(CASE WHEN status='COMMITTED' THEN amount ELSE 0 END), 0) AS committed_volume
      FROM transactions
      WHERE DATE(created_at) = CURDATE() - INTERVAL 1 DAY
    `);

    // ── 3. THIS MONTH ─────────────────────────────────────────
    const [[this_month]] = await pool.execute(`
      SELECT
        COUNT(*)                                                        AS total,
        COALESCE(SUM(status = 'COMMITTED'), 0)                         AS committed,
        COALESCE(SUM(status = 'FAILED'), 0)                            AS failed,
        COALESCE(SUM(CASE WHEN status='COMMITTED' THEN amount ELSE 0 END), 0) AS volume,
        COALESCE(SUM(CASE WHEN direction='OUTGOING' AND status='COMMITTED'
                     THEN amount ELSE 0 END), 0)                       AS sent_amount,
        COALESCE(SUM(CASE WHEN direction='INCOMING' AND status='COMMITTED'
                     THEN amount ELSE 0 END), 0)                       AS received_amount,
        COALESCE(SUM(CASE WHEN status='COMMITTED' THEN fee ELSE 0 END), 0) AS total_fee
      FROM transactions
      WHERE MONTH(created_at) = MONTH(CURDATE())
        AND YEAR(created_at)  = YEAR(CURDATE())
    `);

    // ── 4. LAST 7 DAYS (for trend) ────────────────────────────
    const [last7days] = await pool.execute(`
      SELECT
        DATE(created_at)                                                AS date,
        COUNT(*)                                                        AS total,
        COALESCE(SUM(status = 'COMMITTED'), 0)                         AS committed,
        COALESCE(SUM(status = 'FAILED'), 0)                            AS failed,
        COALESCE(SUM(CASE WHEN direction='OUTGOING' AND status='COMMITTED'
                     THEN amount ELSE 0 END), 0)                       AS sent_amount,
        COALESCE(SUM(CASE WHEN direction='INCOMING' AND status='COMMITTED'
                     THEN amount ELSE 0 END), 0)                       AS received_amount,
        COALESCE(SUM(CASE WHEN status='COMMITTED' THEN amount ELSE 0 END), 0) AS volume
      FROM transactions
      WHERE created_at >= CURDATE() - INTERVAL 6 DAY
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `);

    // ── 5. HOURLY (last 24h) ──────────────────────────────────
    const [hourly] = await pool.execute(`
      SELECT
        HOUR(created_at)                                                AS hour,
        COUNT(*)                                                        AS total,
        COALESCE(SUM(status = 'COMMITTED'), 0)                         AS committed,
        COALESCE(SUM(CASE WHEN direction='OUTGOING' AND status='COMMITTED'
                     THEN amount ELSE 0 END), 0)                       AS sent_amount,
        COALESCE(SUM(CASE WHEN direction='INCOMING' AND status='COMMITTED'
                     THEN amount ELSE 0 END), 0)                       AS received_amount
      FROM transactions
      WHERE created_at >= NOW() - INTERVAL 24 HOUR
      GROUP BY HOUR(created_at)
      ORDER BY hour ASC
    `);

    // ── 6. TYPE BREAKDOWN (today) ─────────────────────────────
    const [type_breakdown] = await pool.execute(`
      SELECT
        type,
        COUNT(*)                                                        AS total,
        COALESCE(SUM(status = 'COMMITTED'), 0)                         AS committed,
        COALESCE(SUM(status = 'FAILED'), 0)                            AS failed,
        COALESCE(SUM(CASE WHEN status='COMMITTED' THEN amount ELSE 0 END), 0) AS volume,
        COALESCE(SUM(CASE WHEN direction='OUTGOING' THEN 1 ELSE 0 END), 0)   AS sent_count,
        COALESCE(SUM(CASE WHEN direction='INCOMING' THEN 1 ELSE 0 END), 0)   AS received_count
      FROM transactions
      WHERE DATE(created_at) = CURDATE()
      GROUP BY type
      ORDER BY total DESC
    `);

    // ── 7. STATUS DISTRIBUTION (today) ───────────────────────
    const [status_dist] = await pool.execute(`
      SELECT
        status,
        COUNT(*) AS count,
        COALESCE(SUM(amount), 0) AS amount
      FROM transactions
      WHERE DATE(created_at) = CURDATE()
      GROUP BY status
      ORDER BY count DESC
    `);

    // ── 8. RECENT TRANSACTIONS (last 10) ─────────────────────
    const [recent] = await pool.execute(`
      SELECT
        t.id, t.transfer_id, t.quote_id,
        t.type, t.direction, t.status,
        t.payer_fsp, t.payee_fsp,
        t.payer_name, t.payee_name,
        t.payer_id_value, t.payee_id_value,
        t.amount, t.currency, t.fee,
        t.created_at, t.completed_at
      FROM transactions t
      ORDER BY t.created_at DESC
      LIMIT 10
    `);

    // ── 9. MERCHANTS ──────────────────────────────────────────
    const [[merchants]] = await pool.execute(`
      SELECT
        COUNT(*)                              AS total,
        COALESCE(SUM(status = 'ACTIVE'), 0)   AS active,
        COALESCE(SUM(status = 'INACTIVE'), 0) AS inactive,
        COALESCE(SUM(status = 'SUSPENDED'), 0) AS suspended
      FROM merchant
    `);

    // ── 10. USERS ─────────────────────────────────────────────
    const [[users_summary]] = await pool.execute(`
      SELECT
        COUNT(*)                              AS total,
        COALESCE(SUM(is_active = 1), 0)       AS active,
        COALESCE(SUM(role = 'ADMIN'), 0)       AS admins,
        COALESCE(SUM(role = 'MERCHANT'), 0)    AS merchants
      FROM users
    `);

    // ── 11. TOP MERCHANTS by volume (this month) ──────────────
    const [top_merchants] = await pool.execute(`
      SELECT
        t.merchant_id,
        m.display_name AS merchant_name,
        m.id_value,
        COUNT(*)                                                         AS total_txn,
        COALESCE(SUM(CASE WHEN t.status='COMMITTED' THEN t.amount ELSE 0 END), 0) AS volume,
        COALESCE(SUM(t.status = 'COMMITTED'), 0)                         AS committed,
        COALESCE(SUM(t.status = 'FAILED'), 0)                            AS failed
      FROM transactions t
      LEFT JOIN merchant m ON t.merchant_id = m.id
      WHERE t.merchant_id IS NOT NULL
        AND MONTH(t.created_at) = MONTH(CURDATE())
        AND YEAR(t.created_at)  = YEAR(CURDATE())
      GROUP BY t.merchant_id, m.display_name, m.id_value
      ORDER BY volume DESC
      LIMIT 5
    `);

    // ── 12. TODAY vs YESTERDAY comparison ────────────────────
    const todayVol     = parseFloat(today.committed_volume || 0);
    const yestVol      = parseFloat(yesterday.committed_volume || 0);
    const vol_change   = yestVol > 0 ? ((todayVol - yestVol) / yestVol * 100).toFixed(1) : null;

    const todayCount   = parseInt(today.committed || 0);
    const yestCount    = parseInt(yesterday.committed || 0);
    const count_change = yestCount > 0 ? ((todayCount - yestCount) / yestCount * 100).toFixed(1) : null;

    // ── Response ──────────────────────────────────────────────
    return res.json({
      today: {
        ...today,
        // ensure numbers
        total:            parseInt(today.total || 0),
        committed:        parseInt(today.committed || 0),
        failed:           parseInt(today.failed || 0),
        aborted:          parseInt(today.aborted || 0),
        expired:          parseInt(today.expired || 0),
        pending:          parseInt(today.pending || 0),
        sent_amount:      parseFloat(today.sent_amount || 0),
        sent_count:       parseInt(today.sent_count || 0),
        received_amount:  parseFloat(today.received_amount || 0),
        received_count:   parseInt(today.received_count || 0),
        total_fee:        parseFloat(today.total_fee || 0),
        committed_volume: parseFloat(today.committed_volume || 0),
      },
      yesterday: {
        total:            parseInt(yesterday.total || 0),
        committed:        parseInt(yesterday.committed || 0),
        failed:           parseInt(yesterday.failed || 0),
        sent_amount:      parseFloat(yesterday.sent_amount || 0),
        received_amount:  parseFloat(yesterday.received_amount || 0),
        committed_volume: parseFloat(yesterday.committed_volume || 0),
      },
      this_month: {
        total:           parseInt(this_month.total || 0),
        committed:       parseInt(this_month.committed || 0),
        failed:          parseInt(this_month.failed || 0),
        volume:          parseFloat(this_month.volume || 0),
        sent_amount:     parseFloat(this_month.sent_amount || 0),
        received_amount: parseFloat(this_month.received_amount || 0),
        total_fee:       parseFloat(this_month.total_fee || 0),
      },
      comparison: {
        vol_change_pct:   vol_change   ? parseFloat(vol_change)   : null,
        count_change_pct: count_change ? parseFloat(count_change) : null,
        vol_up:           vol_change   ? parseFloat(vol_change) >= 0   : null,
        count_up:         count_change ? parseFloat(count_change) >= 0 : null,
      },
      last7days,
      hourly,
      type_breakdown,
      status_dist,
      recent,
      merchants: {
        total:     parseInt(merchants.total     || 0),
        active:    parseInt(merchants.active    || 0),
        inactive:  parseInt(merchants.inactive  || 0),
        suspended: parseInt(merchants.suspended || 0),
      },
      users: {
        total:     parseInt(users_summary.total     || 0),
        active:    parseInt(users_summary.active    || 0),
        admins:    parseInt(users_summary.admins    || 0),
        merchants: parseInt(users_summary.merchants || 0),
      },
      top_merchants,
    });

  } catch (err) {
    console.error('[DASHBOARD] getSummary error:', err);
    return res.status(500).json({ error: err.message });
  }
};
