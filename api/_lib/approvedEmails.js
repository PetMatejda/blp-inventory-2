// Approved BLP users for server endpoints (MCP, token management).
// MUST match the list in firestore.rules (isApprovedUser) – tests/approvedEmails.test.js
// fails when the two differ. When adding a team member, change both and publish the rules.
export const APPROVED_EMAILS = [
  'petmatejda@gmail.com',
  'petr.matejicek@balloonlightgroup.com',
  'admin@balloonlightprag.cz',
  'admin@blp.cz',
  'marekradolf@seznam.cz',
  'petrradolf@seznam.cz',
  'jaroslav.hluchy@gmail.com',
  'matejus.reznak@seznam.cz',
  'kate@k-international.cz',
  'koleczko66@gmail.com',
  'malypavel5@email.cz',
  'blazek.jarous@seznam.cz',
  'cavallo.robin@gmail.com',
  'cavallo.oliver@gmail.com',
  'petr.ji@seznam.cz',
  'auretas@seznam.cz',
  'gkmallas@gmail.com',
  'sejnoha.vaclav1@seznam.cz',
  'marcomatko@gmail.com',
];

export const isApprovedEmail = (email) => !!email && APPROVED_EMAILS.includes(String(email).toLowerCase().trim());
