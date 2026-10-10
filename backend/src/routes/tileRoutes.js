const express = require('express');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const path = require('path');

const router = express.Router();

const CACHE_DIR = path.join(__dirname, '..', '..', 'cache', 'tiles');
const CACHE_MAX_AGE_MS = 45 * 24 * 60 * 60 * 1000;
const CACHE_MAX_FILES = 20000;
const FETCH_TIMEOUT_MS = 7000;
const MAX_CONCURRENT_UPSTREAM = 6;
const MEMORY_CACHE_MAX = 1500;
const MIN_TILE_BYTES = 300;
const MAX_TILE_BYTES = 512 * 1024;
const USER_AGENT = 'EmployeeMonitor/1.0 (self-hosted map tile cache)';

const SOURCES = [
  {
    name: 'esri-street',
    url: (z, x, y) => `https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/${z}/${y}/${x}`,
  },
  {
    name: 'esri-topo',
    url: (z, x, y) => `https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/${z}/${y}/${x}`,
  },
  {
    name: 'opentopomap',
    url: (z, x, y) => `https://a.tile.opentopomap.org/${z}/${x}/${y}.png`,
  },
  {
    name: 'osm',
    url: (z, x, y) => `https://tile.openstreetmap.org/${z}/${x}/${y}.png`,
  },
];

const tileLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 3000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many tile requests' },
});

const memoryCache = new Map();

let activeUpstream = 0;
const waitingQueue = [];

function acquireSlot() {
  if (activeUpstream < MAX_CONCURRENT_UPSTREAM) {
    activeUpstream += 1;
    return Promise.resolve();
  }
  return new Promise((resolve) => waitingQueue.push(resolve));
}

function releaseSlot() {
  const next = waitingQueue.shift();
  if (next) next();
  else activeUpstream -= 1;
}

async function withSlot(fn) {
  await acquireSlot();
  try {
    return await fn();
  } finally {
    releaseSlot();
  }
}

function tileFile(sourceName, z, x, y) {
  return path.join(CACHE_DIR, sourceName, String(z), String(x), `${y}.png`);
}

function readMemory(key) {
  const hit = memoryCache.get(key);
  if (!hit) return null;
  memoryCache.delete(key);
  memoryCache.set(key, hit);
  return hit;
}

function writeMemory(key, buffer) {
  memoryCache.set(key, buffer);
  if (memoryCache.size > MEMORY_CACHE_MAX) {
    memoryCache.delete(memoryCache.keys().next().value);
  }
}

function readDisk(sourceName, z, x, y) {
  try {
    const file = tileFile(sourceName, z, x, y);
    const stat = fs.statSync(file);
    if (Date.now() - stat.mtimeMs > CACHE_MAX_AGE_MS) {
      fs.promises.unlink(file).catch(() => {});
      return null;
    }
    const buffer = fs.readFileSync(file);
    if (buffer.length < MIN_TILE_BYTES || buffer.length > MAX_TILE_BYTES) return null;
    return buffer;
  } catch (e) {
    return null;
  }
}

function writeDisk(sourceName, z, x, y, buffer) {
  const file = tileFile(sourceName, z, x, y);
  fs.promises
    .mkdir(path.dirname(file), { recursive: true })
    .then(() => fs.promises.writeFile(file, buffer))
    .catch(() => {});
}

async function fetchTile(source, z, x, y) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(source.url(z, x, y), {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'image/png,image/jpeg,image/*;q=0.8,*/*;q=0.5',
      },
    });
    if (!response.ok) return null;
    const type = response.headers.get('content-type') || '';
    if (!type.startsWith('image/')) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length < MIN_TILE_BYTES || buffer.length > MAX_TILE_BYTES) return null;
    if (buffer[0] !== 0x89 && buffer[0] !== 0xff) return null;
    return buffer;
  } catch (e) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function loadTile(z, x, y) {
  for (const source of SOURCES) {
    const key = `${source.name}/${z}/${x}/${y}`;
    const cached = readMemory(key) || readDisk(source.name, z, x, y);
    if (cached) {
      writeMemory(key, cached);
      return { buffer: cached, source: source.name };
    }
    const buffer = await withSlot(() => fetchTile(source, z, x, y));
    if (buffer) {
      writeMemory(key, buffer);
      writeDisk(source.name, z, x, y, buffer);
      return { buffer, source: source.name };
    }
  }
  return null;
}

function parseTileRequest(req) {
  const match = /^\/api\/tiles\/(\d{1,2})\/(\d+)\/(\d+)(?:\.\w+)?$/.exec(req.path);
  if (!match) return null;
  const z = Number(match[1]);
  const x = Number(match[2]);
  const y = Number(match[3]);
  if (!Number.isInteger(z) || z < 0 || z > 19) return null;
  const max = 2 ** z;
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= max || y >= max) return null;
  return { z, x, y };
}

function contentTypeOf(buffer) {
  if (buffer[0] === 0xff) return 'image/jpeg';
  return 'image/png';
}

function listFiles(dir) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { recursive: true, withFileTypes: true });
  } catch (e) {
    return [];
  }
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => {
      const file = path.join(entry.parentPath || entry.path, entry.name);
      try {
        return { file, mtimeMs: fs.statSync(file).mtimeMs };
      } catch (e) {
        return null;
      }
    })
    .filter(Boolean);
}

function pruneCache() {
  try {
    const files = listFiles(CACHE_DIR);
    const now = Date.now();
    const expired = files.filter((entry) => now - entry.mtimeMs > CACHE_MAX_AGE_MS);
    const overflow = files.length - expired.length > CACHE_MAX_FILES
      ? files
          .filter((entry) => now - entry.mtimeMs <= CACHE_MAX_AGE_MS)
          .sort((a, b) => a.mtimeMs - b.mtimeMs)
          .slice(0, files.length - expired.length - CACHE_MAX_FILES)
      : [];
    expired.concat(overflow).forEach((entry) => {
      try {
        fs.unlinkSync(entry.file);
      } catch (e) {
        // ignore
      }
    });
  } catch (e) {
    // ignore
  }
}

let pruned = false;

router.get(/^\/api\/tiles\/\d{1,2}\/\d+\/\d+(?:\.\w+)?$/, tileLimiter, async (req, res) => {
  const tile = parseTileRequest(req);
  if (!tile) {
    res.status(400).type('text/plain').send('Invalid tile request');
    return;
  }

  if (!pruned) {
    pruned = true;
    fs.promises.mkdir(CACHE_DIR, { recursive: true }).then(pruneCache).catch(() => {});
  }

  const result = await loadTile(tile.z, tile.x, tile.y);
  if (!result) {
    res.status(502).type('text/plain').send('No tile source available');
    return;
  }

  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.setHeader('Content-Type', contentTypeOf(result.buffer));
  res.setHeader('X-Tile-Source', result.source);
  res.status(200).send(result.buffer);
});

router.use('/api/tiles', (req, res) => {
  res.status(404).type('text/plain').send('Not found');
});

module.exports = router;
