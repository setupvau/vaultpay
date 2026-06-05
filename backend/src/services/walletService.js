// src/services/walletService.js
// All wallet balance changes MUST go through these functions
// Never update wallet balance directly in other controllers

const { transaction, query } = require('../config/database');

/**
 * Credit a user's wallet (add funds)
 * Creates a ledger entry and updates wallet balance
 */
const creditWallet = async (client, {
  userId,
  currency,      // 'INR' or 'USDT'
  amount,
  type,          // ledger type e.g. 'deposit_credit'
  referenceId,
  referenceType,
  note,
  createdBy,
}) => {
  // Lock wallet row for this transaction
  const walletResult = await client.query(
    'SELECT id, balance_inr, balance_usdt FROM wallets WHERE user_id = $1 FOR UPDATE',
    [userId]
  );

  if (!walletResult.rows.length) {
    throw new Error('Wallet not found for user');
  }

  const wallet = walletResult.rows[0];
  const balanceField = currency === 'USDT' ? 'balance_usdt' : 'balance_inr';
  const balanceBefore = parseFloat(wallet[balanceField]);
  const balanceAfter = balanceBefore + parseFloat(amount);

  // Update wallet balance
  await client.query(
    `UPDATE wallets SET ${balanceField} = $1, total_deposited = total_deposited + $2, updated_at = NOW()
     WHERE user_id = $3`,
    [balanceAfter, amount, userId]
  );

  // Create ledger entry
  const ledgerResult = await client.query(
    `INSERT INTO wallet_ledger 
     (wallet_id, user_id, type, currency, amount, balance_before, balance_after,
      reference_id, reference_type, note, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING id`,
    [
      wallet.id, userId, type, currency, amount,
      balanceBefore, balanceAfter,
      referenceId, referenceType, note, createdBy,
    ]
  );

  return {
    ledger_id: ledgerResult.rows[0].id,
    balance_before: balanceBefore,
    balance_after: balanceAfter,
    currency,
  };
};

/**
 * Debit a user's wallet (remove funds)
 */
const debitWallet = async (client, {
  userId,
  currency,
  amount,
  type,
  referenceId,
  referenceType,
  note,
  createdBy,
}) => {
  const walletResult = await client.query(
    'SELECT id, balance_inr, balance_usdt FROM wallets WHERE user_id = $1 FOR UPDATE',
    [userId]
  );

  if (!walletResult.rows.length) throw new Error('Wallet not found');

  const wallet = walletResult.rows[0];
  const balanceField = currency === 'USDT' ? 'balance_usdt' : 'balance_inr';
  const balanceBefore = parseFloat(wallet[balanceField]);

  if (balanceBefore < parseFloat(amount)) {
    throw new Error('Insufficient wallet balance');
  }

  const balanceAfter = balanceBefore - parseFloat(amount);

  await client.query(
    `UPDATE wallets SET ${balanceField} = $1, total_withdrawn = total_withdrawn + $2, updated_at = NOW()
     WHERE user_id = $3`,
    [balanceAfter, amount, userId]
  );

  await client.query(
    `INSERT INTO wallet_ledger 
     (wallet_id, user_id, type, currency, amount, balance_before, balance_after,
      reference_id, reference_type, note, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      wallet.id, userId, type, currency, amount,
      balanceBefore, balanceAfter,
      referenceId, referenceType, note, createdBy,
    ]
  );

  return { balance_before: balanceBefore, balance_after: balanceAfter };
};

/**
 * Get wallet balance for a user
 */
const getWalletBalance = async (userId) => {
  const result = await query(
    'SELECT balance_inr, balance_usdt, total_deposited, total_withdrawn FROM wallets WHERE user_id = $1',
    [userId]
  );
  return result.rows[0];
};

/**
 * Get ledger history for a user
 */
const getLedgerHistory = async (userId, { page = 1, limit = 20, currency } = {}) => {
  const offset = (page - 1) * limit;
  const params = [userId];
  let whereClause = 'WHERE user_id = $1';

  if (currency) {
    params.push(currency);
    whereClause += ` AND currency = $${params.length}`;
  }

  const result = await query(
    `SELECT id, type, currency, amount, balance_before, balance_after, 
            reference_type, note, created_at
     FROM wallet_ledger
     ${whereClause}
     ORDER BY created_at DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );

  return result.rows;
};

module.exports = { creditWallet, debitWallet, getWalletBalance, getLedgerHistory };
