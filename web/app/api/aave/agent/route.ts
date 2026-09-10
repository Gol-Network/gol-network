// Compatibility alias for older clients. Agent execution now lives in the separate LangGraph
// service and both paths use the same Next.js streaming proxy.
export const runtime = 'nodejs';

export { GET, POST } from '../../agent/run/route';
