// Connection state shared across the app.
//   'online'          — server reachable and authenticated
//   'offline'         — server/network unreachable
//   'unauthenticated' — server reachable but the auth-proxy session expired (401)
export const connection = $state({ state: 'online' });

// Back-compat helper: truthy whenever data operations must be blocked — both
// offline and unauthenticated. Existing call sites read `offline.value`.
export const offline = {
  get value() {
    return connection.state !== 'online';
  }
};
