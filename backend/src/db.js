import 'dotenv/config';
import mysql from 'mysql2/promise';

// Pool de connexions MySQL partagé par toute l'API
export const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'dtjob',
  waitForConnections: true,
  connectionLimit: 10,
  dateStrings: true, // les dates sortent en texte "2026-10-06 10:23:14"
});
