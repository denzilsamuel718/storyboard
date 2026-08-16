export function formatSubmissionId(sequence: number) {
  if (!Number.isInteger(sequence) || sequence < 1) throw new Error("Invalid submission sequence");
  return `SB${String(sequence).padStart(4, "0")}`;
}
