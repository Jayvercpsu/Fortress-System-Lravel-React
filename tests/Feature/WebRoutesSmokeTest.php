<?php

namespace Tests\Feature;

use App\Models\ProgressSubmitToken;
use App\Models\Project;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * Browses every GET page of the app and asserts none of them errors.
 *
 * Fully dynamic: route URIs, required roles, and parameters are all derived
 * from the registered route collection, so newly added pages are covered
 * automatically with no map to maintain. A page passes when it renders,
 * redirects, or denies access — it fails only on server errors (5xx).
 */
class WebRoutesSmokeTest extends TestCase
{
    use RefreshDatabase;

    private const SKIPPED_URIS = ['/', 'up', 'storage/{path}'];

    public function test_browsing_every_page_returns_no_server_error(): void
    {
        $fx = $this->makeFixtures();
        $tempFiles = [];
        $checked = 0;

        try {
            foreach (Route::getRoutes()->getRoutes() as $route) {
                if (!in_array('GET', $route->methods(), true)) {
                    continue;
                }
                $uri = $route->uri();
                if (in_array($uri, self::SKIPPED_URIS, true)) {
                    continue;
                }

                $role = $this->roleForRoute($route);
                $url = $this->fillPlaceholders($uri, $fx, $tempFiles);
                $user = $role !== null ? $fx['users'][$role] : null;

                $response = $user
                    ? $this->actingAs($user)->get($url)
                    : $this->get($url);

                $status = $response->getStatusCode();
                $this->assertTrue(
                    $status < 500,
                    "GET {$url} as [" . ($role ?? 'guest') . "] returned {$status}"
                );
                $checked++;
            }
        } finally {
            foreach ($tempFiles as $path) {
                Storage::disk('public')->delete($path);
            }
        }

        $this->assertGreaterThan(50, $checked, 'Expected to browse dozens of pages');
    }

    /**
     * First role listed in the route's role middleware, or null for public pages.
     */
    private function roleForRoute(\Illuminate\Routing\Route $route): ?string
    {
        foreach ($route->gatherMiddleware() as $middleware) {
            if (is_string($middleware) && str_starts_with($middleware, 'role:')) {
                $roles = explode(',', substr($middleware, strlen('role:')));
                return trim($roles[0]);
            }
        }

        return null;
    }

    private function fillPlaceholders(string $uri, array $fx, array &$tempFiles): string
    {
        $url = str_replace(
            ['{project}', '{user}', '{token}'],
            [$fx['project']->id, $fx['users']['foreman']->id, $fx['token']->token],
            $uri
        );

        if (str_contains($url, '{path}')) {
            $path = 'smoke-' . uniqid() . '.txt';
            Storage::disk('public')->put($path, 'smoke test file');
            $tempFiles[] = $path;
            $url = str_replace('{path}', $path, $url);
        }

        return '/' . ltrim($url, '/');
    }

    private function makeFixtures(): array
    {
        $roles = [];
        foreach (Route::getRoutes()->getRoutes() as $route) {
            if (!in_array('GET', $route->methods(), true)) {
                continue;
            }
            $role = $this->roleForRoute($route);
            if ($role !== null) {
                $roles[$role] = true;
            }
        }

        $users = [];
        foreach (array_keys($roles) as $role) {
            $users[$role] = User::create([
                'fullname' => ucfirst($role) . ' Smoke',
                'username' => $role === 'client' ? 'smoke_client_' . uniqid() : null,
                'email' => str_replace(' ', '_', $role) . '_' . uniqid() . '@example.test',
                'password' => Hash::make('password'),
                'role' => $role,
            ]);
        }

        $project = Project::create([
            'name' => 'Smoke Project',
            'client' => 'Smoke Client Inc.',
            'type' => 'Residential',
            'location' => 'Cebu City',
            'phase' => 'Construction',
            'status' => 'active',
            'overall_progress' => 0,
            'user_id' => $users['head_admin']->id ?? null,
        ]);

        $token = ProgressSubmitToken::create([
            'project_id' => $project->id,
            'foreman_id' => $users['foreman']->id ?? null,
            'token' => 'pst_' . bin2hex(random_bytes(16)),
            'expires_at' => null,
        ]);

        return ['users' => $users, 'project' => $project, 'token' => $token];
    }
}
