export const SUBMISSION_TYPES = ["STORY", "SCRIPT", "SCREENPLAY", "SHORT_FILM", "FILM_IDEA", "PITCH", "OTHER"] as const;
export const SUBMISSION_STATUSES = ["DRAFT", "SUBMITTED", "UNDER_REVIEW", "SHORTLISTED", "CONTACTED", "ACCEPTED", "NOT_SELECTED", "WITHDRAWN", "ARCHIVED"] as const;
export type SubmissionType = typeof SUBMISSION_TYPES[number];
export type SubmissionStatus = typeof SUBMISSION_STATUSES[number];

export const ALLOWED_FILES: Record<string, { category: "DOCUMENT" | "IMAGE" | "VIDEO"; max: number }> = {
  "application/pdf": { category: "DOCUMENT", max: 50 * 1024 ** 2 },
  "application/msword": { category: "DOCUMENT", max: 50 * 1024 ** 2 },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": { category: "DOCUMENT", max: 50 * 1024 ** 2 },
  "text/plain": { category: "DOCUMENT", max: 10 * 1024 ** 2 },
  "application/rtf": { category: "DOCUMENT", max: 50 * 1024 ** 2 },
  "application/vnd.oasis.opendocument.text": { category: "DOCUMENT", max: 50 * 1024 ** 2 },
  "image/jpeg": { category: "IMAGE", max: 20 * 1024 ** 2 },
  "image/png": { category: "IMAGE", max: 20 * 1024 ** 2 },
  "image/webp": { category: "IMAGE", max: 20 * 1024 ** 2 },
  "video/mp4": { category: "VIDEO", max: 1024 ** 3 },
  "video/quicktime": { category: "VIDEO", max: 1024 ** 3 },
  "video/webm": { category: "VIDEO", max: 1024 ** 3 }
};

export const formatLabel = (value: string) => value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, c => c.toUpperCase());
