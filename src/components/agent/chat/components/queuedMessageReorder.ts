export function getReorderedSubmissionIds({
  submissionIds,
  sourceId,
  destinationId,
  expectedIds = submissionIds,
}: {
  submissionIds: readonly string[];
  sourceId: string;
  destinationId: string;
  expectedIds?: readonly string[];
}): string[] | null {
  if (
    submissionIds.length !== expectedIds.length ||
    new Set(submissionIds).size !== submissionIds.length ||
    submissionIds.some((id, index) => !id.trim() || id !== expectedIds[index])
  ) {
    return null;
  }
  const source = submissionIds.indexOf(sourceId);
  const destination = submissionIds.indexOf(destinationId);
  if (source < 0 || destination < 0 || source === destination) {
    return null;
  }
  const reordered = [...submissionIds];
  reordered.splice(source, 1);
  reordered.splice(destination, 0, sourceId);
  return reordered;
}
