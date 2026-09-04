<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class UserRepositoryTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_model_has_created_by_fillable(): void
    {
        // Use reflection to get the $fillable property directly
        // Create a User instance since fillable is an instance property
        $user = new User();
        $reflection = new \ReflectionClass($user);
        $property = $reflection->getProperty('fillable');
        $property->setAccessible(true);
        $fillable = $property->getValue($user);

        $this->assertContains('created_by', (array) $fillable);
    }

    public function test_created_by_column_exists_on_users_table(): void
    {
        $schema = Schema::getColumnType('users', 'created_by');
        $this->assertTrue(
            str_starts_with($schema, 'big') || $schema === 'integer',
            'Expected biginteger or integer, got: ' . $schema
        );
    }

    public function test_user_service_create_user_includes_created_by(): void
    {
        $user = User::create([
            'fullname' => 'Test User',
            'email' => 'test_' . uniqid() . '@example.test',
            'password' => 'password',
            'role' => User::ROLE_CLIENT,
            'created_by' => 1,
        ]);

        $this->assertEquals(1, $user->created_by);
    }

    public function test_user_service_create_user_without_created_by(): void
    {
        $user = User::create([
            'fullname' => 'Test User',
            'email' => 'test2_' . uniqid() . '@example.test',
            'password' => 'password',
            'role' => User::ROLE_CLIENT,
        ]);

        $this->assertNull($user->created_by);
    }

    public function test_paginate_for_management_method_exists_on_repository(): void
    {
        $this->assertTrue(
            method_exists(\App\Repositories\UserRepository::class, 'paginateForManagement'),
            'UserRepository should have paginateForManagement method'
        );
    }
}