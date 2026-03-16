<?php

namespace App\Support\Uploads;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Intervention\Image\Drivers\Gd\Driver;
use Intervention\Image\Interfaces\ImageInterface;
use Intervention\Image\ImageManager;

class UploadManager
{
    public const MAX_UPLOAD_KB = 10240;
    public const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
    public const MAX_UPLOAD_LABEL = '10 MB';

    private const IMAGE_QUALITY = 75;
    private const MAX_IMAGE_WIDTH = 1920;
    private const MAX_IMAGE_HEIGHT = 1920;

    public static function maxRule(): string
    {
        return 'max:' . self::MAX_UPLOAD_KB;
    }

    public static function disk(): string
    {
        if (app()->environment(['local', 'testing'])) {
            return 'public';
        }

        $hasS3Config = (string) config('filesystems.disks.s3.bucket') !== ''
            && (string) config('filesystems.disks.s3.key') !== ''
            && (string) config('filesystems.disks.s3.secret') !== '';

        return $hasS3Config ? 's3' : 'public';
    }

    public static function store(UploadedFile $file, string $directory, ?string $disk = null): string
    {
        $resolvedDisk = $disk ?: self::disk();
        $normalizedDirectory = trim($directory, '/');
        if ($normalizedDirectory === '') {
            $normalizedDirectory = 'uploads';
        }

        if (!self::isImage($file)) {
            return $file->store($normalizedDirectory, $resolvedDisk);
        }

        return self::storeCompressedImage($file, $normalizedDirectory, $resolvedDisk);
    }

    public static function delete(?string $path, ?string $disk = null): void
    {
        $normalizedPath = trim((string) $path);
        if ($normalizedPath === '') {
            return;
        }

        Storage::disk($disk ?: self::disk())->delete($normalizedPath);
    }

    private static function isImage(UploadedFile $file): bool
    {
        return str_starts_with(Str::lower((string) $file->getMimeType()), 'image/');
    }

    private static function storeCompressedImage(UploadedFile $file, string $directory, string $disk): string
    {
        try {
            $manager = new ImageManager(new Driver());
            $image = $manager->read($file->getRealPath());
            $resized = $image->scaleDown(width: self::MAX_IMAGE_WIDTH, height: self::MAX_IMAGE_HEIGHT);
            [$encoded, $extension] = self::encodeForStorage($resized, $file);

            $filename = Str::uuid()->toString() . '.' . $extension;
            $path = $directory . '/' . $filename;

            Storage::disk($disk)->put($path, (string) $encoded);

            return $path;
        } catch (\Throwable $e) {
            // Fall back to raw upload if runtime image tooling is unavailable.
            return $file->store($directory, $disk);
        }
    }

    private static function encodeForStorage(ImageInterface $image, UploadedFile $file): array
    {
        return [$image->toWebp(self::IMAGE_QUALITY), 'webp'];
    }
}
