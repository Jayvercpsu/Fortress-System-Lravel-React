<?php

namespace App\Http\Requests\MonitoringBoards;

use App\Models\User;
use App\Support\Uploads\UploadManager;
use Illuminate\Foundation\Http\FormRequest;

class StoreMonitoringBoardFileRequest extends FormRequest
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
