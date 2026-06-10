import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 130,
          background: "#1a1a1a",
          borderRadius: 40,
        }}
      >
        🙌
      </div>
    ),
    { ...size }
  );
}
