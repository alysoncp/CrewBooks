/**
 * Client-side image compression utility
 * Compresses images to JPEG format with size optimization before upload
 */

export async function compressImage(
  file: File,
  maxSizeMB: number = 2
): Promise<File> {
  const maxSizeBytes = maxSizeMB * 1024 * 1024;

  // If file is already small enough and is JPEG, return as-is
  if (file.size <= maxSizeBytes && file.type === "image/jpeg") {
    return file;
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // Calculate optimal dimensions
        let width = img.width;
        let height = img.height;
        const maxDimension = 2048; // Max width or height

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = (height * maxDimension) / width;
            width = maxDimension;
          } else {
            width = (width * maxDimension) / height;
            height = maxDimension;
          }
        }

        // Create canvas and compress
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");

        if (!ctx) {
          reject(new Error("Could not get canvas context"));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Try different quality levels to get under max size
        let quality = 0.9;
        let compressedBlob: Blob | null = null;

        const tryCompress = (q: number): void => {
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error("Failed to compress image"));
                return;
              }

              if (blob.size <= maxSizeBytes || q <= 0.1) {
                // Create a new File object with the compressed blob
                const compressedFile = new File(
                  [blob],
                  file.name.replace(/\.[^/.]+$/, "") + ".jpg",
                  {
                    type: "image/jpeg",
                    lastModified: Date.now(),
                  }
                );
                resolve(compressedFile);
              } else {
                // Try lower quality
                tryCompress(q - 0.1);
              }
            },
            "image/jpeg",
            q
          );
        };

        tryCompress(quality);
      };

      img.onerror = () => {
        reject(new Error("Failed to load image"));
      };

      if (e.target?.result) {
        img.src = e.target.result as string;
      }
    };

    reader.onerror = () => {
      reject(new Error("Failed to read file"));
    };

    reader.readAsDataURL(file);
  });
}

