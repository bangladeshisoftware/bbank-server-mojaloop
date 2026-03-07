

const { pool } = require('../config/db');
const https    = require('https');

function parseUserAgent(ua = '') {
  let browser = 'Unknown', os = 'Unknown', device = 'Desktop';
  let isMobile = false;

  // Browser
  if      (ua.includes('Edg/'))     browser = 'Microsoft Edge';
  else if (ua.includes('OPR/') || ua.includes('Opera')) browser = 'Opera';
  else if (ua.includes('Chrome/') && !ua.includes('Chromium')) browser = 'Chrome';
  else if (ua.includes('Firefox/')) browser = 'Firefox';
  else if (ua.includes('Safari/') && !ua.includes('Chrome')) browser = 'Safari';
  else if (ua.includes('MSIE') || ua.includes('Trident/')) browser = 'Internet Explorer';

  // Extract version
  const verMatch = ua.match(
    /(Chrome|Firefox|Safari|Edg|OPR|Edge)\/([\d.]+)/
  );
  if (verMatch) browser = `${browser} ${verMatch[2].split('.')[0]}`;

  // OS
  if      (ua.includes('Windows NT 10')) os = 'Windows 10/11';
  else if (ua.includes('Windows NT 6.3')) os = 'Windows 8.1';
  else if (ua.includes('Windows NT 6.1')) os = 'Windows 7';
  else if (ua.includes('Windows'))        os = 'Windows';
  else if (ua.includes('Mac OS X'))       os = 'macOS';
  else if (ua.includes('Linux'))          os = 'Linux';
  else if (ua.includes('Android'))        os = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';

  // Device
  if (ua.includes('Mobile') || ua.includes('Android') || ua.includes('iPhone')) {
    device   = 'Mobile';
    isMobile = true;
  } else if (ua.includes('Tablet') || ua.includes('iPad')) {
    device   = 'Tablet';
    isMobile = true;
  }

  return { browser, os, device, isMobile };
}

function getRealIP(req) {
  return (
    req.headers['cf-connecting-ip']       ||   // Cloudflare
    req.headers['x-real-ip']              ||   // Nginx proxy
    req.headers['x-forwarded-for']?.split(',')[0].trim() ||
    req.connection?.remoteAddress          ||
    req.socket?.remoteAddress             ||
    '0.0.0.0'
  ).replace('::ffff:', '');
}

function getGeoLocation(ip) {
  return new Promise((resolve) => {
    // Skip for localhost / private IPs
    if (!ip || ip === '127.0.0.1' || ip === '::1' ||
        ip.startsWith('192.168.') || ip.startsWith('10.') ||
        ip.startsWith('172.')) {
      return resolve({ country: 'Localhost', city: 'Local' });
    }

    const url = `http://ip-api.com/json/${ip}?fields=status,country,city,regionName`;
    
    const http = require('http');
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.status === 'success') {
            resolve({ country: json.country, city: json.city });
          } else {
            resolve({ country: 'Unknown', city: 'Unknown' });
          }
        } catch {
          resolve({ country: 'Unknown', city: 'Unknown' });
        }
      });
    }).on('error', () => resolve({ country: 'Unknown', city: 'Unknown' }));

    // Timeout after 3s
    setTimeout(() => resolve({ country: 'Unknown', city: 'Unknown' }), 3000);
  });
}

exports.logActivity = async (req, activityData) => {
  try {
    const ip  = getRealIP(req);
    const ua  = req.headers['user-agent'] || '';
    const geo = await getGeoLocation(ip);
    const { browser, os, device, isMobile } = parseUserAgent(ua);

    await pool.execute(
      `INSERT INTO activity_logs
         (user_id, username, email, role, merchant_id, merchant_name,
          action, ip_address, country, city, browser, os, device, is_mobile,
          status, note, login_time)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        activityData.user_id,
        activityData.username,
        activityData.email         || null,
        activityData.role,
        activityData.merchant_id   || null,
        activityData.merchant_name || null,
        activityData.action        || 'LOGIN',
        ip,
        geo.country,
        geo.city,
        browser,
        os,
        device,
        isMobile ? 1 : 0,
        activityData.status        || 'SUCCESS',
        activityData.note          || null,
      ]
    );
  } catch (err) {
    // Never block login — just log error
    console.error('[ActivityLog] Failed to write log:', err.message);
  }
};
exports.getLogs = async (req, res) => {
  try {
    const { role: userRole, merchant_id: userMerchantId } = req.user;
    const {
      search, role, merchant_id, status,
      date_from, date_to,
      page = 1, per_page = 20,
    } = req.query;

    const limit  = Math.min(Math.max(parseInt(per_page) || 20, 1), 100);
    const offset = (Math.max(parseInt(page) || 1, 1) - 1) * limit;

    const conditions = [];
    const params     = [];

    // ── Role scoping ──────────────────────────────────────────
    if (userRole === 'MERCHANT') {
      // MERCHANT: only their own logs
      conditions.push('merchant_id = ?');
      params.push(userMerchantId);
    } else {
      // ADMIN: optional filters
      if (role) {
        conditions.push('role = ?');
        params.push(role);
      }
      if (merchant_id) {
        conditions.push('merchant_id = ?');
        params.push(merchant_id);
      }
    }

    // ── Shared filters ────────────────────────────────────────
    if (search?.trim()) {
      conditions.push('(username LIKE ? OR email LIKE ?)');
      params.push(`%${search.trim()}%`, `%${search.trim()}%`);
    }
    if (status) {
      conditions.push('status = ?');
      params.push(status);
    }
    if (date_from) {
      conditions.push('DATE(login_time) >= ?');
      params.push(date_from);
    }
    if (date_to) {
      conditions.push('DATE(login_time) <= ?');
      params.push(date_to);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    // Count
    const [[{ total }]] = await pool.execute(
      `SELECT COUNT(*) AS total FROM activity_logs ${where}`,
      params
    );

    // Data
    const [rows] = await pool.execute(
      `SELECT
         id, user_id, username, email, role,
         merchant_id, merchant_name,
         action, ip_address, country, city,
         browser, os, device, is_mobile,
         status, note, login_time
       FROM activity_logs
       ${where}
       ORDER BY login_time DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return res.json({
      data: rows,
      pagination: {
        total,
        total_pages: Math.ceil(total / limit),
        current_page: parseInt(page) || 1,
        per_page:     limit,
      },
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getStats = async (req, res) => {
  try {
    const { role: userRole, merchant_id: userMerchantId } = req.user;

    const scopeWhere = userRole === 'MERCHANT'
      ? `WHERE merchant_id = '${userMerchantId}'`
      : '';

    const scopeAnd = userRole === 'MERCHANT'
      ? `AND merchant_id = '${userMerchantId}'`
      : '';

    // Summary counts
    const [[summary]] = await pool.execute(
      `SELECT
         COUNT(*)                                                        AS total,
         COALESCE(SUM(DATE(login_time) = CURDATE()), 0)                 AS today,
         COUNT(DISTINCT user_id)                                        AS unique_users,
         COUNT(DISTINCT ip_address)                                     AS unique_ips,
         COALESCE(SUM(status = 'SUCCESS'), 0)                           AS success,
         COALESCE(SUM(status = 'FAILED'), 0)                            AS failed,
         COALESCE(SUM(is_mobile = 1), 0)                                AS mobile,
         COALESCE(SUM(is_mobile = 0), 0)                                AS desktop
       FROM activity_logs ${scopeWhere}`
    );

    // Last 7 days daily
    const [daily] = await pool.execute(
      `SELECT
         DATE(login_time)  AS date,
         COUNT(*)          AS total,
         SUM(status = 'SUCCESS') AS success,
         SUM(status = 'FAILED')  AS failed
       FROM activity_logs
       WHERE login_time >= DATE_SUB(NOW(), INTERVAL 7 DAY)
       ${scopeAnd}
       GROUP BY DATE(login_time)
       ORDER BY date ASC`
    );

    // Top countries (ADMIN only)
    let topCountries = [];
    if (userRole === 'ADMIN') {
      const [ctry] = await pool.execute(
        `SELECT country, COUNT(*) AS total
         FROM activity_logs
         WHERE country IS NOT NULL AND country != 'Unknown'
         GROUP BY country
         ORDER BY total DESC
         LIMIT 5`
      );
      topCountries = ctry;
    }

    // Top browsers
    const [browsers] = await pool.execute(
      `SELECT
         SUBSTRING_INDEX(browser, ' ', 1) AS browser_name,
         COUNT(*) AS total
       FROM activity_logs ${scopeWhere}
       GROUP BY browser_name
       ORDER BY total DESC
       LIMIT 5`
    );

    return res.json({ summary, daily, topCountries, browsers });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

