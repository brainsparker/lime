import { createHash } from "node:crypto";

/** Passive evidence for bytes actually delivered to the controlled backend. */
export function runtimeInputImageEvidence(request, hash = createHash) {
  return (request?.input?.parts ?? [])
    .filter((part) => part?.Image !== undefined)
    .map(({ Image: image }) => {
      const pattern = /^data:[^;,]+;base64,([a-z0-9+/=]+)$/i;
      const inline =
        pattern.exec(image.uri ?? "") ??
        pattern.exec(image.provider_data ?? "");
      const data =
        inline?.[1] ??
        (/^[a-z0-9+/]+={0,2}$/i.test(image.provider_data ?? "")
          ? image.provider_data
          : undefined);
      if (typeof data !== "string") return { mediaType: image.media_type };
      const bytes = Buffer.from(data, "base64");
      const signature = bytes.subarray(0, 8).toString("hex");
      return {
        mediaType: image.media_type,
        byteLength: bytes.length,
        sha256: hash("sha256").update(bytes).digest("hex"),
        signature,
        ...(signature === "89504e470d0a1a0a" && bytes.length >= 24
          ? { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }
          : {}),
      };
    });
}
