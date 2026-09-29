import assert from "node:assert/strict";
import test from "node:test";
import { schedulerFailure, schedulerRetryCount, SOCIAL_MAX_RETRIES } from "./social-scheduler-policy";

test("pre-publish failures retry with a bounded counter", () => {
  let previous: string | null = null;
  for (let attempt = 1; attempt <= SOCIAL_MAX_RETRIES; attempt += 1) {
    const result = schedulerFailure("network", previous, false);
    assert.equal(result.status, "SCHEDULED");
    assert.equal(schedulerRetryCount(result.errorMessage), attempt);
    previous = result.errorMessage;
  }
  assert.equal(schedulerFailure("network", previous, false).status, "FAILED");
});

test("a possibly published post is never retried automatically", () => {
  const result = schedulerFailure("timeout", null, true);
  assert.equal(result.status, "FAILED");
  assert.match(result.errorMessage, /kontrollo Instagram/);
});
