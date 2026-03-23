<?php

namespace App\Support\Uploads;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Log;
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

    /**
     * Image validation rules (supports avif).
     */
    public static function imageRules(bool $required = false): array
    {
        return [
            $required ? 'required' : 'nullable',
            'mimes:jpg,jpeg,png,bmp,gif,svg,webp,avif',
            self::maxRule(),
        ];
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

        $logContext = [
            'disk' => $resolvedDisk,
            'directory' => $normalizedDirectory,
            'original_name' => $file->getClientOriginalName(),
            'extension' => $file->getClientOriginalExtension(),
            'mime' => $file->getMimeType(),
            'size' => $file->getSize(),
        ];

        if ($resolvedDisk === 's3') {
            $logContext['s3_bucket'] = (string) config('filesystems.disks.s3.bucket');
            $logContext['s3_region'] = (string) config('filesystems.disks.s3.region');
            $logContext['s3_endpoint'] = (string) config('filesystems.disks.s3.endpoint');
            $logContext['s3_url'] = (string) config('filesystems.disks.s3.url');
            $logContext['s3_path_style'] = (bool) config('filesystems.disks.s3.use_path_style_endpoint');
        }

        Log::info('UploadManager: upload started', $logContext);

        if (!self::isImage($file)) {
            $path = $file->store($normalizedDirectory, $resolvedDisk);
            Log::info('UploadManager: upload stored (raw)', $logContext + ['path' => $path]);
            return $path;
        }

        return self::storeCompressedImage($file, $normalizedDirectory, $resolvedDisk);
    }

    public static function delete(?string $path, ?string $disk = null): void
    {
        $normalizedPath = trim((string) $path);
        if ($normalizedPath === '') {
            return;
        }

        $preferredDisk = $disk ?: self::disk();
        $candidateDisks = collect([$preferredDisk, 'public'])
            ->when(self::hasS3Config(), fn ($disks) => $disks->push('s3'))
            ->unique()
            ->values();

        foreach ($candidateDisks as $candidateDisk) {
            try {
                $storage = Storage::disk((string) $candidateDisk);
                if (!$storage->fileExists($normalizedPath)) {
                    continue;
                }

                $storage->delete($normalizedPath);
                return;
            } catch (\Throwable $e) {
                // Ignore this disk and continue with fallbacks.
            }
        }
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
            $exists = null;
            try {
                $exists = Storage::disk($disk)->fileExists($path);
            } catch (\Throwable $e) {
                Log::warning('UploadManager: upload verification failed (compressed image)', [
                    'disk' => $disk,
                    'path' => $path,
                    'error' => $e->getMessage(),
                ]);
            }

            Log::info('UploadManager: upload stored (compressed image)', [
                'disk' => $disk,
                'path' => $path,
                'original_name' => $file->getClientOriginalName(),
                'extension' => $extension,
                'mime' => $file->getMimeType(),
                'size' => $file->getSize(),
                'exists' => $exists,
            ]);

            if ($exists === false) {
                Log::warning('UploadManager: upload verification failed (compressed image)', [
                    'disk' => $disk,
                    'path' => $path,
                ]);
            }

            return $path;
        } catch (\Throwable $e) {
            Log::warning('UploadManager: compression failed, falling back to raw upload', [
                'disk' => $disk,
                'directory' => $directory,
                'original_name' => $file->getClientOriginalName(),
                'extension' => $file->getClientOriginalExtension(),
                'mime' => $file->getMimeType(),
                'size' => $file->getSize(),
                'error' => $e->getMessage(),
            ]);
            // Fall back to raw upload if runtime image tooling is unavailable.
            $path = $file->store($directory, $disk);
            $exists = null;
            try {
                $exists = Storage::disk($disk)->fileExists($path);
            } catch (\Throwable $e) {
                Log::warning('UploadManager: upload verification failed (raw fallback)', [
                    'disk' => $disk,
                    'path' => $path,
                    'error' => $e->getMessage(),
                ]);
            }
            Log::info('UploadManager: upload stored (raw fallback)', [
                'disk' => $disk,
                'path' => $path,
                'original_name' => $file->getClientOriginalName(),
                'extension' => $file->getClientOriginalExtension(),
                'mime' => $file->getMimeType(),
                'size' => $file->getSize(),
                'exists' => $exists,
            ]);
            if ($exists === false) {
                Log::warning('UploadManager: upload verification failed (raw fallback)', [
                    'disk' => $disk,
                    'path' => $path,
                ]);
            }
            return $path;
        }
    }

    private static function encodeForStorage(ImageInterface $image, UploadedFile $file): array
    {
        return [$image->toWebp(self::IMAGE_QUALITY), 'webp'];
    }

    private static function hasS3Config(): bool
    {
        return (string) config('filesystems.disks.s3.bucket') !== ''
            && (string) config('filesystems.disks.s3.key') !== ''
            && (string) config('filesystems.disks.s3.secret') !== '';
    }
}
