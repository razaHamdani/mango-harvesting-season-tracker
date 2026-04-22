/**
 * Photo path validator — Phase 1.4
 *
 * Paths are stored as: `{userId}/{seasonId}/{subdir}/{fileId}.{ext}`
 *
 * The previous implementation used only String.startsWith(), which fails
 * to enforce the file-name segment format and allows traversal sequences
 * like `../../etc/passwd` inside the filename portion.
 *
 * This validator:
 *   1. Applies a strict regex that enforces UUID format for each segment
 *      and an allowlist of extensions.
 *   2. Verifies the first two path segments match the caller-supplied
 *      userId and seasonId (ownership binding).
 *   3. Returns the original string unchanged on success (so the stored
 *      path is exactly what the client uploaded) or null on failure.
 */

type PhotoSubdir = 'expenses' | 'activities' | 'payments'

// UUID: 8-4-4-4-12 hex chars separated by hyphens
const UUID_RE = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
// Allowed image extensions
const EXT_RE = 'jpg|jpeg|png|webp'

const PHOTO_PATH_RE = new RegExp(
  `^(${UUID_RE})/(${UUID_RE})/(expenses|activities|payments)/(${UUID_RE})\\.(${EXT_RE})$`,
  'i'
)

export function validatePhotoPath(
  rawPath: string | null,
  userId: string,
  seasonId: string,
  subdir: PhotoSubdir
): string | null {
  if (!rawPath) return null

  const match = rawPath.match(PHOTO_PATH_RE)
  if (!match) return null

  // match[1] = userId segment, match[2] = seasonId segment, match[3] = subdir
  const [, pathUserId, pathSeasonId, pathSubdir] = match

  if (pathUserId.toLowerCase() !== userId.toLowerCase()) return null
  if (pathSeasonId.toLowerCase() !== seasonId.toLowerCase()) return null
  if (pathSubdir.toLowerCase() !== subdir.toLowerCase()) return null

  return rawPath
}
