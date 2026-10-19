import { setTimeout } from "node:timers/promises";

export const ticketRetryDelays = [15_000, 30_000, 60_000, 120_000, 120_000];

export function isTransientStapleError(error) {
  const output = `${error.message}\n${error.stdout || ""}\n${error.stderr || ""}`;
  return (
    /Failed to staple your application with code: 68|(?:staple and )?validate action failed! Error 68/u.test(
      output,
    ) &&
    /NSURLErrorDomain|CloudKit's response is inconsistent|HTTPError\(statusCode: nil/u.test(
      output,
    )
  );
}

export async function retryMacOSTicketDelivery(
  operation,
  { sleep = setTimeout, log = console.log } = {},
) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (
        !isTransientStapleError(error) ||
        attempt === ticketRetryDelays.length
      ) {
        throw error;
      }
      const delay = ticketRetryDelays[attempt];
      log(
        `Apple ticket delivery unavailable; retry ${attempt + 1}/${ticketRetryDelays.length} in ${delay / 1000}s`,
      );
      await sleep(delay);
    }
  }
}
