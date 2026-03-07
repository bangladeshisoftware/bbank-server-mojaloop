const { pool } = require('../config/db');

exports.updateBalance = async ({
  merchant_id,
  user_id = null,
  transaction_id = null,
  transfer_id = null,
  type,
  amount,
  fee = 0,
  currency = 'BDT',
  note = null,
}) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // ── 1. Ensure wallet row exists ───────────────────────────
    await conn.execute(
      `INSERT INTO merchant_wallet
         (merchant_id, user_id, balance, total_credit, total_debit, total_fee, currency)
       VALUES (?, ?, 0, 0, 0, 0, ?)
       ON DUPLICATE KEY UPDATE merchant_id = merchant_id`, // no-op if exists
      [merchant_id, user_id, currency],
    );

    // ── 2. Lock wallet row & get current balance ──────────────
    const [[wallet]] = await conn.execute(
      `SELECT balance FROM merchant_wallet
       WHERE merchant_id = ? FOR UPDATE`,
      [merchant_id],
    );

    const balanceBefore = parseFloat(wallet?.balance || 0);
    const amt = parseFloat(amount || 0);
    const feeAmt = parseFloat(fee || 0);

    // ── 3. Calculate new balance ──────────────────────────────
    let balanceAfter;
    if (type === 'CREDIT') {
      balanceAfter = balanceBefore + amt;
    } else {
      // DEBIT: subtract amount + fee
      balanceAfter = balanceBefore - amt - feeAmt;
    }

    // ── 4. Update wallet ──────────────────────────────────────
    if (type === 'CREDIT') {
      await conn.execute(
        `UPDATE merchant_wallet
         SET balance       = balance + ?,
             total_credit  = total_credit + ?,
             total_fee     = total_fee + ?,
             updated_at    = NOW()
         WHERE merchant_id = ?`,
        [amt, amt, feeAmt, merchant_id],
      );
    } else {
      await conn.execute(
        `UPDATE merchant_wallet
         SET balance      = balance - ? - ?,
             total_debit  = total_debit + ?,
             total_fee    = total_fee + ?,
             updated_at   = NOW()
         WHERE merchant_id = ?`,
        [amt, feeAmt, amt, feeAmt, merchant_id],
      );
    }

    await conn.execute(
      `INSERT INTO merchant_balance
         (merchant_id, user_id, transaction_id, transfer_id,
          type, amount, fee, balance_before, balance_after,
          currency, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        merchant_id,
        user_id,
        transaction_id,
        transfer_id,
        type,
        amt,
        feeAmt,
        balanceBefore,
        balanceAfter,
        currency,
        note,
      ],
    );

    await conn.commit();

    console.log(
      `[BALANCE] ${type} ৳${amt} | merchant=${merchant_id} | ` +
        `before=৳${balanceBefore} → after=৳${balanceAfter}`,
    );
  } catch (err) {
    await conn.rollback();
    console.error('[BALANCE] updateBalance failed:', err.message);
    throw err;
  } finally {
    conn.release();
  }
};

exports.updateBalanceByAdmin = async (req, res) => {
  const {
    merchant_id,
    user_id = null,
    transaction_id = null,
    transfer_id = null,
    type,
    amount,
    fee = 0,
    currency = 'BDT',
    note = null,
  } = req.body;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // ── 1. Ensure wallet row exists ───────────────────────────
    await conn.execute(
      `INSERT INTO merchant_wallet
         (merchant_id, user_id, balance, total_credit, total_debit, total_fee, currency)
       VALUES (?, ?, 0, 0, 0, 0, ?)
       ON DUPLICATE KEY UPDATE merchant_id = merchant_id`, // no-op if exists
      [merchant_id, user_id, currency],
    );

    // ── 2. Lock wallet row & get current balance ──────────────
    const [[wallet]] = await conn.execute(
      `SELECT balance FROM merchant_wallet
       WHERE merchant_id = ? FOR UPDATE`,
      [merchant_id],
    );

    const balanceBefore = parseFloat(wallet?.balance || 0);
    const amt = parseFloat(amount || 0);
    const feeAmt = parseFloat(fee || 0);

    // ── 3. Calculate new balance ──────────────────────────────
    let balanceAfter;
    if (type === 'CREDIT') {
      balanceAfter = balanceBefore + amt;
    } else {
      // DEBIT: subtract amount + fee
      balanceAfter = balanceBefore - amt - feeAmt;
    }

    // ── 4. Update wallet ──────────────────────────────────────
    if (type === 'CREDIT') {
      await conn.execute(
        `UPDATE merchant_wallet
         SET balance       = balance + ?,
             total_credit  = total_credit + ?,
             total_fee     = total_fee + ?,
             updated_at    = NOW()
         WHERE merchant_id = ?`,
        [amt, amt, feeAmt, merchant_id],
      );
    } else {
      await conn.execute(
        `UPDATE merchant_wallet
         SET balance      = balance - ? - ?,
             total_debit  = total_debit + ?,
             total_fee    = total_fee + ?,
             updated_at   = NOW()
         WHERE merchant_id = ?`,
        [amt, feeAmt, amt, feeAmt, merchant_id],
      );
    }

    await conn.execute(
      `INSERT INTO merchant_balance
         (merchant_id, user_id, transaction_id, transfer_id,
          type, amount, fee, balance_before, balance_after,
          currency, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        merchant_id,
        user_id,
        transaction_id,
        transfer_id,
        type,
        amt,
        feeAmt,
        balanceBefore,
        balanceAfter,
        currency,
        note,
      ],
    );

    await conn.commit();

    console.log(
      `[BALANCE] ${type} ৳${amt} | merchant=${merchant_id} | ` +
        `before=৳${balanceBefore} → after=৳${balanceAfter}`,
    );
    res.status(400).json({ message: 'balance added.' });
  } catch (err) {
    await conn.rollback();
    console.error('[BALANCE] updateBalance failed:', err.message);
    throw err;
  } finally {
    conn.release();
  }
};

exports.getBalance = async (req, res) => {
  try {
    const { role, merchant_id: tokenMerchantId } = req.user;

    const merchantId =
      role === 'MERCHANT' ? tokenMerchantId : req.query.merchant_id || null;

    if (!merchantId)
      return res.status(400).json({ error: 'merchant_id required' });

    // Wallet
    const [[wallet]] = await pool.execute(
      `SELECT w.*, m.display_name, m.id_type, m.id_value, m.status AS merchant_status
       FROM merchant_wallet w
       JOIN merchant m ON m.id = w.merchant_id
       WHERE w.merchant_id = ?`,
      [merchantId],
    );

    if (!wallet) {
      // No wallet yet — merchant has zero balance
      const [[merchant]] = await pool.execute(
        `SELECT id, display_name, id_type, id_value FROM merchant WHERE id = ?`,
        [merchantId],
      );
      return res.json({
        merchant_id: merchantId,
        display_name: merchant?.display_name || 'Unknown',
        balance: 0,
        total_credit: 0,
        total_debit: 0,
        total_fee: 0,
        currency: 'BDT',
        last_updated: null,
      });
    }

    // Today stats
    const [[todayStats]] = await pool.execute(
      `SELECT
         COALESCE(SUM(CASE WHEN type='CREDIT' THEN amount ELSE 0 END), 0) AS today_credit,
         COALESCE(SUM(CASE WHEN type='DEBIT'  THEN amount ELSE 0 END), 0) AS today_debit,
         COUNT(*) AS today_txn
       FROM merchant_balance
       WHERE merchant_id = ? AND DATE(created_at) = CURDATE()`,
      [merchantId],
    );

    return res.json({
      merchant_id: wallet.merchant_id,
      display_name: wallet.display_name,
      id_type: wallet.id_type,
      id_value: wallet.id_value,
      balance: parseFloat(wallet.balance || 0),
      total_credit: parseFloat(wallet.total_credit || 0),
      total_debit: parseFloat(wallet.total_debit || 0),
      total_fee: parseFloat(wallet.total_fee || 0),
      currency: wallet.currency,
      last_updated: wallet.updated_at,
      today: {
        credit: parseFloat(todayStats.today_credit || 0),
        debit: parseFloat(todayStats.today_debit || 0),
        txn: parseInt(todayStats.today_txn || 0),
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getLedger = async (req, res) => {
  try {
    const { role, merchant_id: tokenMerchantId } = req.user;
    const { type, date_from, date_to, page = 1, per_page = 20 } = req.query;

    const merchantId =
      role === 'MERCHANT' ? tokenMerchantId : req.query.merchant_id || null;

    if (!merchantId)
      return res.status(400).json({ error: 'merchant_id required' });

    const limit = Math.min(Math.max(parseInt(per_page) || 20, 1), 100);
    const offset = (Math.max(parseInt(page) || 1, 1) - 1) * limit;

    const conditions = ['b.merchant_id = ?'];
    const params = [merchantId];

    if (type) {
      conditions.push('b.type = ?');
      params.push(type);
    }
    if (date_from) {
      conditions.push('DATE(b.created_at) >= ?');
      params.push(date_from);
    }
    if (date_to) {
      conditions.push('DATE(b.created_at) <= ?');
      params.push(date_to);
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    const [[{ total }]] = await pool.execute(
      `SELECT COUNT(*) AS total FROM merchant_balance b ${where}`,
      params,
    );

    const [rows] = await pool.execute(
      `SELECT
         b.id, b.merchant_id, b.transaction_id, b.transfer_id,
         b.type, b.amount, b.fee,
         b.balance_before, b.balance_after,
         b.currency, b.note, b.created_at,
         t.type AS txn_type,
         t.direction,
         t.payer_name, t.payee_name,
         t.payer_id_value, t.payee_id_value,
         t.payer_fsp, t.payee_fsp
       FROM merchant_balance b
       LEFT JOIN transactions t ON t.transfer_id = b.transfer_id
       ${where}
       ORDER BY b.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );

    return res.json({
      data: rows,
      pagination: {
        total,
        total_pages: Math.ceil(total / limit),
        current_page: parseInt(page) || 1,
        per_page: limit,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getSummary = async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN')
      return res.status(403).json({ error: 'Admin only' });

    const { search, page = 1, per_page = 20 } = req.query;
    const limit = Math.min(parseInt(per_page) || 20, 100);
    const offset = (Math.max(parseInt(page) || 1, 1) - 1) * limit;

    const conditions = [];
    const params = [];

    if (search?.trim()) {
      conditions.push('(m.display_name LIKE ? OR m.id_value LIKE ?)');
      params.push(`%${search.trim()}%`, `%${search.trim()}%`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [[{ total }]] = await pool.execute(
      `SELECT COUNT(*) AS total
       FROM merchant m
       LEFT JOIN merchant_wallet w ON w.merchant_id = m.id
       ${where}`,
      params,
    );

    const [rows] = await pool.execute(
      `SELECT
         m.id AS merchant_id, m.display_name, m.id_type, m.id_value, m.status,
         COALESCE(w.balance,      0) AS balance,
         COALESCE(w.total_credit, 0) AS total_credit,
         COALESCE(w.total_debit,  0) AS total_debit,
         COALESCE(w.total_fee,    0) AS total_fee,
         COALESCE(w.currency, 'BDT') AS currency,
         w.updated_at
       FROM merchant m
       LEFT JOIN merchant_wallet w ON w.merchant_id = m.id
       ${where}
       ORDER BY COALESCE(w.balance, 0) DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );

    return res.json({
      data: rows,
      pagination: {
        total,
        total_pages: Math.ceil(total / limit),
        current_page: parseInt(page) || 1,
        per_page: limit,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
