<?php

namespace App\Http\Controllers;

use App\Http\Requests\Settings\UpdateSettingsRequest;
use App\Services\SettingsService;
use Illuminate\Http\Request;
use Inertia\Inertia;

class SettingsController extends Controller
{
    public function __construct(
        private readonly SettingsService $settingsService
    ) {
    }

    public function index(Request $request)
    {
        return Inertia::render('Settings/Index', [
            'account' => $this->settingsService->getSettingsPayload($request->user()),
        ]);
    }

    public function update(UpdateSettingsRequest $request)
    {
        $this->settingsService->updateSettings($request->user(), $request->validated());

        return redirect()->route('settings.index')->with('success', __('messages.settings.updated'));
    }
}
