'use strict';

// Dependency-free Node.js server for the portfolio and its admin API.
const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');

function loadEnvFile() {
  const file = path.join(__dirname, '.env');
  if (!fs.existsSync(file)) return;
  for (const rawLine of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const equals = line.indexOf('=');
    if (equals < 1) continue;
    const key = line.slice(0, equals).trim();
    let value = line.slice(equals + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (process.env[key] === undefined) process.env[key] = value;
  }
}
loadEnvFile();

const PORT = Number(process.env.PORT) || 3000;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, 'data'));
const DATA_FILE = path.join(DATA_DIR, 'portfolio.json');

// Demo fallback only. Set ADMIN_PASSWORD in .env / hosting environment before deployment.
const DEMO_ADMIN_PASSWORD = 'Vijay@2026!';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || DEMO_ADMIN_PASSWORD;
const SESSION_LIFETIME_MS = 4 * 60 * 60 * 1000;
const sessions = new Map();
const loginAttempts = new Map();

const defaultData = {
  profile: {
    name: 'Vijay Kumar', role: 'Software Engineering · Network Automation · Cybersecurity',
    eyebrow: 'M.Tech CSE (Cybersecurity) · Delhi Technological University',
    headline: 'I build software that gets closer to the system.',
    summary: 'From Linux network diagnostics to concurrent C++ systems and AI-enabled applications, I turn complex technical ideas into practical, testable software.',
    about: 'I’m an M.Tech CSE student specializing in Cybersecurity at Delhi Technological University, with MCA and BCA foundations from IGNOU. I enjoy building software where reliability, debugging, and security matter—from backend APIs and automated network checks to system-level experiments. I’m interested in software engineering, SDET and automation, networking, and security engineering roles where I can ship useful tools, test carefully, and keep learning.',
    location: 'Delhi, India', availability: 'Open to software engineering, SDET / automation, networking, and cybersecurity opportunities.',
    email: '', githubUrl: '', linkedinUrl: '', resumeUrl: ''
  }, skills: [], education: [], projects: []
};

function ensureDataFile() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    const bundledData = path.join(__dirname, 'data', 'portfolio.json');
    if (bundledData !== DATA_FILE && fs.existsSync(bundledData)) fs.copyFileSync(bundledData, DATA_FILE);
    else fs.writeFileSync(DATA_FILE, JSON.stringify(defaultData, null, 2));
  }
}

function readData() {
  ensureDataFile();
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
  catch (error) {
    console.error('Could not parse portfolio data:', error.message);
    throw new Error('Portfolio data file is invalid. Restore data/portfolio.json from a backup.');
  }
}

function writeData(data) {
  ensureDataFile();
  const tempFile = `${DATA_FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tempFile, DATA_FILE);
}

function text(value, max = 5000) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function cleanUrl(value) {
  const input = text(value, 1000);
  if (!input) return '';
  if (input.startsWith('/') && !input.startsWith('//')) return input;
  try {
    const parsed = new URL(input);
    return ['http:', 'https:', 'mailto:'].includes(parsed.protocol) ? parsed.toString() : '';
  } catch { return ''; }
}

function cleanList(value, maxItems = 30) {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => text(String(entry), 100)).filter(Boolean).slice(0, maxItems);
}

function cleanProject(input, current = {}) {
  const title = text(input.title, 120);
  if (!title) throw new Error('Project title is required.');
  return {
    id: current.id || text(input.id, 80) || crypto.randomUUID(), title,
    category: text(input.category, 80) || 'Software Engineering',
    status: ['Built', 'In progress', 'Research', 'Archived'].includes(input.status) ? input.status : 'In progress',
    featured: Boolean(input.featured), description: text(input.description, 1600), details: text(input.details, 3000),
    stack: cleanList(input.stack, 20), repoUrl: cleanUrl(input.repoUrl), demoUrl: cleanUrl(input.demoUrl)
  };
}

function parseCookies(header = '') {
  const cookies = {};
  for (const part of header.split(';')) {
    const equals = part.indexOf('=');
    if (equals < 1) continue;
    const name = part.slice(0, equals).trim();
    try { cookies[name] = decodeURIComponent(part.slice(equals + 1).trim()); } catch { /* ignore malformed cookie */ }
  }
  return cookies;
}

function currentSession(req) {
  const token = parseCookies(req.headers.cookie || '').vk_portfolio_session;
  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;
  if (session.expiresAt < Date.now()) { sessions.delete(token); return null; }
  session.expiresAt = Date.now() + SESSION_LIFETIME_MS;
  return { token, session };
}

function cookieHeader(token, maxAge = 4 * 60 * 60) {
  return `vk_portfolio_session=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${IS_PRODUCTION ? '; Secure' : ''}`;
}

function sendJSON(res, status, value, extraHeaders = {}) {
  const payload = JSON.stringify(value);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin',
    ...extraHeaders
  });
  res.end(payload);
}

function sendFile(res, filename) {
  const ext = path.extname(filename).toLowerCase();
  const contentTypes = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.pdf': 'application/pdf' };
  fs.readFile(filename, (error, data) => {
    if (error) return sendJSON(res, 404, { error: 'File not found.' });
    res.writeHead(200, {
      'Content-Type': contentTypes[ext] || 'application/octet-stream',
      'Content-Length': data.length, 'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=300'
    });
    res.end(data);
  });
}

function readJSONBody(req, maxBytes = 150 * 1024) {
  return new Promise((resolve, reject) => {
    let body = '';
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(Object.assign(new Error('Request is too large.'), { statusCode: 413 }));
        req.destroy();
        return;
      }
      body += chunk;
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try { resolve(JSON.parse(body)); }
      catch { reject(Object.assign(new Error('Request body must be valid JSON.'), { statusCode: 400 })); }
    });
    req.on('error', reject);
  });
}

function requireAdmin(res, sessionInfo) {
  if (sessionInfo && sessionInfo.session.isAdmin === true) return true;
  sendJSON(res, 401, { error: 'Please log in to manage your portfolio.' });
  return false;
}

async function handleAPI(req, res, url) {
  const method = req.method || 'GET';
  const pathname = url.pathname;
  const sessionInfo = currentSession(req);

  if (method === 'GET' && pathname === '/api/portfolio') {
    try { return sendJSON(res, 200, readData()); }
    catch (error) { return sendJSON(res, 500, { error: error.message }); }
  }

  if (method === 'GET' && pathname === '/api/admin/session') {
    return sendJSON(res, 200, { authenticated: Boolean(sessionInfo && sessionInfo.session.isAdmin === true) });
  }

  if (method === 'POST' && pathname === '/api/login') {
    const ip = req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const recent = (loginAttempts.get(ip) || []).filter((stamp) => now - stamp < 10 * 60 * 1000);
    if (recent.length >= 8) return sendJSON(res, 429, { error: 'Too many attempts. Wait 10 minutes and try again.' });
    let body;
    try { body = await readJSONBody(req); } catch (error) { return sendJSON(res, error.statusCode || 400, { error: error.message }); }
    const supplied = typeof body.password === 'string' ? body.password : '';
    const expectedBuffer = Buffer.from(ADMIN_PASSWORD);
    const suppliedBuffer = Buffer.from(supplied);
    const matches = expectedBuffer.length === suppliedBuffer.length && crypto.timingSafeEqual(expectedBuffer, suppliedBuffer);
    if (!matches) {
      recent.push(now); loginAttempts.set(ip, recent);
      return sendJSON(res, 401, { error: 'That password did not match.' });
    }
    loginAttempts.delete(ip);
    if (sessionInfo) sessions.delete(sessionInfo.token);
    const token = crypto.randomBytes(32).toString('hex');
    sessions.set(token, { isAdmin: true, expiresAt: now + SESSION_LIFETIME_MS });
    return sendJSON(res, 200, { authenticated: true }, { 'Set-Cookie': cookieHeader(token) });
  }

  if (method === 'POST' && pathname === '/api/logout') {
    if (sessionInfo) sessions.delete(sessionInfo.token);
    return sendJSON(res, 200, { ok: true }, { 'Set-Cookie': cookieHeader('', 0) });
  }

  const adminRoute = pathname.startsWith('/api/admin/');
  if (adminRoute && !requireAdmin(res, sessionInfo)) return;
  if (!adminRoute) return sendJSON(res, 404, { error: 'API route not found.' });

  let body = {};
  if (['POST', 'PUT', 'PATCH'].includes(method)) {
    try { body = await readJSONBody(req); }
    catch (error) { return sendJSON(res, error.statusCode || 400, { error: error.message }); }
  }

  if (method === 'PUT' && pathname === '/api/admin/profile') {
    try {
      const data = readData();
      const fields = ['name', 'role', 'eyebrow', 'headline', 'summary', 'about', 'location', 'availability'];
      for (const field of fields) data.profile[field] = text(body[field], field === 'about' || field === 'summary' ? 2500 : 300);
      data.profile.email = text(body.email, 250);
      data.profile.githubUrl = cleanUrl(body.githubUrl);
      data.profile.linkedinUrl = cleanUrl(body.linkedinUrl);
      data.profile.resumeUrl = cleanUrl(body.resumeUrl);
      writeData(data);
      return sendJSON(res, 200, { profile: data.profile });
    } catch (error) { return sendJSON(res, 400, { error: error.message || 'Could not update profile.' }); }
  }

  if (method === 'PUT' && pathname === '/api/admin/skills') {
    try {
      if (!Array.isArray(body.skills)) return sendJSON(res, 400, { error: 'Skills must be a list of categories.' });
      const skills = body.skills.slice(0, 12).map((group) => ({
        category: text(group.category, 80),
        items: cleanList(Array.isArray(group.items) ? group.items : String(group.items || '').split(','), 30)
      })).filter((group) => group.category && group.items.length);
      const data = readData(); data.skills = skills; writeData(data);
      return sendJSON(res, 200, { skills: data.skills });
    } catch (error) { return sendJSON(res, 400, { error: error.message || 'Could not update skills.' }); }
  }

  if (method === 'POST' && pathname === '/api/admin/projects') {
    try {
      const data = readData();
      const project = cleanProject(body);
      if (data.projects.some((item) => item.id === project.id)) project.id = crypto.randomUUID();
      data.projects.unshift(project); writeData(data);
      return sendJSON(res, 201, { project });
    } catch (error) { return sendJSON(res, 400, { error: error.message || 'Could not create project.' }); }
  }

  const projectMatch = pathname.match(/^\/api\/admin\/projects\/([^/]+)$/);
  if (projectMatch && method === 'PUT') {
    let id;
    try { id = decodeURIComponent(projectMatch[1]); } catch { return sendJSON(res, 400, { error: 'Invalid project ID.' }); }
    try {
      const data = readData();
      const index = data.projects.findIndex((project) => project.id === id);
      if (index < 0) return sendJSON(res, 404, { error: 'Project not found.' });
      const project = cleanProject(body, data.projects[index]);
      data.projects[index] = project; writeData(data);
      return sendJSON(res, 200, { project });
    } catch (error) { return sendJSON(res, 400, { error: error.message || 'Could not update project.' }); }
  }

  if (projectMatch && method === 'DELETE') {
    let id;
    try { id = decodeURIComponent(projectMatch[1]); } catch { return sendJSON(res, 400, { error: 'Invalid project ID.' }); }
    try {
      const data = readData();
      const oldLength = data.projects.length;
      data.projects = data.projects.filter((project) => project.id !== id);
      if (data.projects.length === oldLength) return sendJSON(res, 404, { error: 'Project not found.' });
      writeData(data);
      return sendJSON(res, 200, { ok: true });
    } catch (error) { return sendJSON(res, 500, { error: error.message || 'Could not delete project.' }); }
  }

  return sendJSON(res, 404, { error: 'Admin API route not found.' });
}

const server = http.createServer(async (req, res) => {
  let url;
  try { url = new URL(req.url, `http://${req.headers.host || 'localhost'}`); }
  catch { return sendJSON(res, 400, { error: 'Invalid request URL.' }); }

  if (url.pathname.startsWith('/api/')) {
    try { await handleAPI(req, res, url); }
    catch (error) { console.error(error); if (!res.headersSent) sendJSON(res, 500, { error: 'Something went wrong. Please try again.' }); }
    return;
  }

  let pathname;
  try { pathname = decodeURIComponent(url.pathname); }
  catch { return sendJSON(res, 400, { error: 'Invalid path.' }); }
  if (pathname === '/') pathname = '/index.html';
  const candidate = path.resolve(PUBLIC_DIR, `.${pathname}`);
  if (!candidate.startsWith(`${PUBLIC_DIR}${path.sep}`)) return sendJSON(res, 403, { error: 'Forbidden.' });
  if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return sendFile(res, candidate);
  // Support SPA-style future routes while keeping the API paths explicit.
  return sendFile(res, path.join(PUBLIC_DIR, 'index.html'));
});

server.listen(PORT, () => {
  ensureDataFile();
  console.log(`Vijay's portfolio is running at http://localhost:${PORT}`);
  if (!process.env.ADMIN_PASSWORD) console.warn('Using the demo admin password. Set ADMIN_PASSWORD before deployment.');
});

process.on('SIGTERM', () => server.close(() => process.exit(0)));
process.on('SIGINT', () => server.close(() => process.exit(0)));
