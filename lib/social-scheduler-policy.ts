export const SOCIAL_STALE_AFTER_MS = 5 * 60 * 1000;
export const SOCIAL_MAX_RETRIES = 3;

export function schedulerRetryCount(message: string | null) {
  const count = /^retry=(\d+);/.exec(message ?? "");
  return count ? Number(count[1]) : 0;
}

export function schedulerFailure(message: string, previousMessage: string | null, publishAttempted: boolean) {
  const retries = schedulerRetryCount(previousMessage);
  if (!publishAttempted && retries < SOCIAL_MAX_RETRIES) {
    const nextRetry = retries + 1;
    return {
      status: "SCHEDULED",
      scheduledAt: new Date(Date.now() + nextRetry * 5 * 60 * 1000),
      errorMessage: `retry=${nextRetry}; ${message}`.slice(0, 1000),
    };
  }
  return {
    status: "FAILED",
    errorMessage: (publishAttempted
      ? `Rezultati i publikimit nuk eshte i sigurt; kontrollo Instagram para riprovimit. ${message}`
      : message).slice(0, 1000),
  };
}
