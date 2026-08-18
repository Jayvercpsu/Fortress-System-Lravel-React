<?php
namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder {
    public function run(): void {
        User::updateOrCreate([
            'email'    => 'masteradmin@buildbooks.com',
        ], [
            'fullname' => 'Master Administrator',
            'password' => Hash::make('password'),
            'role'     => 'master_admin',
        ]);

        User::updateOrCreate([
            'email'    => 'headadmin@buildbooks.com',
        ], [
            'fullname' => 'Head Administrator',
            'password' => Hash::make('password'),
            'role'     => 'head_admin',
        ]);

        User::updateOrCreate([
            'email'    => 'admin@buildbooks.com',
        ], [
            'fullname' => 'Administrator',
            'password' => Hash::make('password'),
            'role'     => 'admin',
        ]);

        User::updateOrCreate([
            'email'    => 'hr@buildbooks.com',
        ], [
            'fullname' => 'HR Personnel',
            'password' => Hash::make('password'),
            'role'     => 'hr',
        ]);

        User::updateOrCreate([
            'email'    => 'foreman@buildbooks.com',
        ], [
            'fullname' => 'Foreman',
            'password' => Hash::make('password'),
            'role'     => 'foreman',
        ]);

        User::updateOrCreate([
            'email'    => 'designer@buildbooks.com',
        ], [
            'fullname' => 'Designer',
            'password' => Hash::make('password'),
            'role'     => 'designer',
        ]);
    }
}
