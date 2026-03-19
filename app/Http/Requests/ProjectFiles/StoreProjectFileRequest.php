<?php

namespace App\Http\Requests\ProjectFiles;

use App\Models\User;
use App\Support\Uploads\UploadManager;
use Illuminate\Foundation\Http\FormRequest;

class StoreProjectFileRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() instanceof User;
    }

    public function rules(): array
    {
        return [
            'file' => ['required', 'file', UploadManager::maxRule()],
        ];
    }
}
