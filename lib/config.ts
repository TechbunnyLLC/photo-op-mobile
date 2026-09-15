// Central place for backend wiring.
//
// Known architecture (from AWS resource export, AWS account "octopus44"):
//   - ECS Fargate services behind an ALB: photoop-backend, photoop-worker, photoop-beat
//   - Django + Celery + Redis + RDS
//   - S3 bucket "photoop-media" for uploaded media
//   - AWS Rekognition for auto-tagging objects in photos/video
//
// None of the real endpoints are known to this scaffold yet — fill these in
// (ideally from an EAS/Expo env var, not hardcoded) once the ALB's public
// hostname and API auth scheme are confirmed with the backend engineer.

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? "https://api.photo-op.ai";

export const MEDIA_BUCKET = "photoop-media";

// Toggle to develop the UI against local fixture data (see lib/api.ts)
// before the mobile-facing API surface is confirmed.
export const USE_MOCK_API = process.env.EXPO_PUBLIC_USE_MOCK_API !== "false";
