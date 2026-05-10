/**
 * @param {string | undefined} role
 * @returns {string}
 */
export function formatMemberRole(role) {
  if (!role) return 'Membro'
  const normalized = String(role).trim().toLowerCase()
  if (normalized === 'titular') return 'Titular'
  if (normalized === 'dependente') return 'Dependente'
  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

/**
 * @param {string} ownerId
 * @param {import('../types.js').Member[]} members
 * @returns {string}
 */
export function getOwnerName(ownerId, members) {
  return members.find((member) => member.id === ownerId)?.name || '-'
}
