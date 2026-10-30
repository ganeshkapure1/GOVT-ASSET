/**
 * Shared System Constants & Policy Disclaimers
 */

/**
 * GEOSPATIAL BOUNDARY NOTICE:
 * Current municipal ward boundary polygons in the database are synthetic pilot approximations
 * generated for testing and system demonstration. They must be treated strictly as placeholders.
 * Official municipal administration requires verified GIS shapefiles from the municipal corporation.
 */
export const SYNTHETIC_BOUNDARY_DISCLAIMER =
  'Current electoral ward boundaries are synthetic pilot approximations and must not be used for official municipal boundary assertions.';

/**
 * EVIDENCE STORAGE NOTICE:
 * Evidence storage is operating via local filesystem mock (.storage_mock/).
 * Cloud storage (Cloudflare R2 / AWS S3) is an unconfigured production dependency.
 */
export const STORAGE_BACKEND_NOTICE =
  'Evidence storage is operating via local filesystem mock (.storage_mock/). Cloud storage (Cloudflare R2/S3) is an unconfigured production dependency.';

/**
 * NOTIFICATION & SCHEDULER NOTICE:
 * Transactional notifications operate via local mock sandbox unless provider keys are configured.
 */
export const NOTIFICATION_MOCK_NOTICE =
  'Transactional notifications are operating in Mock/Development sandbox mode. Live provider delivery requires configured SMS/Email gateway credentials.';
