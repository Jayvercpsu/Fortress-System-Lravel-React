<?php

namespace App\Http\Requests\Payrolls;

use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;

class UpdateDefaultRateRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() instanceof User;
    }

    public function rules(): array
    {
        return [
            'default_rate_per_hour' => ['required', 'numeric', 'min:0'],
        ];
    }
}
