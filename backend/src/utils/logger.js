function info(message, ...details) { console.log(`[CASIA] ${message}`, ...details); }
function warn(message, ...details) { console.warn(`[CASIA] ${message}`, ...details); }
function error(message, ...details) { console.error(`[CASIA] ${message}`, ...details); }
module.exports = { info, warn, error };
