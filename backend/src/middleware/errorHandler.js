// src/middleware/errorHandler.js

const errorHandler = (err, req, res, next) => {
  // Always log the full error in the terminal
  console.error('─── ERROR ───────────────────────────');
  console.error('Route:', req.method, req.path);
  console.error('Message:', err.message);
  console.error('Code:', err.code);
  if (err.detail) console.error('Detail:', err.detail);
  console.error('─────────────────────────────────────');

  // Joi validation errors
  if (err.isJoi) {
    return res.status(400).json({
      success: false,
      message: err.details[0].message.replace(/"/g, ''),
    });
  }

  // PostgreSQL: unique constraint (duplicate phone, txid, etc.)
  if (err.code === '23505') {
    const field = err.detail?.match(/\((.+?)\)/)?.[1] || 'value';
    return res.status(409).json({
      success: false,
      message: `This ${field} is already registered`,
    });
  }

  // PostgreSQL: foreign key violation
  if (err.code === '23503') {
    return res.status(400).json({
      success: false,
      message: 'Referenced record does not exist',
    });
  }

  // PostgreSQL: relation/table does not exist
  // This means the SQL setup was not run in Supabase
  if (err.code === '42P01') {
    const table = err.message.match(/relation "(.+?)" does not exist/)?.[1] || 'unknown';
    return res.status(500).json({
      success: false,
      message: `Database table "${table}" not found. Please run FULL_SETUP.sql in Supabase.`,
    });
  }

  // Default error — always show message in development
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Something went wrong. Please try again.',
  });
};

const createError = (message, statusCode = 400) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
};

module.exports = errorHandler;
module.exports.createError = createError;
