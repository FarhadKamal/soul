// Buffers console output and uncaught errors so they can be copied for bug
// reports - a real JS error thrown mid-action (e.g. during a bot's turn)
// can silently abort whatever was in progress with nothing visible in the
// game log, so having the actual console trace on hand is the only way to
// diagnose it after the fact.
const buffer = [];
const MAX_ENTRIES = 500;

function record(level, args) {
  const text = args.map((a) => {
    if (a instanceof Error) return a.stack || a.message;
    if (typeof a === 'object') {
      try { return JSON.stringify(a); } catch { return String(a); }
    }
    return String(a);
  }).join(' ');
  buffer.push(`[${new Date().toISOString()}] ${level.toUpperCase()}: ${text}`);
  if (buffer.length > MAX_ENTRIES) buffer.shift();
}

['log', 'warn', 'error'].forEach((level) => {
  const original = console[level].bind(console);
  console[level] = (...args) => {
    record(level, args);
    original(...args);
  };
});

window.addEventListener('error', (e) => {
  record('error', [`Uncaught: ${e.message} (${e.filename}:${e.lineno}:${e.colno})`]);
});

window.addEventListener('unhandledrejection', (e) => {
  record('error', [`Unhandled promise rejection: ${e.reason?.stack || e.reason}`]);
});

export function getConsoleLogText() {
  return buffer.length === 0 ? '(no console output captured)' : buffer.join('\n');
}
