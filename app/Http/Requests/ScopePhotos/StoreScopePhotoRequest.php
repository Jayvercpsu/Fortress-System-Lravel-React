<?php

namespace App\Http\Requests\ScopePhotos;

use App\Models\User;
use App\Support\Uploads\UploadManager;
use Illuminate\Foundation\Http\FormRequest;

class StoreScopePhotoRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() instanceof User;
    }

    public function rules(): array
    {
        return [
            'photo' => ['required', 'image', UploadManager::maxRule()],
            'caption' => ['nullable', 'string', 'max:255'],
        ];
    }
}
