export type Media = { uri: string; base64: string; mime: string };
export type CaptureProps = { onCapture: (media: Media) => void; onError: (error: string) => void };
