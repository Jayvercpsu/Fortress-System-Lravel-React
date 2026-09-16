<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Settings\UpdateSettingsRequest;
use App\Models\Project;
use App\Models\User;
use App\Models\UserDetail;
use App\Services\PmProgressService;
use App\Services\ProjectManagerApiTokenService;
use App\Services\ProjectService;
use App\Services\SettingsService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;

class ProjectManagerAuthController extends Controller
{
    private const LOGIN_MAX_ATTEMPTS = 5;
    private const LOGIN_DECAY_SECONDS = 60;

    public function __construct(
        private readonly ProjectManagerApiTokenService $tokens,
        private readonly ProjectService $projectService,
        private readonly PmProgressService $pmProgressService
    ) {
    }

    public function login(Request $request)
    {
        $credentials = $request->validate([
            'email' => 'required|email',
            'password' => 'required|string',
        ]);

        $throttleKey = 'pm_api_login|'.Str::lower($credentials['email']).'|'.$request->ip();
        if (RateLimiter::tooManyAttempts($throttleKey, self::LOGIN_MAX_ATTEMPTS)) {
            return response()->json([
                'message' => 'Too many login attempts. Please try again in '.RateLimiter::availableIn($throttleKey).' seconds.',
            ], 429);
        }

        $user = User::where('email', $credentials['email'])->first();

        if (!$user || !Hash::check($credentials['password'], $user->password)) {
            RateLimiter::hit($throttleKey, self::LOGIN_DECAY_SECONDS);

            return response()->json(['message' => 'Invalid login credentials. Please try again.'], 422);
        }

        if ($user->role !== User::ROLE_PROJECT_MANAGER) {
            RateLimiter::hit($throttleKey, self::LOGIN_DECAY_SECONDS);

            return response()->json(['message' => 'This account is not a project manager account.'], 403);
        }

        RateLimiter::clear($throttleKey);

        $expiresAt = $this->tokens->expiresAt();

        return response()->json([
            'token' => $this->tokens->issue($user),
            'token_type' => 'Bearer',
            'expires_in_minutes' => ProjectManagerApiTokenService::TOKEN_TTL_MINUTES,
            'expires_at' => $expiresAt->toIso8601String(),
            'server_time' => now()->toIso8601String(),
            'user' => $this->userPayload($user),
            'projects' => $this->visibleProjects((int) $user->id),
        ]);
    }

    public function me(Request $request)
    {
        $user = $request->user();

        return response()->json([
            'user' => $this->userPayload($user),
            'projects' => $this->visibleProjects((int) $user->id),
            'server_time' => now()->toIso8601String(),
        ]);
    }

    public function projects(Request $request)
    {
        return response()->json([
            'projects' => $this->visibleProjects((int) $request->user()->id),
        ]);
    }

    public function logout()
    {
        // Stateless encrypted tokens are discarded client-side.
        return response()->json(['message' => 'Logged out.']);
    }

    public function settings(Request $request, SettingsService $settings)
    {
        return response()->json([
            'account' => $this->accountWithPhotoUrl(
                $settings->getSettingsPayload($request->user())
            ),
            'sex_options' => UserDetail::sexOptions(),
            'server_time' => now()->toIso8601String(),
        ]);
    }

    public function updateSettings(UpdateSettingsRequest $request, SettingsService $settings)
    {
        $settings->updateSettings($request->user(), $request->validated());

        return response()->json([
            'message' => 'Settings updated.',
            'account' => $this->accountWithPhotoUrl(
                $settings->getSettingsPayload($request->user()->fresh())
            ),
        ]);
    }

    public function updatePhoto(Request $request, SettingsService $settings)
    {
        $validated = $request->validate([
            'photo' => ['required', 'image', 'mimes:jpg,jpeg,png,gif,webp', 'max:10240'],
        ]);

        $user = $request->user()->load('detail');
        $path = $settings->updateProfilePhoto($user, $validated['photo']);

        return response()->json([
            'message' => 'Profile photo updated.',
            'profile_photo_path' => $path,
            'profile_photo_url' => $this->profilePhotoUrl($path),
            'account' => $this->accountWithPhotoUrl(
                $settings->getSettingsPayload($user->fresh())
            ),
        ]);
    }

    private function userPayload(User $user): array
    {
        $user->loadMissing('detail');
        $photoPath = $user->detail?->profile_photo_path ?? '';

        return [
            'id' => $user->id,
            'fullname' => $user->fullname,
            'email' => $user->email,
            'role' => $user->role,
            'profile_photo_path' => $photoPath,
            'profile_photo_url' => $this->profilePhotoUrl($photoPath),
        ];
    }

    private function profilePhotoUrl(string $path): string
    {
        $path = trim($path);
        if ($path === '') {
            return '';
        }

        return url('/files/'.ltrim($path, '/'));
    }

    private function accountWithPhotoUrl(array $account): array
    {
        $account['profile_photo_url'] = $this->profilePhotoUrl(
            (string) ($account['profile_photo_path'] ?? '')
        );

        return $account;
    }

    /**
     * Projects assigned to the PM: construction-phase projects carrying a
     * project_manager assignment for this user, with strictly PM-based
     * overall progress (0 when the PM side has no data yet).
     */
    private function visibleProjects(int $pmUserId): array
    {
        $assignedIds = $this->projectService->assignedProjectIdsForPm($pmUserId);

        $projects = Project::query()
            ->where('phase', Project::PHASE_CONSTRUCTION)
            ->whereIn('id', $assignedIds)
            ->orderBy('name')
            ->get(['id', 'name', 'client', 'location', 'phase', 'status']);

        if ($projects->isEmpty()) {
            return [];
        }

        $pmProgressByProject = $this->pmProgressService->progressByProjectIds(
            $projects->pluck('id')->all()
        );

        return $projects
            ->map(function (Project $project) use ($pmProgressByProject) {
                $location = trim((string) ($project->location ?? ''));
                if ($location === '') {
                    $location = trim((string) ($project->client ?? ''));
                }

                return [
                    'id' => $project->id,
                    'name' => $project->name,
                    'location' => $location,
                    'client' => $project->client,
                    'phase' => $project->phase,
                    'status' => $project->status,
                    'overall_progress' => $pmProgressByProject[(int) $project->id] ?? 0.0,
                ];
            })
            ->values()
            ->all();
    }
}
