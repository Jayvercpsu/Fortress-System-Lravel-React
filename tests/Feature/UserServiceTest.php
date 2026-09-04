<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\UserService;
use App\Repositories\Contracts\UserRepositoryInterface;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class UserServiceTest extends TestCase
{
    use RefreshDatabase;

    private UserService $userService;

    protected function setUp(): void
    {
        parent::setUp();
        $this->userService = new UserService(app(UserRepositoryInterface::class));
    }

    public function test_create_user_includes_created_by(): void
    {
        $validated = [
            'fullname' => 'Test User',
            'email' => 'test_' . uniqid() . '@example.test',
            'password' => 'password',
            'role' => User::ROLE_CLIENT,
            'created_by' => 1,
        ];

        $this->userService->createUser($validated);

        $user = User::where('email', $validated['email'])->first();
        $this->assertNotNull($user);
        $this->assertEquals(1, $user->created_by);
    }

    public function test_create_user_without_created_by(): void
    {
        $validated = [
            'fullname' => 'Test User',
            'email' => 'test2_' . uniqid() . '@example.test',
            'password' => 'password',
            'role' => User::ROLE_CLIENT,
        ];

        $this->userService->createUser($validated);

        $user = User::where('email', $validated['email'])->first();
        $this->assertNotNull($user);
        $this->assertNull($user->created_by);
    }
}