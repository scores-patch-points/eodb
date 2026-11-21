// Copy to config.js (which is not committed) and set the routes your spaces use. A route is "<kind>:<address>".
//   relay:<url>              a blind relay (app/relay.mjs)
//   mailbox:<url>#<token>    a mailbox server (app/mailbox/mailbox.mjs); the part after # is its token, sent only in a header
// Anyone who gets a share link also gets these routes (and the token), so use a token you are willing to share with everyone you invite.
window.EODB_ROUTES = ['mailbox:https://mail.example.org#PUT-THE-TOKEN-HERE'];
