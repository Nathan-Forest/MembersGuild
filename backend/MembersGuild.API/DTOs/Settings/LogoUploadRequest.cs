public record LogoUploadRequest(
    string FileName,
    string ContentType,
    string Data          // base64
);