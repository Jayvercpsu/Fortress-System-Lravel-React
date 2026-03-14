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

    public static function store(UploadedFile $file, string $directory, string $disk = 'public'): string
    {
        $normalizedDirectory = trim($directory, '/');
        if ($normalizedDirectory === '') {
            $normalizedDirectory = 'uploads';
        }

        if (!self::isImage($file)) {
            return $file->store($normalizedDirectory, $disk);
        }

        return self::storeCompressedImage($file, $normalizedDirectory, $disk);
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
        $extension = Str::lower((string) $file->getClientOriginalExtension());

        if (in_array($extension, ['jpg', 'jpeg', 'jpe'], true)) {
            return [$image->toJpeg(self::IMAGE_QUALITY, progressive: true), 'jpg'];
        }

        if ($extension === 'webp') {
            return [$image->toWebp(self::IMAGE_QUALITY), 'webp'];
        }

        if ($extension === 'png') {
            return [$image->toPng(), 'png'];
        }

        if ($extension === 'gif') {
            return [$image->toGif(), 'gif'];
        }

        return [$image->toJpeg(self::IMAGE_QUALITY, progressive: true), 'jpg'];
    }
}
