// src/controllers/broadcastController.js
const { query, transaction } = require('../config/database');

// ── Get active broadcasts for logged-in user (unread only) ───
const getActiveBroadcasts = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT b.* FROM broadcasts b
       WHERE b.is_active = true
         AND (b.ends_at IS NULL OR b.ends_at > NOW())
         AND b.starts_at <= NOW()
         AND NOT EXISTS (
           SELECT 1 FROM broadcast_reads br
           WHERE br.broadcast_id = b.id AND br.user_id = $1
         )
       ORDER BY b.priority DESC, b.created_at DESC`,
      [req.user.id]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) { next(err); }
};

// ── Mark broadcast as read ───────────────────────────────────
const markBroadcastRead = async (req, res, next) => {
  try {
    const { broadcast_id } = req.params;
    await query(
      `INSERT INTO broadcast_reads (broadcast_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [broadcast_id, req.user.id]
    );
    res.json({ success: true });
  } catch (err) { next(err); }
};

// ── Get notices (persistent announcements) ───────────────────
const getNotices = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT id, title, body, priority, created_at
       FROM notices WHERE is_active = true
       ORDER BY priority DESC, created_at DESC`
    );
    res.json({ success: true, data: result.rows });
  } catch (err) { next(err); }
};

// ── ADMIN: create broadcast ──────────────────────────────────
const adminCreateBroadcast = async (req, res, next) => {
  try {
    const { title, body, type, priority, show_once, ends_at } = req.body;
    if (!title || !body) {
      return res.status(400).json({ success: false, message: 'Title and body are required' });
    }

    const result = await query(
      `INSERT INTO broadcasts (title, body, type, priority, show_once, ends_at, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [title, body, type||'info', priority||1, show_once!==false, ends_at||null, req.admin.id]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) { next(err); }
};

// ── ADMIN: list broadcasts ───────────────────────────────────
const adminListBroadcasts = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT b.*, u.full_name as created_by_name,
              COUNT(br.id) as read_count
       FROM broadcasts b
       LEFT JOIN users u ON u.id = b.created_by
       LEFT JOIN broadcast_reads br ON br.broadcast_id = b.id
       GROUP BY b.id, u.full_name
       ORDER BY b.created_at DESC`
    );
    res.json({ success: true, data: result.rows });
  } catch (err) { next(err); }
};

// ── ADMIN: toggle broadcast active ──────────────────────────
const adminToggleBroadcast = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await query(
      `UPDATE broadcasts SET is_active = NOT is_active, updated_at=NOW()
       WHERE id=$1 RETURNING id, is_active`,
      [id]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (err) { next(err); }
};

// ── ADMIN: delete broadcast ──────────────────────────────────
const adminDeleteBroadcast = async (req, res, next) => {
  try {
    await query('DELETE FROM broadcasts WHERE id=$1', [req.params.id]);
    res.json({ success: true, message: 'Broadcast deleted' });
  } catch (err) { next(err); }
};

// ── ADMIN: create notice ─────────────────────────────────────
const adminCreateNotice = async (req, res, next) => {
  try {
    const { title, body, priority } = req.body;
    if (!title || !body) {
      return res.status(400).json({ success: false, message: 'Title and body required' });
    }
    const result = await query(
      `INSERT INTO notices (title, body, priority, created_by) VALUES ($1,$2,$3,$4) RETURNING *`,
      [title, body, priority||1, req.admin.id]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) { next(err); }
};

// ── ADMIN: list notices ──────────────────────────────────────
const adminListNotices = async (req, res, next) => {
  try {
    const result = await query('SELECT * FROM notices ORDER BY priority DESC, created_at DESC');
    res.json({ success: true, data: result.rows });
  } catch (err) { next(err); }
};

// ── ADMIN: toggle/delete notice ──────────────────────────────
const adminToggleNotice = async (req, res, next) => {
  try {
    await query('UPDATE notices SET is_active=NOT is_active, updated_at=NOW() WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) { next(err); }
};

const adminDeleteNotice = async (req, res, next) => {
  try {
    await query('DELETE FROM notices WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) { next(err); }
};

module.exports = {
  getActiveBroadcasts, markBroadcastRead, getNotices,
  adminCreateBroadcast, adminListBroadcasts, adminToggleBroadcast, adminDeleteBroadcast,
  adminCreateNotice, adminListNotices, adminToggleNotice, adminDeleteNotice,
};
